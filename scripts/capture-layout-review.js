async page => {
  await page.reload();
  await page.getByRole('button', {name:'Voltar ao exemplo', exact:true}).click();
  const changeView = async label => {
    const button=page.getByRole('button',{name:label,exact:true});
    if(await button.isVisible()) await button.click();
    else await page.getByRole('combobox',{name:'Visualização',exact:true}).selectOption({label});
  };
  const views=['Semana','Dia','Mês','Agenda','Recursos','Linha do tempo'];
  const report=[];
  for(const width of [1440,768,375,320]) {
    await page.setViewportSize({width,height:1000});
    for(let index=0;index<views.length;index++) {
      await changeView(views[index]);
      await page.locator('[data-mc-root]').waitFor();
      if(width<=375 && ['Semana','Recursos'].includes(views[index])) {
        const scroll = await page.evaluate(() => {
          const scroller=document.querySelector('[data-mc-hscroll]');
          const selectors=scroller.querySelector('[data-mc-day]')
            ? ['[data-mc-day-header]','[data-mc-day]'] : ['.mc-resource-header','.mc-resource-col'];
          scroller.scrollLeft=scroller.scrollWidth;
          const headers=[...scroller.querySelectorAll(selectors[0])],columns=[...scroller.querySelectorAll(selectors[1])];
          const last=columns.at(-1).getBoundingClientRect(),viewport=scroller.getBoundingClientRect();
          const aligned=headers.length===columns.length && columns.every((column,i)=>Math.abs(column.getBoundingClientRect().left-headers[i].getBoundingClientRect().left)<1);
          const needsScroll=columns.length*(selectors[0].includes("day")?104:140)+56>scroller.clientWidth; const result={scrollable:!needsScroll || scroller.scrollWidth>scroller.clientWidth,moved:!needsScroll || scroller.scrollLeft>0,aligned,lastVisible:last.right<=viewport.right+1 && last.left>=viewport.left};
          scroller.scrollLeft=0;return result;
        });
        if(Object.values(scroll).some(value=>!value)) throw new Error(`Rolagem/alinhamento ${views[index]} ${width}: ${JSON.stringify(scroll)}`);
      }
      await page.screenshot({path:`output/layout-review/after-${width}-${index}.png`,fullPage:true});
      report.push({width,view:views[index],geometry:await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth}))});
    }
  }
  for (const entry of report) if(entry.geometry.scrollWidth > entry.width) throw new Error(`Overflow de página: ${JSON.stringify(entry)}`);
  await page.setViewportSize({width:1440,height:1000});
  await changeView('Semana');
  await page.evaluate(()=>document.querySelector('[data-mc-root]').style.width='350px');
  await page.waitForFunction(()=>{const el=document.querySelector('[data-mc-hscroll]');return el.scrollWidth>el.clientWidth;});
  await page.screenshot({path:'output/layout-review/panel-desktop.png',fullPage:true});
  await page.evaluate(()=>document.querySelector('[data-mc-root]').style.removeProperty('width'));
  return report;
}
