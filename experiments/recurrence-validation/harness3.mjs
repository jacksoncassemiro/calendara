import pkg from 'rrule';
const { RRule, RRuleSet } = pkg;
import { TemporalRRuleV2 } from './temporal-rrule-v2.mjs';
const LIMIT = 60;
const fmt = d => `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
// TODOS os cenários das suites 1 e 2 + os novos multi-ordinais (o gap)
const cases = [
  ['Daily count 5','2024-01-01','RRULE:FREQ=DAILY;COUNT=5'],
  ['Daily interval 3 count 6','2024-01-01','RRULE:FREQ=DAILY;INTERVAL=3;COUNT=6'],
  ['Daily until','2024-01-01','RRULE:FREQ=DAILY;UNTIL=20240110T000000Z'],
  ['Weekly MO,WE,FR count 9','2024-01-01','RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=9'],
  ['Weekly interval2 TU,TH count8','2024-01-02','RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=TU,TH;COUNT=8'],
  ['Weekly default weekday count5','2024-01-03','RRULE:FREQ=WEEKLY;COUNT=5'],
  ['Monthly day31 skip count6','2024-01-31','RRULE:FREQ=MONTHLY;BYMONTHDAY=31;COUNT=6'],
  ['Monthly last day count6','2024-01-31','RRULE:FREQ=MONTHLY;BYMONTHDAY=-1;COUNT=6'],
  ['Monthly 4th FR count5','2024-01-01','RRULE:FREQ=MONTHLY;BYDAY=4FR;COUNT=5'],
  ['Monthly last MO count5','2024-01-01','RRULE:FREQ=MONTHLY;BYDAY=-1MO;COUNT=5'],
  ['Monthly 5th WE ghost count4','2024-01-01','RRULE:FREQ=MONTHLY;BYDAY=5WE;COUNT=4'],
  ['Yearly implicit Feb29 count3','2024-02-29','RRULE:FREQ=YEARLY;COUNT=3'],
  ['Yearly BYMONTH12 day25 count3','2024-01-01','RRULE:FREQ=YEARLY;BYMONTH=12;BYMONTHDAY=25;COUNT=3'],
  ['Impossible Feb30 anti-loop','2024-01-01','RRULE:FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=30;COUNT=3'],
  ['EXDATE removes 2','2024-01-01','RRULE:FREQ=DAILY;COUNT=5\nEXDATE:20240102T000000Z,20240104T000000Z'],
  ['Monthly multi-day 1,15 count6','2024-01-01','RRULE:FREQ=MONTHLY;BYMONTHDAY=1,15;COUNT=6'],
  ['Monthly BYSETPOS -1 wkday','2024-01-01','RRULE:FREQ=MONTHLY;BYDAY=MO,TU,WE,TH,FR;BYSETPOS=-1;COUNT=4'],
  ['Neg BYMONTHDAY -1,-2 count6','2024-01-01','RRULE:FREQ=MONTHLY;BYMONTHDAY=-1,-2;COUNT=6'],
  ['Yearly BYDAY 1MO BYMONTH1 c3','2024-01-01','RRULE:FREQ=YEARLY;BYMONTH=1;BYDAY=1MO;COUNT=3'],
  // ---- OS NOVOS: multi-ordinal (o gap corrigido) ----
  ['** Monthly 2FR,4FR count6','2024-01-01','RRULE:FREQ=MONTHLY;BYDAY=2FR,4FR;COUNT=6'],
  ['** Monthly 1MO,3MO count6','2024-01-01','RRULE:FREQ=MONTHLY;BYDAY=1MO,3MO;COUNT=6'],
  ['** Monthly 1SU,-1SU count6','2024-01-01','RRULE:FREQ=MONTHLY;BYDAY=1SU,-1SU;COUNT=6'],
  ['** Yearly 1MO,3MO BYMONTH3 c4','2024-01-01','RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=1MO,3MO;COUNT=4'],
];
function oracle(dt, ruleStr){
  const [y,m,d]=dt.split('-').map(Number);
  const opts=RRule.parseString(ruleStr.split('\n').find(l=>l.startsWith('RRULE:')).replace('RRULE:',''));
  opts.dtstart=new Date(Date.UTC(y,m-1,d));
  const ex=ruleStr.split('\n').find(l=>l.startsWith('EXDATE:'));
  const rule=new RRule(opts);
  if(!ex) return rule.all((x,i)=>i<LIMIT).map(fmt);
  const set=new RRuleSet(); set.rrule(rule);
  ex.replace('EXDATE:','').split(',').forEach(v=>set.exdate(new Date(Date.UTC(+v.substring(0,4),+v.substring(4,6)-1,+v.substring(6,8)))));
  return set.all((x,i)=>i<LIMIT).map(fmt);
}
let pass=0,fail=0;const failures=[];
for(const [name,dt,rule] of cases){
  let ours=[],theirs=[],err=null;
  try{ours=TemporalRRuleV2.fromString(rule,dt).all(LIMIT).map(d=>d.toString());}catch(e){err='ours:'+e.message;}
  try{theirs=oracle(dt,rule);}catch(e){err=(err||'')+' oracle:'+e.message;}
  const match=JSON.stringify(ours)===JSON.stringify(theirs);
  if(match&&!err)pass++;else{fail++;failures.push({name,rule,ours,theirs,err});}
}
console.log(`\n===== V2 RESULT: ${pass}/${pass+fail} passed =====\n`);
for(const f of failures){
  console.log(`FAIL: ${f.name}\n  rule:${f.rule}`);
  if(f.err)console.log('  err:'+f.err);
  console.log(`  ours:   ${f.ours.slice(0,8).join(', ')}`);
  console.log(`  theirs: ${f.theirs.slice(0,8).join(', ')}\n`);
}
