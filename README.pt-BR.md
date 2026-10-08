# Calendara

Biblioteca React nativa de calendário e agenda, com recursos, recorrência, views configuráveis e tema personalizável. Um único pacote TypeScript. Licença MIT.

Projeto pessoal e experimental desenvolvido com assistência do OpenAI Codex. As APIs podem mudar antes da versão 1.0; valide os cenários dos quais seu aplicativo depende.

[English](README.md) · [Primeiros passos](docs/pt-BR/getting-started.md) · [API](docs/pt-BR/api.md) · [Contribuição](CONTRIBUTING.pt-BR.md) · [Segurança](SECURITY.pt-BR.md)

## Instalação

Calendara é distribuída como `.tgz` anexado a uma GitHub Release. Não está publicada no npm. Após uma release ser publicada, copie a URL do pacote em [Releases](https://github.com/jacksoncassemiro/calendara/releases) e execute:

```sh
yarn add https://github.com/jacksoncassemiro/calendara/releases/download/v0.1.0/calendara-0.1.0.tgz
yarn add react react-dom
```

A URL representa o formato previsto da primeira release; não afirma que o arquivo já existe. Escolha uma tag disponível e seu arquivo correspondente. React e React DOM 18 ou 19 são peers; use versões compatíveis entre si. O [guia de instalação](docs/pt-BR/getting-started.md) inclui um projeto React novo e instalação local.

## Renderizar

```tsx
import { Calendar, dayView, monthView, type CalendarEvent } from '@jacksoncassemiro/calendara';
import '@jacksoncassemiro/calendara/styles.css';

const views = [dayView, monthView];
const events: CalendarEvent[] = [{
  id: 'consulta-1', calendarId: 'consultas', title: 'Consulta inicial',
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

`views` define o conjunto completo. Omitir usa semana, dia, mês e agenda; `BUILTIN_VIEWS` amplia esse conjunto. `initialView` e `initialDate` valem somente na montagem. A aplicação cria e persiste eventos. Veja no [guia da API](docs/pt-BR/api.md) como salvar movimentos/redimensionamentos e usar formulário próprio.

## Recursos disponíveis

- Dia, semana, mês, agenda, N dias, recursos e timeline; views React próprias.
- Movimento, redimensionamento, eventos de vários dias, callbacks de arraste externo e modos de sobreposição/ver mais.
- Capacidade, buffers, expediente e bloqueios com configuração por recurso.
- Recorrência diária, semanal, mensal e anual, exceções e overrides.
- Editor opcional, slots de renderização, tokens CSS, layouts compactos e ativação de horários por teclado.

A biblioteca está em desenvolvimento e não oferece paridade completa com todos os concorrentes. A recorrência usa `rrule-temporal`; Temporal carrega um fallback quando necessário. Testes físicos em Safari/mobile e tecnologias assistivas são distintos dos testes automatizados no Edge. Veja [recursos e limites](docs/pt-BR/api.md#recursos-e-limites).

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
