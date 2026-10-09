<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/brand/calendara-dark.png">
    <img src="assets/brand/calendara-light.png" alt="Calendara" width="160">
  </picture>
</p>

<p align="center">
  <strong>English</strong> · <a href="README.pt-BR.md">Português</a>
</p>

A native React calendar and scheduler with resources, recurring events, configurable views and a customizable theme. One TypeScript package. MIT licensed.

A personal, experimental project developed with assistance from OpenAI Codex. APIs may change before 1.0; test the scenarios your application depends on.

[Documentation](https://jacksoncassemiro.me/calendara/?lang=en) · [Playground](https://jacksoncassemiro.me/calendara/examples/react.html?lang=en) · [Examples](https://jacksoncassemiro.me/calendara/examples/features.html?lang=en) · [API](docs/en/api.md) · [Changelog](CHANGELOG.md)

## Install

Calendara is distributed as a `.tgz` asset attached to a GitHub Release. It is not published to npm. Version [0.4.0](https://github.com/jacksoncassemiro/calendara/releases/tag/v0.4.0) is available. Install its fixed asset URL:

```sh
yarn add https://github.com/jacksoncassemiro/calendara/releases/download/v0.4.0/calendara-0.4.0.tgz
yarn add react react-dom
```

React and React DOM 18 or 19 are peers; use matching versions. The [installation guide](docs/en/getting-started.md) covers a new React project and local installation.

## Render

```tsx
import { Calendar, dayView, monthView, type CalendarEvent } from '@jacksoncassemiro/calendara';
import '@jacksoncassemiro/calendara/styles.css';

const views = [dayView, monthView];
const events: CalendarEvent[] = [
  {
    id: 'appointment-1',
    calendarId: 'appointments',
    title: 'Initial appointment',
    time: {
      allDay: false,
      start: { dateTime: '2026-10-09T09:00:00', timeZone: 'America/Sao_Paulo' },
      end: { dateTime: '2026-10-09T10:00:00', timeZone: 'America/Sao_Paulo' },
    },
  },
];

export function App() {
  return (
    <Calendar
      views={views}
      events={events}
      initialView="day"
      initialDate="2026-10-09"
      options={{ timeZone: 'America/Sao_Paulo' }}
    />
  );
}
```

`views` is required and selects the complete available set. Pass `BUILTIN_VIEWS` for the standard set, or list only the views you need. `initialView` and `initialDate` apply only at mount. Your application creates and persists events. The [API guide](docs/en/api.md) shows drag/resize persistence and custom forms.

## Included

- Day, week, month, agenda, year, quarter and year planner; resource grids and timelines; custom React views.
- Drag, resize, multi-day events, external drag callbacks and overlap/overflow display modes.
- Capacity, buffers, business hours and blocked intervals, including per-resource rules.
- Secondly through yearly recurrence, exceptions and overrides.
- Resource hierarchy, vertical timeline virtualization, ICS import/export and consumer undo/redo.
- Optional event editor, render slots, CSS tokens, compact layouts and keyboard slot activation.

This developing library does not offer complete scheduler parity. Civil recurrence uses injected Temporal, with a lazy `temporal-polyfill` fallback. Physical Safari/mobile and assistive-technology checks remain separate from automated Chromium validation. See [features and limits](docs/en/features.md).

## AI-assisted integration

Using an AI assistant? Start with the [AI integration guide](docs/en/ai-integration.md). The site's [llms.txt](https://jacksoncassemiro.me/calendara/llms.txt) indexes readable guides and generated API contracts.

## Develop

```sh
corepack enable
yarn install --frozen-lockfile
yarn dev
yarn verify
yarn test:browser
```

Use Node 22.12+, 24 or 26+, according to `package.json`, and Yarn 1.22.22. Open the server URL; `examples/react.html` is not a standalone file. Browser review uses Microsoft Edge. [Contribution and release instructions](CONTRIBUTING.md) describe branches, checks and packaging.

The [bilingual documentation](docs/en/README.md) is the current public guide. Root-level `docs/`, `specs/` and `experiments/` files preserve architecture decisions and audit history; they may describe previous states.

## Community and license

Read [how to contribute](CONTRIBUTING.md), [report an issue](https://github.com/jacksoncassemiro/calendara/issues) or consult the [security policy](SECURITY.md). Every included feature is distributed under the [MIT license](LICENSE).
