async (page) => {
  const origin = new URL(page.url()).origin;
  const pathname = new URL(page.url()).pathname;
  const siteBase = pathname.includes('/examples/')
    ? pathname.slice(0, pathname.indexOf('/examples/'))
    : pathname.slice(0, pathname.lastIndexOf('/'));
  const url = (id) => `${origin}${siteBase}/examples/features.html?demo=${id}&lang=en&theme=dark`;
  const views = {
    week: 'week',
    month: 'month',
    list: 'list',
    resources: 'resources',
    timeline: 'timeline',
    persistence: 'day',
    recurrence: 'week',
    'external-drag': 'day',
    overflow: 'day',
    'custom-view': 'summary',
    'custom-render': 'day',
    'custom-toolbar': 'day',
    'day-style': 'week',
    'custom-editor': 'day',
    source: 'week',
    period: 'three-days',
  };
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.setViewportSize({ width: 1440, height: 1000 });
  for (const [demo, view] of Object.entries(views)) {
    await page.goto(url(demo));
    await page.locator(`[data-mc-root][data-mc-view="${view}"]`).waitFor();
    if ((await page.locator('.focused-catalog a').count()) !== 16)
      throw new Error('Incomplete focused catalog');
    if (!(await page.locator('.focused-code').textContent()).includes('Calendar'))
      throw new Error('Missing integration code: ' + demo);
    if (demo === 'source')
      await page.getByRole('status').filter({ hasText: 'Simulated source loaded' }).waitFor();
    if (demo === 'custom-render' && !(await page.locator('[data-mc-event] strong').count()))
      throw new Error('Custom render did not apply');
  }
  await page.goto(url('month'));
  await page.getByRole('checkbox', { name: 'Indicators and list', exact: true }).check();
  await page.getByRole('button', { name: 'Phone · 360 px', exact: true }).click();
  await page.locator('.mc-month-compact').waitFor();
  const compactDayHeight = await page
    .locator('[data-mc-month-day="2026-10-07"]')
    .evaluate((element) => element.getBoundingClientRect().height);
  if (compactDayHeight < 64 || compactDayHeight > 76)
    throw new Error('Indicator mode inherited the event-card cell height');
  const today = page.locator('[data-mc-month-day="2026-10-08"] .mc-month-daynum');
  const selected = page.locator('[data-mc-month-day="2026-10-07"] .mc-month-daynum');
  if (
    (await today.getAttribute('aria-current')) !== 'date' ||
    (await selected.getAttribute('aria-pressed')) !== 'true'
  )
    throw new Error('Today and selected date merged');
  if (!(await page.locator('[data-mc-month-day="2026-10-08"] .mc-month-count').textContent()))
    throw new Error('Unselected date lost event marker');
  const lastEvent = await page.locator('[data-mc-month-detail-event]').last().boundingBox();
  const createAction = await page
    .getByRole('button', { name: 'Create event on this day', exact: true })
    .boundingBox();
  if (!lastEvent || !createAction || createAction.y - lastEvent.y - lastEvent.height < 12)
    throw new Error('Create action touches the event list');
  await page.screenshot({
    path: 'output/layout-review/focused-month-360-dark.png',
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Tablet · 768 px', exact: true }).click();
  await page.locator('.mc-month:not(.mc-month-compact)').waitFor();
  await page.screenshot({
    path: 'output/layout-review/focused-month-768-dark.png',
    fullPage: true,
  });
  await page.goto(url('custom-editor'));
  await page.locator('[data-mc-event]').first().click();
  await page.getByRole('textbox', { name: 'Your form: title' }).fill('Consumer form saved');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.locator('[data-mc-event]').filter({ hasText: 'Consumer form saved' }).waitFor();
  await page.setViewportSize({ width: 375, height: 900 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  if (overflow > 1) throw new Error('Focused demo page overflows narrow viewport');
  if (errors.length) throw new Error(errors.join('\n'));
  return [
    '16 exemplos focados: views explícitas, código, fonte simulada, formulário próprio; contêiner 360/768px; hoje/seleção/eventos separados; sem erros de página',
  ];
};
