import pkg from 'rrule';
const { RRule, RRuleSet } = pkg;
import { TemporalRRule } from './temporal-rrule.mjs';
const LIMIT = 60;
const fmt = d => `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;

const cases = [
  ['Daily count 5','2024-01-01','RRULE:FREQ=DAILY;COUNT=5'],
  ['Daily interval 3 count 6','2024-01-01','RRULE:FREQ=DAILY;INTERVAL=3;COUNT=6'],
  ['Daily until','2024-01-01','RRULE:FREQ=DAILY;UNTIL=20240110T000000Z'],
  ['Weekly MO,WE,FR count 9','2024-01-01','RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=9'],
  ['Weekly interval2 TU,TH count8','2024-01-02','RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=TU,TH;COUNT=8'],
  ['Weekly default weekday count5','2024-01-03','RRULE:FREQ=WEEKLY;COUNT=5'],
  ['Weekly SU wrap count5','2024-01-07','RRULE:FREQ=WEEKLY;BYDAY=SU;COUNT=5'],
  ['Monthly day15 count6','2024-01-15','RRULE:FREQ=MONTHLY;BYMONTHDAY=15;COUNT=6'],
  ['Monthly day31 skip count6','2024-01-31','RRULE:FREQ=MONTHLY;BYMONTHDAY=31;COUNT=6'],
  ['Monthly last day count6','2024-01-31','RRULE:FREQ=MONTHLY;BYMONTHDAY=-1;COUNT=6'],
  ['Monthly 4th FR count5','2024-01-01','RRULE:FREQ=MONTHLY;BYDAY=4FR;COUNT=5'],
  ['Monthly last MO count5','2024-01-01','RRULE:FREQ=MONTHLY;BYDAY=-1MO;COUNT=5'],
  ['Monthly 5th WE ghost count4','2024-01-01','RRULE:FREQ=MONTHLY;BYDAY=5WE;COUNT=4'],
  ['Monthly default day count4','2024-03-10','RRULE:FREQ=MONTHLY;COUNT=4'],
  ['Monthly interval2 day1 count5','2024-01-01','RRULE:FREQ=MONTHLY;INTERVAL=2;BYMONTHDAY=1;COUNT=5'],
  ['Yearly implicit Feb29 count3','2024-02-29','RRULE:FREQ=YEARLY;COUNT=3'],
  ['Yearly implicit Jan15 count3','2024-01-15','RRULE:FREQ=YEARLY;COUNT=3'],
  ['Yearly BYMONTH12 day25 count3','2024-01-01','RRULE:FREQ=YEARLY;BYMONTH=12;BYMONTHDAY=25;COUNT=3'],
  ['Monthly last day Nov99 count5','2099-11-01','RRULE:FREQ=MONTHLY;BYMONTHDAY=-1;COUNT=5'],
  ['Impossible Feb30 anti-loop','2024-01-01','RRULE:FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=30;COUNT=3'],
  ['Halley 76y interval count3','1986-02-09','RRULE:FREQ=YEARLY;INTERVAL=76;COUNT=3'],
  ['EXDATE removes 2','2024-01-01','RRULE:FREQ=DAILY;COUNT=5\nEXDATE:20240102T000000Z,20240104T000000Z'],
  ['Weekly all weekdays count10','2024-01-01','RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR;COUNT=10'],
  ['Monthly multi-day 1,15 count6','2024-01-01','RRULE:FREQ=MONTHLY;BYMONTHDAY=1,15;COUNT=6'],
  ['Monthly BYSETPOS -1 wkday','2024-01-01','RRULE:FREQ=MONTHLY;BYDAY=MO,TU,WE,TH,FR;BYSETPOS=-1;COUNT=4'],
  ['Monthly BYSETPOS 1 wkend','2024-01-01','RRULE:FREQ=MONTHLY;BYDAY=SA,SU;BYSETPOS=1;COUNT=4'],
  ['Yearly leap only count3','2024-02-29','RRULE:FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=29;COUNT=3'],
  ['Daily count+until both','2024-01-01','RRULE:FREQ=DAILY;COUNT=10;UNTIL=20240105T000000Z'],
];

function oracle(dt, ruleStr){
  const [y,m,d]=dt.split('-').map(Number);
  const dtstart=new Date(Date.UTC(y,m-1,d));
  const lines=ruleStr.split('\n');
  const rline=lines.find(l=>l.startsWith('RRULE:')).replace('RRULE:','');
  const exline=lines.find(l=>l.startsWith('EXDATE:'));
  const opts=RRule.parseString(rline);
  opts.dtstart=dtstart;
  const rule=new RRule(opts);
  if(!exline) return rule.all((x,i)=>i<LIMIT).map(fmt);
  const set=new RRuleSet();
  set.rrule(rule);
  exline.replace('EXDATE:','').split(',').forEach(v=>set.exdate(new Date(Date.UTC(+v.substring(0,4),+v.substring(4,6)-1,+v.substring(6,8)))));
  return set.all((x,i)=>i<LIMIT).map(fmt);
}

let pass=0,fail=0;const failures=[];
for(const [name,dt,rule] of cases){
  let ours=[],theirs=[],err=null;
  try{ours=TemporalRRule.fromString(rule,dt).all(LIMIT).map(d=>d.toString());}catch(e){err='ours:'+e.message;}
  try{theirs=oracle(dt,rule);}catch(e){err=(err||'')+' oracle:'+e.message;}
  const match=JSON.stringify(ours)===JSON.stringify(theirs);
  if(match&&!err)pass++;
  else{fail++;failures.push({name,rule,ours,theirs,err,firstDiff:(()=>{const n=Math.max(ours.length,theirs.length);for(let i=0;i<n;i++)if(ours[i]!==theirs[i])return{i,o:ours[i],t:theirs[i]};return null;})()});}
}
console.log(`\n===== RESULT: ${pass}/${pass+fail} passed =====\n`);
for(const f of failures){
  console.log(`FAIL: ${f.name}`);
  console.log(`  rule: ${f.rule.replace('\n','  |  ')}`);
  if(f.err)console.log(`  err: ${f.err}`);
  console.log(`  len ours=${f.ours.length} theirs=${f.theirs.length}`);
  if(f.firstDiff)console.log(`  firstDiff @${f.firstDiff.i}: ours=${f.firstDiff.o} theirs=${f.firstDiff.t}`);
  console.log(`  ours:   ${f.ours.slice(0,8).join(', ')}`);
  console.log(`  theirs: ${f.theirs.slice(0,8).join(', ')}`);
  console.log('');
}
