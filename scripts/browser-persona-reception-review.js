async (page) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.mouse.up();
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.reload();
  await page.getByRole('button', { name: 'Restaurar data de exemplo', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Aplicar restrições de horário' }).uncheck();
  await page.getByRole('combobox', { name: 'Capacidade padrão', exact: true }).selectOption('1');
  await page
    .getByRole('combobox', { name: 'Capacidade Sala 2', exact: true })
    .selectOption('unlimited');
  await page.getByRole('button', { name: 'Recursos', exact: true }).click();
  const dialog = page.locator('dialog.demo-editor');
  const editorRoom = (name) => dialog.getByRole('checkbox', { name, exact: true });
  const title = () => dialog.getByRole('textbox', { name: 'Título', exact: true });
  const save = () => dialog.getByRole('button', { name: 'Salvar evento', exact: true }).click();
  const setInterval = async (start, end) => {
    await dialog.getByLabel('Início', { exact: true }).fill(`2026-10-07T${start}`);
    await dialog.getByLabel('Término', { exact: true }).fill(`2026-10-07T${end}`);
  };
  const clickSlot = async (room, minute) => {
    const slot = page.locator(`[data-mc-resource="${room}"] [data-mc-cell-start="${minute}"]`);
    await slot.scrollIntoViewIfNeeded();
    const rect = await slot.boundingBox();
    if (!rect) throw new Error('Slot da sala não encontrado');
    await page.mouse.click(rect.x + rect.width / 2, rect.y + 2);
    await dialog.waitFor({ state: 'visible' });
  };
  const card = (room, name) =>
    page.locator(`[data-mc-resource="${room}"] [data-mc-event][title="${name}"]`);

  // A receptionist starts in a room column, then edits the time into a busy
  // interval. Unlimited room capacity must override the stricter global default.
  await clickSlot('sala-2', 750);
  if (!(await editorRoom('Sala 2').isChecked()) || (await editorRoom('Sala 1').isChecked()))
    throw new Error('Clique na Sala 2 perdeu o recurso selecionado ao abrir o editor');
  await title().fill('Coleta paralela');
  await setInterval('11:15', '11:45');
  await save();
  await dialog.waitFor({ state: 'hidden' });
  await card('sala-2', 'Coleta paralela').waitFor();
  if (await card('sala-1', 'Coleta paralela').count())
    throw new Error('Criação entrou na sala incorreta');
  await page.getByRole('button', { name: 'Mês', exact: true }).click();
  await page.getByRole('button', { name: 'Recursos', exact: true }).click();
  await card('sala-2', 'Coleta paralela').click();
  if (
    (await dialog.getByLabel('Início', { exact: true }).inputValue()).slice(0, 16) !==
    '2026-10-07T11:15'
  )
    throw new Error('Reserva aceita perdeu horário depois de trocar views e reabrir editor');
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();

  // Reducing capacity must affect editor validation as well as pointer moves,
  // while a rejected edit must leave the previously accepted event untouched.
  await page.getByRole('combobox', { name: 'Capacidade Sala 2', exact: true }).selectOption('1');
  await card('sala-2', 'Coleta paralela').click();
  await title().fill('Alteração recusada');
  await save();
  await dialog.getByRole('alert').filter({ hasText: 'over-capacity' }).waitFor();
  if (
    !(await card('sala-2', 'Coleta paralela').count()) ||
    (await card('sala-2', 'Alteração recusada').count())
  )
    throw new Error('Editor alterou evento controlado mesmo após recusa de capacidade');
  await setInterval('12:00', '12:30');
  await title().fill('Coleta reagendada');
  await save();
  await dialog.waitFor({ state: 'hidden' });
  await card('sala-2', 'Coleta reagendada').waitFor();

  // With capacity one, Sala 1's 09–10 consultation reserves preparation until
  // 10:15. Unlimited capacity permits overlapping buffered reservations too.
  await page.getByRole('combobox', { name: 'Capacidade Sala 1', exact: true }).selectOption('1');
  await clickSlot('sala-1', 900);
  await title().fill('Coleta após preparação');
  await setInterval('10:00', '10:15');
  await save();
  await dialog.getByRole('alert').filter({ hasText: 'buffer-conflict' }).waitFor();
  await setInterval('10:15', '10:30');
  await save();
  await dialog.waitFor({ state: 'hidden' });
  await card('sala-1', 'Coleta após preparação').waitFor();
  // Fixed closures retain their coordinates; preparation belongs to its event.
  await page.getByRole('checkbox', { name: 'Aplicar restrições de horário' }).check();
  const roomColumn = page.locator('[data-mc-resource="sala-1"][data-mc-slot="y"]');
  const overlayPositions = () =>
    roomColumn.evaluate((column) => ({
      blocked: Array.from(
        column.querySelectorAll('[data-mc-blocked]'),
        (overlay) => overlay.style.top,
      ),
      buffers: Array.from(
        column.querySelectorAll('[data-mc-buffer]'),
        (overlay) => overlay.style.top,
      ),
    }));
  const overlaysBeforeMove = await overlayPositions();
  if (!overlaysBeforeMove.blocked.length || !overlaysBeforeMove.buffers.length)
    throw new Error('Closure and preparation overlays must both be visible');
  const consultation = card('sala-1', 'Consulta inicial');
  await consultation.scrollIntoViewIfNeeded();
  const destinationSlot = roomColumn.locator('[data-mc-cell-start="480"]');
  await destinationSlot.scrollIntoViewIfNeeded();
  const destinationBounds = await destinationSlot.boundingBox();
  const visibleConsultationBounds = await consultation.boundingBox();
  await page.mouse.move(
    visibleConsultationBounds.x + visibleConsultationBounds.width / 2,
    visibleConsultationBounds.y + 12,
  );
  await page.mouse.down();
  await page.mouse.move(
    destinationBounds.x + destinationBounds.width / 2,
    destinationBounds.y + 12,
    { steps: 8 },
  );
  await page.mouse.up();
  await page.waitForFunction(
    () =>
      document
        .querySelector('[data-mc-resource="sala-1"] [data-mc-event][title="Consulta inicial"]')
        ?.getAttribute('data-mc-start-min') === '480',
  );
  const overlaysAfterMove = await overlayPositions();
  if (JSON.stringify(overlaysBeforeMove.blocked) !== JSON.stringify(overlaysAfterMove.blocked))
    throw new Error('Moving an event displaced the fixed lunch closure');
  if (JSON.stringify(overlaysBeforeMove.buffers) === JSON.stringify(overlaysAfterMove.buffers))
    throw new Error('Preparation failed to follow its moved event');
  await page.screenshot({ path: 'output/layout-review/persona-reception.png', fullPage: true });
  if (errors.length) throw new Error(errors.join('; '));
  return [
    'Recepção: clique preenche sala; limite próprio ilimitado vence padrão global',
    'Recepção: criação aceita sobrevive troca de views; recusa no editor preserva estado',
    'Recepção: sala com capacidade 1 respeita preparação e libera exatamente ao fim do buffer',
    'Recepção: almoço permanece fixo; preparação acompanha seu evento ao mover',
  ];
};
