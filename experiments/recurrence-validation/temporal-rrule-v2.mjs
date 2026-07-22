import { Temporal } from '@js-temporal/polyfill';
const CODE_DAYS = { MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6, SU: 7 };

// v2: byDay guarda ordinal POR entrada -> [{weekday:1..7, ordinal:number|null}]
export class TemporalRRuleV2 {
  constructor(o){
    this.freq=o.freq||'DAILY'; this.interval=o.interval>0?o.interval:1; this.count=o.count||null;
    this.byDay=o.byDay||[];          // [{weekday, ordinal|null}]
    this.bymonthday=o.bymonthday||[]; this.bymonth=o.bymonth||[];
    this.bysetpos=o.bysetpos??null; this.exdates=o.exdates||[];
    this.dtstart=typeof o.dtstart==='string'?Temporal.PlainDate.from(o.dtstart):o.dtstart;
    this.until=(typeof o.until==='string'&&o.until)?Temporal.PlainDate.from(o.until):(o.until||null);
  }
  _nthWeekdayInMonth(year, month, weekday, ordinal){
    // weekday 1..7 (Mon..Sun) == Temporal dayOfWeek
    const first=Temporal.PlainDate.from({year,month,day:1});
    const dim=first.daysInMonth;
    const matches=[];
    for(let d=1; d<=dim; d++){ const pd=first.with({day:d}); if(pd.dayOfWeek===weekday) matches.push(pd); }
    if(ordinal>0) return matches[ordinal-1]||null;
    if(ordinal<0) return matches[matches.length+ordinal]||null;
    return null;
  }
  *generate(){
    let occ=0; const ex=new Set(this.exdates.map(d=>typeof d==='string'?d:d.toString()));
    let ps;
    if(this.freq==='MONTHLY')ps=this.dtstart.with({day:1});
    else if(this.freq==='YEARLY')ps=this.dtstart.with({month:1,day:1});
    else if(this.freq==='WEEKLY')ps=this.dtstart.subtract({days:this.dtstart.dayOfWeek-1});
    else ps=this.dtstart;

    // regras implícitas
    let bM=this.bymonth||[], bMD=this.bymonthday||[], bD=[...this.byDay];
    const hasOrdinals = bD.some(e=>e.ordinal!=null);
    const plainWeekdays = bD.map(e=>e.weekday);
    if(this.freq==='YEARLY'&&!bM.length&&!bD.length&&!bMD.length){bM=[this.dtstart.month];bMD=[this.dtstart.day];}
    else if(this.freq==='MONTHLY'&&!bMD.length&&!bD.length){bMD=[this.dtstart.day];}
    else if(this.freq==='WEEKLY'&&!bD.length){bD=[{weekday:this.dtstart.dayOfWeek,ordinal:null}];}
    const weekdaySet = bD.map(e=>e.weekday);

    let empty=0;
    while(true){
      let pe,nps;
      switch(this.freq){
        case 'DAILY': pe=ps.add({days:1}); nps=ps.add({days:this.interval}); break;
        case 'WEEKLY': pe=ps.add({weeks:1}); nps=ps.add({weeks:this.interval}); break;
        case 'MONTHLY': pe=ps.add({months:1}); nps=ps.add({months:this.interval}); break;
        case 'YEARLY': pe=ps.add({years:1}); nps=ps.add({years:this.interval}); break;
      }
      let cand=[];

      if((this.freq==='MONTHLY'||this.freq==='YEARLY') && hasOrdinals){
        // Para cada mês do período (1 p/ MONTHLY, 12 filtrados por bM p/ YEARLY)
        const months = this.freq==='MONTHLY' ? [ps.month] : Array.from({length:12},(_,i)=>i+1).filter(m=>!bM.length||bM.includes(m));
        for(const m of months){
          for(const e of bD){
            if(e.ordinal==null) continue;
            const pd=this._nthWeekdayInMonth(ps.year, m, e.weekday, e.ordinal);
            if(pd && Temporal.PlainDate.compare(pd,this.dtstart)>=0) cand.push(pd);
          }
        }
        // dedup + sort
        const seen=new Set(); cand=cand.filter(pd=>{const k=pd.toString(); if(seen.has(k))return false; seen.add(k); return true;})
          .sort((a,b)=>Temporal.PlainDate.compare(a,b));
      } else {
        let it=ps;
        while(Temporal.PlainDate.compare(it,pe)<0){
          if(Temporal.PlainDate.compare(it,this.dtstart)>=0){
            let ok=true;
            if(bM.length&&!bM.includes(it.month))ok=false;
            if(weekdaySet.length&&!weekdaySet.includes(it.dayOfWeek))ok=false;
            if((this.freq==='MONTHLY'||this.freq==='YEARLY')&&bMD.length){
              const neg=it.day-it.daysInMonth-1;
              if(!bMD.includes(it.day)&&!bMD.includes(neg))ok=false;
            }
            if(ok)cand.push(it);
          }
          it=it.add({days:1});
        }
        if(this.bysetpos!==null&&cand.length){
          let p=this.bysetpos;
          if(p>0&&p<=cand.length)cand=[cand[p-1]];
          else if(p<0&&Math.abs(p)<=cand.length)cand=[cand[cand.length+p]];
          else cand=[];
        }
      }

      let y=false;
      for(const c of cand){
        if(this.until&&Temporal.PlainDate.compare(c,this.until)>0)return;
        occ++;
        if(!ex.has(c.toString())){yield c;y=true;}
        if(this.count!==null&&occ>=this.count)return;
      }
      ps=nps;
      if(y)empty=0; else {empty++; if(empty>2000)break;}
    }
  }
  all(max=100){const r=[];const g=this.generate();for(let i=0;i<max;i++){const n=g.next();if(n.done)break;r.push(n.value);}return r;}
  static fromString(str,dtstart){
    const o={dtstart, byDay:[]};
    let rl='',el='';
    for(const line of str.split('\n')){const t=line.trim();
      if(t.startsWith('RRULE:'))rl=t.replace(/^RRULE:/i,'');
      else if(t.startsWith('EXDATE:'))el=t.replace(/^EXDATE:/i,'');
      else if(!t.includes(':')&&t.includes('='))rl=t;}
    if(rl)rl.split(';').forEach(part=>{const [k,v]=part.split('=');if(!k||!v)return;
      switch(k.toUpperCase()){
        case 'FREQ':o.freq=v.toUpperCase();break;
        case 'INTERVAL':o.interval=parseInt(v,10);break;
        case 'COUNT':o.count=parseInt(v,10);break;
        case 'UNTIL':o.until=Temporal.PlainDate.from(`${v.substring(0,4)}-${v.substring(4,6)}-${v.substring(6,8)}`);break;
        case 'BYDAY':v.split(',').forEach(c=>{const m=c.match(/^(-?\d+)?([A-Z]{2})$/);if(m&&CODE_DAYS[m[2]])o.byDay.push({weekday:CODE_DAYS[m[2]],ordinal:m[1]?parseInt(m[1],10):null});});break;
        case 'BYMONTHDAY':o.bymonthday=v.split(',').map(x=>parseInt(x,10));break;
        case 'BYMONTH':o.bymonth=v.split(',').map(x=>parseInt(x,10));break;
        case 'BYSETPOS':o.bysetpos=parseInt(v,10);break;
      }});
    if(el)o.exdates=el.split(',').map(v=>`${v.substring(0,4)}-${v.substring(4,6)}-${v.substring(6,8)}`);
    return new TemporalRRuleV2(o);
  }
}
