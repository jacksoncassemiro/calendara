async page => {
 await page.mouse.up(); await page.reload(); await page.setViewportSize({width:1400,height:900});
 const source=await page.evaluate(async()=>await (await fetch('/src/react/views/format.ts')).text());
 if(!source.includes('return options.timeLabelInterval'))throw new Error('Server is serving stale label contract');
 const results=[];
 for(const name of ['Dia','Semana','Recursos']) {
  await page.getByRole('button',{name,exact:true}).click();
  await page.getByRole('combobox',{name:'Intervalo dos rótulos',exact:true}).selectOption('30');
  const labels=page.locator('[data-mc-hscroll] .mc-hour-label');
  await labels.first().waitFor();
  const geometry=await labels.evaluateAll(nodes=>nodes.map(node=>{const r=node.getBoundingClientRect(),p=node.parentElement.getBoundingClientRect();return {text:node.textContent,top:r.top-p.top,bottom:r.bottom-p.top,height:p.height,end:node.hasAttribute('data-mc-axis-end')};}));
  if(geometry.some(r=>r.top<0 || r.bottom>r.height+0.5))throw new Error('Labels extend beyond axis '+name);
  if(geometry[0].top<1 || geometry[1].text!=='07:30' || geometry.at(-1).text!=='20:30')throw new Error('Label offset or interval incorrect '+name);
  const gap=geometry[1].top-geometry[0].top;
  if(Math.abs((geometry.at(-1).height-geometry.at(-1).top+2)-gap)>0.5)throw new Error('Last slot height differs '+name);
  results.push({view:name,first:geometry[0],last:geometry.at(-1),slotHeight:gap});
  if(name==='Dia')await page.screenshot({path:'output/playwright/day-axis-labels.png',fullPage:true});
 }
 return results;
}
