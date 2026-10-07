async page => {
  await page.setViewportSize({width:1440,height:1000}); await page.reload();
  await page.getByRole('button',{name:'Mês',exact:true}).click();
  const results=[];
  const check=(ok,label)=>{if(!ok)throw new Error(label);results.push(label);};
  const cell=date=>page.locator(`[data-mc-month-day="${date}"]`);
  const congress=()=>page.locator('[data-mc-month-event^="congresso@"]');
  const drag=async(source,target)=>{
    await source.scrollIntoViewIfNeeded();const a=await source.boundingBox(),b=await target.boundingBox();
    await page.mouse.move(a.x+Math.min(15,a.width/2),a.y+a.height/2);await page.mouse.down();
    await page.mouse.move(b.x+20,b.y+b.height/2,{steps:10});await page.mouse.up();
  };
  const more=()=>cell('2026-10-07').locator('.mc-month-more');
  const geometry=await page.evaluate(()=>{
    const root=document.querySelector('.mc-month');
    return [...root.querySelectorAll('[data-mc-month-event],.mc-month-more')].every(node=>{
      const a=node.getBoundingClientRect(),week=node.closest('.mc-month-week').getBoundingClientRect();
      return a.top>=week.top && a.bottom<=week.bottom && a.right<=week.right && a.left>=week.left;
    });
  });
  check(geometry,'Mês: barras e botão +Mais permanecem dentro da semana');
  await page.getByRole('combobox',{name:'Ver mais',exact:true}).selectOption('custom');
  await more().click();await page.locator('.demo-more-custom').waitFor();
  check(await page.locator('.demo-more-custom button').count()===5,'Ver mais: componente React personalizado recebe os quatro eventos');
  await page.getByRole('button',{name:'Abrir agenda do dia',exact:true}).click();
  await page.locator('[data-mc-day="2026-10-07"]').waitFor();
  check(await page.locator('.mc-month-popover').count()===0,'Componente personalizado navega para o dia selecionado');
  await page.getByRole('button',{name:'Mês',exact:true}).click();
  await page.getByRole('combobox',{name:'Ver mais',exact:true}).selectOption('day');await more().click();
  await page.locator('[data-mc-day="2026-10-07"]').waitFor();
  check(await page.locator('.mc-month').count()===0,'monthMoreView abre a view Dia sem popover');
  await page.getByRole('combobox',{name:'Ver mais',exact:true}).selectOption('popover');
  await page.getByRole('button',{name:'Mês',exact:true}).click();
  await drag(congress(),cell('2026-10-13'));
  await page.waitForFunction(()=>document.querySelector('[data-mc-month-event^="congresso@"]')?.getAttribute('data-mc-month-dates')==='2026-10-13 2026-10-14 2026-10-15');
  await drag(congress().locator('[data-mc-resize]'),cell('2026-10-16'));
  await page.waitForFunction(()=>document.querySelector('[data-mc-month-event^="congresso@"]')?.getAttribute('data-mc-month-dates')==='2026-10-13 2026-10-14 2026-10-15 2026-10-16');
  await page.getByRole('combobox',{name:'Espaçamento',exact:true}).selectOption('2');
  await page.getByRole('button',{name:'Dia',exact:true}).click();await page.getByRole('button',{name:'Mês',exact:true}).click();
  check(await congress().getAttribute('data-mc-month-dates')==='2026-10-13 2026-10-14 2026-10-15 2026-10-16','React controlado: mover/estender sobrevivem a rerender e troca de view');
  await congress().focus();await page.keyboard.press('Enter');
  check(await page.getByLabel('Início',{exact:true}).inputValue()==='2026-10-13' && await page.getByLabel('Último dia',{exact:true}).inputValue()==='2026-10-16','Editor recebe o intervalo salvo pelo resize');
  await page.getByRole('textbox',{name:'Título',exact:true}).fill('Congresso salvo');await page.getByRole('button',{name:'Salvar evento',exact:true}).click();
  await page.locator('[data-mc-month-event][title="Congresso salvo"]').waitFor();
  check(await congress().getAttribute('data-mc-month-dates')==='2026-10-13 2026-10-14 2026-10-15 2026-10-16','Editar salva título sem perder o intervalo alterado');
  await page.getByRole('checkbox',{name:'Aplicar restrições de horário',exact:true}).check();
  await drag(page.locator('[data-mc-month-event^="consulta@"] [data-mc-resize]'),cell('2026-10-08'));
  await page.waitForFunction(()=>document.querySelector('.demo-feedback')?.textContent.includes('atravessa um bloqueio'));
  check(await page.locator('[data-mc-month-event^="consulta@"]').getAttribute('data-mc-month-dates')==='2026-10-07','Extensão bloqueada é recusada com motivo visível; evento original preservado');
  await page.getByRole('checkbox',{name:'Aplicar restrições de horário',exact:true}).uncheck();
  await page.getByRole('button',{name:'Dia',exact:true}).click();
  await page.getByRole('combobox',{name:'Espaçamento',exact:true}).selectOption('1.5');
  await page.getByRole('combobox',{name:'Rótulos de horário',exact:true}).selectOption('60');
  const labels=await page.locator('.mc-hour-label').evaluateAll(nodes=>nodes.map(node=>({label:node.textContent,y:node.getBoundingClientRect().top})));
  check(labels[1].label==='08:00' && Math.abs(labels[1].y-labels[0].y-90)<1,'Espaçamento: rótulos de 60 minutos têm 90px com escala 1.5');
  check(await page.locator('[data-mc-cell-start="450"]').count()===1,'Intervalo de rótulos não altera slots de 30 minutos');
  await page.screenshot({path:'output/layout-review/time-spacing-after.png',fullPage:true});
  return results;
}
