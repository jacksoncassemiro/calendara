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
  const indexResponse = await page.request.get(`${origin}${siteBase}llms.txt`);
  if (!indexResponse.ok()) throw new Error('AI documentation index unavailable');
  const indexText = await indexResponse.text();
  const indexedUrls = [
    ...indexText.matchAll(/\]\((https:\/\/jacksoncassemiro\.me\/calendara\/docs\/[^)]+)\)/g),
  ];
  if (indexedUrls.length < 8) throw new Error('AI index is missing integration guides');
  for (const [, url] of indexedUrls) {
    const path = new URL(url).pathname.replace('/calendara/', siteBase);
    const response = await page.request.get(`${origin}${path}`);
    const content = await response.text();
    if (!response.ok() || !content.startsWith('# '))
      throw new Error(`Unreadable AI guide: ${path}`);
    if (
      path.endsWith('api-reference.md') &&
      (!content.includes('monthFixedWeeks') || !content.includes('Português:'))
    )
      throw new Error('Generated Markdown API missing current bilingual contracts');
  }
  const discoveryHref = await page.locator('link[rel="describedby"]').getAttribute('href');
  if (!discoveryHref || new URL(discoveryHref, page.url()).href !== `${origin}${siteBase}llms.txt`)
    throw new Error('AI documentation discovery link missing');
  if (runtimeErrors.length) throw new Error(runtimeErrors.join('\n'));
  const demo = page.getByRole('link', { name: 'Experimentar a agenda', exact: true }).first();
  if (!(await demo.getAttribute('href')).split('?')[0].endsWith('examples/react.html'))
    throw new Error('Demo link does not target the playground');
  await page.screenshot({ path: 'output/layout-review/docs-desktop.png' });

  await page.getByLabel('Contrato', { exact: true }).selectOption('CalendarProps');
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

  const featureRows = page.locator('#features article a[href*="features.html"]');
  const resourceCategory = page.getByRole('button', { name: /^Resources and availability/ });
  const resourceCount = Number(await resourceCategory.locator('span').innerText());
  await resourceCategory.click();
  if ((await featureRows.count()) !== resourceCount)
    throw new Error('Resource category filter failed');
  await page.getByRole('button', { name: /^All features/ }).click();
  await page.getByLabel('Search features', { exact: true }).fill('recurrence');
  if (
    !(await featureRows.count()) ||
    !(await page
      .locator('#features article')
      .filter({ hasText: /recurrence/i })
      .count())
  )
    throw new Error('Feature search failed');
  await page.getByLabel('Search features', { exact: true }).fill('does-not-exist');
  if (await featureRows.count()) throw new Error('Empty feature search failed');
  await page.getByLabel('Search features', { exact: true }).fill('');
  await page
    .locator('#features')
    .screenshot({ path: 'output/layout-review/docs-feature-directory.png' });

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
    .locator('#features article a[href*="features.html"]')
    .evaluateAll((links) =>
      links.map((link) => ({ href: link.href, view: link.dataset.demoView })),
    );
  const advertisedCount = Number(
    await page.locator('.site-feature-categories button').first().locator('span').innerText(),
  );
  if (featureLinks.length !== advertisedCount)
    throw new Error('Feature catalog count does not match its examples');
  for (const { href, view: expectedView } of featureLinks) {
    const demo = new URL(href).searchParams.get('demo');
    await page.goto(href);
    await page.locator(`[data-mc-root][data-mc-view="${expectedView}"]`).waitFor();
    if ((await page.locator('html').getAttribute('lang')) !== 'en')
      throw new Error('Feature link did not preserve English');
    if (demo === 'history') {
      await page.getByRole('button', { name: 'Add event', exact: true }).click();
      await page.getByRole('button', { name: 'Undo', exact: true }).waitFor({ state: 'visible' });
      await page.waitForFunction(
        () =>
          ![...document.querySelectorAll('button')].find((button) => button.textContent === 'Undo')
            ?.disabled,
      );
      await page.getByRole('button', { name: 'Undo', exact: true }).click();
      await page.waitForFunction(
        () =>
          ![...document.querySelectorAll('button')].find((button) => button.textContent === 'Redo')
            ?.disabled,
      );
      await page.getByRole('button', { name: 'Redo', exact: true }).click();
    }
    if (demo === 'ics') {
      await page.getByRole('button', { name: 'Import ICS', exact: true }).click();
      await page.locator('[data-mc-event^="imported"]').first().waitFor();
      await page.getByRole('button', { name: 'Export ICS', exact: true }).click();
      await page.waitForFunction(() =>
        document.querySelector('textarea').value.includes('BEGIN:VEVENT'),
      );
    }
    if (demo === 'timeline-tree') {
      const rows = page.locator('[data-mc-resource-key]');
      if ((await rows.count()) === 0 || (await rows.count()) >= 121)
        throw new Error('Timeline tree did not window resource rows');
      await page.getByLabel('RTL direction', { exact: true }).check();
      await page.waitForFunction(() => document.querySelector('[data-mc-root]').dir === 'rtl');
    }
  }
  await page.goto(`${origin}${siteBase}index.html?lang=en&theme=dark`);
  await page.getByRole('heading', { name: 'A schedule that fits the way you work.' }).waitFor();
  await page.getByLabel('Search features', { exact: true }).fill('Undo');
  if ((await page.locator('#features article').count()) !== 1)
    throw new Error('Feature search did not isolate history');
  await page.getByLabel('Search features', { exact: true }).fill('does-not-exist');
  await page.getByRole('status').filter({ hasText: 'No features found.' }).waitFor();
  await page.getByLabel('Search features', { exact: true }).fill('');
  await page
    .locator('.site-feature-categories button')
    .filter({ hasText: 'Resources and availability' })
    .click();
  if ((await page.locator('#features .site-feature-group').count()) !== 1)
    throw new Error('Feature category filtering failed');
  await page.locator('.site-feature-categories button').first().click();

  for (const theme of ['light', 'dark']) {
    await page.goto(`${origin}${siteBase}index.html?lang=en&theme=${theme}`);
    const contrasts = await page.evaluate(() => {
      const luminance = (color) => {
        const channels = color
          .match(/[\d.]+/g)
          .slice(0, 3)
          .map(Number)
          .map((channel) => {
            const normalized = channel / 255;
            return normalized <= 0.04045
              ? normalized / 12.92
              : ((normalized + 0.055) / 1.055) ** 2.4;
          });
        return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
      };
      const background = getComputedStyle(document.documentElement).backgroundColor;
      return [
        '.calendara-site-brand',
        '.site-introduction h1',
        '.site-introduction p',
        '.site-introduction .site-primary',
      ].map((selector) => {
        const element = document.querySelector(selector);
        const style = getComputedStyle(element);
        const ownBackground = style.backgroundColor;
        const values = [
          luminance(style.color),
          luminance(ownBackground === 'rgba(0, 0, 0, 0)' ? background : ownBackground),
        ].sort((left, right) => right - left);
        return { selector, ratio: (values[0] + 0.05) / (values[1] + 0.05) };
      });
    });
    if (contrasts.some(({ ratio }) => ratio < 4.5))
      throw new Error(`Brand contrast in ${theme}: ${JSON.stringify(contrasts)}`);
    await page.screenshot({ path: `output/layout-review/brand-${theme}.png` });
  }

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
