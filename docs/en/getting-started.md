# Getting started

[Português](../pt-BR/getting-started.md) · [Documentation](README.md)

## Requirements

For library development and the example below, use Node satisfying `^22.12.0 || ^24.0.0 || >=26.0.0`, Yarn 1.22.22, and a React bundler. Install matching React/React DOM 18 or 19. TypeScript is optional for consumers. No Tailwind installation is required.

## New React application

```sh
corepack enable
yarn create vite my-agenda --template react-ts
cd my-agenda
yarn install
```

Open [Calendara Releases](https://github.com/jacksoncassemiro/calendara/releases). Select a published version and copy the `.tgz` asset URL. Do not use the automatically generated source ZIP/tar.gz: those archives are source checkouts, not the compiled package.

```sh
yarn add https://github.com/jacksoncassemiro/calendara/releases/download/v0.4.3/calendara-0.4.3.tgz
```

Use a fixed published release URL. GitHub serves the package, while Yarn still resolves its runtime dependencies from the configured registry. This is not a fully offline installation.

Replace `src/App.tsx` with the [README example](../../README.md#render), then run:

```sh
yarn dev
```

Import `@jacksoncassemiro/calendara/styles.css` once, before application overrides. The library supports ESM and CommonJS with TypeScript declarations. `/core` is a secondary entry of the same package for engine utilities, not a second package to install.

## Downloaded package

Download the release `.tgz`, keep it in your project, and install its path:

```sh
yarn add ./vendor/calendara-0.4.3.tgz
```

Check its SHA-256 against `SHA256SUMS` from the same release. On PowerShell:

```powershell
Get-FileHash ./vendor/calendara-0.4.3.tgz -Algorithm SHA256
```

Pin a specific release URL and commit `yarn.lock`; avoid a mutable `latest` URL. A matching checksum detects a changed download, but does not independently prove publisher identity.

## Updating and troubleshooting

Read the release notes and [CHANGELOG](../../CHANGELOG.md), install the new version's URL, and review the lockfile. Package updates do not migrate your persisted events automatically.

- A 404 means the tag/asset is absent or private; verify the published release URL.
- An unstyled calendar usually means the stylesheet import is missing.
- Open examples through `yarn dev`, not `file://`; modules need the development server.
- Use `events` state or `eventSource` as the data authority and persist edits as described in the [API guide](api.md).
