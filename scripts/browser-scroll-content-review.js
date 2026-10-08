async (page) => {
  await page.mouse.up();
  await page.reload();
  await page.setViewportSize({ width: 700, height: 850 });
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
    host.id = 'scroll-content-fixture';
    document.body.append(host);
    const tail = document.createElement('div');
    tail.style.height = '1000px';
    document.body.append(tail);
    const resources = Array.from({ length: 8 }, (_, i) => ({
      id: 'room' + i,
      title: 'Sala ' + i,
      capacity: false,
    }));
    const event = {
      id: 'long',
      calendarId: 'c',
      title: 'Atendimento longo',
      resourceIds: ['room0'],
      time: {
        allDay: false,
        start: { dateTime: '2026-10-07T08:00:00', timeZone: 'UTC' },
        end: { dateTime: '2026-10-07T20:00:00', timeZone: 'UTC' },
      },
    };
    const allDay = {
      id: 'allday',
      calendarId: 'c',
      title: 'Congresso',
      resourceIds: ['room0'],
      time: { allDay: true, start: { date: '2026-10-07' }, end: { date: '2026-10-08' } },
    };
    const app = new CalendarApp({
      temporal: await ensureTemporal(),
      date: '2026-10-07',
      view: 'resources',
      resources,
      events: [event],
      views: [...BUILTIN_VIEWS, createResourceDayView(resources), createTimelineView(resources)],
      options: {
        timeZone: 'UTC',
        startHour: 7,
        endHour: 21,
        pxPerMinute: 2,
        defaultResourceCapacity: false,
      },
      onEventClick: () => {
        window.scrollEventClicks = (window.scrollEventClicks ?? 0) + 1;
      },
    });
    app.mount(host);
    await app.ready();
    window.scrollApp = app;
    window.scrollEvents = [event, allDay];
  });
  const root = page.locator('#scroll-content-fixture');
  const frames = () =>
    page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const scroller = root.locator('[data-mc-hscroll]');
  await scroller.evaluate((n) =>
    window.scrollTo(0, n.getBoundingClientRect().top + window.scrollY + 500),
  );
  await frames();
  await page.evaluate(() => window.scrollApp.setEvents(window.scrollEvents));
  await frames();
  const allDay = root.locator('.mc-resource-allday-row');
  const sticky = await allDay.evaluate((n) => ({
    top: n.getBoundingClientRect().top,
    fixed: getComputedStyle(n).position,
    height: n.getBoundingClientRect().height,
  }));
  if (sticky.fixed !== 'fixed' || sticky.top < 0 || sticky.top > 100)
    throw new Error('New allDay band not pinned ' + JSON.stringify(sticky));
  const title = root.locator('[data-mc-event^="long@"] .mc-event-content');
  const vertical = await title.boundingBox();
  if (vertical.y < sticky.top + sticky.height - 1 || vertical.y > sticky.top + sticky.height + 8)
    throw new Error('Long title behind pinned band');
  const allEvent = root.locator('[data-mc-event^="allday@"]');
  await allEvent.click();
  if ((await page.evaluate(() => window.scrollEventClicks)) !== 1)
    throw new Error('Pinned allDay event not interactive');
  await page.evaluate(() => window.scrollApp.setEvents([window.scrollEvents[0]]));
  await frames();
  if ((await allDay.count()) !== 0) throw new Error('Removed band remains');
  await page.evaluate(() => window.scrollApp.setEvents(window.scrollEvents));
  await frames();
  if ((await allDay.evaluate((n) => getComputedStyle(n).position)) !== 'fixed')
    throw new Error('Recreated band not pinned');
  await page.screenshot({ path: 'output/playwright/sticky-allday-long-title.png' });
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    window.scrollApp.changeView('timeline');
  });
  await frames();
  await root.locator('[data-mc-hscroll]').evaluate((n) => {
    n.scrollLeft = 650;
  });
  await frames();
  const horizontal = await root.locator('[data-mc-event^="long@"] .mc-event-content').boundingBox();
  const label = await root.locator('.mc-timeline-label').first().boundingBox();
  if (horizontal.x < label.x + label.width - 1 || horizontal.x > label.x + label.width + 10)
    throw new Error(
      'Long timeline content lost behind label ' + JSON.stringify({ horizontal, label }),
    );
  await page.screenshot({ path: 'output/playwright/timeline-long-title-scroll.png' });
  return { sticky, verticalTitle: vertical.y, horizontalTitle: horizontal.x };
};
