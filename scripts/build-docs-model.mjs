import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const contracts = [
  ['CalendarProps', 'src/react/types.ts'],
  ['CalendarHandle', 'src/react/types.ts'],
  ['CalendarConfig', 'src/react/app/calendarApp.ts'],
  ['DayHeaderInfo', 'src/react/viewTypes.ts'],
  ['DayStyleInfo', 'src/react/viewTypes.ts'],
  ['ResourceViewInput', 'src/react/views/ResourceDayView.tsx'],
  ['ResourceTimelineConfig', 'src/react/views/TimelineView.tsx'],
  ['MultiMonthViewOptions', 'src/react/views/MultiMonthView.tsx'],
  ['YearPlannerViewOptions', 'src/react/views/YearPlannerView.tsx'],
  ['CalendarPrintOptions', 'src/react/printing.ts'],
  ['CalendarPrintInput', 'src/react/printing.ts'],
  ['CalendarEventEditorProps', 'src/react/CalendarEventEditor.tsx'],
  ['CalendarEditorContext', 'src/react/CalendarEventEditor.tsx'],
  ['ReactViewConfig', 'src/react/createReactView.tsx'],
  ['UseCalendar', 'src/react/useCalendar.ts'],
  ['RangeChange', 'src/react/app/calendarApp.ts'],
  ['EventSourceContext', 'src/react/app/calendarApp.ts'],
  ['ViewContext', 'src/react/viewTypes.ts'],
  ['ViewRange', 'src/react/viewTypes.ts'],
  ['ViewNavigationInput', 'src/react/viewTypes.ts'],
  ['ViewRenderContext', 'src/react/viewTypes.ts'],
  ['CalendarView', 'src/react/viewTypes.ts'],
  ['ToolbarContext', 'src/react/viewTypes.ts'],
  ['EventSlotInfo', 'src/react/viewTypes.ts'],
  ['MonthMoreInfo', 'src/react/viewTypes.ts'],
  ['EventDropOutsideInfo', 'src/react/externalDrag.ts'],
  ['EventDateTime', 'src/core/types/datetime.ts'],
  ['EventTime', 'src/core/types/datetime.ts'],
  ['EventOccurrence', 'src/core/types/event.ts'],
  ['CalendarOptions', 'src/core/render/state.ts'],
  ['CalendarEvent', 'src/core/types/event.ts'],
  ['CalendarResource', 'src/core/types/resource.ts'],
  ['Recurrence', 'src/core/types/recurrence.ts'],
  ['RRuleModel', 'src/core/types/recurrence.ts'],
];

function commentText(comment) {
  if (typeof comment === 'string') return comment;
  return comment?.map((part) => part.text).join('') ?? '';
}

const model = contracts.map(([name, relativePath]) => {
  const filename = fileURLToPath(new URL(`../${relativePath}`, import.meta.url));
  const source = ts.createSourceFile(
    filename,
    readFileSync(filename, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  const contract = source.statements.find(
    (statement) => ts.isInterfaceDeclaration(statement) && statement.name.text === name,
  );
  if (!contract) throw new Error(`Documentation contract not found: ${name}`);
  const fields = contract.members.map((member) => {
    const documentation = member.jsDoc?.at(-1);
    const remarks = documentation?.tags?.find((tag) => tag.tagName.text === 'remarks');
    const portuguese = commentText(remarks?.comment)
      .replace(/^Português:\s*/, '')
      .replace(/\s+/g, ' ')
      .trim();
    const english = commentText(documentation?.comment).replace(/\s+/g, ' ').trim();
    if (!english || !portuguese)
      throw new Error(`Missing EN/PT JSDoc: ${name}.${member.name?.getText(source)}`);
    return {
      name: member.name?.getText(source) ?? '',
      type: ts.isMethodSignature(member)
        ? `(${member.parameters.map((parameter) => parameter.getText(source)).join(', ')}) => ${member.type?.getText(source) ?? 'void'}`
        : (member.type?.getText(source) ?? 'unknown'),
      optional: Boolean(member.questionToken),
      english,
      portuguese,
      line: source.getLineAndCharacterOfPosition(member.getStart(source)).line + 1,
    };
  });
  return { name, source: relativePath, fields };
});

const output = fileURLToPath(new URL('../examples/generated/api-model.json', import.meta.url));
mkdirSync(fileURLToPath(new URL('../examples/generated/', import.meta.url)), { recursive: true });
writeFileSync(output, `${JSON.stringify(model, null, 2)}\n`);
console.log(
  `Generated ${model.length} API contracts (${model.reduce((total, contract) => total + contract.fields.length, 0)} fields).`,
);
