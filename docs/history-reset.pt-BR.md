# Iniciar com histórico Git novo

Português · [English](history-reset.md)

É possível e opcional. Isso não melhora o funcionamento do pacote nem remove credenciais de clones antigos. O fluxo de release não reescreve histórico nem executa force push.

## Recomendação: snapshot revisado em outro repositório

`node scripts/export-clean-repository.mjs` copia os arquivos atuais para `output/fresh-repository`, sem `.git` nem arquivos novos ignorados. Inclui arquivos rastreados e novos não ignorados, pula arquivos excluídos, rejeita arquivos não regulares e recusa substituir uma exportação existente. Preserva checkout, branches, commits e remotos atuais.

Revisar a cópia antes de iniciar Git. Arquivos já rastreados são exportados mesmo que uma regra posterior do `.gitignore` corresponda a eles; remover da origem os segredos ou artefatos rastreados indevidamente. Preservar licença MIT e créditos de terceiros. Depois, dentro da pasta exportada:

```sh
git init -b main
git add .
git diff --cached --stat
git commit -m "Initial Calendara release"
```

Esses comandos criam apenas histórico local. Criar outro repositório GitHub e enviar o snapshot é uma decisão separada. O remoto atual é `jacksoncassemiro/calendara`; não apontar a cópia para ele e executar force push sem um plano explícito de migração.

No novo remoto escolhido, configurar proteções de `main`/`develop`, tags, CI e environment de release. Criar `develop` a partir do commit inicial revisado. Releases, issues, PRs, estrelas e integrações permanecem vinculadas ao repositório antigo; copiar fontes não as transfere.

## Reescrever o repositório existente

Uma branch órfã seguida de force push pode substituir o histórico visível, mas afeta colaboradores, referências de PRs, branches, tags e releases. Não apaga clones, forks, caches ou todas as referências no GitHub. Renomear o repositório também não zera os commits.

Antes de qualquer reescrita: fazer backup completo verificado, inventariar branches/tags/releases, decidir o que preservar, coordenar colaboradores, planejar ajustes nas proteções e definir reversão. Solicitar clones novos depois; branches antigas podem reintroduzir commits antigos. Não executar comandos destrutivos até aprovar essa migração específica.

Se houve segredo exposto, rotacionar a credencial e seguir o [procedimento do GitHub para dados sensíveis](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository). Zerar o histórico por aparência não resolve esse risco.
