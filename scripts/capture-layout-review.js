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
      await page.screenshot({path:`output/layout-review/after-${width}-${index}.png`,fullPage:true});
      report.push({width,view:views[index],geometry:await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth}))});
    }
  }
  for (const entry of report) if(entry.geometry.scrollWidth > entry.width) throw new Error(`Overflow de página: ${JSON.stringify(entry)}`);
  return report;
}
