# Primeiros passos

[English](../en/getting-started.md) · [Documentação](README.md)

## Requisitos

Para desenvolver a biblioteca e executar o exemplo, use Node compatível com `^22.12.0 || ^24.0.0 || >=26.0.0`, Yarn 1.22.22 e um bundler React. Instale versões compatíveis de React/React DOM 18 ou 19. TypeScript é opcional para consumidores. Não é necessário instalar Tailwind.

## Aplicação React nova

```sh
corepack enable
yarn create vite minha-agenda --template react-ts
cd minha-agenda
yarn install
```

Abra [Releases da Calendara](https://github.com/jacksoncassemiro/calendara/releases), escolha uma versão publicada e copie a URL do arquivo `.tgz`. O ZIP/tar.gz de código-fonte gerado automaticamente pelo GitHub é um checkout, não o pacote compilado.

```sh
yarn add https://github.com/jacksoncassemiro/calendara/releases/download/v0.4.4/calendara-0.4.4.tgz
```

Use uma URL fixa de release publicada. O GitHub fornece o pacote, mas Yarn continua resolvendo dependências de execução no registry configurado. Não é uma instalação totalmente offline.

Substitua `src/App.tsx` pelo [exemplo do README](../../README.pt-BR.md#renderizar) e execute:

```sh
yarn dev
```

Importe `@jacksoncassemiro/calendara/styles.css` uma vez, antes dos overrides do aplicativo. Há ESM, CommonJS e declarações TypeScript. `/core` é uma entrada secundária do mesmo pacote para utilitários do motor, não outro pacote a instalar.

## Pacote baixado

Baixe o `.tgz` da release, mantenha-o no projeto e instale pelo caminho:

```sh
yarn add ./vendor/calendara-0.4.4.tgz
```

Compare SHA-256 com `SHA256SUMS` da mesma release. No PowerShell:

```powershell
Get-FileHash ./vendor/calendara-0.4.4.tgz -Algorithm SHA256
```

Fixe uma URL de versão e versione `yarn.lock`; evite URL mutável de `latest`. O checksum detecta alteração no download, mas não comprova por si só a identidade do publicador.

## Atualização e problemas comuns

Leia as notas da release e o [CHANGELOG](../../CHANGELOG.md), instale a URL da nova versão e revise o lockfile. Atualizar o pacote não migra eventos persistidos automaticamente.

- Erro 404: tag/arquivo ausente ou privado; confira a URL da release publicada.
- Calendário sem estilo: verifique a importação da folha CSS.
- Abra os exemplos por `yarn dev`, não por `file://`; os módulos exigem servidor.
- Escolha `events` ou `eventSource` como fonte de verdade e salve as edições conforme o [guia da API](api.md).
