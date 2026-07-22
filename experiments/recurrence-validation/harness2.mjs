import pkg from 'rrule';
const { RRule, RRuleSet } = pkg;
import { TemporalRRule } from './temporal-rrule.mjs';
const LIMIT = 40;
const fmt = d => `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
const cases = [
  ['WKST: Weekly int2 from Sunday','2024-01-07','RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=SU,SA;COUNT=8'],
  ['WKST: Weekly int2 MO,SU from Wed','2024-01-03','RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,SU;COUNT=8'],
  ['Weekly int3 TU,TH,SA count9','2024-01-04','RRULE:FREQ=WEEKLY;INTERVAL=3;BYDAY=TU,TH,SA;COUNT=9'],
  ['Neg BYMONTHDAY -2 count5','2024-01-01','RRULE:FREQ=MONTHLY;BYMONTHDAY=-2;COUNT=5'],
  ['Neg BYMONTHDAY -1,-2 count6','2024-01-01','RRULE:FREQ=MONTHLY;BYMONTHDAY=-1,-2;COUNT=6'],
  ['Yearly BYDAY 1MO BYMONTH1 c3','2024-01-01','RRULE:FREQ=YEARLY;BYMONTH=1;BYDAY=1MO;COUNT=3'],
  ['Yearly BYSETPOS -1 wkday c3','2024-01-01','RRULE:FREQ=YEARLY;BYMONTH=12;BYDAY=MO,TU,WE,TH,FR;BYSETPOS=-1;COUNT=3'],
  ['UNTIL inclusive boundary','2024-01-01','RRULE:FREQ=DAILY;UNTIL=20240103T000000Z'],
  ['Monthly BYSETPOS 2 wkday c4','2024-01-01','RRULE:FREQ=MONTHLY;BYDAY=MO,TU,WE,TH,FR;BYSETPOS=2;COUNT=4'],
  ['Monthly 2nd,4th FR (multi) c6','2024-01-01','RRULE:FREQ=MONTHLY;BYDAY=2FR,4FR;COUNT=6'],
  ['Monthly 30th skip Feb c6','2024-01-30','RRULE:FREQ=MONTHLY;BYMONTHDAY=30;COUNT=6'],
  ['Daily interval 7 c6','2024-02-27','RRULE:FREQ=DAILY;INTERVAL=7;COUNT=6'],
  ['Weekly no BYDAY int2 c5','2024-01-03','RRULE:FREQ=WEEKLY;INTERVAL=2;COUNT=5'],
  ['Monthly last SU c5','2024-01-01','RRULE:FREQ=MONTHLY;BYDAY=-1SU;COUNT=5'],
  ['Yearly Feb29 interval1 c4','2020-02-29','RRULE:FREQ=YEARLY;COUNT=4'],
  ['Monthly int3 day15 c5','2024-01-15','RRULE:FREQ=MONTHLY;INTERVAL=3;BYMONTHDAY=15;COUNT=5'],
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
  try{ours=TemporalRRule.fromString(rule,dt).all(LIMIT).map(d=>d.toString());}catch(e){err='ours:'+e.message;}
  try{theirs=oracle(dt,rule);}catch(e){err=(err||'')+' oracle:'+e.message;}
  const match=JSON.stringify(ours)===JSON.stringify(theirs);
  if(match&&!err)pass++;else{fail++;failures.push({name,rule,ours,theirs,err,fd:(()=>{const n=Math.max(ours.length,theirs.length);for(let i=0;i<n;i++)if(ours[i]!==theirs[i])return{i,o:ours[i],t:theirs[i]};return null;})()});}
}
console.log(`\n===== BATCH 2 RESULT: ${pass}/${pass+fail} passed =====\n`);
for(const f of failures){
  console.log(`FAIL: ${f.name}\n  rule: ${f.rule}`);
  if(f.err)console.log(`  err: ${f.err}`);
  console.log(`  len ours=${f.ours.length} theirs=${f.theirs.length}`);
  if(f.fd)console.log(`  firstDiff @${f.fd.i}: ours=${f.fd.o} theirs=${f.fd.t}`);
  console.log(`  ours:   ${f.ours.slice(0,10).join(', ')}`);
  console.log(`  theirs: ${f.theirs.slice(0,10).join(', ')}\n`);
}
