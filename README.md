# Calendara

A native React calendar and scheduler with resources, recurring events, configurable views and a customizable theme. One TypeScript package. MIT licensed.

A personal, experimental project developed with assistance from OpenAI Codex. APIs may change before 1.0; test the scenarios your application depends on.

[Português](README.pt-BR.md) · [Getting started](docs/en/getting-started.md) · [API](docs/en/api.md) · [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md)

## Install

Calendara is distributed as a `.tgz` asset attached to a GitHub Release. It is not published to npm. After a release is published, copy its asset URL from [Releases](https://github.com/jacksoncassemiro/calendara/releases), then run:

```sh
yarn add https://github.com/jacksoncassemiro/calendara/releases/download/v0.1.0/calendara-0.1.0.tgz
yarn add react react-dom
```

This URL shows the planned first-release format; it does not mean the asset already exists. Choose an available tag and matching asset. React and React DOM 18 or 19 are peers; use matching versions. The [installation guide](docs/en/getting-started.md) covers a new React project and local installation.

## Render

```tsx
import { Calendar, dayView, monthView, type CalendarEvent } from '@jacksoncassemiro/calendara';
import '@jacksoncassemiro/calendara/styles.css';

const views = [dayView, monthView];
const events: CalendarEvent[] = [{
  id: 'appointment-1', calendarId: 'appointments', title: 'Initial appointment',
  time: {
    allDay: false,
    start: { dateTime: '2026-10-08T09:00:00', timeZone: 'America/Sao_Paulo' },
    end: { dateTime: '2026-10-08T10:00:00', timeZone: 'America/Sao_Paulo' },
  },
}];

export function App() {
  return <Calendar views={views} events={events} initialView="day"
    initialDate="2026-10-08" options={{ timeZone: 'America/Sao_Paulo' }} />;
}
```

`views` selects the complete available set. Omit it for week, day, month and list; use `BUILTIN_VIEWS` to extend that set. `initialView` and `initialDate` apply only at mount. Your application creates and persists events. The [API guide](docs/en/api.md) shows drag/resize persistence and custom forms.

## Included

- Day, week, month, agenda, N-day, resource-day and resource-timeline views; custom React views.
- Drag, resize, multi-day events, external drag callbacks and overlap/overflow display modes.
- Capacity, buffers, business hours and blocked intervals, including per-resource rules.
- Daily, weekly, monthly and yearly recurrence, exceptions and overrides.
- Optional event editor, render slots, CSS tokens, compact layouts and keyboard slot activation.

This developing library does not offer complete scheduler parity. Recurrence uses `rrule-temporal`; Temporal loads a fallback when necessary. Physical Safari/mobile and assistive-technology checks remain separate from automated Edge validation. See [features and limits](docs/en/api.md#features-and-limits).

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
