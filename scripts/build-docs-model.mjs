import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const contracts = [
  ['CalendarProps', 'src/react/types.ts'],
  ['CalendarHandle', 'src/react/types.ts'],
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
