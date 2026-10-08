async (page) => {
  await page.reload();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.evaluate(async () => {
    const { CalendarApp, dayView, monthView, createReactView, ensureTemporal } = await import('/src/index.ts');
    document.querySelector('main').style.display = 'none';
    const host = document.createElement('div');
    host.id = 'view-selection-fixture';
    document.body.append(host);
    const app = new CalendarApp({ date: '2026-10-07', temporal: await ensureTemporal(), views: [dayView, monthView] });
    app.mount(host);
    await app.ready();
    window.viewSelection = { app, dayView, monthView, createReactView };
  });
  const fixture = page.locator('#view-selection-fixture');
  await fixture.locator('[data-mc-day]').waitFor();
  const names = await page.evaluate(() => window.viewSelection.app.listViews().map(view => view.name));
  if (names.join(',') !== 'day,month') throw new Error('Views não escolhidas continuam registradas');
  await fixture.getByRole('button', { name: 'Mês', exact: true }).click();
  await fixture.locator('.mc-month').waitFor();
  await page.evaluate(() => {
    const { app, dayView, monthView } = window.viewSelection;
    app.setViews([monthView, dayView]);
    if (app.listViews()[0].name !== 'month') throw new Error('Ordem não atualizada');
    app.setViews([dayView]);
    if (app.getState().viewName !== 'day') throw new Error('Remover view ativa não selecionou primeira disponível');
    try { app.setViews([]); throw new Error('Lista vazia aceita'); }
    catch (error) { if (!error.message.includes('pelo menos uma view')) throw error; }
    if (app.listViews().length !== 1) throw new Error('Lista inválida alterou registro');
    app.setViews(undefined);
    if (app.listViews().length !== 4) throw new Error('Padrão não restaurado');
    const custom = window.viewSelection.createReactView({ name: 'custom-only', label: 'Própria' }, () => 'Somente nossa view');
    app.setViews([custom]);
  });
  await fixture.getByText('Somente nossa view', { exact: true }).waitFor();
  await page.screenshot({ path: 'output/layout-review/view-selection-custom-only.png', fullPage: true });
  return ['Lista exata e ordem das views respeitadas', 'Remover view ativa seleciona a primeira disponível',
    'Lista inválida preserva registro', 'Padrão opcional restaurado', 'Calendário com apenas view React própria'];
}
