# Site de documentação

Português · [English](publishing-pages.md)

A documentação pública e o playground podem ser hospedados em `https://jacksoncassemiro.github.io/calendara/`. A URL só ficará disponível depois de versionar o workflow, enviar para `main` e concluir o deploy.

Em Settings → Pages do repositório, selecionar **GitHub Actions** como origem. Restringir o environment `github-pages` a `main`; adicionar revisão obrigatória se o plano permitir. Revisar o primeiro build antes do deploy. Um domínio próprio exige atualizar o base path do site e a configuração de domínio/Pages.

`.github/workflows/pages.yml` executa em pushes para `main` ou manualmente nessa branch. O job de leitura instala dependências pelo lockfile e compila com `MC_SITE_BASE=/calendara/`. Envia apenas `dist/playground`, com a documentação e demo. Rejeita links simbólicos, logs, dotenv e tarballs nessa saída. Resultados locais de auditoria, screenshots, histórico Git e pacotes de release não são enviados.

O job de deploy recebe apenas `pages: write` e `id-token: write`, no environment `github-pages`. Executa a Action oficial fixada por SHA, sem checkout, instalação de dependências ou scripts de build do projeto. PRs e forks não recebem permissão de deploy. A visibilidade do Pages pode ser diferente da visibilidade do repositório; considerar públicos todos os eventos de demonstração e exemplos incluídos.

O site é estático: alterações dos eventos não são enviadas a um backend de produção. Sua publicação é separada da distribuição `.tgz` pelas GitHub Releases e não publica a biblioteca no npm.

Fontes: [workflows próprios para Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), [deploy-pages](https://github.com/actions/deploy-pages), [proteção de environments](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments).
