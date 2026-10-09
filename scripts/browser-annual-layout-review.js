async (page) => {
  const previousURL = page.url();
  const errors = [];
  const recordError = (error) => errors.push(error.message);
  page.on('pageerror', recordError);
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.goto(new URL('/examples/react.html?lang=en&theme=dark', previousURL).href);
  await page.locator('[data-mc-root]').waitFor();
  await page.evaluate(async () => {
    const calendar = await import('/src/index.ts');
    document.querySelector('main').hidden = true;
    const host = document.createElement('div');
    host.id = 'annual-layout-fixture';
    host.style.cssText = 'width:1080px;max-width:100%;margin:30px auto';
    document.body.append(host);
    const events = Array.from({ length: 8 }, (_, index) => ({
      id: `annual-${index}`,
      calendarId: 'fixture',
      title: `Long annual appointment ${index}`,
      resourceIds: ['room'],
      time: {
        allDay: false,
        start: { dateTime: '2026-10-07T09:00', timeZone: 'UTC' },
        end: { dateTime: '2026-10-07T10:00', timeZone: 'UTC' },
      },
    }));
    window.annualLayoutApp = new calendar.CalendarApp({
      temporal: await calendar.ensureTemporal(),
      date: '2026-10-07',
      view: 'year-planner',
      views: [
        calendar.yearPlannerView,
        calendar.yearView,
        calendar.weekView,
        calendar.createResourceTimelineView({
          name: 'period',
          duration: 'week',
          groupBy: () => 'Rooms',
        }),
      ],
      resources: [{ id: 'room', title: 'Room' }],
      events,
      options: {
        locale: 'en-US',
        timeZone: 'UTC',
        nowMs: Date.parse('2026-10-09T12:00:00Z'),
        defaultResourceCapacity: false,
      },
    });
    window.annualLayoutApp.mount(host);
    await window.annualLayoutApp.ready();
  });
  const fixture = page.locator('#annual-layout-fixture');
  const planner = fixture.locator('[data-mc-year-planner-scroll]');
  const scrollbar = fixture.locator('.mc-header-scrollbar');
  await scrollbar.waitFor({ state: 'visible' });
  const heights = await planner
    .locator('tbody tr')
    .evaluateAll((rows) => rows.map((row) => row.getBoundingClientRect().height));
  if (Math.max(...heights) - Math.min(...heights) > 1)
    throw new Error('Annual month rows depend on event count');
  await planner.locator('[data-mc-year-planner-date="2026-10-07"] summary').click();
  const expandedHeights = await planner
    .locator('tbody tr')
    .evaluateAll((rows) => rows.map((row) => row.getBoundingClientRect().height));
  if (expandedHeights.some((height, index) => Math.abs(height - heights[index]) > 1))
    throw new Error('Annual overflow expands month row');
  await planner.locator('[data-mc-year-planner-date="2026-10-07"] summary').click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await scrollbar.evaluate((element) => {
    element.scrollLeft = 350;
  });
  await page.waitForFunction(
    () => document.querySelector('[data-mc-year-planner-scroll]').scrollLeft > 300,
  );
  const labelGeometry = await planner.evaluate((scroll) => {
    const label = scroll.querySelector('tbody th');
    const viewport = scroll.getBoundingClientRect();
    const bounds = label.getBoundingClientRect();
    const hit = document.elementFromPoint(viewport.left + 5, bounds.top + 20);
    return {
      offset: Math.abs(bounds.left - viewport.left),
      coversEdge: hit?.closest('th') === label,
      border: getComputedStyle(label).borderInlineEndWidth,
    };
  });
  if (labelGeometry.offset > 2 || !labelGeometry.coversEdge || labelGeometry.border !== '1px')
    throw new Error('Annual month label does not cover scrolled dates');
  await page.evaluate(() => {
    const source = document.querySelector('.mc-year-planner thead').getBoundingClientRect();
    window.scrollBy(0, source.top + 120);
  });
  await page.waitForFunction(
    () =>
      getComputedStyle(document.querySelector('#annual-layout-fixture .mc-header-scrollbar'))
        .position === 'fixed',
  );
  const pinned = await scrollbar.boundingBox();
  if (pinned.y < 0 || pinned.y > 100)
    throw new Error('Annual top scrollbar is not reachable after page scroll');
  await page.screenshot({ path: 'output/layout-review/annual-layout-pinned.png' });
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    window.annualLayoutApp.changeView('year');
  });
  const weeks = await fixture
    .locator('[data-mc-month-panel]')
    .evaluateAll((panels) =>
      panels.map((panel) => panel.querySelectorAll('.mc-month-week').length),
    );
  if (weeks.some((count) => count !== 6))
    throw new Error('Annual panels do not share six-week configuration');
  await page.evaluate(() => window.annualLayoutApp.setOptions({ monthFixedWeeks: false }));
  if (
    (await fixture.locator('[data-mc-month-panel]').first().locator('.mc-month-week').count()) !== 5
  )
    throw new Error('Natural month weeks option ignored');
  await page.evaluate(() => window.annualLayoutApp.setOptions({ monthFixedWeeks: true }));
  await page.evaluate(() => {
    window.annualLayoutEvents = window.annualLayoutApp.getState().events;
    window.annualLayoutApp.setEvents([]);
  });
  const year = await fixture
    .locator('[data-mc-month-panel]')
    .first()
    .evaluate((panel) => {
      const date = panel.querySelector('.mc-month-day');
      const bounds = date.getBoundingClientRect();
      return {
        height: bounds.height,
        width: bounds.width,
        bottomBorder: getComputedStyle(panel.querySelector('.mc-month-week:last-child'))
          .borderBottomWidth,
        gapBelowGrid:
          panel.getBoundingClientRect().bottom -
          panel.querySelector('.mc-month').getBoundingClientRect().bottom,
      };
    });
  if (
    year.height > 72 ||
    year.height / year.width > 1.6 ||
    year.bottomBorder !== '1px' ||
    year.gapBelowGrid > 2
  )
    throw new Error(`Multi-month sizing/borders: ${JSON.stringify(year)}`);
  await page.screenshot({ path: 'output/layout-review/annual-layout-year.png' });
  await page.evaluate(() => {
    window.annualLayoutApp.setEvents(window.annualLayoutEvents);
    window.annualLayoutApp.changeView('period');
  });
  const group = fixture.locator('.mc-period-group-row');
  if ((await group.locator('.mc-period-group-day').count()) !== 7)
    throw new Error('Missing day boundaries in resource group row');
  const borders = await group.locator('.mc-period-group-label').evaluate((label) => ({
    side: getComputedStyle(label).borderInlineEndWidth,
    height: label.getBoundingClientRect().height,
    rowHeight: label.parentElement.getBoundingClientRect().height,
  }));
  if (borders.side !== '1px' || borders.rowHeight - borders.height > 2)
    throw new Error('Resource label divider stops at group row');
  await page.screenshot({ path: 'output/layout-review/annual-layout-period.png' });
  await page.evaluate(() => window.annualLayoutApp.changeView('week'));
  const themes = [];
  for (const theme of ['light', 'dark']) {
    await page.evaluate((theme) => {
      document.documentElement.dataset.theme = theme;
    }, theme);
    themes.push(
      await fixture.locator('.mc-day-col.mc-today').evaluate((day, theme) => {
        const luminance = (color) => {
          const values = color
            .match(/[\d.]+/g)
            .slice(0, 3)
            .map((value) => Number(value) / 255)
            .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
          return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
        };
        const style = getComputedStyle(day);
        const event = getComputedStyle(document.querySelector('#annual-layout-fixture .mc-event'));
        const background = style.backgroundColor;
        const foreground = style.color;
        const values = [luminance(background), luminance(foreground)].sort(
          (first, second) => first - second,
        );
        return {
          theme,
          background,
          eventBackground: event.backgroundColor,
          ratio: (values[1] + 0.05) / (values[0] + 0.05),
        };
      }, theme),
    );
  }
  if (themes.some((theme) => theme.ratio < 4.5 || theme.background === theme.eventBackground))
    throw new Error(`Today contrast: ${JSON.stringify(themes)}`);
  await page.setViewportSize({ width: 360, height: 800 });
  await page.evaluate(() => window.annualLayoutApp.changeView('year'));
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1))
    throw new Error('Annual panels overflow narrow viewport');
  await page.evaluate(() => window.annualLayoutApp.destroy());
  await fixture.evaluate((element) => element.remove());
  page.off('pageerror', recordError);
  if (errors.length) throw new Error(errors.join('\n'));
  await page.goto(previousURL);
  return {
    uniformPlannerRows: heights[0],
    stickyMonthLabels: true,
    pinnedTopScrollbar: true,
    year,
    continuousGroupBoundaries: true,
    themes,
    errors,
  };
};
