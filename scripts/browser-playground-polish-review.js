async (page) => {
  const origin = new URL(page.url()).origin;
  const siteBase = page.url().includes('/calendara/') ? '/calendara/' : '/';
  const playground = `${origin}${siteBase}examples/react.html`;
  const runtimeErrors = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  const results = [];
  const check = (condition, message) => {
    if (!condition) throw new Error(message);
    results.push(message);
  };
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${playground}?lang=en&theme=dark&view=summary`);
  await page.locator('[data-mc-root][data-mc-view="summary"]').waitFor();
  await page.getByRole('heading', { name: 'Daily summary', exact: true }).waitFor();
  check(
    (await page.locator('html').getAttribute('lang')) === 'en',
    'Playground language is English',
  );
  check(
    (await page.locator('html').getAttribute('data-theme')) === 'dark',
    'Explicit dark theme applied',
  );
  check(
    (await page.locator('.demo-summary-list li').count()) === 4,
    'Daily summary contains every occurrence',
  );
  check(
    (await page.locator('.demo-summary-list').innerText()).includes('Room 2'),
    'Summary displays assigned resources',
  );
  check(
    (await page.locator('.demo-summary-list').innerText()).includes('Recurring'),
    'Summary distinguishes recurring appointments',
  );
  check(
    (await page.locator('.demo-summary-list time').count()) === 4,
    'Summary displays appointment intervals',
  );
  const documentationHref = await page
    .getByRole('link', { name: 'Documentation', exact: true })
    .getAttribute('href');
  check(
    documentationHref.includes('lang=en') && documentationHref.includes('theme=dark'),
    'Documentation link preserves language and theme',
  );
  await page.screenshot({ path: 'output/layout-review/playground-summary-dark-en.png' });
  await page.getByRole('link', { name: 'Back to documentation', exact: true }).click();
  await page
    .getByRole('heading', { name: 'A schedule that fits the way you work.', exact: true })
    .waitFor();
  check(
    new URL(page.url()).searchParams.get('lang') === 'en',
    'Return link opens English documentation',
  );
  check(
    (await page.locator('html').getAttribute('data-theme')) === 'dark',
    'Return link preserves dark theme',
  );
  await page.goto(`${playground}?lang=en&theme=dark&view=summary`);
  await page.getByRole('heading', { name: 'Daily summary', exact: true }).waitFor();

  await page.getByLabel('Reject next save', { exact: true }).check();
  await page.locator('.demo-summary-list button').filter({ hasText: 'Weekly follow-up' }).click();
  const editor = page.getByRole('dialog');
  const editorContrast = await editor.evaluate((dialog) => {
    const luminance = (color) => {
      const channels = color
        .match(/[\d.]+/g)
        .slice(0, 3)
        .map(Number)
        .map((channel) => {
          const normalized = channel / 255;
          return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
        });
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    };
    const contrast = (foreground, background) => {
      const values = [luminance(foreground), luminance(background)].sort(
        (first, second) => second - first,
      );
      return (values[0] + 0.05) / (values[1] + 0.05);
    };
    const surface = getComputedStyle(dialog).backgroundColor;
    return [...dialog.querySelectorAll('label, legend, input:not([type="checkbox"]), select')].map(
      (element) => {
        const style = getComputedStyle(element);
        const background =
          style.backgroundColor === 'rgba(0, 0, 0, 0)' ? surface : style.backgroundColor;
        return contrast(style.color, background);
      },
    );
  });
  check(
    editorContrast.every((ratio) => ratio >= 4.5),
    'Dark editor labels, legends and fields meet 4.5:1 contrast',
  );
  await page.screenshot({ path: 'output/layout-review/playground-editor-dark-en.png' });
  await editor.getByLabel('Apply changes', { exact: true }).selectOption('series');
  await editor.getByLabel('Repeat', { exact: true }).selectOption('YEARLY');
  await editor.getByLabel('Recurring month', { exact: true }).waitFor();
  await editor.getByLabel('Recurring day of month', { exact: true }).waitFor();
  check(
    (await editor.getByLabel('Recurring month').locator('option').first().innerText()) ===
      'January',
    'Yearly editor fields and months are localized',
  );
  await editor.getByLabel('Repeat', { exact: true }).selectOption('WEEKLY');
  await editor.getByLabel('Monday', { exact: true }).waitFor();
  await editor.getByLabel('Title', { exact: true }).fill('Rejected editor title');
  await editor.getByRole('button', { name: 'Save event', exact: true }).click();
  await editor.getByRole('alert').filter({ hasText: 'Could not save the event.' }).waitFor();
  await editor.getByRole('button', { name: 'Cancel', exact: true }).click();
  check(
    (await page.locator('.demo-summary-list').innerText()).includes('Weekly follow-up'),
    'Rejected form save preserves the original event',
  );
  check(
    !(await page.locator('.demo-summary-list').innerText()).includes('Rejected editor title'),
    'Rejected form does not persist edited data',
  );

  await page
    .getByRole('group', { name: 'Theme', exact: true })
    .getByRole('button', { name: 'Light', exact: true })
    .click();
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'light');
  await page.reload();
  await page.locator('[data-mc-root]').waitFor();
  check(
    (await page.locator('html').getAttribute('data-theme')) === 'light',
    'Theme selection survives reload and updates URL',
  );

  await page.goto(`${playground}?lang=en&theme=dark&view=day&scenario=external-drag`);
  await page.locator('[data-mc-root][data-mc-view="day"]').waitFor();
  await page.getByLabel('Slot size', { exact: true }).selectOption('1');
  const source = page.getByRole('button', {
    name: 'Drag external appointment · 30 minutes',
    exact: true,
  });
  const dropZone = page.locator('[data-demo-drop-zone]');
  const root = page.locator('[data-mc-root]');
  const drag = async ({ sourceLocator, destinationLocator, expectPreview }) => {
    await destinationLocator.scrollIntoViewIfNeeded();
    const sourceBounds = await sourceLocator.boundingBox();
    const targetBounds = await destinationLocator.boundingBox();
    if (!sourceBounds || !targetBounds)
      throw new Error('External drag source or destination is not visible');
    await page.mouse.move(
      sourceBounds.x + sourceBounds.width / 2,
      sourceBounds.y + Math.min(sourceBounds.height / 2, 20),
    );
    await page.mouse.down();
    await page.mouse.move(
      targetBounds.x + targetBounds.width / 2,
      targetBounds.y + Math.min(targetBounds.height / 2, 10),
      { steps: 12 },
    );
    if (expectPreview) await root.locator('[data-mc-draft]').first().waitFor({ timeout: 3000 });
    await page.mouse.up();
  };
  const emptySlot = root.locator('[data-mc-cell-start="840"]').first();
  await page.getByLabel('Reject next save', { exact: true }).check();
  await drag({ sourceLocator: source, destinationLocator: emptySlot, expectPreview: true });
  await page
    .getByRole('status')
    .filter({ hasText: 'external appointment was not inserted' })
    .waitFor();
  check(
    (await root.locator('[data-mc-event]').filter({ hasText: 'External appointment' }).count()) ===
      0,
    'Rejected external insertion preserves calendar state',
  );

  await drag({ sourceLocator: source, destinationLocator: emptySlot, expectPreview: true });
  const inserted = root
    .locator('[data-mc-event]')
    .filter({ hasText: 'External appointment' })
    .first();
  await inserted.waitFor();
  await page.getByLabel('Reject next save', { exact: true }).check();
  await inserted.scrollIntoViewIfNeeded();
  await drag({ sourceLocator: inserted, destinationLocator: dropZone, expectPreview: false });
  await page.getByRole('status').filter({ hasText: 'event remains in the calendar' }).waitFor();
  check(
    (await root.locator('[data-mc-event]').filter({ hasText: 'External appointment' }).count()) ===
      1,
    'Rejected outgoing transfer preserves the appointment',
  );
  await inserted.scrollIntoViewIfNeeded();
  await drag({ sourceLocator: inserted, destinationLocator: dropZone, expectPreview: false });
  await dropZone.locator('.demo-outside-event').waitFor();
  check(
    (await root.locator('[data-mc-event]').filter({ hasText: 'External appointment' }).count()) ===
      0,
    'Accepted outgoing transfer removes the controlled event',
  );
  await drag({
    sourceLocator: dropZone.locator('.demo-outside-event'),
    destinationLocator: emptySlot,
    expectPreview: true,
  });
  await inserted.waitFor();
  check(
    (await dropZone.locator('.demo-outside-event').count()) === 0,
    'Returning an archived appointment consumes its external card',
  );
  await page.screenshot({ path: 'output/layout-review/playground-external-panel-dark.png' });

  await page.goto(`${playground}?lang=en&theme=dark&view=day&scenario=overflow`);
  await page.locator('[data-mc-root][data-mc-view="day"]').waitFor();
  check(
    (await page.getByLabel('Concurrent events', { exact: true }).inputValue()) === 'more',
    'Overflow scenario configures the demonstration',
  );
  check(
    (await page.getByLabel('Default capacity', { exact: true }).inputValue()) === 'unlimited',
    'Overflow demonstration separates visual overlap from capacity',
  );
  for (const width of [375, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => window.scrollTo(0, 0));
    check(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
      `Playground has no page-level horizontal overflow at ${width}px`,
    );
    const panelBounds = await page.locator('.demo-controls').boundingBox();
    check(
      panelBounds.x >= 0 &&
        panelBounds.x + panelBounds.width <= width &&
        panelBounds.y + panelBounds.height <= 900,
      `External controls fit the ${width}px viewport`,
    );
    await page.screenshot({ path: `output/layout-review/playground-dark-en-mobile-${width}.png` });
  }
  await page.goto(`${playground}?lang=en&theme=dark&view=resources`);
  await page.locator('[data-mc-root][data-mc-view="resources"]').waitFor();
  await page
    .getByRole('spinbutton', { name: 'Preparation after (minutes)', exact: true })
    .fill('30');
  await page
    .getByRole('spinbutton', { name: 'Preparation before (minutes)', exact: true })
    .fill('10');
  await page.getByText(/Brown band: Room 1 preparation, 10 minutes before and 30 after/).waitFor();
  await page.getByRole('checkbox', { name: 'Room 1 preparation', exact: true }).uncheck();
  check(
    await page
      .getByRole('spinbutton', { name: 'Preparation after (minutes)', exact: true })
      .isDisabled(),
    'Preparation can be disabled and configured',
  );
  await page.getByText(/Brown band: Room 1 preparation, 0 minutes before and 0 after/).waitFor();
  check(
    await page
      .locator('.demo-tools input[type="number"]')
      .evaluateAll((inputs) =>
        inputs.every(
          (input) =>
            input.getBoundingClientRect().width <=
            input.parentElement.getBoundingClientRect().width + 1,
        ),
      ),
    'Number controls remain bounded by their container',
  );
  if (runtimeErrors.length) throw new Error(runtimeErrors.join('\n'));
  return results;
};
