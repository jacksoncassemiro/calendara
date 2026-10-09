async (page) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await page.reload();
  await page.locator('[data-mc-root]').waitFor();
  await page.evaluate(async () => {
    const {
      BUILTIN_VIEWS,
      CalendarApp,
      ensureTemporal,
      createResourceDayView,
      createTimelineView,
    } = await import('/src/index.ts');
    document.querySelector('main').style.display = 'none';
    const host = document.createElement('div');
    host.id = 'clinician-fixture';
    document.body.append(host);
    const resources = [
      { id: 'triage', title: 'Triagem', capacity: 3 },
      { id: 'collection', title: 'Coleta', capacity: 3 },
    ];
    const night = {
      id: 'night',
      calendarId: 'c',
      title: 'Plantão completo 19h–09h',
      resourceIds: ['triage'],
      time: {
        allDay: false,
        start: { dateTime: '2026-10-07T19:00:00', timeZone: 'UTC' },
        end: { dateTime: '2026-10-08T09:00:00', timeZone: 'UTC' },
      },
    };
    const congress = {
      id: 'congress',
      calendarId: 'c',
      title: 'Capacitação',
      resourceIds: ['triage'],
      time: { allDay: true, start: { date: '2026-10-07' }, end: { date: '2026-10-09' } },
    };
    window.clinicianEvents = { night, congress };
    window.clinicianLog = [];
    const app = new CalendarApp({
      temporal: await ensureTemporal(),
      date: '2026-10-07',
      view: 'resources',
      resources,
      events: [night],
      views: [...BUILTIN_VIEWS, createResourceDayView(resources), createTimelineView(resources)],
      options: { timeZone: 'UTC', startHour: 7, endHour: 21, pxPerMinute: 2 },
      onEventDrop: (change) => window.clinicianLog.push(change),
      onEventResize: (change) => window.clinicianLog.push(change),
    });
    app.mount(host);
    await app.ready();
    window.clinicianApp = app;
  });
  const root = page.locator('#clinician-fixture');
  const state = async () =>
    root.evaluate(async (host) => {
      const scroll = host.querySelector('[data-mc-hscroll]');
      window.scrollTo(0, scroll.getBoundingClientRect().top + window.scrollY + 400);
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const all = scroll.querySelector('.mc-resource-allday-row');
      return {
        fixed: all ? getComputedStyle(all).position === 'fixed' : false,
        placeholders: scroll.querySelectorAll('.mc-page-allday-placeholder').length,
        congress: host.querySelectorAll('[data-mc-event^="congress@"]').length,
      };
    });
  // Async assignments must preserve the visible day. / PT: Atribuições assíncronas devem preservar o dia visível.
  await state();
  await page.evaluate(() => window.clinicianApp.setEvents(Object.values(window.clinicianEvents)));
  await root.locator('[data-mc-event^="congress@"]').waitFor();
  const loaded = await state();
  if (!loaded.fixed || loaded.congress !== 1 || loaded.placeholders !== 1)
    throw new Error(`Faixa inserida em scroll: ${JSON.stringify(loaded)}`);
  await page.evaluate(() => window.clinicianApp.setEvents([window.clinicianEvents.night]));
  const removed = await state();
  if (removed.congress !== 0 || removed.placeholders !== 0)
    throw new Error(`Faixa removida deixou geometria residual: ${JSON.stringify(removed)}`);
  // Moving a fragment preserves the overnight duration. / PT: Mover um trecho preserva a duração noturna.
  await page.evaluate(() => window.scrollTo(0, 0));
  const event = root.locator('[data-mc-resource="triage"] [data-mc-event^="night@"]');
  await event.scrollIntoViewIfNeeded();
  const from = await event.boundingBox(),
    target = await root.locator('[data-mc-resource="collection"][data-mc-slot]').boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + 20);
  await page.mouse.down();
  await page.mouse.move(target.x + target.width / 2, from.y + 20, { steps: 8 });
  await page.mouse.up();
  await root.locator('[data-mc-resource="collection"] [data-mc-event^="night@"]').waitFor();
  const moved = await page.evaluate(() => window.clinicianLog.at(-1));
  if (
    moved.resourceId !== 'collection' ||
    moved.startMin !== 1140 ||
    moved.endMin !== 540 ||
    moved.endDateISO !== '2026-10-08'
  )
    throw new Error(`Transferência truncou plantão: ${JSON.stringify(moved)}`);
  await page.evaluate(() => window.clinicianApp.changeView('month'));
  const dates = await root
    .locator('[data-mc-month-event^="night@"]')
    .getAttribute('data-mc-month-dates');
  if (dates !== '2026-10-07 2026-10-08')
    throw new Error(`Troca de view perdeu intervalo: ${dates}`);
  await page.evaluate(() => {
    window.clinicianApp.setOptions({ startHour: 0, endHour: 24 });
    window.clinicianApp.changeView('timeline');
  });
  await root.locator('[data-mc-event^="night@"]').waitFor();
  const horizontal = await root.evaluate(async (host) => {
    const scroll = host.querySelector('[data-mc-hscroll]');
    window.scrollTo(0, 0);
    scroll.scrollLeft = scroll.scrollWidth - scroll.clientWidth;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const event = host.querySelector('[data-mc-event^="night@"]'),
      content = event.querySelector('.mc-event-content');
    const viewport = scroll.getBoundingClientRect(),
      label = host.querySelector('.mc-timeline-label').getBoundingClientRect(),
      text = content.getBoundingClientRect(),
      bar = event.getBoundingClientRect();
    return {
      textLeft: text.left,
      visibleLeft: viewport.left + label.width,
      eventRight: bar.right,
      textRight: text.right,
    };
  });
  if (
    horizontal.textLeft < horizontal.visibleLeft - 1 ||
    horizontal.textRight > horizontal.eventRight + 1
  )
    throw new Error(`Título de plantão oculto atrás da sala: ${JSON.stringify(horizontal)}`);
  return { loaded, removed, moved, horizontal };
};
