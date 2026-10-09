async (page) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.mouse.up();
  await page.reload();
  await page.setViewportSize({ width: 1200, height: 950 });
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
    host.id = 'feature-fixture';
    document.body.append(host);
    const resources = [{ id: 'triage', title: 'Triagem', capacity: 4 }];
    const events = Array.from({ length: 8 }, (_, i) => ({
      id: 'dense' + i,
      calendarId: 'c',
      title: 'Agendamento ' + i,
      resourceIds: ['triage'],
      time: {
        allDay: false,
        start: { dateTime: '2026-10-07T09:00:00', timeZone: 'UTC' },
        end: { dateTime: '2026-10-07T10:00:00', timeZone: 'UTC' },
      },
    }));
    const app = new CalendarApp({
      temporal: await ensureTemporal(),
      date: '2026-10-07',
      view: 'day',
      events,
      resources,
      views: [...BUILTIN_VIEWS, createResourceDayView(resources), createTimelineView(resources)],
      options: { timeZone: 'UTC', startHour: 8, endHour: 18, pxPerMinute: 1.5, monthMaxEvents: 3 },
      onEventClick: () => {
        window.clicked = (window.clicked ?? 0) + 1;
      },
    });
    app.mount(host);
    await app.ready();
    window.featureApp = app;
  });
  const root = page.locator('#feature-fixture');
  const set = (options) =>
    page.evaluate((options) => window.featureApp.setOptions(options), options);
  const view = (name) => page.evaluate((name) => window.featureApp.changeView(name), name);
  const drag = async ({ source, target }) => {
    await source.scrollIntoViewIfNeeded();
    await target.scrollIntoViewIfNeeded();
    const a = await source.boundingBox(),
      b = await target.boundingBox();
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2, b.y + 2, { steps: 12 });
  };
  await set({ timedEventOverflow: 'scroll', minEventWidth: 180 });
  const wide = await root.locator('[data-mc-day]').boundingBox();
  if (wide.width < 1440) throw new Error('Coluna densa não ampliou');
  await set({ timedEventOverflow: 'more', eventMaxStack: 3 });
  if ((await root.locator('[data-mc-event]').count()) !== 2)
    throw new Error('Limite visual não agrupou excesso');
  await root.locator('[data-mc-more]').click();
  await root.locator('.mc-month-popover').waitFor();
  if ((await root.locator('.mc-month-popover [data-mc-event]').count()) !== 6)
    throw new Error('Popover não contém todos os ocultos');
  const popupEvent = root.locator('.mc-month-popover [data-mc-event^="dense2@"]');
  await drag({ source: popupEvent, target: root.locator('[data-mc-cell-start="660"]') });
  await root.locator('[data-mc-draft]').waitFor();
  if (
    await root
      .locator('[data-mc-event^="dense2@"]')
      .evaluateAll((nodes) =>
        nodes.some(
          (node) =>
            getComputedStyle(node).visibility === 'visible' && !node.closest('.mc-month-popover'),
        ),
      )
  )
    throw new Error('Origem duplicada na prévia');
  await page.mouse.up();
  await page.waitForFunction(() =>
    document.querySelector('[data-mc-event^="dense2@"][data-mc-start-min="660"]'),
  );
  await page.keyboard.press('Escape');
  await set({ timedEventOverflow: 'shrink' });
  const moved = root.locator('[data-mc-event^="dense2@"]');
  await drag({
    source: moved.locator('[data-mc-resize="start"]'),
    target: root.locator('[data-mc-cell-start="630"]'),
  });
  await page.mouse.up();
  await page.waitForFunction(() =>
    document.querySelector(
      '[data-mc-event^="dense2@"][data-mc-start-min="630"][data-mc-end-min="720"]',
    ),
  );
  await view('month');
  await root.locator('[data-mc-month-day="2026-10-07"] .mc-month-more').click();
  await root.locator('.mc-month-popover').waitFor();
  const monthPopup = root.locator('.mc-month-popover [data-mc-event^="dense3@"]');
  await drag({ source: monthPopup, target: root.locator('[data-mc-month-day="2026-10-09"]') });
  await root.locator('[data-mc-draft]').waitFor();
  await page.mouse.up();
  await page.keyboard.press('Escape');
  await page.waitForFunction(() =>
    document.querySelector('[data-mc-month-event^="dense3@"][data-mc-month-dates="2026-10-09"]'),
  );
  // Capacity is independent of visual grouping. / PT: Capacidade independe do agrupamento visual.
  const capacity = await page.evaluate(() =>
    window.featureApp.evaluatePlacement({
      dateISO: '2026-10-07',
      startMin: 540,
      endMin: 600,
      resourceId: 'triage',
    }),
  );
  if (capacity.valid) throw new Error('Capacidade 4 não recusou a quinta reserva');
  await page.evaluate(() =>
    window.featureApp.setResources([{ id: 'triage', title: 'Triagem', capacity: 10 }]),
  );
  const allowed = await page.evaluate(() =>
    window.featureApp.evaluatePlacement({
      dateISO: '2026-10-07',
      startMin: 540,
      endMin: 600,
      resourceId: 'triage',
    }),
  );
  if (!allowed.valid) throw new Error('Aumento de capacidade não permitiu concorrência');
  await page.evaluate(() =>
    window.featureApp.setDayStyle(({ dateISO }) =>
      dateISO === '2026-10-09' ? { backgroundColor: '#fee2e2' } : undefined,
    ),
  );
  const bg = await root
    .locator('[data-mc-month-day="2026-10-09"]')
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  if (bg !== 'rgb(254, 226, 226)') throw new Error('Decoração do dia não aplicada');
  await page.evaluate(() => {
    window.featureApp.setResources([{ id: 'triage', title: 'Triagem' }]);
    window.featureApp.setOptions({ defaultResourceCapacity: 4 });
  });
  const evaluate = () =>
    page.evaluate(() =>
      window.featureApp.evaluatePlacement({
        dateISO: '2026-10-07',
        startMin: 540,
        endMin: 600,
        resourceId: 'triage',
      }),
    );
  if ((await evaluate()).valid) throw new Error('Recurso não herdou padrão global 4');
  await set({ defaultResourceCapacity: false });
  if (!(await evaluate()).valid) throw new Error('Padrão ilimitado não aplicado');
  await page.evaluate(() =>
    window.featureApp.setResources([{ id: 'triage', title: 'Triagem', capacity: 2 }]),
  );
  if ((await evaluate()).valid) throw new Error('Limite próprio não substituiu padrão ilimitado');
  await page.evaluate(() => {
    window.featureApp.setResources([{ id: 'triage', title: 'Triagem', capacity: false }]);
    window.featureApp.setOptions({ defaultResourceCapacity: 1 });
  });
  if (!(await evaluate()).valid) throw new Error('Sala ilimitada não substituiu padrão global 1');
  const freeStatus = await page.evaluate(() =>
    window.featureApp.evaluatePlacement({
      dateISO: '2026-10-09',
      startMin: 540,
      endMin: 600,
      resourceId: 'triage',
    }),
  );
  if (!freeStatus.valid) throw new Error('Decoração visual bloqueou agendamento');
  await page.screenshot({
    path: 'output/layout-review/features-month-popover-drag.png',
    fullPage: true,
  });
  await page.evaluate(() =>
    window.featureApp.setEvents([
      {
        id: 'convert',
        calendarId: 'c',
        title: 'Conversão',
        resourceIds: ['triage'],
        time: {
          allDay: false,
          start: { dateTime: '2026-10-07T09:00:00', timeZone: 'UTC' },
          end: { dateTime: '2026-10-07T10:00:00', timeZone: 'UTC' },
        },
      },
    ]),
  );
  await set({ allowEventTypeChange: true });
  await view('week');
  await drag({
    source: root.locator('[data-mc-event^="convert@"]'),
    target: root.locator('[data-mc-allday-cell="2026-10-09"]'),
  });
  await page.mouse.up();
  await page.waitForFunction(() => window.featureApp.getState().events[0].time.allDay === true);
  await drag({
    source: root.locator('[data-mc-allday-event^="convert@"]'),
    target: root.locator('[data-mc-day="2026-10-10"] [data-mc-cell-start="660"]'),
  });
  await page.mouse.up();
  await page.waitForFunction(() => window.featureApp.getState().events[0].time.allDay === false);
  const converted = await page.evaluate(() => window.featureApp.getState().events[0].time);
  if (
    converted.start.dateTime !== '2026-10-10T11:00:00' ||
    converted.end.dateTime !== '2026-10-11T11:00:00' ||
    converted.start.date
  )
    throw new Error('Conversão bidirecional não preservou duração/tipo');
  if (errors.length) throw new Error(errors.join('; '));
  return [
    'Densidade: ampliar/rolar e agrupar +mais',
    'Popover de horários: arraste e resize pelo início',
    'Popover do mês: arraste para outro dia',
    'Prévia não duplica origem',
    'Triagem: capacidade 4 e 10 respeitadas',
  ];
};
