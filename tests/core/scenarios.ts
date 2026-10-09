/** Named RFC 5545 fixture: start date and recurrence text. / PT: Cenário RFC 5545: data inicial e texto da recorrência. */
export type Scenario = [name: string, dtstart: string, rule: string];

/** Frequency and limit combinations. / PT: Combinações de frequência e limites. */
export const BASE: Scenario[] = [
  ['Daily count 5', '2024-01-01', 'RRULE:FREQ=DAILY;COUNT=5'],
  ['Daily interval 3 count 6', '2024-01-01', 'RRULE:FREQ=DAILY;INTERVAL=3;COUNT=6'],
  ['Daily until', '2024-01-01', 'RRULE:FREQ=DAILY;UNTIL=20240110T000000Z'],
  ['Weekly MO,WE,FR count 9', '2024-01-01', 'RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=9'],
  [
    'Weekly interval2 TU,TH count8',
    '2024-01-02',
    'RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=TU,TH;COUNT=8',
  ],
  ['Weekly default weekday count5', '2024-01-03', 'RRULE:FREQ=WEEKLY;COUNT=5'],
  ['Weekly SU wrap count5', '2024-01-07', 'RRULE:FREQ=WEEKLY;BYDAY=SU;COUNT=5'],
  ['Monthly day15 count6', '2024-01-15', 'RRULE:FREQ=MONTHLY;BYMONTHDAY=15;COUNT=6'],
  ['Monthly day31 skip count6', '2024-01-31', 'RRULE:FREQ=MONTHLY;BYMONTHDAY=31;COUNT=6'],
  ['Monthly last day count6', '2024-01-31', 'RRULE:FREQ=MONTHLY;BYMONTHDAY=-1;COUNT=6'],
  ['Monthly 4th FR count5', '2024-01-01', 'RRULE:FREQ=MONTHLY;BYDAY=4FR;COUNT=5'],
  ['Monthly last MO count5', '2024-01-01', 'RRULE:FREQ=MONTHLY;BYDAY=-1MO;COUNT=5'],
  ['Monthly 5th WE ghost count4', '2024-01-01', 'RRULE:FREQ=MONTHLY;BYDAY=5WE;COUNT=4'],
  ['Monthly default day count4', '2024-03-10', 'RRULE:FREQ=MONTHLY;COUNT=4'],
  [
    'Monthly interval2 day1 count5',
    '2024-01-01',
    'RRULE:FREQ=MONTHLY;INTERVAL=2;BYMONTHDAY=1;COUNT=5',
  ],
  ['Yearly implicit Feb29 count3', '2024-02-29', 'RRULE:FREQ=YEARLY;COUNT=3'],
  ['Yearly implicit Jan15 count3', '2024-01-15', 'RRULE:FREQ=YEARLY;COUNT=3'],
  [
    'Yearly BYMONTH12 day25 count3',
    '2024-01-01',
    'RRULE:FREQ=YEARLY;BYMONTH=12;BYMONTHDAY=25;COUNT=3',
  ],
  ['Monthly last day Nov99 count5', '2099-11-01', 'RRULE:FREQ=MONTHLY;BYMONTHDAY=-1;COUNT=5'],
  ['Impossible Feb30 anti-loop', '2024-01-01', 'RRULE:FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=30;COUNT=3'],
  ['Halley 76y interval count3', '1986-02-09', 'RRULE:FREQ=YEARLY;INTERVAL=76;COUNT=3'],
  [
    'EXDATE removes 2',
    '2024-01-01',
    'RRULE:FREQ=DAILY;COUNT=5\nEXDATE:20240102T000000Z,20240104T000000Z',
  ],
  ['Weekly all weekdays count10', '2024-01-01', 'RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR;COUNT=10'],
  ['Monthly multi-day 1,15 count6', '2024-01-01', 'RRULE:FREQ=MONTHLY;BYMONTHDAY=1,15;COUNT=6'],
  [
    'Monthly BYSETPOS -1 wkday',
    '2024-01-01',
    'RRULE:FREQ=MONTHLY;BYDAY=MO,TU,WE,TH,FR;BYSETPOS=-1;COUNT=4',
  ],
  ['Monthly BYSETPOS 1 wkend', '2024-01-01', 'RRULE:FREQ=MONTHLY;BYDAY=SA,SU;BYSETPOS=1;COUNT=4'],
  ['Yearly leap only count3', '2024-02-29', 'RRULE:FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=29;COUNT=3'],
];

