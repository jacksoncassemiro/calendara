async page=>{
 await page.mouse.up();await page.reload();await page.setViewportSize({width:1792,height:950});
 await page.getByRole('button',{name:'Linha do tempo',exact:true}).click();
 const size=page.getByRole('combobox',{name:'Tamanho do slot',exact:true});
 const duration=page.getByRole('combobox',{name:'Duração do slot',exact:true});
 const interval=page.getByRole('combobox',{name:'Intervalo dos rótulos',exact:true});
 await size.selectOption('1');await interval.selectOption('30');const results=[];
 for(const slot of ['60','30']){
  await duration.selectOption(slot);
  const result=await page.locator('[data-mc-hscroll] .mc-timeline-axis').evaluate(el=>{
   const a=el.getBoundingClientRect(),labels=[...el.querySelectorAll('.mc-timeline-hour')].map(n=>{const r=n.getBoundingClientRect();return {text:n.textContent,x:r.x-a.x,y:r.y-a.y,width:r.width,height:r.height};});
   let collisions=0;for(let i=0;i<labels.length;i++)for(let j=i+1;j<labels.length;j++){const a=labels[i],b=labels[j];if(Math.min(a.x+a.width,b.x+b.width)>Math.max(a.x,b.x)+0.5 && Math.min(a.y+a.height,b.y+b.height)>Math.max(a.y,b.y)+0.5)collisions++;}
   return {width:a.width,height:a.height,labels,collisions};
  });
  if(result.collisions || result.labels.length!==28 || result.labels[1].text!=='07:30' || Math.abs(result.labels[1].x-result.labels[0].x-(slot==='60'?15:30))>0.5)throw new Error('Invalid explicit labels '+JSON.stringify(result));
  if(result.labels.some(l=>l.y<0 || l.y+l.height>result.height))throw new Error('Label cut vertically');
  await page.screenshot({path:'output/playwright/timeline-label-config-'+slot+'.png'});results.push({slot,...result});
 }
 return results.map(({labels,...result})=>({...result,labelCount:labels.length,rows:new Set(labels.map(l=>l.y)).size}));
}
