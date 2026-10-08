async page=>{
 await page.mouse.up();await page.reload();await page.setViewportSize({width:1200,height:900});
 await page.evaluate(async()=>{
  const { BUILTIN_VIEWS,CalendarApp,ensureTemporal,createResourceDayView,createTimelineView}=await import('/src/index.ts');
  document.querySelector('main').style.display='none';const host=document.createElement('div');host.id='margin-fixture';document.body.append(host);
  const resources=[{id:'room',title:'Sala',capacity:false}];
  const event={id:'margin',calendarId:'c',title:'Evento',resourceIds:['room'],time:{allDay:false,start:{dateTime:'2026-10-07T09:00:00',timeZone:'UTC'},end:{dateTime:'2026-10-07T10:00:00',timeZone:'UTC'}}};
  const app=new CalendarApp({temporal:await ensureTemporal(),date:'2026-10-07',view:'day',resources,events:[event],views: [...BUILTIN_VIEWS, createResourceDayView(resources),createTimelineView(resources)],options:{timeZone:'UTC',startHour:8,endHour:12,pxPerMinute:2,defaultResourceCapacity:false},onDateClick:(date,minute)=>{window.marginClick={date,minute};},onEventClick:()=>{window.eventClick=(window.eventClick??0)+1;}});
  app.mount(host);await app.ready();window.marginApp=app;
 });
 const root=page.locator('#margin-fixture');const results=[];
 for(const view of ['day','week','resources','timeline']) {
  await page.evaluate(view=>{window.marginClick=null;window.marginApp.changeView(view);},view);
  const event=root.locator('[data-mc-event^="margin@"]');await event.scrollIntoViewIfNeeded();
  const rect=await event.boundingBox();
  const area=await event.evaluate(n=>n.parentElement.getBoundingClientRect().toJSON());
  const x=view==='timeline'?rect.x+rect.width/2:area.right-2;
  const y=view==='timeline'?rect.y+rect.height+3:rect.y+rect.height/2;
  if(view==='timeline' && y>=area.bottom)throw new Error('No free timeline lane margin');
  if(view!=='timeline' && area.right-(rect.x+rect.width)<4)throw new Error('No free day margin '+view);
  await page.mouse.click(x,y);await page.waitForFunction(()=>window.marginClick!==null);
  const clicked=await page.evaluate(()=>({slot:window.marginClick,eventClicks:window.eventClick??0}));
  if(clicked.eventClicks!==0 || clicked.slot.date!=='2026-10-07' || clicked.slot.minute<540 || clicked.slot.minute>=600)throw new Error('Margin click did not select occupied time '+JSON.stringify(clicked));
  results.push({view,...clicked});
 }
 return results;
}
