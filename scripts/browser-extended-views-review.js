async (page) => {
  const previousURL = page.url();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.mouse.up();
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.goto(
    'http://127.0.0.1:5180/examples/features.html?demo=resource-week&lang=en&theme=dark',
  );
  await page.waitForSelector('[data-mc-root] [data-mc-slot]');
  const setup = await page.evaluate(async () => {
    const calendar = await import('/src/index.ts');
    document.querySelector('main')?.setAttribute('hidden', '');
    const fixture = document.createElement('div');
    fixture.id = 'extended-fixture';
    fixture.style.cssText = 'width:100%;max-width:1100px;margin:20px auto';
    document.body.append(fixture);
    const resources = [
      { id: 'room', title: 'Room', type: 'Clinic' },
      { id: 'doctor', title: 'Doctor', type: 'Clinic' },
    ];
    const views = [
      calendar.createResourceView({ days: 7, alignment: 'week', name: 'resource-week' }),
      calendar.createResourceTimelineView({
        duration: 'week',
        groupBy: (resource) => resource.type,
        name: 'timeline-week',
      }),
      calendar.createResourceTimelineView({
        duration: 'month',
        name: 'timeline-month',
        resourceWindow: { start: 0, count: 1 },
      }),
      calendar.quarterView,
      calendar.yearView,
      calendar.yearPlannerView,
      calendar.dayAgendaView,
    ];
    const event = {
      id: 'event',
      calendarId: 'fixture',
      title: 'Appointment',
      resourceIds: ['room'],
      time: {
        allDay: false,
        start: { dateTime: '2026-10-07T09:00', timeZone: 'UTC' },
        end: { dateTime: '2026-10-07T10:00', timeZone: 'UTC' },
      },
    };
    const app = new calendar.CalendarApp({
      temporal: await calendar.ensureTemporal(),
      date: '2026-10-07',
      views,
      view: 'resource-week',
      resources,
      events: [event],
      options: { timeZone: 'UTC', locale: 'en-US', startHour: 8, endHour: 18 },
    });
    app.mount(fixture);
    await app.ready();
    window.extendedApp = app;
    return app.listViews().length;
  });
  if (setup !== 7) throw new Error('Extra views must be explicitly registered');
  for (const view of [
    'resource-week',
    'timeline-week',
    'timeline-month',
    'quarter',
    'year',
    'year-planner',
    'day-agenda',
  ]) {
    await page.evaluate((name) => window.extendedApp.changeView(name), view);
    await page.waitForTimeout(100);
    const text = await page.locator('#extended-fixture').innerText();
    if (!text.includes('Appointment')) throw new Error(`Missing event in ${view}`);
    if (
      view === 'quarter' &&
      (await page.locator('#extended-fixture [data-mc-month-panel]').count()) !== 3
    )
      throw new Error('Quarter panels');
    if (
      view === 'year' &&
      (await page.locator('#extended-fixture [data-mc-month-panel]').count()) !== 12
    )
      throw new Error('Year panels');
    if (
      view === 'timeline-month' &&
      (await page.locator('#extended-fixture [data-mc-timeline-date]').count()) !== 31
    )
      throw new Error('Monthly dates');
    await page.screenshot({ path: `output/layout-review/extended-${view}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 360, height: 780 });
  await page.evaluate(() => window.extendedApp.changeView('quarter'));
  await page.waitForTimeout(100);
  const overflow = await page.evaluate(() => {
    const fixture = document.querySelector('#extended-fixture');
    return fixture.scrollWidth > fixture.clientWidth + 2;
  });
  if (overflow) throw new Error('Quarter spills beyond narrow container');
  await page.screenshot({
    path: 'output/layout-review/extended-quarter-mobile.png',
    fullPage: true,
  });
  const printSnapshot = await page.evaluate(async () => {
    let markup = '';
    const append = document.body.append.bind(document.body);
    document.body.append = (...nodes) => {
      const frame = nodes.find((node) => node instanceof HTMLIFrameElement);
      if (frame) markup = frame.srcdoc;
      else append(...nodes);
    };
    try {
      window.extendedApp.changeView('day-agenda');
      window.extendedApp.print({ title: 'Print test', orientation: 'landscape' });
    } finally {
      document.body.append = append;
    }
    return markup;
  });
  if (!printSnapshot.includes('Appointment') || !printSnapshot.includes('size:A4 landscape'))
    throw new Error('Print handle must produce the complete isolated document');
  await page.evaluate(() => window.extendedApp.destroy());
  await page.locator('#extended-fixture').evaluate((fixture) => fixture.remove());
  if (errors.length) throw new Error(errors.join('\n'));
  await page.goto(previousURL);
  console.log('Extended views: seven registered views, desktop and narrow container passed.');
  return 'Seven views and isolated print snapshot passed; native print dialog not exercised.';
};
