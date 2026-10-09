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
      const { CalendarApp, BUILTIN_VIEWS, ensureTemporal } = await import('/src/index.ts');
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
        views: BUILTIN_VIEWS,
        view: 'day',
        date: '2026-10-07',
        options: { timeZone: 'UTC', startHour: 0, endHour: 24, pxPerMinute: 2 },
        events: [
          {
            id: 'touch-event',
            calendarId: 'c',
            title: 'Touch appointment',
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
    await mobile.screenshot({ path: 'output/layout-review/touch-scroll.png', fullPage: false });
    return { swipe, held, input: 'Chromium CDP touch; not a physical phone' };
  } finally {
    await context.close();
  }
};
