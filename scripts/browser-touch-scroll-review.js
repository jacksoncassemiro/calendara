async (page) => {
  const browser = page.context().browser();
  const context = await browser.newContext({
    viewport: { width: 390, height: 800 },
    isMobile: true,
    hasTouch: true,
  });
  const mobile = await context.newPage();
  try {
    await mobile.goto(new URL('/examples/react.html', page.url()).href);
    await mobile.evaluate(async () => {
      const { CalendarApp, BUILTIN_VIEWS, createResourceView, ensureTemporal } =
        await import('/src/index.ts');
      const host = document.createElement('div');
      document.body.replaceChildren(host);
      window.touchCommits = 0;
      window.touchDrafts = 0;
      window.touchTrace = [];
      for (const type of ['pointerdown', 'pointermove', 'pointercancel', 'pointerup'])
        document.addEventListener(type, (event) =>
          window.touchTrace.push({
            type,
            pointer: event.pointerType,
            y: event.clientY,
            target: event.target.closest?.('[data-mc-event]')?.dataset.mcEvent,
          }),
        );
      const app = new CalendarApp({
        temporal: await ensureTemporal(),
        views: [
          ...BUILTIN_VIEWS,
          createResourceView({
            name: 'touch-resources',
            resources: [{ id: 'room', title: 'Room' }],
          }),
        ],
        view: 'day',
        date: '2026-10-07',
        options: { timeZone: 'UTC', startHour: 0, endHour: 24, pxPerMinute: 2 },
        resources: [{ id: 'room', title: 'Room' }],
        events: [
          {
            id: 'touch-event',
            calendarId: 'c',
            title: 'Touch appointment',
            resourceIds: ['room'],
            time: {
              allDay: false,
              start: { dateTime: '2026-10-07T09:00:00', timeZone: 'UTC' },
              end: { dateTime: '2026-10-07T11:00:00', timeZone: 'UTC' },
            },
          },
        ],
        onEventDrop: () => {
          window.touchCommits++;
          window.touchTrace.push('drop');
          return true;
        },
        onSelect: () => {
          window.touchCommits++;
        },
        onDateClick: () => {
          window.touchCommits++;
        },
      });
      app.mount(host);
      window.touchApp = app;
      await app.ready();
      new MutationObserver((records) => {
        for (const record of records)
          for (const node of record.addedNodes)
            if (
              node instanceof Element &&
              (node.matches('[data-mc-draft]') || node.querySelector('[data-mc-draft]'))
            )
              window.touchDrafts++;
      }).observe(host, { childList: true, subtree: true });
    });
    const session = await context.newCDPSession(mobile);
    const touch = ({ type, x, y }) =>
      session.send('Input.dispatchTouchEvent', {
        type,
        touchPoints: type === 'touchEnd' ? [] : [{ x, y, radiusX: 2, radiusY: 2, id: 1 }],
      });
    const event = mobile.locator('[data-mc-event^="touch-event@"]');
    await event.scrollIntoViewIfNeeded();
    const eventBounds = await event.boundingBox();
    const x = eventBounds.x + eventBounds.width / 2;
    const y = Math.min(650, eventBounds.y + 60);
    const beforeScroll = await mobile.evaluate(() => scrollY);
    await touch({ type: 'touchStart', x, y });
    for (let step = 1; step <= 6; step++) {
      await touch({ type: 'touchMove', x, y: y - step * 25 });
      await mobile.waitForTimeout(30);
    }
    await mobile.waitForTimeout(150);
    await touch({ type: 'touchEnd' });
    await mobile.waitForTimeout(200);
    const swipe = await mobile.evaluate(() => ({
      commits: window.touchCommits,
      drafts: window.touchDrafts,
      scrollY,
    }));
    if (swipe.commits || swipe.drafts || swipe.scrollY <= beforeScroll)
      throw new Error('Native swipe stole a calendar gesture: ' + JSON.stringify(swipe));
    await event.scrollIntoViewIfNeeded();
    const heldBounds = await event.boundingBox();
    const heldY = heldBounds.y + 50;
    await touch({ type: 'touchStart', x, y: heldY });
    await mobile.waitForTimeout(520);
    await touch({ type: 'touchMove', x, y: heldY + 60 });
    await mobile.waitForTimeout(80);
    await touch({ type: 'touchMove', x, y: heldY + 90 });
    await mobile.waitForTimeout(80);
    await touch({ type: 'touchEnd' });
    await mobile.waitForTimeout(100);
    const held = await mobile.evaluate(() => ({
      commits: window.touchCommits,
      drafts: window.touchDrafts,
      trace: window.touchTrace,
    }));
    if (held.commits !== 1 || held.drafts < 1)
      throw new Error('Intentional held touch drag failed: ' + JSON.stringify(held));
    const scrollViews = [];
    for (const view of ['week', 'touch-resources']) {
      await mobile.evaluate((name) => {
        window.touchApp.changeView(name);
        window.touchCommits = 0;
        window.touchDrafts = 0;
      }, view);
      await mobile.waitForTimeout(100);
      const target = mobile.locator('[data-mc-event^="touch-event@"]').first();
      await target.scrollIntoViewIfNeeded();
      const bounds = await target.boundingBox();
      const point = {
        x: bounds.x + Math.min(bounds.width / 2, 40),
        y: Math.min(650, bounds.y + 50),
      };
      await touch({ type: 'touchStart', ...point });
      for (let step = 1; step <= 6; step++) {
        await touch({ type: 'touchMove', x: point.x, y: point.y - step * 22 });
        await mobile.waitForTimeout(30);
      }
      await touch({ type: 'touchEnd' });
      await mobile.waitForTimeout(200);
      const result = await mobile.evaluate(() => ({
        commits: window.touchCommits,
        drafts: window.touchDrafts,
      }));
      if (result.commits || result.drafts)
        throw new Error(`Native ${view} swipe created a draft: ${JSON.stringify(result)}`);
      scrollViews.push(view);
    }
    await mobile.screenshot({ path: 'output/layout-review/touch-scroll.png', fullPage: false });
    return { swipe, held, scrollViews, input: 'Chromium CDP touch; not a physical phone' };
  } finally {
    await context.close();
  }
};
