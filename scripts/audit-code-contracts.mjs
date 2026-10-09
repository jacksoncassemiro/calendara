import { readdirSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const findings = {
  undocumentedMembers: [],
  positionalParameters: [],
  positionalContracts: [],
  singleLanguageComments: [],
};
const files = [];
function collectFiles(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === 'generated') continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) collectFiles(path);
    else if (/\.(?:tsx?|m?js)$/.test(entry.name)) files.push(path);
  }
}
for (const directory of ['src', 'tests', 'scripts', 'examples'])
  collectFiles(join(root, directory));
for (const file of files) {
  const content = readFileSync(file, 'utf8');
  const source = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true);
  const location = (node) => ({
    file: relative(root, file).replaceAll('\\', '/'),
    line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
  });
  function visit(node) {
    if (
      ts.isInterfaceDeclaration(node) &&
      node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
    ) {
      for (const member of node.members) {
        if (!member.jsDoc?.length)
          findings.undocumentedMembers.push({
            ...location(member),
            contract: node.name.text,
            member: member.name?.getText(source),
          });
      }
    }
    if (ts.isFunctionLike(node) && node.body && node.parameters.length >= 3) {
      findings.positionalParameters.push({
        ...location(node),
        name: node.name?.getText(source) ?? '<callback>',
        parameters: node.parameters.map((parameter) => parameter.getText(source)),
      });
    }
    if (
      (ts.isMethodSignature(node) ||
        ts.isCallSignatureDeclaration(node) ||
        ts.isFunctionTypeNode(node)) &&
      node.parameters.length >= 3
    ) {
      findings.positionalContracts.push({
        ...location(node),
        name: node.name?.getText(source) ?? '<function type>',
        parameters: node.parameters.map((parameter) => parameter.getText(source)),
      });
    }
    for (const comment of [
      ...(ts.getLeadingCommentRanges(content, node.pos) ?? []),
      ...(ts.getTrailingCommentRanges(content, node.end) ?? []),
    ]) {
      const text = content.slice(comment.pos, comment.end);
      if (
        /^(?:\/\*|\/\/)/.test(text) &&
        !/(?:@remarks Português:|PT:|Português:)/.test(text) &&
        !/@jsx|reference|@vitest|@ts-|eslint-|prettier-/.test(text)
      ) {
        const item = { ...location(node), text };
        if (
          !findings.singleLanguageComments.some(
            (existing) => existing.file === item.file && existing.text === text,
          )
        )
          findings.singleLanguageComments.push(item);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}
mkdirSync(join(root, 'output'), { recursive: true });
writeFileSync(
  join(root, 'output/code-contract-audit.json'),
  JSON.stringify(findings, null, 2) + '\n',
);
console.log(
  JSON.stringify(
    Object.fromEntries(Object.entries(findings).map(([key, items]) => [key, items.length])),
  ),
);
if (
  process.argv.includes('--check') &&
  (findings.undocumentedMembers.length ||
    findings.singleLanguageComments.length ||
    findings.positionalParameters.length ||
    findings.positionalContracts.length)
)
  process.exitCode = 1;
