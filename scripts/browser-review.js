// Execute with yarn test:browser (server + isolated browser session + cleanup).
// Requires the React demo already loaded. No fixed sleeps; assertions wait for DOM state.
async page => {
  const runtimeErrors = [];
  page.on('pageerror', error => runtimeErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') runtimeErrors.push(message.text()); });
  await page.reload();
  const results = [];
  const changeView = async name => {
    const button = page.getByRole('button', { name, exact: true });
    if (await button.isVisible()) await button.click();
    else await page.getByRole('combobox', { name: 'Visualização', exact: true }).selectOption({ label: name });
  };
  const check = (condition, message) => { if (!condition) throw new Error(message); results.push(message); };
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('combobox',{name:'Espaçamento',exact:true}).selectOption('1');
  await page.getByRole('button', { name: 'Voltar ao exemplo', exact: true }).click();
  await page.getByRole('button', { name: 'Semana', exact: true }).click();
  await page.locator('[data-mc-event]').first().waitFor();
  const civilComparison = await page.evaluate(async () => {
    const { expandCivilEvent } = await import('/experiments/civil-recurrence/engine.mjs');
    const { expandEvent, getTemporal } = await import('/src/core/index.ts');
    const event = { id: 'experiment', calendarId: 'agenda', title: 'Base', time: { allDay: false,
      start: { dateTime: '2024-03-08T09:00:00', timeZone: 'America/New_York' },
      end: { dateTime: '2024-03-08T10:00:00', timeZone: 'America/New_York' } },
      recurrence: { rule: 'FREQ=DAILY;COUNT=5', exDates: ['2024-03-09T14:00:00Z'], rDates: ['2024-03-10T11:00:00'],
        overrides: { '2024-03-11T09:00:00': { title: 'Alterada' } } } };
    const expected = expandEvent(getTemporal(), event);
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'Temporal');
    try {
      Object.defineProperty(globalThis, 'Temporal', { value: undefined, writable: true, configurable: true });
      return JSON.stringify(expandCivilEvent(event)) === JSON.stringify(expected);
    } finally {
      if (descriptor) Object.defineProperty(globalThis, 'Temporal', descriptor);
      else delete globalThis.Temporal;
    }
  });
  check(civilComparison, 'Motor experimental: mesmas ocorrências/exceções no browser com Temporal global indisponível');
  check(await page.locator('[data-mc-day]').count() === 7, 'Semana: sete colunas');
  check(await page.locator('[data-mc-allday-event]').count() === 1 && await page.locator('[data-mc-allday-event]').getAttribute('data-mc-allday-dates') === '2026-10-06 2026-10-07 2026-10-08', 'Evento all-day: barra contínua de três dias e fim exclusivo');
  check(await page.locator('[data-mc-event^="plantao@"]').count() === 2, 'Evento noturno: dois segmentos');
  // Move and resize the whole all-day interval through actual pointer surfaces.
  await page.getByRole('checkbox', { name: 'Aplicar restrições de horário' }).uncheck();
  const allDayStart = page.locator('[data-mc-allday-cell="2026-10-06"] [data-mc-allday-event]');
  const a = await allDayStart.boundingBox();
  const targetCell = await page.locator('[data-mc-allday-cell="2026-10-08"]').boundingBox();
  await page.mouse.move(a.x + 15, a.y + 10); await page.mouse.down();
  await page.mouse.move(targetCell.x + 15, a.y + 10, {steps:8}); await page.mouse.up();
  await page.waitForFunction(()=>!document.querySelector('[data-mc-allday-cell="2026-10-06"] [data-mc-allday-event]') && !!document.querySelector('[data-mc-allday-dates~="2026-10-10"]'),null,{timeout:5000})
    .catch(async()=>{throw new Error(`All-day move: ${await page.evaluate(()=>JSON.stringify({feedback:document.querySelector('.demo-feedback')?.textContent,days:[...document.querySelectorAll('[data-mc-allday-event]')].map(x=>x.parentElement.dataset.mcAlldayCell)}))}`);});
  check(await page.locator('[data-mc-allday-event]').getAttribute('data-mc-allday-dates') === '2026-10-08 2026-10-09 2026-10-10', 'All-day drag: preserva duração e fim exclusivo');
  const resizeAllDay = await page.locator('[data-mc-allday-dates~="2026-10-10"] [data-mc-resize]').boundingBox();
  const lastCell = await page.locator('[data-mc-allday-cell="2026-10-11"]').boundingBox();
  await page.mouse.move(resizeAllDay.x + 4, resizeAllDay.y + 5); await page.mouse.down();
  await page.mouse.move(lastCell.x + 15, resizeAllDay.y + 5, {steps:8}); await page.mouse.up();
  await page.waitForFunction(()=>document.querySelector('[data-mc-allday-event]')?.getAttribute('data-mc-allday-dates')==='2026-10-08 2026-10-09 2026-10-10 2026-10-11',null,{timeout:5000})
    .catch(async()=>{throw new Error(`All-day resize: ${await page.locator('.demo-feedback').textContent()}`);});
  results.push('All-day resize: expande o intervalo completo');
  // Move a timed overnight event to another date, preserving its full duration.
  await page.locator('[data-mc-day="2026-10-07"] [data-mc-event^="plantao@"]').scrollIntoViewIfNeeded();
  const overnight = await page.locator('[data-mc-day="2026-10-07"] [data-mc-event^="plantao@"]').boundingBox();
  const nextDay = await page.locator('[data-mc-day="2026-10-08"]').boundingBox();
  await page.mouse.move(overnight.x + 15, overnight.y + 10); await page.mouse.down();
  await page.mouse.move(nextDay.x + 15, overnight.y + 10, {steps:8}); await page.mouse.up();
  await page.waitForFunction(()=>!!document.querySelector('[data-mc-day="2026-10-09"] [data-mc-event^="plantao@"][data-mc-end-min="540"]'));
  results.push('Multiday drag: preserva início e duração de todas as partes');
  await page.locator('[data-mc-day="2026-10-09"] [data-mc-event^="plantao@"] [data-mc-resize]').scrollIntoViewIfNeeded();
  const overnightHandle = await page.locator('[data-mc-day="2026-10-09"] [data-mc-event^="plantao@"] [data-mc-resize]').boundingBox();
  await page.mouse.move(overnightHandle.x+10,overnightHandle.y+2);await page.mouse.down();
  await page.mouse.move(overnightHandle.x+10,overnightHandle.y+62,{steps:8});await page.mouse.up();
  await page.waitForFunction(()=>!!document.querySelector('[data-mc-day="2026-10-09"] [data-mc-event^="plantao@"][data-mc-end-min="600"]'));
  results.push('Multiday resize: altera o fim sem truncar o início');
  await page.getByRole('checkbox', { name: 'Aplicar restrições de horário' }).check();
  await page.screenshot({ path: 'output/playwright/react-desktop.png', fullPage: true });
  for (const [button, selector] of [['Dia', '[data-mc-day]'], ['Mês', '[data-mc-month-day]'], ['Agenda', '[data-mc-list-item]'], ['Recursos', '[data-mc-resource]'], ['Linha do tempo', '[data-mc-timeline-row]'], ['3 dias', '[data-mc-day]']]) {
    await page.getByRole('button', { name: button, exact: true }).click();
    await page.locator(selector).first().waitFor();
    check(await page.locator(selector).count() > 0, `${button}: render e navegação`);
  }
  await page.getByRole('button', { name: 'Resumo', exact: true }).click();
  await page.getByRole('heading', { name: 'Resumo do dia' }).waitFor();
  await page.getByRole('button', { name: 'Recolher eventos' }).click();
  check(await page.locator('.demo-summary li').count() === 0, 'View React personalizada: hooks funcionam');
  await page.getByRole('button', { name: 'Mostrar eventos' }).click();
  await page.getByRole('button', { name: 'Consulta inicial', exact: true }).click();
  await page.getByRole('textbox', { name: 'Título', exact: true }).fill('Consulta revisada');
  await page.getByRole('button', { name: 'Salvar evento' }).click();
  await page.getByRole('button', { name: 'Consulta revisada', exact: true }).waitFor();
  results.push('Edição controlada React: título sincronizado');
  await page.getByRole('button', { name: 'Semana', exact: true }).click();
  const day = page.locator('[data-mc-day="2026-10-07"]');
  const event = page.locator('[data-mc-event^="consulta@"]');
  const bounds = await day.boundingBox();
  const box = await event.boundingBox();
  if (!bounds || !box) throw new Error('Missing event geometry');
  // Move 09:00→10:00 on the real pointer surface.
  await page.mouse.move(box.x + box.width / 2, box.y + 20);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + 80, { steps: 10 });
  await page.mouse.up();
  await page.waitForFunction(() => document.querySelector('[data-mc-event^="consulta@"]')?.getAttribute('data-mc-start-min') === '600');
  results.push('Drag React: novo horário aplicado');
  await page.getByRole('checkbox', { name: 'Recusar próxima gravação' }).check();
  const moved = await event.boundingBox();
  await page.mouse.move(moved.x + moved.width / 2, moved.y + 20);
  await page.mouse.down();
  await page.mouse.move(moved.x + moved.width / 2, moved.y + 260, { steps: 10 });
  await page.mouse.up();
  await page.waitForFunction(() => document.querySelector('.demo-feedback')?.textContent?.includes('Gravação recusada'));
  check(await event.getAttribute('data-mc-start-min') === '600', 'Rejeição: horário restaurado');
  const handle = event.locator('[data-mc-resize]');
  const resize = await handle.boundingBox();
  await page.mouse.move(resize.x + resize.width / 2, resize.y + resize.height / 2);
  await page.mouse.down();
  await page.mouse.move(resize.x + resize.width / 2, resize.y + resize.height / 2 + 30, { steps: 10 });
  await page.mouse.up();
  await page.waitForFunction(() => document.querySelector('[data-mc-event^="consulta@"]')?.getAttribute('data-mc-end-min') === '690');
  results.push('Resize React: nova duração aplicada');
  // Empty slot at 15:00 opens the creation form.
  const column = await day.boundingBox();
  await page.mouse.click(column.x + column.width / 2, column.y + 480);
  await page.getByRole('textbox', { name: 'Título', exact: true }).fill('Novo agendamento');
  await page.getByRole('button', { name: 'Salvar evento' }).click();
  await page.locator('[data-mc-event][title="Novo agendamento"]').waitFor();
  results.push('Criação React: novo evento no slot');
  await page.locator('[data-mc-event][title="Novo agendamento"]').click();
  await page.getByRole('checkbox', { name: 'Sala 1', exact: true }).check();
  await page.getByRole('button', { name: 'Salvar evento' }).click();
  await page.locator('dialog').waitFor({ state: 'hidden' });
  await page.mouse.click(column.x + column.width / 2, column.y + 540);
  await page.getByRole('textbox', { name: 'Título', exact: true }).fill('Conflito recusado');
  await page.getByLabel('Início', { exact: true }).fill('2026-10-07T15:00');
  await page.getByLabel('Término', { exact: true }).fill('2026-10-07T15:30');
  await page.getByRole('checkbox', { name: 'Sala 1', exact: true }).check();
  await page.getByRole('button', { name: 'Salvar evento' }).click();
  await page.getByRole('alert').filter({ hasText: 'over-capacity' }).waitFor();
  check(await page.locator('[data-mc-event][title="Conflito recusado"]').count() === 0, 'Editor: criação rejeitada por capacidade do recurso');
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.getByRole('button', { name: 'Recursos', exact: true }).click();
  await page.getByRole('combobox', { name: 'Recurso visível' }).selectOption('sala-1');
  check(await page.locator('[data-mc-resource]').count() === 1, 'Recursos: filtro mostra somente a sala escolhida');
  await page.getByRole('combobox', { name: 'Recurso visível' }).selectOption('');
  // Transfer the real reservation to another resource on the pointer surface.
  const reservation = page.locator('[data-mc-resource="sala-1"] [data-mc-event][title="Novo agendamento"]');
  const reservationBox = await reservation.boundingBox();
  const targetResource = await page.locator('[data-mc-resource="sala-2"]').boundingBox();
  await page.mouse.move(reservationBox.x + reservationBox.width / 2, reservationBox.y + 12);
  await page.mouse.down();
  await page.mouse.move(targetResource.x + targetResource.width / 2, reservationBox.y + 12, { steps: 12 });
  await page.mouse.up();
  await page.locator('[data-mc-resource="sala-2"] [data-mc-event][title="Novo agendamento"]').waitFor();
  check(await page.locator('[data-mc-resource="sala-1"] [data-mc-event][title="Novo agendamento"]').count() === 0, 'Drag recursos: reserva transferida entre salas');
  await page.getByRole('button', { name: 'Linha do tempo', exact: true }).click();
  const timelineEvent = page.locator('[data-mc-timeline-row="sala-2"] [data-mc-event][title="Novo agendamento"]');
  const timelineBox = await timelineEvent.boundingBox();
  await page.mouse.move(timelineBox.x + 10, timelineBox.y + 12);
  await page.mouse.down();
  await page.mouse.move(timelineBox.x + 70, timelineBox.y + 12, { steps: 12 });
  await page.mouse.up();
  await page.waitForFunction(() => document.querySelector('[data-mc-timeline-row="sala-2"] [data-mc-event][title="Novo agendamento"]')?.getAttribute('data-mc-start-min') === '960');
  results.push('Timeline: movimento horizontal altera horário');
  const recurring = page.locator('[data-mc-timeline-row="sala-2"] [data-mc-event^="retorno@"]');
  await recurring.focus();
  await page.keyboard.press('Enter');
  await page.getByRole('textbox', { name: 'Título', exact: true }).fill('Ocorrência revisada');
  await page.getByRole('button', { name: 'Salvar evento' }).click();
  await page.locator('[data-mc-event][title="Ocorrência revisada"]').waitFor();
  await page.getByRole('button', { name: 'Próximo período', exact: true }).click();
  // Navigate six more days to the next occurrence: the series title is unchanged.
  for (let index = 0; index < 6; index++) await page.getByRole('button', { name: 'Próximo período', exact: true }).click();
  await page.locator('[data-mc-event][title="Retorno semanal"]').waitFor();
  check(await page.locator('[data-mc-event][title="Ocorrência revisada"]').count() === 0, 'Recorrência: edição isolada preserva próxima ocorrência');
  await page.locator('[data-mc-event][title="Retorno semanal"]').first().focus();
  await page.keyboard.press('Enter');
  await page.getByLabel('Aplicar alterações').selectOption('following');
  await page.getByRole('textbox', { name: 'Título', exact: true }).fill('Retornos futuros');
  await page.getByRole('button', { name: 'Salvar evento' }).click();
  await page.locator('[data-mc-event][title="Retornos futuros"]').waitFor();
  for (let index = 0; index < 7; index++) await page.getByRole('button', { name: 'Próximo período', exact: true }).click();
  await page.locator('[data-mc-event][title="Retornos futuros"]').waitFor();
  results.push('Este e seguintes: edição aplicada à próxima ocorrência');
  await page.locator('[data-mc-event][title="Retornos futuros"]').first().focus();
  await page.keyboard.press('Enter');
  await page.getByLabel('Aplicar alterações').selectOption('following');
  await page.getByRole('button', { name: 'Excluir evento', exact: true }).click();
  await page.getByRole('dialog').waitFor({state:'hidden'});
  check(await page.locator('[data-mc-event][title="Retornos futuros"]').count() === 0, 'Este e seguintes: exclusão remove ocorrência atual');
  for (let index = 0; index < 14; index++) await page.getByRole('button', { name: 'Período anterior', exact: true }).click();
  await page.locator('[data-mc-event][title="Ocorrência revisada"]').waitFor();
  results.push('Este e seguintes: edição/exclusão preservam override passado');
  await page.getByRole('button', { name: 'Voltar ao exemplo', exact: true }).click();
  await page.getByRole('button', { name: 'Desmontar calendário' }).click();
  check(await page.locator('[data-mc-root]').count() === 0, 'Unmount: DOM removido');
  await page.getByRole('button', { name: 'Montar calendário' }).click();
  await page.locator('[data-mc-root]').waitFor();
  check(await page.locator('[data-mc-root]').count() === 1, 'Remount StrictMode: uma instância visível');
  const mobile = [];
  for (const width of [320, 375, 768]) {
    await page.setViewportSize({ width, height: 850 });
    for (const view of ['Semana', 'Dia', 'Mês', 'Agenda', 'Recursos', 'Linha do tempo']) {
      await changeView(view);
      const geometry = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: innerWidth }));
      if (geometry.document > geometry.viewport + 1) throw new Error(`Overflow ${view} at ${width}: ${geometry.document}`);
      mobile.push(`${width}:${view}`);
    }
  }
  await page.setViewportSize({ width: 375, height: 850 });
  await changeView('Dia');
  await page.locator('[data-mc-view="day"]').first().waitFor();
  await changeView('Mês');
  await page.locator('[data-mc-month-day="2026-10-07"] button').click();
  await page.keyboard.press('ArrowDown');
  check(await page.evaluate(() => document.activeElement?.closest('[data-mc-month-day]')?.getAttribute('data-mc-month-day')) === '2026-10-14',
    'Mês mobile/teclado: seta vertical avança uma semana');
  await page.locator('[data-mc-month-day="2026-10-07"] button').click();
  await page.locator('[data-mc-month-detail-event]').first().waitFor();
  check(await page.locator('[data-mc-month-detail-event]').count() > 0,'Mês mobile: seleciona dia e mostra lista de eventos');
  await page.screenshot({ path:'output/playwright/react-mobile-month.png',fullPage:true });
  await page.locator('[data-mc-month-detail-event]').first().focus();
  await page.keyboard.press('Enter');
  await page.getByRole('dialog').waitFor();
  check(await page.getByRole('textbox',{name:'Título',exact:true}).isVisible(),'Mobile/teclado: abre editor para reagendamento');
  await page.screenshot({ path:'output/playwright/react-mobile-editor.png',fullPage:true });
  await page.getByRole('button',{name:'Cancelar',exact:true}).click();
  await changeView('Dia');
  await page.screenshot({ path: 'output/playwright/react-mobile.png', fullPage: true });
  const slot = page.locator('[data-mc-cell-start]').first();
  await slot.focus();
  const before = await slot.getAttribute('data-mc-cell-start');
  await page.keyboard.press('ArrowDown');
  check(await page.evaluate(() => document.activeElement?.getAttribute('data-mc-cell-start')) !== before,
    'Teclado/mobile: seta navega para próximo horário');
  await page.locator('[data-mc-cell-start="1140"]').first().focus();
  await page.keyboard.press('Enter');
  await page.getByRole('dialog').waitFor();
  check(await page.getByRole('textbox', { name: 'Título', exact: true }).isVisible(), 'Teclado: seleção abre editor de criação');
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  if (runtimeErrors.length) throw new Error(`Browser errors: ${runtimeErrors.join('; ')}`);
  return { results, responsive: mobile, runtimeErrors };
}

