async page => {
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.mouse.up();await page.reload();await page.setViewportSize({width:1280,height:1050});
  await page.evaluate(async()=>{
    const {CalendarApp,ensureTemporal,createResourceDayView,createTimelineView}=await import('/src/index.ts');
    document.querySelector('main').style.display='none';
    const host=document.createElement('div');host.id='admin-fixture';document.body.append(host);
    const resources=[{id:'triage',title:'Triagem',capacity:false}];
    const event=(id,start,end)=>({id,calendarId:'c',title:id,resourceIds:['triage'],time:{allDay:false,
      start:{dateTime:`2026-10-07T${start}:00`,timeZone:'UTC'},end:{dateTime:`2026-10-07T${end}:00`,timeZone:'UTC'}}});
    const events=[...Array.from({length:8},(_,i)=>event('admin'+i,'09:00','10:00')),event('isolated','11:00','11:30')];
    const app=new CalendarApp({temporal:await ensureTemporal(),date:'2026-10-07',view:'day',events,resources,
      views:[createResourceDayView(resources),createTimelineView(resources)],options:{timeZone:'UTC',startHour:8,endHour:13,
        pxPerMinute:2,defaultResourceCapacity:false,eventMaxStack:3,monthMaxEvents:3},
      onEventClick:()=>{window.adminEditorClicks=(window.adminEditorClicks??0)+1;}});
    app.mount(host);await app.ready();window.adminApp=app;
    window.adminInitialTimes=JSON.stringify(app.getState().events.map(item=>({id:item.id,time:item.time,resourceIds:item.resourceIds})));
  });
  const root=page.locator('#admin-fixture');
  const set=options=>page.evaluate(options=>window.adminApp.setOptions(options),options);
  const view=name=>page.evaluate(name=>window.adminApp.changeView(name),name);
  const rectangles=()=>root.locator('[data-mc-event^="admin"]').evaluateAll(nodes=>nodes.map(node=>({
    id:node.dataset.mcEvent,...node.getBoundingClientRect().toJSON(),z:Number(getComputedStyle(node).zIndex)})));
  const denseCards=()=>root.locator('[data-mc-event^="admin"]').filter({visible:true});
  const results=[];
  for(const name of ['day','resources']) {
    await view(name);await set({timedEventOverflow:'shrink',slotEventOverlap:false});
    const side=(await rectangles()).sort((a,b)=>a.x-b.x);
    if(side.length!==8)throw new Error(`${name}: faltam reservas lado a lado`);
    for(let i=1;i<side.length;i++)if(side[i-1].right>side[i].left+.5)throw new Error(`${name}: sobreposição com slotEventOverlap=false`);
    await set({slotEventOverlap:true});
    const overlap=(await rectangles()).sort((a,b)=>a.x-b.x);
    for(let i=0;i<overlap.length-1;i++){
      const current=overlap[i],next=overlap[i+1];
      if(current.right<=next.left+.5)throw new Error(`${name}: sobreposição parcial não apareceu`);
      const exposed=next.left-current.left;
      if(exposed+1<current.width/2)throw new Error(`${name}: mais de metade do evento escondida`);
      const accessible=await page.evaluate(({x,y,id})=>document.elementFromPoint(x,y)?.closest('[data-mc-event]')?.getAttribute('data-mc-event')===id,
        {x:current.left+exposed/2,y:current.top+current.height/2,id:current.id});
      if(!accessible || next.z<=current.z)throw new Error(`${name}: faixa exposta não alcança o evento correto`);
    }
    await set({timedEventOverflow:'more'});
    if(await denseCards().count()!==2)throw new Error(`${name}: +mais não limitou oito reservas a duas visíveis`);
    await root.locator('[data-mc-more]').click();await root.locator('.mc-month-popover').waitFor();
    if(await root.locator('.mc-month-popover [data-mc-event]').count()!==6)throw new Error(`${name}: popover não mostra seis reservas ocultas`);
    await page.keyboard.press('Escape');
    const untouched=await page.evaluate(()=>JSON.stringify(window.adminApp.getState().events.map(item=>({id:item.id,time:item.time,resourceIds:item.resourceIds})))===window.adminInitialTimes);
    if(!untouched)throw new Error(`${name}: política visual mudou horário ou recurso`);
    results.push(`${name}: lado a lado, sobreposição parcial e +mais preservam horários`);
  }
  await view('timeline');
  if(await denseCards().count()!==2 || await root.locator('[data-mc-event^="isolated@"]').count()!==1)
    throw new Error('Timeline: limite do cluster ocultou evento isolado ou exibiu reservas em excesso');
  await root.locator('[data-mc-more]').click();await root.locator('.mc-month-popover').waitFor();
  if(await root.locator('.mc-month-popover [data-mc-event]').count()!==6)throw new Error('Timeline: popover incompleto');
  const source=root.locator('.mc-month-popover [data-mc-event^="admin2@"]');
  const target=root.locator('[data-mc-slot="x"] [data-mc-cell-start="660"]');
  await source.scrollIntoViewIfNeeded();await target.scrollIntoViewIfNeeded();
  const a=await source.boundingBox(),b=await target.boundingBox();
  await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();
  await page.mouse.move(b.x+2,b.y+b.height/2,{steps:12});
  await root.locator('[data-mc-draft]').waitFor();
  if(await root.locator('[data-mc-event^="admin2@"]').evaluateAll(nodes=>nodes.some(node=>getComputedStyle(node).visibility==='visible')))
    throw new Error('Timeline: origem permanece visível junto à prévia');
  await page.mouse.up();await page.keyboard.press('Escape');
  await page.waitForFunction(()=>window.adminApp.getState().events.find(event=>event.id==='admin2').time.start.dateTime==='2026-10-07T11:00:00');
  const moved=await page.evaluate(()=>window.adminApp.getState().events.find(event=>event.id==='admin2'));
  if(moved.time.end.dateTime!=='2026-10-07T12:00:00' || moved.resourceIds.join()!=='triage')throw new Error('Timeline: arraste perdeu duração ou sala');
  results.push('Timeline: +mais separa cluster, arrasta oculto a 11–12h sem duplicar e preserva sala');

  await page.evaluate(async()=>{
    const React=await import('/node_modules/.vite/deps/react.js'); const {createElement}=React.default ?? React;
    window.adminApp.setRenderEvent(({event})=>createElement('button',{type:'button',
      onClick:()=>{window.adminCustomClicks=(window.adminCustomClicks??0)+1;}},'Ação '+event.id));
    window.adminEditorClicks=0;window.adminApp.changeView('month');
  });
  await root.locator('[data-mc-month-day="2026-10-07"] .mc-month-more').click();
  await root.locator('.mc-month-popover').waitFor();
  await root.locator('.mc-month-popover button[type=button]').filter({hasText:/^Ação admin0$/}).click();
  const custom=await page.evaluate(()=>({actions:window.adminCustomClicks,editors:window.adminEditorClicks}));
  if(custom.actions!==1 || custom.editors!==0 || !await root.locator('.mc-month-popover').isVisible())
    throw new Error('Botão customizado no popover do mês abriu editor ou fechou lista indevidamente: '+JSON.stringify(custom));
  if(errors.length)throw new Error(errors.join('; '));
  results.push('Botão customizado no popover do mês executa sua ação sem abrir editor');
  return results;
}

