async (page) => {
  await page.goto('http://127.0.0.1:5180/examples/react.html');
  await page.setViewportSize({ width: 800, height: 800 });
  await page.evaluate(async () => {
    const calendar = await import('/src/index.ts');
    const host = document.createElement('div');
    host.style.cssText = 'width:500px;margin:200px auto 0';
    document.body.replaceChildren(host);
    const spacer = document.createElement('div');
    spacer.style.height = '1000px';
    document.body.append(spacer);
    const app = new calendar.CalendarApp({
      temporal: await calendar.ensureTemporal(),
      date: '2026-10-07',
      view: 'timeline',
      views: [
        ...calendar.BUILTIN_VIEWS,
        calendar.createTimelineView([{ id: 'room', title: 'Room' }]),
      ],
      resources: [{ id: 'room', title: 'Room' }],
      options: {
        direction: 'rtl',
        locale: 'en-US',
        timeZone: 'UTC',
        startHour: 8,
        endHour: 18,
        pxPerMinute: 2,
      },
      events: [
        {
          id: 'rtl',
          title: 'RTL appointment',
          calendarId: 'c',
          resourceIds: ['room'],
          time: {
            allDay: false,
            start: { dateTime: '2026-10-07T09:00', timeZone: 'UTC' },
            end: { dateTime: '2026-10-07T10:00', timeZone: 'UTC' },
          },
        },
      ],
    });
    app.mount(host);
    await app.ready();
    window.rtlApp = app;
  });
  await page.locator('[data-mc-event^="rtl@"]').waitFor();
  const geometry = await page.evaluate(() => {
    const root = document.querySelector('[data-mc-root]');
    const labels = [...root.querySelectorAll('.mc-timeline-hour')];
    const start = labels
      .find((label) => label.textContent.includes('08:00'))
      ?.getBoundingClientRect();
    const later = labels
      .find((label) => label.textContent.includes('10:00'))
      ?.getBoundingClientRect();
    const scroller = root.querySelector('[data-mc-hscroll]');
    scroller.scrollLeft = -250;
    return {
      direction: getComputedStyle(root).direction,
      start: start?.x,
      later: later?.x,
      scroll: scroller.scrollLeft,
    };
  });
  if (geometry.direction !== 'rtl' || !(geometry.start > geometry.later) || geometry.scroll >= 0)
    throw new Error(`RTL timeline geometry failed: ${JSON.stringify(geometry)}`);
  await page.screenshot({ path: 'output/layout-review/rtl-layout.png' });
  await page.evaluate(() => window.scrollTo(0, 350));
  await page.waitForTimeout(150);
  const alignment = await page.evaluate(() => {
    const scroller = document.querySelector('[data-mc-hscroll]');
    const overlay = document.querySelector('.mc-page-sticky-header');
    const corner = overlay?.querySelector('.mc-page-sticky-corner');
    return corner
      ? {
          delta: Math.abs(
            corner.getBoundingClientRect().right - scroller.getBoundingClientRect().right,
          ),
          corner: corner.getBoundingClientRect().toJSON(),
          viewport: scroller.getBoundingClientRect().toJSON(),
          overlay: overlay.getBoundingClientRect().toJSON(),
          transform: corner.style.transform,
        }
      : { delta: Infinity };
  });
  if (alignment.delta > 2)
    throw new Error(`RTL pinned resource label drifted: ${JSON.stringify(alignment)}`);
  await page.screenshot({ path: 'output/layout-review/rtl-timeline.png' });
  return {
    geometry,
    alignment,
    scope: 'Chromium timeline direction, negative scroll and pinned label',
  };
};
