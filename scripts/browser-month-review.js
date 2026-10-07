async page => {
  const runtimeErrors=[];
  page.on('pageerror', error=>runtimeErrors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.reload();
  await page.locator('[data-mc-root]').waitFor();
  await page.evaluate(async () => {
    const { CalendarApp, ensureTemporal, createResourceDayView, createTimelineView } = await import('/src/index.ts');
    document.querySelector('main').style.display = 'none';
    const host = document.createElement('div'); host.id = 'month-fixture'; document.body.append(host);
    const timed = (id, start, end, editable = true) => ({ id, calendarId: 'c', title: id, editable, resourceIds: ['a'],
      time: { allDay: false, start: { dateTime: start, timeZone: 'UTC' }, end: { dateTime: end, timeZone: 'UTC' } } });
    const events = [timed('meeting', '2026-10-07T09:17:00', '2026-10-07T10:42:00'),
      timed('night', '2026-10-07T19:00:00', '2026-10-08T09:00:00'),
      timed('readonly', '2026-10-07T15:00:00', '2026-10-07T16:00:00', false),
      { ...timed('repeat', '2026-10-07T11:00:00', '2026-10-07T12:00:00'), recurrence: { rule: 'FREQ=WEEKLY;COUNT=4' } },
      { id: 'conference', calendarId: 'c', title: 'Congresso', resourceIds: ['a'], time: { allDay: true, start: { date: '2026-10-06' }, end: { date: '2026-10-09' } } }];
    const resources = [{ id: 'a', title: 'Sala A', capacity: 100 }, { id: 'b', title: 'Sala B', capacity: 100 }];
    window.monthLog = { moves: [], resizes: [], clicks: 0, dates: 0, blocked: 0, reject: false };
    window.monthApp = new CalendarApp({ temporal: await ensureTemporal(), date: '2026-10-07', view: 'month', events, resources,
      views: [createResourceDayView(resources), createTimelineView(resources)], options: { timeZone: 'UTC', monthMaxEvents: false },
      onEventClick: () => window.monthLog.clicks++,
      onDateClick: () => window.monthLog.dates++,
      onEventDrop: change => { window.monthLog.moves.push(change); return !window.monthLog.reject; },
      onEventResize: change => { window.monthLog.resizes.push(change); },
      onDropBlocked: () => window.monthLog.blocked++ });
    window.monthApp.mount(host); await window.monthApp.ready();
  });
  const results = [];
  const assert = (ok, label) => { if (!ok) throw new Error(label); results.push(label); };
  const chip = (date, id) => page.locator(`[data-mc-month-event^="${id}@"][data-mc-month-dates~="${date}"]`);
  const drag = async (source, target, handle = false, sourceDate) => {
    await source.scrollIntoViewIfNeeded();
    const a = await source.boundingBox(), b = await target.boundingBox();
    if (!a || !b) throw new Error('Missing pointer surface');
    const dayBox=sourceDate ? await cell(sourceDate).boundingBox() : null;
    await page.mouse.move(dayBox ? dayBox.x+20 : a.x + (handle ? 4 : Math.min(20, a.width / 2)), a.y + a.height / 2); await page.mouse.down();
    await page.mouse.move(b.x + 20, b.y + b.height / 2, { steps: 10 }); await page.mouse.up();
  };
  const cell = date => page.locator(`[data-mc-month-day="${date}"]`);
  await drag(chip('2026-10-07', 'meeting'), cell('2026-10-09'));
  await chip('2026-10-09', 'meeting').waitFor();
  const move = await page.evaluate(() => window.monthLog.moves.at(-1));
  assert(move.startMin === 557 && move.endMin === 642 && move.dateISO === '2026-10-09', 'Mês: mover preserva minutos fora do snap');
  await drag(chip('2026-10-08', 'night'), cell('2026-10-14'),false,'2026-10-08');
  await chip('2026-10-13', 'night').waitFor(); await chip('2026-10-14', 'night').waitFor();
  const overnight = await page.evaluate(() => window.monthLog.moves.at(-1));
  assert(overnight.dateISO === '2026-10-13' && overnight.endDateISO === '2026-10-14' && overnight.startMin === 1140 && overnight.endMin === 540,
    'Mês: mover pela continuação atravessa semanas e preserva evento noturno inteiro');
  await drag(chip('2026-10-07', 'conference'), cell('2026-10-13'),false,'2026-10-07');
  await chip('2026-10-12', 'conference').waitFor(); await chip('2026-10-14', 'conference').waitFor();
  assert(await chip('2026-10-12','conference').getAttribute('data-mc-month-dates') === '2026-10-12 2026-10-13 2026-10-14', 'Mês: all-day mantém três dias e fim exclusivo');
  await drag(chip('2026-10-14', 'conference').locator('[data-mc-resize]'), cell('2026-10-15'), true);
  await chip('2026-10-15', 'conference').waitFor();
  assert(await chip('2026-10-12','conference').getAttribute('data-mc-month-dates') === '2026-10-12 2026-10-13 2026-10-14 2026-10-15', 'Mês: resize expande all-day para quatro dias');
  await drag(chip('2026-10-09', 'meeting').locator('[data-mc-resize]'), cell('2026-10-10'), true);
  await chip('2026-10-10', 'meeting').waitFor();
  const resize = await page.evaluate(() => window.monthLog.resizes.at(-1));
  assert(resize.startMin === 557 && resize.endMin === 642 && resize.endDateISO === '2026-10-10', 'Mês: resize entre dias preserva horário final');
  assert(await page.evaluate(() => window.monthLog.clicks) === 0, 'Arrastar não dispara clique/edição');
  await drag(chip('2026-10-07', 'readonly'), cell('2026-10-08'));
  assert(await chip('2026-10-07', 'readonly').count() === 1 && await chip('2026-10-08', 'readonly').count() === 0, 'Mês: readonly impede alteração');
  await drag(chip('2026-10-14', 'repeat'), cell('2026-10-15'));
  await chip('2026-10-15', 'repeat').waitFor();
  assert(await chip('2026-10-14', 'repeat').count() === 0 && await chip('2026-10-07', 'repeat').count() === 1
    && await chip('2026-10-21', 'repeat').count() === 1 && await chip('2026-10-28', 'repeat').count() === 1,
    'Mês: mover ocorrência cria exceção e preserva demais datas da série');
  await page.evaluate(() => window.monthApp.setConstraints({ blocked: [{ scope: 'date', date: '2026-10-16' }] }));
  await drag(chip('2026-10-09', 'meeting'), cell('2026-10-16'));
  await page.waitForFunction(() => window.monthLog.blocked === 1);
  assert(await chip('2026-10-09', 'meeting').count() === 1 && await chip('2026-10-16', 'meeting').count() === 0, 'Mês: restrição bloqueia intervalo e mantém evento original');
  await page.evaluate(() => window.monthApp.setConstraints({}));
  await page.evaluate(() => window.monthLog.reject = true);
  await drag(chip('2026-10-09', 'meeting'), cell('2026-10-16'));
  await chip('2026-10-09', 'meeting').waitFor();
  assert(await chip('2026-10-16', 'meeting').count() === 0, 'Mês: callback false reverte posição');
  await page.evaluate(() => window.monthLog.reject = false);
  await page.screenshot({ path: 'output/layout-review/month-gestures-after.png', fullPage: true });
  for (const view of ['resources', 'timeline']) {
    await page.evaluate(view => { window.monthApp.setDate('2026-10-13'); window.monthApp.changeView(view); }, view);
    const allDay = page.locator('[data-mc-allday-cell] [data-mc-event^="conference@"]');
    await allDay.waitFor();
    const target = page.locator('[data-mc-allday-cell][data-mc-slot-resource="b"]');
    // Timeline must publish empty all-day destinations too.
    await drag(allDay, target);
    await page.locator('[data-mc-allday-cell][data-mc-slot-resource="b"] [data-mc-event^="conference@"]').waitFor();
    const transferred = await page.evaluate(() => window.monthLog.moves.at(-1));
    assert(transferred.resourceId === 'b' && transferred.fromResourceId === 'a', `${view}: all-day aparece e permite transferência de recurso`);
    // Return the resource before the next view.
    await drag(page.locator('[data-mc-allday-cell][data-mc-slot-resource="b"] [data-mc-event^="conference@"]'), page.locator('[data-mc-allday-cell][data-mc-slot-resource="a"]'));
  }
  await page.evaluate(() => {
    window.monthLog.clicks = 0; window.monthLog.dates = 0;
    window.monthApp.setDate('2026-10-07'); window.monthApp.changeView('month');
    window.monthApp.setOptions({monthMaxEvents:3});
    window.monthApp.setEvents([...Array.from({length:6}, (_,index)=>({id:`overflow-${index}`,calendarId:'c',title:`Reserva detalhada ${index}`,
      time:{allDay:false,start:{dateTime:'2026-10-07T09:00:00',timeZone:'UTC'},end:{dateTime:'2026-10-07T10:00:00',timeZone:'UTC'}}})),
      {id:'overflow-all',calendarId:'c',title:'Evento inteiro de vários dias',time:{allDay:true,start:{date:'2026-10-06'},end:{date:'2026-10-09'}}}]);
  });
  const more = cell('2026-10-07').locator('.mc-month-more');
  await more.waitFor();
  assert(await page.locator('[data-mc-month-dates~="2026-10-07"]').count() === 3 && await more.textContent() === '+4 mais', 'Mês: limite de três e contagem exata de quatro ocultos');
  await more.focus(); await page.keyboard.press('Enter');
  await page.locator('.mc-month-popover').waitFor();
  assert(await page.locator('[data-mc-month-detail-event]').count() === 7, '+Mais: lista completa inclui all-day e eventos ocultos');
  assert(await page.evaluate(()=>window.monthLog.dates) === 0, '+Mais: abertura não dispara criação de evento');
  await page.screenshot({path:'output/layout-review/month-more-after.png',fullPage:true});
  await page.locator('[data-mc-month-detail-event^="overflow-5@"]').click();
  assert(await page.evaluate(()=>window.monthLog.clicks) === 1, '+Mais: evento oculto pode ser aberto uma única vez');
  await more.click(); await page.locator('.mc-month-popover h3').focus(); await page.keyboard.press('Escape');
  assert(await page.locator('.mc-month-popover').count() === 0 && await more.evaluate(node=>node===document.activeElement), '+Mais: Escape fecha lista e devolve foco');
  await page.evaluate(()=>window.monthApp.setOptions({monthMaxEvents:0}));
  await page.waitForFunction(()=>document.querySelector('[data-mc-month-day="2026-10-07"] .mc-month-more')?.textContent==='+7 mais');
  assert(await cell('2026-10-07').locator('[data-mc-month-event]').count() === 0, 'Limite zero: todos os eventos continuam acessíveis pela lista');
  await page.evaluate(()=>window.monthApp.setOptions({monthMaxEvents:false}));
  await page.waitForFunction(()=>document.querySelectorAll('[data-mc-month-dates~="2026-10-07"]').length===7);
  assert(await more.count()===0, 'Limite false: mostra todos os eventos');
  await page.evaluate(()=>window.monthApp.setOptions({monthMaxEvents:3}));
  await page.setViewportSize({width:375,height:1000});
  await page.locator('.mc-month-compact').waitFor();
  assert(await page.locator('[data-mc-month-detail-event]').count()===7, 'Celular: lista do dia permanece completa apesar do limite da grade');
  await page.screenshot({path:'output/layout-review/month-more-mobile-after.png',fullPage:true});
  if(runtimeErrors.length) throw new Error(`Browser errors: ${runtimeErrors.join('; ')}`);
  return results;
}
