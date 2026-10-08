// Personal agenda: keyboard-only editing, isolated recurrence and mobile selection.
// Run through playwright-cli run-code after loading examples/react.html.
async (page) => {
  const results = [];
  const check = (condition, label) => {
    if (!condition) throw new Error(label);
    results.push(label);
  };
  const view = async (name) => {
    const button = page.getByRole('button', { name, exact: true });
    if (await button.isVisible()) await button.click();
    else
      await page
        .getByRole('combobox', { name: 'Visualização', exact: true })
        .selectOption({ label: name });
  };
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.reload();
  await page.getByRole('button', { name: 'Restaurar data de exemplo', exact: true }).click();
  await view('Mês');
  const more = page.locator('[data-mc-month-day="2026-10-07"] .mc-month-more');
  await more.focus();
  await page.keyboard.press('Enter');
  await page.locator('.mc-month-popover').waitFor();
  await page.waitForFunction(() => document.activeElement?.matches('.mc-month-popover h3'));
  check(
    await page.evaluate(() => document.activeElement?.closest('.mc-month-popover') !== null),
    'Popover aberto por teclado recebe foco',
  );
  await page.keyboard.press('Escape');
  await page.locator('.mc-month-popover').waitFor({ state: 'hidden' });
  check(
    await more.evaluate((element) => element === document.activeElement),
    'Escape devolve foco ao botão +Mais',
  );

  // Edit a middle occurrence and assert adjacent occurrences retain their titles/dates.
  const repeat = page.locator('[data-mc-month-event^="retorno@"]');
  const before = await repeat.evaluateAll((nodes) =>
    nodes.map((node) => ({
      key: node.dataset.mcEvent,
      title: node.title,
      dates: node.dataset.mcMonthDates,
    })),
  );
  // Attribute selector avoids relying on text or occurrence ordering.
  const chosen = page.locator(
    '[data-mc-month-event^="retorno@"][data-mc-month-dates~="2026-10-14"]',
  );
  await chosen.focus();
  await page.keyboard.press('Enter');
  await page.getByRole('dialog').waitFor();
  const title = page.getByRole('textbox', { name: 'Título', exact: true });
  await page.waitForFunction(
    () =>
      document.activeElement?.tagName === 'INPUT' &&
      document.activeElement?.labels?.[0]?.textContent === 'Título',
  );
  check(
    (await page.getByLabel('Aplicar alterações').inputValue()) === 'occurrence',
    'Editor recorrente inicia com escopo somente esta ocorrência',
  );
  await page.keyboard.press('Shift+Tab');
  check(
    await page.evaluate(() => Boolean(document.activeElement?.closest('dialog[open]'))),
    'Foco permanece no modal ao voltar a partir do primeiro campo',
  );
  await title.fill('Retorno pessoal revisado');
  await page.getByRole('button', { name: 'Salvar evento', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  check(
    (await chosen.getAttribute('title')) === 'Retorno pessoal revisado',
    'Edição por teclado salva ocorrência escolhida',
  );
  const after = await repeat.evaluateAll((nodes) =>
    nodes.map((node) => ({
      key: node.dataset.mcEvent,
      title: node.title,
      dates: node.dataset.mcMonthDates,
    })),
  );
  check(
    before
      .filter((event) => !event.dates.includes('2026-10-14'))
      .every((original) =>
        after.some((event) => JSON.stringify(event) === JSON.stringify(original)),
      ),
    'Editar ocorrência intermediária preserva anteriores e posteriores',
  );

  await chosen.focus();
  await page.keyboard.press('Enter');
  await page.getByRole('dialog').waitFor();
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  check(
    await chosen.evaluate((element) => element === document.activeElement),
    'Escape no editor retorna foco ao evento da agenda',
  );

  await view('Dia');
  const snapshot = () =>
    page.locator('[data-mc-day] [data-mc-event]').evaluateAll((nodes) =>
      nodes
        .map((node) => ({
          id: node.dataset.mcEvent,
          start: node.dataset.mcStartMin,
          end: node.dataset.mcEndMin,
          title: node.title,
        }))
        .sort((a, b) => a.id.localeCompare(b.id)),
    );
  const original = await snapshot();
  await page.getByRole('combobox', { name: 'Duração do slot', exact: true }).selectOption('15');
  await page
    .getByRole('combobox', { name: 'Intervalo dos rótulos', exact: true })
    .selectOption('60');
  await page.getByRole('combobox', { name: 'Tamanho do slot', exact: true }).selectOption('2');
  check(
    JSON.stringify(await snapshot()) === JSON.stringify(original),
    'Alterar duração, tamanho e rótulos dos slots preserva horários e eventos',
  );
  await page.getByRole('combobox', { name: 'Duração do slot', exact: true }).selectOption('60');
  check(
    JSON.stringify(await snapshot()) === JSON.stringify(original),
    'Slots de uma hora não arredondam eventos já existentes',
  );

  await page.setViewportSize({ width: 375, height: 850 });
  await view('Mês');
  await page.locator('.mc-month-compact').waitFor();
  const selected = page.locator('[data-mc-month-day="2026-10-14"] button.mc-month-daynum');
  await selected.click();
  await page.locator('[data-mc-month-detail-event][class="mc-list-item"]').first().waitFor();
  check(
    (await selected.getAttribute('aria-pressed')) === 'true',
    'Mês mobile mantém dia selecionado explícito para acessibilidade',
  );
  check(
    await page
      .locator('.mc-month-detail')
      .innerText()
      .then((text) => text.includes('Retorno pessoal revisado')),
    'Lista mobile mostra ocorrência previamente editada',
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.waitForFunction(() => !document.querySelector('.mc-month-compact'));
  check((await page.locator('.mc-month').count()) === 1, 'Resize para desktop preserva view Mês');
  check(
    (await page
      .locator('[data-mc-month-day="2026-10-14"] button.mc-month-daynum')
      .getAttribute('tabindex')) === '0',
    'Resize preserva seleção do dia e ponto de entrada do teclado',
  );
  await page.screenshot({
    path: 'output/layout-review/persona-personal-after.png',
    fullPage: true,
  });
  return results;
};
