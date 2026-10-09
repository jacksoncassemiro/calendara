async (page) => {
  const origin = new URL(page.url()).origin;
  const errors = [];
  const recordError = (error) => errors.push(error.message);
  page.on('pageerror', recordError);
  await page.setViewportSize({ width: 1800, height: 900 });
  await page.goto(`${origin}/examples/features.html?demo=quarter&lang=en&theme=dark`);
  await page.locator('[data-mc-root]').waitFor();
  await page.evaluate(async () => {
    const calendar = await import('/src/index.ts');
    document.querySelector('main').hidden = true;
    const host = document.createElement('div');
    host.id = 'dense-panels-fixture';
    host.style.cssText = 'width:1600px;max-width:100%;margin:20px auto';
    document.body.append(host);
    const events = Array.from({ length: 20 }, (_, index) => ({
      id: `dense-${index}`,
      calendarId: 'fixture',
      title: `Long appointment ${index}`,
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
    window.densePanelsApp = new calendar.CalendarApp({
      temporal: await calendar.ensureTemporal(),
      date: '2026-10-07',
      view: 'quarter',
      views: [calendar.quarterView, calendar.yearView],
      events,
      options: { timeZone: 'UTC', locale: 'en-US', monthCompactBreakpoint: false },
    });
    window.densePanelsApp.mount(host);
    await window.densePanelsApp.ready();
  });
  const fixture = page.locator('#dense-panels-fixture');
  const reports = [];
  for (const view of ['quarter', 'year']) {
    await page.evaluate((view) => window.densePanelsApp.changeView(view), view);
    const geometry = await fixture.locator('[data-mc-month-panel]').evaluateAll((panels) =>
      panels.map((panel) => ({
        height: panel.getBoundingClientRect().height,
        weeks: [...panel.querySelectorAll('.mc-month-week')].map(
          (week) => week.getBoundingClientRect().height,
        ),
        gap:
          panel.getBoundingClientRect().bottom -
          panel.querySelector('.mc-month').getBoundingClientRect().bottom,
      })),
    );
    if (
      Math.max(...geometry.map((panel) => panel.height)) -
        Math.min(...geometry.map((panel) => panel.height)) >
      1
    )
      throw new Error(`Unequal dense ${view} panels: ${JSON.stringify(geometry)}`);
    if (
      geometry.some(
        (panel) =>
          panel.weeks.length !== 6 ||
          panel.gap > 2 ||
          Math.max(...panel.weeks) - Math.min(...panel.weeks) > 2,
      )
    )
      throw new Error(`Dense ${view} row alignment or footer gap: ${JSON.stringify(geometry)}`);
    const more = fixture.locator('[data-mc-month-day="2026-10-07"] .mc-month-more');
    if (!(await more.count()) || !(await more.first().isVisible()))
      throw new Error('Dense month lost overflow access');
    await page.screenshot({ path: `output/layout-review/dense-${view}.png`, fullPage: true });
    reports.push({ view, panelHeight: geometry[0].height, weeks: geometry[0].weeks });
  }
  await page.setViewportSize({ width: 360, height: 820 });
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1))
    throw new Error('Dense multi-month page overflow');
  await page.screenshot({ path: 'output/layout-review/dense-panels-mobile.png', fullPage: true });
  await page.evaluate(() => {
    window.densePanelsApp.destroy();
    document.getElementById('dense-panels-fixture').remove();
  });
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto(`${origin}/examples/features.html?demo=timeline-week&lang=pt-BR&theme=dark`);
  await page.locator('.mc-period-group-row').first().waitFor();
  await page.waitForFunction(() =>
    [...document.querySelectorAll('.mc-period-group-row')].every(
      (row) =>
        row.querySelector('button').getBoundingClientRect().bottom <=
        row.getBoundingClientRect().bottom,
    ),
  );
  const groups = await page.locator('.mc-period-group-row').evaluateAll((rows) =>
    rows.map((row) => ({
      row: row.getBoundingClientRect().height,
      label: row.querySelector('button').getBoundingClientRect().height,
    })),
  );
  await page.screenshot({ path: 'output/layout-review/dense-long-groups.png', fullPage: true });
  await page.goto(`${origin}/examples/features.html?demo=timeline-tree&lang=pt-BR&theme=dark`);
  await page.locator('[data-mc-resource-rows]').waitFor();
  const axis = await page
    .locator('.mc-period-time-header .mc-timeline-axis')
    .first()
    .evaluate((element) => ({
      height: element.getBoundingClientRect().height,
      tops: [...element.querySelectorAll('.mc-timeline-hour')].map(
        (label) => label.getBoundingClientRect().top,
      ),
    }));
  if (axis.height > 32 || new Set(axis.tops).size !== 1)
    throw new Error('Virtual hierarchy example retains staircase hour labels');
  await page.getByRole('checkbox', { name: 'Direção RTL' }).check();
  const scroll = page.locator('[data-mc-hscroll]').first();
  await scroll.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await page.waitForFunction(() => document.querySelector('[data-mc-period-resource="room-119"]'));
  if ((await page.locator('[data-mc-period-resource]').count()) > 30)
    throw new Error('Resource labels broke bounded virtualization');
  await page.screenshot({ path: 'output/layout-review/dense-tree-rtl.png', fullPage: true });
  await page.evaluate(async () => {
    const calendar = await import('/src/index.ts');
    document.querySelector('main').hidden = true;
    const host = document.createElement('div');
    host.id = 'long-label-fixture';
    host.style.cssText = 'width:700px;max-width:100%;margin:20px auto';
    document.body.append(host);
    const resources = Array.from({ length: 120 }, (_, index) => ({
      id: `long-${index}`,
      title: `Room ${index} with an unusually long resource name`,
    }));
    window.longLabelApp = new calendar.CalendarApp({
      temporal: await calendar.ensureTemporal(),
      date: '2026-10-07',
      view: 'labels',
      resources,
      views: [
        calendar.createResourceTimelineView({
          name: 'labels',
          duration: 'week',
          groupBy: () => 'A very long translated resource group title',
          virtualization: { height: 360, overscan: 2 },
        }),
      ],
      options: { timeZone: 'UTC', locale: 'en-US' },
    });
    window.longLabelApp.mount(host);
    await window.longLabelApp.ready();
  });
  const labels = page.locator('#long-label-fixture');
  await page.waitForFunction(() => {
    const resource = document.querySelector('#long-label-fixture [data-mc-period-resource]');
    return (
      resource.getBoundingClientRect().height > 44 &&
      resource.querySelector('button').getBoundingClientRect().bottom <=
        resource.getBoundingClientRect().bottom
    );
  });
  const measuredHeight = await labels
    .locator('[data-mc-period-resource]')
    .first()
    .evaluate((element) => element.getBoundingClientRect().height);
  await labels
    .locator('[data-mc-root]')
    .evaluate((element) => element.style.setProperty('--mc-font-size', '22px'));
  await page.waitForFunction(
    (height) =>
      document
        .querySelector('#long-label-fixture [data-mc-period-resource]')
        .getBoundingClientRect().height > height,
    measuredHeight,
  );
  const labelGeometry = await labels.locator('[data-mc-period-resource]').evaluateAll((elements) =>
    elements.map((label) => ({
      height: label.getBoundingClientRect().height,
      tracks: [...label.parentElement.parentElement.querySelectorAll('.mc-timeline-row')].map(
        (track) => track.getBoundingClientRect().height,
      ),
      fits:
        label.querySelector('button').getBoundingClientRect().bottom <=
        label.getBoundingClientRect().bottom,
    })),
  );
  if (
    labelGeometry.some(
      (row) =>
        !row.fits ||
        row.tracks.length !== 7 ||
        row.tracks.some((height) => Math.abs(height - row.height) > 1),
    )
  )
    throw new Error(`Measured resource rows do not align: ${JSON.stringify(labelGeometry)}`);
  await page.screenshot({ path: 'output/layout-review/dense-variable-labels.png', fullPage: true });
  await page.evaluate(() => {
    window.longLabelApp.destroy();
    document.getElementById('long-label-fixture').remove();
  });
  page.off('pageerror', recordError);
  if (errors.length) throw new Error(errors.join('\n'));
  return {
    panels: reports,
    groups,
    automaticAxis: axis,
    rtlVirtualization: true,
    longLabels: labelGeometry,
    errors,
  };
};
