<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/brand/calendara-dark.png">
    <img src="assets/brand/calendara-light.png" alt="Calendara" width="160">
  </picture>
</p>

<p align="center">
  <a href="README.md">English</a> · <strong>Português</strong>
</p>

Biblioteca React nativa de calendário e agenda, com recursos, recorrência, views configuráveis e tema personalizável. Um único pacote TypeScript. Licença MIT.

Projeto pessoal e experimental desenvolvido com assistência do OpenAI Codex. As APIs podem mudar antes da versão 1.0; valide os cenários dos quais seu aplicativo depende.

[Documentação](https://jacksoncassemiro.me/calendara/?lang=pt-BR) · [Playground](https://jacksoncassemiro.me/calendara/examples/react.html?lang=pt-BR) · [Exemplos](https://jacksoncassemiro.me/calendara/examples/features.html?lang=pt-BR) · [API](docs/pt-BR/api.md) · [Changelog](CHANGELOG.pt-BR.md)

## Instalação

Calendara é distribuída como `.tgz` anexado a uma GitHub Release. Não está publicada no npm. A versão [0.2.0](https://github.com/jacksoncassemiro/calendara/releases/tag/v0.2.0) está disponível. Instale pela URL fixa do pacote:

```sh
yarn add https://github.com/jacksoncassemiro/calendara/releases/download/v0.2.0/calendara-0.2.0.tgz
yarn add react react-dom
```

React e React DOM 18 ou 19 são peers; use versões compatíveis entre si. O [guia de instalação](docs/pt-BR/getting-started.md) inclui um projeto React novo e instalação local.

## Renderizar

```tsx
import { Calendar, dayView, monthView, type CalendarEvent } from '@jacksoncassemiro/calendara';
import '@jacksoncassemiro/calendara/styles.css';

const views = [dayView, monthView];
const events: CalendarEvent[] = [
  {
    id: 'consulta-1',
    calendarId: 'consultas',
    title: 'Consulta inicial',
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

`views` é obrigatório e define o conjunto completo. Passe `BUILTIN_VIEWS` para o conjunto padrão ou liste somente as views necessárias. `initialView` e `initialDate` valem somente na montagem. A aplicação cria e persiste eventos. Veja no [guia da API](docs/pt-BR/api.md) como salvar movimentos/redimensionamentos e usar formulário próprio.

## Recursos disponíveis

- Dia, semana, mês, agenda, ano, trimestre e planejamento anual; grades de recursos e timelines; views React próprias.
- Movimento, redimensionamento, eventos de vários dias, callbacks de arraste externo e modos de sobreposição/ver mais.
- Capacidade, buffers, expediente e bloqueios com configuração por recurso.
- Recorrência de segundos até anos, exceções e overrides.
- Hierarquia de recursos, virtualização vertical da timeline, importação/exportação ICS e desfazer/refazer do consumidor.
- Editor opcional, slots de renderização, tokens CSS, layouts compactos e ativação de horários por teclado.

A biblioteca está em desenvolvimento e não oferece paridade completa com todos os concorrentes. A recorrência civil usa Temporal injetado, com fallback lazy de `temporal-polyfill`. Testes físicos em Safari/mobile e tecnologias assistivas são distintos dos testes automatizados no Chromium. Veja [recursos e limites](docs/pt-BR/features.md).

## Desenvolvimento

```sh
corepack enable
yarn install --frozen-lockfile
yarn dev
yarn verify
yarn test:browser
```

Use Node 22.12+, 24 ou 26+, conforme `package.json`, e Yarn 1.22.22. Abra a URL do servidor; `examples/react.html` não funciona como arquivo isolado. A validação de navegador usa Microsoft Edge. [Contribuição e releases](CONTRIBUTING.pt-BR.md) descreve branches, verificações e empacotamento.

A [documentação bilíngue](docs/pt-BR/README.md) é o guia público atual. Arquivos na raiz de `docs/`, `specs/` e `experiments/` preservam decisões e histórico da auditoria; podem descrever estados anteriores.

## Comunidade e licença

Veja [como contribuir](CONTRIBUTING.pt-BR.md), [relate um problema](https://github.com/jacksoncassemiro/calendara/issues) ou consulte a [política de segurança](SECURITY.pt-BR.md). Todos os recursos incluídos são distribuídos sob a [licença MIT](LICENSE).
