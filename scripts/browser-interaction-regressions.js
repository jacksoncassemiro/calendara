async (page) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.reload();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'Voltar ao exemplo', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Aplicar restrições de horário', exact: true }).check();
  await page.getByRole('button', { name: 'Dia', exact: true }).click();
  for (const minute of [435, 735]) {
    const slot = page.locator(`[data-mc-cell-start="${minute === 435 ? 420 : 720}"]`).first();
    await slot.scrollIntoViewIfNeeded();
    const rect = await slot.boundingBox();
    await page.mouse.click(rect.x + rect.width / 2, rect.y + rect.height / 2);
    if (await page.locator('.mc-event-editor').count())
      throw new Error(`Modal abriu em horário bloqueado: ${minute}`);
    await page.waitForFunction(() =>
      document.querySelector('.demo-feedback').textContent.includes('indisponível'),
    );
  }
  await page
    .getByRole('checkbox', { name: 'Aplicar restrições de horário', exact: true })
    .uncheck();
  await page.getByRole('button', { name: 'Recursos', exact: true }).click();
  for (const [resource, minute, reason] of [['sala-1', 600, 'preparação']]) {
    const slot = page.locator(`[data-mc-resource="${resource}"] [data-mc-cell-start="${minute}"]`);
    await slot.scrollIntoViewIfNeeded();
    const rect = await slot.boundingBox();
    // Click in free space in the occupied row, outside the event box.
    await page.mouse.click(rect.x + rect.width - 3, rect.y + rect.height - 2);
    await page.waitForFunction(
      (reason) => document.querySelector('.demo-feedback').textContent.includes(reason),
      reason,
    );
    if (await page.locator('.mc-event-editor').count())
      throw new Error(`Modal abriu apesar do conflito ${reason}`);
  }
  await page.getByRole('button', { name: 'Mês', exact: true }).click();
  const handle = page.locator('[data-mc-month-event^="congresso@"] [data-mc-resize="end"]');
  await handle.scrollIntoViewIfNeeded();
  const a = await handle.boundingBox();
  const target = await page.locator('[data-mc-month-day="2026-10-10"]').boundingBox();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x + target.width / 2, target.y + 60, { steps: 10 });
  await page.locator('[data-mc-draft]').waitFor();
  const drafts = await page.locator('[data-mc-draft]').count();
  if (
    drafts !== 1 ||
    (await page.locator('[data-mc-draft]').getAttribute('data-mc-draft-dates')) !==
      '2026-10-06 2026-10-07 2026-10-08 2026-10-09 2026-10-10'
  )
    throw new Error('Prévia de resize fragmentada ou intervalo incorreto');
  const draft = await page.locator('[data-mc-draft]').boundingBox();
  const week = await page
    .locator('[data-mc-draft]')
    .evaluate((el) => el.closest('.mc-month-week').getBoundingClientRect().bottom);
  if (draft.y + draft.height > week + 1) throw new Error('Prévia invade a próxima semana');
  await page.screenshot({ path: 'output/layout-review/month-resize-preview.png', fullPage: true });
  await page.mouse.up();
  await page.waitForFunction(
    () =>
      document.querySelector('[data-mc-month-event^="congresso@"]')?.dataset.mcMonthDates ===
      '2026-10-06 2026-10-07 2026-10-08 2026-10-09 2026-10-10',
  );
  const bar = page.locator('[data-mc-month-event^="congresso@"]');
  await bar.scrollIntoViewIfNeeded();
  const from = await bar.boundingBox();
  const destination = await page.locator('[data-mc-month-day="2026-10-13"]').boundingBox();
  await page.mouse.move(from.x + 30, from.y + 10);
  await page.mouse.down();
  await page.mouse.move(destination.x + 30, destination.y + 50, { steps: 10 });
  await page.waitForFunction(
    () =>
      document.querySelector('[data-mc-draft]')?.dataset.mcDraftDates ===
      '2026-10-13 2026-10-14 2026-10-15 2026-10-16 2026-10-17',
  );
  if (
    (await page.locator('[data-mc-draft]').count()) !== 1 ||
    !(await page.locator('[data-mc-draft]').innerText()).includes('Congresso')
  )
    throw new Error('Prévia de movimento perdeu barra/título');
  await page.mouse.up();
  await page.waitForFunction(
    () =>
      document.querySelector('[data-mc-month-event^="congresso@"]')?.dataset.mcMonthDates ===
      '2026-10-13 2026-10-14 2026-10-15 2026-10-16 2026-10-17',
  );
  await page.evaluate(() => {
    window.savedNow = Date.now;
    Date.now = () => Date.parse('2026-10-07T22:30:00Z');
  });
  await page.getByRole('button', { name: 'Linha do tempo', exact: true }).click();
  const now = page.locator('.mc-timeline-now');
  if ((await now.count()) !== 1) throw new Error('Linha de agora duplicada');
  const line = await now.boundingBox(),
    rows = await page.locator('.mc-timeline-rows').boundingBox();
  if (Math.abs(line.height - rows.height) > 1) throw new Error('Linha de agora fragmentada');
  await page.screenshot({
    path: 'output/layout-review/timeline-continuous-now.png',
    fullPage: true,
  });
  await page.evaluate(() => {
    Date.now = window.savedNow;
  });
  if (errors.length) throw new Error(errors.join('; '));
  return [
    'Clique fora do expediente recusado',
    'Clique no almoço recusado',
    'Resize no mês: uma barra contínua, commit aceito',
    'Timeline: uma linha de agora contínua',
  ];
};
