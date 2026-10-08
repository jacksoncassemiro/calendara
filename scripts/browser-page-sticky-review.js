async page => {
  await page.setViewportSize({width:375,height:900});
  await page.reload();
  await page.locator('[data-mc-root]').waitFor();
  await page.evaluate(async()=>{
    const {CalendarApp,ensureTemporal,createResourceDayView,createTimelineView}=await import('/src/index.ts');
    document.querySelector('main').style.display='none';
    const host=document.createElement('div');host.id='sticky-fixture';document.body.append(host);
    const footer=document.createElement('div');footer.style.height='1200px';document.body.append(footer);
    const resources=Array.from({length:20},(_,index)=>({id:`room-${index}`,title:`Sala ${index+1}`}));
    const events=[{id:'long',calendarId:'c',title:'Evento longo',resourceIds:['room-0'],time:{allDay:false,
      start:{dateTime:'2026-10-07T00:00:00',timeZone:'UTC'},end:{dateTime:'2026-10-07T23:00:00',timeZone:'UTC'}}},
      {id:'all',calendarId:'c',title:'Congresso',resourceIds:['room-0'],time:{allDay:true,startDate:'2026-10-07',endDate:'2026-10-09'}}];
    window.allDayClicks=0;
    const app=new CalendarApp({temporal:await ensureTemporal(),date:'2026-10-07',view:'week',resources,events,
      onEventClick:()=>window.allDayClicks++,
      views:[createResourceDayView(resources),createTimelineView(resources)],
      options:{timeZone:'UTC',startHour:0,endHour:24,pxPerMinute:1.5}});
    app.mount(host);await app.ready();window.stickyApp=app;
  });
  const results=[];
  for(const view of ['week','day','resources','timeline']) {
    await page.evaluate(view=>{window.scrollTo(0,0);window.stickyApp.changeView(view);},view);
    const scroller=page.locator('#sticky-fixture [data-mc-hscroll]');
    await scroller.waitFor();
    const result=await scroller.evaluate(async scroll=>{
      scroll.scrollLeft=220;
      window.scrollTo(0,scroll.getBoundingClientRect().top+window.scrollY+200);
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      const overlay=scroll.nextElementSibling;
      const copy=overlay.querySelector('.mc-page-sticky-content');
      const original=scroll.querySelector('.mc-header-row,.mc-resource-header-row,.mc-timeline-header');
      const viewport=scroll.getBoundingClientRect(),o=overlay.getBoundingClientRect(),c=copy.firstElementChild.getBoundingClientRect();
      const originalCell=original.children[1].getBoundingClientRect(),copiedCell=copy.children[1].getBoundingClientRect();
      const allDay=scroll.querySelector('.mc-allday-row,.mc-resource-allday-row');
      const allRect=allDay?.getBoundingClientRect();
      const content=scroll.querySelector('[data-mc-event^="long"] .mc-event-content');
      const event=content?.parentElement.getBoundingClientRect(),text=content?.getBoundingClientRect();
      return {view:scroll.parentElement.dataset.mcView,scrollY:window.scrollY,scrollLeft:scroll.scrollLeft,
        internalScrollTop:scroll.scrollTop,visible:getComputedStyle(overlay).display!=='none',overlayTop:o.top,
        overlayWidth:o.width,viewportWidth:scroll.clientWidth,cornerDelta:c.left-viewport.left,
        columnDelta:copiedCell.left-originalCell.left,clonedData:copy.querySelectorAll('[data-mc-day-header]').length,
        copies:document.querySelector('#sticky-fixture').querySelectorAll('.mc-page-sticky-header').length,
        allDayFixed:!allDay || getComputedStyle(allDay).position==='fixed',allDayDelta:allRect ? allRect.top-o.bottom : 0,
        contentOffset:content ? parseFloat(content.style.getPropertyValue('--mc-content-offset')) : 0,
        textWithinEvent:!text || (text.left>=event.left-1 && text.right<=event.right+1 && text.top>=event.top-1 && text.bottom<=event.bottom+1)};
    });
    if(!result.visible || result.internalScrollTop!==0 || Math.abs(result.overlayTop)>1 || Math.abs(result.cornerDelta)>1
      || Math.abs(result.columnDelta)>1 || result.overlayWidth!==result.viewportWidth || result.copies!==1 || result.clonedData!==0)
      throw new Error(`Cabeçalho de página inválido: ${JSON.stringify(result)}`);
    if(!result.allDayFixed || Math.abs(result.allDayDelta)>1 || !result.textWithinEvent) throw new Error(`Faixa/conteúdo inválido: ${JSON.stringify(result)}`);
    if(view==='week') {
      await page.locator('#sticky-fixture [data-mc-allday-event^="all"]').click();
      if(await page.evaluate(()=>window.allDayClicks)!==1) throw new Error('Faixa fixa perdeu interação');
    }
    results.push(result);
    await page.screenshot({path:`output/playwright/page-sticky-${view}.png`,fullPage:false});
    const hidden=await scroller.evaluate(async scroll=>{
      window.scrollTo(0,scroll.getBoundingClientRect().bottom+window.scrollY+100);
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      return getComputedStyle(scroll.nextElementSibling).display==='none';
    });
    if(!hidden) throw new Error(`Cabeçalho escapou do calendário ${view}`);
  }
  return results;
}