/** Civil-calendar boundaries and combined filters. / PT: Limites do calendário civil e filtros combinados. */
export const EDGE: Scenario[] = [
  [
    'WKST: Weekly int2 from Sunday',
    '2024-01-07',
    'RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=SU,SA;COUNT=8',
  ],
  [
    'WKST: Weekly int2 MO,SU from Wed',
    '2024-01-03',
    'RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,SU;COUNT=8',
  ],
  [
    'Weekly int3 TU,TH,SA count9',
    '2024-01-04',
    'RRULE:FREQ=WEEKLY;INTERVAL=3;BYDAY=TU,TH,SA;COUNT=9',
  ],
  ['Neg BYMONTHDAY -2 count5', '2024-01-01', 'RRULE:FREQ=MONTHLY;BYMONTHDAY=-2;COUNT=5'],
  ['Neg BYMONTHDAY -1,-2 count6', '2024-01-01', 'RRULE:FREQ=MONTHLY;BYMONTHDAY=-1,-2;COUNT=6'],
  ['Yearly BYDAY 1MO BYMONTH1 c3', '2024-01-01', 'RRULE:FREQ=YEARLY;BYMONTH=1;BYDAY=1MO;COUNT=3'],
  [
    'Yearly BYSETPOS -1 wkday c3',
    '2024-01-01',
    'RRULE:FREQ=YEARLY;BYMONTH=12;BYDAY=MO,TU,WE,TH,FR;BYSETPOS=-1;COUNT=3',
  ],
  ['UNTIL inclusive boundary', '2024-01-01', 'RRULE:FREQ=DAILY;UNTIL=20240103T000000Z'],
  [
    'Monthly BYSETPOS 2 wkday c4',
    '2024-01-01',
    'RRULE:FREQ=MONTHLY;BYDAY=MO,TU,WE,TH,FR;BYSETPOS=2;COUNT=4',
  ],
  ['Monthly 2nd,4th FR (multi) c6', '2024-01-01', 'RRULE:FREQ=MONTHLY;BYDAY=2FR,4FR;COUNT=6'],
  ['Monthly 30th skip Feb c6', '2024-01-30', 'RRULE:FREQ=MONTHLY;BYMONTHDAY=30;COUNT=6'],
  ['Daily interval 7 c6', '2024-02-27', 'RRULE:FREQ=DAILY;INTERVAL=7;COUNT=6'],
  ['Weekly no BYDAY int2 c5', '2024-01-03', 'RRULE:FREQ=WEEKLY;INTERVAL=2;COUNT=5'],
  ['Monthly last SU c5', '2024-01-01', 'RRULE:FREQ=MONTHLY;BYDAY=-1SU;COUNT=5'],
  ['Yearly Feb29 interval1 c4', '2020-02-29', 'RRULE:FREQ=YEARLY;COUNT=4'],
  ['Monthly int3 day15 c5', '2024-01-15', 'RRULE:FREQ=MONTHLY;INTERVAL=3;BYMONTHDAY=15;COUNT=5'],
];

/** Multiple ordinal weekdays in one period. / PT: Vários dias da semana ordinais no mesmo período. */
export const MULTI_ORDINAL: Scenario[] = [
  ['Monthly 2FR,4FR count6', '2024-01-01', 'RRULE:FREQ=MONTHLY;BYDAY=2FR,4FR;COUNT=6'],
  ['Monthly 1MO,3MO count6', '2024-01-01', 'RRULE:FREQ=MONTHLY;BYDAY=1MO,3MO;COUNT=6'],
  ['Monthly 1SU,-1SU count6', '2024-01-01', 'RRULE:FREQ=MONTHLY;BYDAY=1SU,-1SU;COUNT=6'],
  ['Yearly 1MO,3MO BYMONTH3 c4', '2024-01-01', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=1MO,3MO;COUNT=4'],
];

/** Explicit non-Monday week starts. / PT: Inícios de semana explícitos diferentes de segunda-feira. */
export const WKST: Scenario[] = [
  [
    'WKST=SU Weekly int2 SU,SA c8',
    '2024-01-07',
    'RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=SU,SA;WKST=SU;COUNT=8',
  ],
  [
    'WKST=SU Weekly int2 MO,SU c8',
    '2024-01-03',
    'RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,SU;WKST=SU;COUNT=8',
  ],
];

export const ALL: Scenario[] = [...BASE, ...EDGE, ...MULTI_ORDINAL, ...WKST];
