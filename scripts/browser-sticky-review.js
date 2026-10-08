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
    host.id = 'sticky-fixture';
    document.body.append(host);
    const resources = Array.from({ length: 20 }, (_, index) => ({
      id: `room-${index}`,
      title: `Sala ${index + 1}`,
    }));
    const app = new CalendarApp({
      temporal: await ensureTemporal(),
      date: '2026-10-07',
      view: 'week',
      resources,
      views: [...BUILTIN_VIEWS, createResourceDayView(resources), createTimelineView(resources)],
      options: { timeZone: 'UTC', startHour: 0, endHour: 24, pxPerMinute: 1.5 },
    });
    app.mount(host);
    await app.ready();
    window.stickyApp = app;
    host.querySelector('[data-mc-root]').style.setProperty('--mc-grid-max-height', '350px');
  });
  const results = [];
  for (const view of ['week', 'day', 'resources', 'timeline']) {
    await page.evaluate((view) => window.stickyApp.changeView(view), view);
    const scroller = page.locator('#sticky-fixture [data-mc-hscroll]');
    await scroller.waitFor();
    const result = await scroller.evaluate(async (scroll) => {
      scroll.scrollIntoView();
      scroll.scrollTop = 200;
      scroll.scrollLeft = 220;
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const header = scroll.querySelector(
        '.mc-header-row,.mc-resource-header-row,.mc-timeline-header',
      );
      const gutter = scroll.querySelector('.mc-time-axis,.mc-timeline-label');
      const corner = header.firstElementChild;
      const viewport = scroll.getBoundingClientRect(),
        h = header.getBoundingClientRect(),
        g = gutter.getBoundingClientRect(),
        c = corner.getBoundingClientRect();
      return {
        view: scroll.parentElement.dataset.mcView,
        scrollTop: scroll.scrollTop,
        scrollLeft: scroll.scrollLeft,
        headerDelta: h.top - viewport.top,
        gutterDelta: g.left - viewport.left,
        cornerDelta: c.left - viewport.left,
        verticalOverflow: scroll.scrollHeight > scroll.clientHeight,
        horizontalOverflow: scroll.scrollWidth > scroll.clientWidth,
      };
    });
    if (
      !result.verticalOverflow ||
      result.scrollTop <= 0 ||
      Math.abs(result.headerDelta) > 1 ||
      Math.abs(result.gutterDelta) > 1 ||
      Math.abs(result.cornerDelta) > 1
    )
      throw new Error(`Sticky desalinhado: ${JSON.stringify(result)}`);
    if (view !== 'day' && (!result.horizontalOverflow || result.scrollLeft <= 0))
      throw new Error(`Scroll lateral indisponível: ${JSON.stringify(result)}`);
    results.push(result);
    await page.screenshot({ path: `output/playwright/sticky-${view}.png`, fullPage: true });
  }
  await page.evaluate(() => window.stickyApp.changeView('day'));
  const expanded = await page.locator('#sticky-fixture [data-mc-hscroll]').evaluate((scroll) => {
    scroll.closest('[data-mc-root]').style.setProperty('--mc-grid-max-height', 'none');
    return { height: scroll.clientHeight, contentHeight: scroll.scrollHeight };
  });
  if (expanded.height < 2000 || expanded.contentHeight > expanded.height + 1)
    throw new Error(`Grade sem limite criou scroll vertical: ${JSON.stringify(expanded)}`);
  return { results, expanded };
};
