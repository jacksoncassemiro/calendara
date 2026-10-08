# Publicação

Português · [English](publishing.md)

A Calendara será distribuída como `.tgz` compilado em uma GitHub Release, sem publicar a biblioteca no npm ou no GitHub Packages. O Yarn continua baixando React e outras dependências do registry configurado. O ZIP de código-fonte gerado pelo GitHub não é o pacote compilado para instalação.

## Branches e versões

- `main`: versões revisadas. Exigir PR e check `Verify package`; impedir force push e exclusão.
- `develop`: integração, também com PR e checks obrigatórios.
- `feature/*` e `fix/*`: partir de `develop` e retornar por PR.
- `release/0.1.0`: estabilizar a partir de `develop`, atualizar `package.json` e `CHANGELOG.md`, abrir PR para `main` e integrar as mudanças de volta em `develop`.
- `hotfix/*`: partir de `main`, corrigir por PR para `main` e integrar em `develop`.

Usar SemVer e uma seção por versão no changelog, como `## [0.1.0] - 2026-10-08`, com mudanças em português e inglês. Explicitar mudanças incompatíveis. A CI não altera versões automaticamente a partir das mensagens dos commits.

## Preparar a release

1. Antes de executar a Action, configurar rulesets e o environment `release`: revisão obrigatória, impedir autoaprovação quando disponível e restringir a `main`. A disponibilidade depende do plano e da visibilidade do repositório.
2. Integrar o PR de release em `main` e confirmar a CI.
3. Criar tag anotada nesse commit revisado: `git tag -a v0.1.0 -m "Calendara 0.1.0"`. Enviar somente essa tag: `git push origin v0.1.0`.
4. Em Actions, executar **Prepare GitHub release**, selecionando `main` e informando `v0.1.0`.
5. O fluxo valida a origem da tag, versão, changelog, tipos, testes, build e pacote consumidor. Após o gate do environment, cria um rascunho com `calendara-0.1.0.tgz` e `SHA256SUMS`.
6. Revisar o rascunho, baixar o pacote, comparar seu hash e instalar em um consumidor. Publicar manualmente. Nunca substituir uma tag ou pacote publicado; criar outra versão.

Os arquivos de workflow não configuram as proteções remotas. O GitHub cria um environment inexistente sem proteção; configurar os revisores é uma atividade separada do mantenedor.

## Instalar sem publicação no npm

Depois de publicar a release em repositório público:

```sh
yarn add https://github.com/jacksoncassemiro/calendara/releases/download/v0.1.0/calendara-0.1.0.tgz
yarn add react react-dom
```

Importar `@jacksoncassemiro/calendara` e `@jacksoncassemiro/calendara/styles.css`. Fixar a URL da versão e versionar `yarn.lock`. Em repositório privado, baixar com autenticação pela interface/CLI do GitHub, conferir `SHA256SUMS` e instalar com `yarn add ./calendara-0.1.0.tgz`. Não incluir tokens em URLs de dependências ou lockfiles.

Windows: `Get-FileHash ./calendara-0.1.0.tgz -Algorithm SHA256`. Linux/macOS: `shasum -a 256 calendara-0.1.0.tgz`. Comparar com o hash publicado. O checksum detecta alterações no download, mas não é uma assinatura independente do autor.

## Começar com histórico novo

É possível, mas não é requisito para publicar. Criar **outro repositório com um snapshot revisado dos arquivos versionados** permite iniciar com um commit e preservar o antigo para recuperação. Exportar apenas arquivos rastreados, iniciar Git em outra pasta e revisar antes de criar o remoto. Preservar licença, copyright e créditos de terceiros.

Reescrever o repositório atual com branch órfã e force push afeta colaboradores, tags, referências de PRs e releases. Clones antigos podem manter o histórico. Isso exige escolher o destino, fazer backup verificado e coordenar colaboradores. Não foi aplicado nesta preparação. Se houve segredo exposto, rotacioná-lo; apagar histórico não substitui essa medida.

Fontes: [GitHub Releases](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases), [proteção de environments](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments), [segurança de Actions](https://docs.github.com/en/actions/reference/security/secure-use), [remoção de dados sensíveis](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository).
