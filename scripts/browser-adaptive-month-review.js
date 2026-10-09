async (page) => {
  const origin = new URL(page.url()).origin;
  const errors = [];
  const recordError = (error) => errors.push(error.message);
  page.on('pageerror', recordError);
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto(`${origin}/examples/features.html?demo=quarter&lang=en&theme=dark`);
  await page.evaluate(async () => {
    const calendar = await import('/src/index.ts');
    document.querySelector('main').hidden = true;
    const host = document.createElement('div');
    host.id = 'adaptive-month-fixture';
    host.style.cssText = 'width:1200px;max-width:100%;margin:20px auto';
    document.body.append(host);
    const events = Array.from({ length: 7 }, (_, index) => ({
      id: `adaptive-${index}`,
      calendarId: 'fixture',
      title: `Appointment ${index}`,
      time: {
        allDay: false,
        start: { dateTime: '2026-10-07T09:00', timeZone: 'UTC' },
        end: { dateTime: '2026-10-07T10:00', timeZone: 'UTC' },
      },
    }));
    events.push({
      id: 'span',
      calendarId: 'fixture',
      title: 'Three-day appointment',
      time: { allDay: true, start: { date: '2026-10-06' }, end: { date: '2026-10-09' } },
    });
    window.adaptiveMonthApp = new calendar.CalendarApp({
      temporal: await calendar.ensureTemporal(),
      date: '2026-10-07',
      view: 'month',
      views: [
        calendar.monthView,
        calendar.dayView,
        calendar.quarterView,
        calendar.yearView,
        calendar.yearPlannerView,
      ],
      events,
      options: { timeZone: 'UTC', locale: 'en-US', monthCompactBreakpoint: false },
      onMonthMoreClick: (info) => {
        window.adaptiveMoreInfo = {
          total: info.occurrences.length,
          hidden: info.hiddenOccurrences.length,
        };
      },
    });
    window.adaptiveMonthApp.mount(host);
    await window.adaptiveMonthApp.ready();
  });
  const fixture = page.locator('#adaptive-month-fixture');
  const date = fixture.locator('[data-mc-month-day="2026-10-07"]');
  const reports = [];
  for (const [width, visible] of [
    [1200, 3],
    [770, 2],
    [630, 1],
    [360, 0],
  ]) {
    await fixture.evaluate((host, width) => {
      host.style.width = `${width}px`;
    }, width);
    await page.waitForFunction(
      (visible) =>
        document.querySelectorAll('#adaptive-month-fixture [data-mc-month-dates~="2026-10-07"]')
          .length === visible,
      visible,
    );
    const count = await date.locator('.mc-month-more').innerText();
    if (!count.startsWith(`+${8 - visible}`))
      throw new Error(`Incorrect hidden count at ${width}: ${count}`);
    const geometry = await date.evaluate((cell) => {
      const button = cell.querySelector('.mc-month-more');
      const style = getComputedStyle(button);
      const linear = (value) =>
        value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      const luminance = (color) =>
        color
          .match(/[\d.]+/g)
          .slice(0, 3)
          .map(Number)
          .map((channel) => linear(channel / 255))
          .map((channel, index) => channel * [0.2126, 0.7152, 0.0722][index])
          .reduce((sum, channel) => sum + channel, 0);
      const foreground = luminance(style.color),
        background = luminance(style.backgroundColor);
      return {
        dayHeight: cell.getBoundingClientRect().height,
        triggerHeight: button.getBoundingClientRect().height,
        padding: [style.paddingTop, style.paddingBottom],
        fits: button.getBoundingClientRect().bottom <= cell.getBoundingClientRect().bottom,
        contrast:
          (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05),
      };
    });
    if (
      !geometry.fits ||
      geometry.triggerHeight !== 24 ||
      geometry.padding.some((value) => value !== '0px') ||
      geometry.contrast < 4.5
    )
      throw new Error(`Trigger geometry/contrast: ${JSON.stringify(geometry)}`);
    reports.push({ width, visible, ...geometry });
    await page.screenshot({
      path: `output/layout-review/adaptive-month-${width}.png`,
      fullPage: true,
    });
  }
  if (reports.at(-1).dayHeight >= reports[0].dayHeight)
    throw new Error('Narrow month did not shrink vertically');
  await date.locator('.mc-month-more').click();
  await fixture.locator('.mc-month-popover').waitFor();
  const info = await page.evaluate(() => window.adaptiveMoreInfo);
  if (
    info.total !== 8 ||
    info.hidden !== 8 ||
    (await fixture.locator('[data-mc-month-detail-event]').count()) !== 8
  )
    throw new Error('Adaptive overflow loses occurrences');
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.adaptiveMonthApp.setOptions({ monthMoreView: 'day' }));
  await date.locator('.mc-month-more').click();
  await fixture.locator('[data-mc-day="2026-10-07"]').waitFor();
  await page.evaluate(() => {
    window.adaptiveMonthApp.setOptions({ monthMoreView: undefined, monthMaxEvents: false });
    window.adaptiveMonthApp.changeView('month');
  });
  await page.waitForFunction(
    () =>
      document.querySelectorAll('#adaptive-month-fixture [data-mc-month-dates~="2026-10-07"]')
        .length === 8,
  );
  if (await date.locator('.mc-month-more').count())
    throw new Error('Explicit unbounded cards were reduced');
  await page.evaluate(() => window.adaptiveMonthApp.setOptions({ monthMaxEvents: 3 }));
  await fixture.evaluate((host) => {
    host.style.width = '1200px';
  });
  for (const view of ['quarter', 'year']) {
    const initialFrames = await page.evaluate(async (view) => {
      window.adaptiveMonthApp.changeView('year-planner');
      await new Promise(requestAnimationFrame);
      window.adaptiveMonthApp.changeView(view);
      const snapshot = () => ({
        cards: document.querySelectorAll('#adaptive-month-fixture [data-mc-month-event]').length,
        heights: [
          ...document.querySelectorAll('#adaptive-month-fixture [data-mc-month-panel]'),
        ].map((node) => node.getBoundingClientRect().height),
      });
      const frames = [snapshot()];
      for (let frame = 0; frame < 3; frame++) {
        await new Promise(requestAnimationFrame);
        frames.push(snapshot());
      }
      return frames;
    }, view);
    if (initialFrames.some((frame) => frame.cards !== 0 || Math.max(...frame.heights) > 520))
      throw new Error(`Unmeasured ${view} first frame: ${JSON.stringify(initialFrames)}`);
    await page.waitForFunction(
      () => document.querySelectorAll('#adaptive-month-fixture [data-mc-month-event]').length === 0,
    );
    const heights = await fixture
      .locator('[data-mc-month-panel]')
      .evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height));
    if (Math.max(...heights) - Math.min(...heights) > 1 || Math.max(...heights) > 520)
      throw new Error(`Oversized or unequal ${view} panels: ${heights}`);
    if (!(await fixture.locator('.mc-month-more').first().isVisible()))
      throw new Error('Multi-month lost count trigger');
    await page.screenshot({ path: `output/layout-review/adaptive-${view}.png`, fullPage: true });
  }
  await page.evaluate(() => {
    window.adaptiveMonthApp.destroy();
    document.getElementById('adaptive-month-fixture').remove();
  });
  page.off('pageerror', recordError);
  if (errors.length) throw new Error(errors.join('\n'));
  return {
    adaptiveWidths: reports,
    overflowPreserved: info,
    unlimitedPreserved: true,
    multiMonthCompact: true,
    errors,
  };
};
