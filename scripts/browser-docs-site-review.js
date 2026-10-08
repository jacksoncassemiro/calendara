async (page) => {
  const origin = new URL(page.url()).origin;
  const siteBase = page.url().includes('/calendara/') ? '/calendara/' : '/';
  const runtimeErrors = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  page.on('response', (response) => {
    if (response.status() >= 400) runtimeErrors.push(`${response.status()} ${response.url()}`);
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${origin}${siteBase}index.html`);
  await page.getByRole('heading', { name: 'Uma agenda que se adapta ao seu trabalho.' }).waitFor();
  if (runtimeErrors.length) throw new Error(runtimeErrors.join('\n'));
  const demo = page.getByRole('link', { name: 'Experimentar a agenda', exact: true }).first();
  if (!(await demo.getAttribute('href')).split('?')[0].endsWith('examples/react.html'))
    throw new Error('Demo link does not target the playground');
  await page.screenshot({ path: 'output/layout-review/docs-desktop.png' });

  await page.getByLabel('Buscar campo ou descrição', { exact: true }).fill('initialView');
  const fields = page.locator('.site-api-field');
  await page.waitForFunction(() =>
    [...document.querySelectorAll('.site-api-field')].every((field) =>
      field.textContent.toLowerCase().includes('initialview'),
    ),
  );
  const initialViewField = fields.filter({
    has: page.locator('.site-api-field-heading code', { hasText: /^initialView$/ }),
  });
  if (
    (await initialViewField.count()) !== 1 ||
    !(await initialViewField.innerText()).includes('Usada só na montagem')
  )
    throw new Error('Generated API search/Portuguese docs failed');
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await page.getByRole('heading', { name: 'A schedule that fits the way you work.' }).waitFor();
  if ((await page.locator('html').getAttribute('lang')) !== 'en' || !page.url().includes('lang=en'))
    throw new Error('Language state/URL not updated');
  if (!(await initialViewField.innerText()).includes('Initial registered view'))
    throw new Error('English JSDoc not shown');

  await page.getByLabel('Search fields or descriptions', { exact: true }).fill('');
  await page.getByLabel('Contract', { exact: true }).selectOption('CalendarResource');
  await page
    .getByLabel('Search fields or descriptions', { exact: true })
    .fill('false is unlimited');
  await fields.filter({ hasText: 'false is unlimited' }).waitFor();
  if (
    (await fields.count()) !== 1 ||
    !(await fields.first().innerText()).includes('false is unlimited')
  )
    throw new Error('Resource contract reference is missing');
  await page.getByLabel('Search fields or descriptions', { exact: true }).fill('does-not-exist');
  await page.getByRole('status').filter({ hasText: 'No fields match your search.' }).waitFor();

  await page
    .getByRole('group', { name: 'Theme', exact: true })
    .getByRole('button', { name: 'Dark', exact: true })
    .click();
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
  await page.reload();
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
  await page.screenshot({ path: 'output/layout-review/docs-dark-en.png' });
  await page.emulateMedia({ colorScheme: 'light' });
  await page
    .getByRole('group', { name: 'Theme', exact: true })
    .getByRole('button', { name: 'System', exact: true })
    .click();
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
  await page
    .getByRole('group', { name: 'Theme', exact: true })
    .getByRole('button', { name: 'Light', exact: true })
    .click();
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'light');

  const featureLinks = await page
    .locator('a[href*="&view="]')
    .evaluateAll((links) => links.map((link) => link.href));
  if (featureLinks.length !== 10) throw new Error('Feature catalog is incomplete');
  for (const href of featureLinks) {
    const expectedView = new URL(href).searchParams.get('view');
    await page.goto(href);
    await page.locator(`[data-mc-root][data-mc-view="${expectedView}"]`).waitFor();
    if ((await page.locator('html').getAttribute('lang')) !== 'en')
      throw new Error('Feature link did not preserve English');
  }
  await page.goto(`${origin}${siteBase}index.html?lang=en&theme=dark`);
  await page.getByRole('heading', { name: 'A schedule that fits the way you work.' }).waitFor();

  for (const width of [375, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => window.scrollTo(0, 0));
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    if (overflow > 1) throw new Error(`Documentation page overflow at ${width}px: ${overflow}`);
    await page.screenshot({ path: `output/layout-review/docs-mobile-${width}.png` });
  }

  await page.getByRole('link', { name: 'Try the calendar', exact: true }).first().click();
  await page.locator('[data-mc-root]').waitFor();
  await page.getByRole('link', { name: 'Documentation', exact: true }).click();
  await page.getByRole('heading', { name: 'A schedule that fits the way you work.' }).waitFor();
  return [
    'Documentação PT/EN, API gerada e busca de contratos; layout 320/375px; links reais demo/documentação',
  ];
};
