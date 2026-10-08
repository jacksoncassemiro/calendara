# Contribuição

[English](CONTRIBUTING.md)

## Ambiente

Use Node compatível com `package.json` (`^22.12.0 || ^24.0.0 || >=26.0.0`) e Yarn 1.22.22.

```sh
git clone https://github.com/jacksoncassemiro/calendara.git
cd calendara
corepack enable
yarn install --frozen-lockfile
yarn dev
```

Abra `/examples/react.html` pela URL do Vite. O estilo da biblioteca fica em `styles.css`; o CSS do playground é separado. Preserve o pacote único e React como peer. Versione o lockfile ao alterar dependências.

## Mudanças pequenas e revisáveis

Defina comportamento, usuários afetados e critérios de aceite observáveis antes da implementação. Mudanças maiores usam spec, plano e tarefas pequenas em `specs/`. Prefira nomes descritivos e lógica compartilhada quando remover duplicação real. Mantenha JSDoc útil e direto, com inglês e português. Atualize os dois idiomas da documentação pública juntos. Testes devem validar comportamento/integração, não repetir a implementação.

```sh
yarn verify
yarn test:browser
yarn audit:dependencies
```

`verify` verifica tipos, testes unitários/integração, build, consumo do pacote e demo. Os scripts de browser verificam interações/layouts; Edge é o padrão local e CI usa Chrome. Inspecione screenshots e console nas mudanças visuais. Esses scripts não comprovam Safari/mobile físico ou leitor de tela.

## Branches e commits

- `main`: commits revisados e prontos para release.
- `develop`: integração da próxima versão.
- `feature/<descricao>` ou `fix/<descricao>`: fatias pequenas a partir de `develop`, integradas por PR.
- `release/<versao>`: preparação a partir de `develop`, com versão, changelog e correções finais.
- `hotfix/<descricao>`: correção urgente a partir de `main`, integrada de volta nas duas branches duradouras.

Use commits claros, como `fix: preserve resource capacity during resize`. PRs descrevem comportamento final, validação e limites relevantes. Configure proteção/rulesets exigindo revisão e `Verify package`; desabilite force push nas branches duradouras. Essa configuração é feita no GitHub; o YAML não impõe essas regras sozinho.

## Preparação da release

1. Em `release/<versao>`, atualize `package.json` com SemVer e adicione seção correspondente em `CHANGELOG.md`, nos dois idiomas. Revise breaking changes e instalação.
2. Integre o PR revisado em `main` e depois integre as mudanças liberadas em `develop`.
3. Crie tag anotada `v<versao>` no commit exato liberado de `main` e envie a tag. Não mova tags publicadas.
4. Execute **Prepare GitHub release** a partir de `main`, informando a tag existente. O fluxo verifica versão/tag/ancestralidade, valida pacote/browser e empacota a biblioteca compilada com checksum.
5. Revise o rascunho da GitHub Release, conteúdo do pacote, notas e checksum. Publique manualmente após a revisão.

O workflow não publica no npm. A permissão de escrita fica somente no job do rascunho, atrás do environment `release`. Configure revisores obrigatórios nesse environment quando seu plano GitHub permitir. Actions são fixadas, dependências usam lockfile e a tag validada é conferida novamente antes da criação do rascunho. A execução hospedada ainda precisa ser validada no GitHub após o envio dos arquivos.

Zerar histórico Git não é etapa habitual de release. Isso perde links de commits, tags e contexto de auditoria, podendo afetar colaboradores. Preserve um Git bundle offline antes de uma reescrita autorizada separadamente; prefira repositório novo quando precisar de histórico público limpo. Não reescreva tags publicadas nesse fluxo.
