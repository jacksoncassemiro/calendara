async (page) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.reload();
  await page.getByRole('button', { name: 'Restaurar data de exemplo', exact: true }).click();
  await page.getByRole('button', { name: 'Dia', exact: true }).click();
  const slot = page.locator('[data-mc-day="2026-10-07"] [data-mc-cell-start="900"]');
  await slot.scrollIntoViewIfNeeded();
  const rect = await slot.boundingBox();
  await page.mouse.click(rect.x + rect.width - 2, rect.y + 2);
  const editor = page.locator('dialog.demo-editor');
  await editor.waitFor({ state: 'visible' });
  await editor.getByLabel('Título', { exact: true }).fill('Auditoria recorrência semanal');
  await editor.getByLabel('Repetir', { exact: true }).selectOption('WEEKLY');
  await editor.getByLabel('Intervalo da repetição', { exact: true }).fill('1');
  await editor.getByRole('checkbox', { name: 'Segunda-feira', exact: true }).check();
  await editor.getByRole('checkbox', { name: 'Quarta-feira', exact: true }).check();
  await editor.getByLabel('Fim da repetição', { exact: true }).selectOption('count');
  await editor.getByLabel('Quantidade de ocorrências', { exact: true }).fill('4');
  await page.screenshot({
    path: 'output/layout-review/recurrence-editor-weekly.png',
    fullPage: true,
  });
  await editor.getByRole('button', { name: 'Salvar evento', exact: true }).click();
  await editor.waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: 'Mês', exact: true }).click();
  const cards = page.locator('[data-mc-month-event][title="Auditoria recorrência semanal"]');
  const dates = await cards.evaluateAll((nodes) =>
    nodes.map((node) => node.dataset.mcMonthDates).sort(),
  );
  await page.locator('[data-mc-month-day="2026-10-07"] .mc-month-more').click();
  const hidden = page
    .locator('.mc-month-popover [data-mc-event]')
    .filter({ hasText: 'Auditoria recorrência semanal' });
  await hidden.waitFor();
  if ((await hidden.count()) === 1) dates.push(await hidden.getAttribute('data-mc-event-date'));
  dates.sort();
  await page.keyboard.press('Escape');
  if (
    JSON.stringify(dates) !==
    JSON.stringify(['2026-10-07', '2026-10-12', '2026-10-14', '2026-10-19'])
  )
    throw new Error('Datas semanais divergentes: ' + JSON.stringify(dates));
  await cards.first().click();
  await editor.waitFor({ state: 'visible' });
  await editor.getByLabel('Aplicar alterações', { exact: true }).selectOption('series');
  await editor.getByLabel('Repetir', { exact: true }).selectOption('YEARLY');
  await editor.getByLabel('Mês da repetição', { exact: true }).selectOption('10');
  await editor.getByLabel('Dia do mês da repetição', { exact: true }).fill('7');
  await editor.getByLabel('Fim da repetição', { exact: true }).selectOption('until');
  await editor.getByLabel('Data final da repetição', { exact: true }).fill('2026-10-06');
  await editor.getByRole('button', { name: 'Salvar evento', exact: true }).click();
  await editor.getByRole('alert').filter({ hasText: 'posterior ao início' }).waitFor();
  if ((await cards.count()) !== 3) throw new Error('Regra inválida alterou série aceita');
  await editor.getByRole('button', { name: 'Cancelar', exact: true }).click();
  return [
    'Editor semanal gera quatro datas em segunda/quarta',
    'Campos anuais e término por data disponíveis',
    'Regra inválida rejeitada preserva série',
  ];
};
