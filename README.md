# projeto-calendario

Biblioteca de calendário/agenda própria com prioridade em **React**, motores em TypeScript, bloqueios, horário comercial, recursos e recorrência via Temporal API. O renderer é React nativo; eventos, toolbar e views personalizadas pertencem à árvore React do consumidor e compartilham seus providers.

> **Status:** em desenvolvimento, com auditoria e regressões automatizadas. Views Dia/Semana/Mês/N-dias/Agenda/Recursos/Timeline disponíveis; drag/resize limitado a eventos timed contidos em um dia. Não há paridade completa com concorrentes. Consulte a [revisão de arquitetura e recursos](docs/06-REVISAO-COMPETITIVA.md) e o [estado do projeto](docs/00-STATUS.md).

## Pacotes

| Pacote | O quê |
|---|---|
| `@meucalendario/core` | motores de datas, subconjunto de recorrência RFC 5545, constraints, geometria e ocupação; sem renderer ou dependência de React. |
| `@meucalendario/react` | `<Calendar/>`, views, controlador `CalendarApp`, `useCalendar`, `createReactView`, `useCompactCalendar`. |
| `@meucalendario/styles` | tema padrão (tokens `--mc-*` + classes `mc-*`). Ver [`docs/04-ESTILIZACAO.md`](docs/04-ESTILIZACAO.md). |

## Instalação

Os pacotes estão na versão de desenvolvimento `0.0.0`; publicação em registry não foi validada. As instruções abaixo descrevem o consumo após empacotamento/publicação ou em um workspace.

```bash
yarn add @meucalendario/react @meucalendario/core @meucalendario/styles react react-dom
# fallback para ambientes sem Temporal (dependência já declarada pelo core):
yarn add @js-temporal/polyfill
```

## Uso — React

```tsx
import { Calendar, useCalendar } from '@meucalendario/react';
import '@meucalendario/styles';
import type { CalendarEvent } from '@meucalendario/core';

const events: CalendarEvent[] = [{
  id: 'e1', calendarId: 'c1', title: 'Consulta',
  time: {
    allDay: false,
    start: { dateTime: '2026-07-22T09:00:00', timeZone: 'America/Sao_Paulo' },
    end:   { dateTime: '2026-07-22T10:00:00', timeZone: 'America/Sao_Paulo' },
  },
}];

export function Agenda() {
  const { ref, api } = useCalendar();
  return (
    <>
      <button onClick={() => api.prev()}>‹</button>
      <button onClick={() => api.today()}>Hoje</button>
      <button onClick={() => api.next()}>›</button>

      <Calendar
        apiRef={ref}
        view="week"
        date="2026-07-22"
        events={events}
        options={{ timeZone: 'America/Sao_Paulo', startHour: 7, endHour: 20 }}
        constraints={{
          businessHours: [{ daysOfWeek: [1, 2, 3, 4, 5], startTime: '08:00', endTime: '18:00' }],
          blocked: [{ scope: 'time', date: '2026-07-22', startTime: '12:00', endTime: '13:00' }],
        }}
        onEventDrop={(change) =>
          // persista; retorne false / rejeite para REVERTER o movimento otimista.
          saveNewTime(change.occurrence.masterId, change.startDateTime, change.endDateTime)
        }
        onDateSelect={(sel) => openCreateModal(sel.dateISO, sel.startMin, sel.endMin)}
        onDropBlocked={(info) => toast(`Movimento inválido: ${info.reason}`)}
      />
    </>
  );
}
```

O controlador acompanha o ciclo de montagem. Mudanças de props são agrupadas; dados equivalentes não geram uma nova derivação. `renderEvent`, `customToolbar` e views de `createReactView` aceitam conteúdo React e herdam o contexto diretamente. Trate eventos e opções como dados imutáveis. `resources` habilita validação de lotação/buffer no drag. O consumidor deve persistir alterações e exceções de recorrência em seu estado.

## Organização interna

Os motores TypeScript são independentes do renderer. Os três pacotes atuais ainda são empacotados separadamente; React nativo não exige essa divisão. A recomendação para simplificar o consumo é um único pacote público com módulos internos de motor, componentes e estilos. Essa consolidação ainda não foi implementada. A interface visual atual requer React.

## Interação, recorrência, estilização, a11y

- **Interação** (views de time-grid): `onEventDrop`/`onEventResize` (retornar `false`/rejeitar ⇒ **revert**), `onDateSelect`, `onDropBlocked`/`onClickBlocked`. Validade = `ConstraintEngine` (horário comercial/bloqueios/allowed) **+** ocupação do recurso (lotação por `capacity`, `bufferBefore`/`bufferAfter`).
- **Recorrência:** motor próprio sobre Temporal para DAILY/WEEKLY/MONTHLY/YEARLY. Não implementa todo o RFC 5545; confira as limitações na revisão. Polyfill carregado quando Temporal não está disponível. `rrule.js` é usado como oráculo de testes, fora do bundle de produção.
- **Estilização:** `import '@meucalendario/styles'` e redefina tokens `--mc-*` sob `[data-mc-root]`. Guia: [`docs/04-ESTILIZACAO.md`](docs/04-ESTILIZACAO.md).
- **Acessibilidade:** toolbar com `role="toolbar"`, `aria-label` nos ícones ‹/›, `aria-pressed` nas views, `aria-live` no título (navegação por teclado no grid fica para depois).

## Desenvolvimento

```bash
yarn install
yarn test          # vitest (node + jsdom)
yarn typecheck     # tsc estrito por pacote
yarn build         # ESM + CJS + .d.ts por pacote (core → react → styles)
yarn verify        # tipos, testes, build, pacotes empacotados e demo de produção
yarn test:browser  # fluxos React e layout no Edge; gerencia servidor e sessão isolada
node scripts/bench.mjs 2000 15   # bench (requer core buildado)
```

O benchmark usa o polyfill quando Temporal não está disponível. O [experimento de recorrência civil](experiments/civil-recurrence/REPORT.md) compara o motor atual, um protótipo sem Temporal e rrule.js. O protótipo não substitui produção: faltam resolução completa de timezone/DST e validação mais ampla.

### Playground (validação visual)

Além dos testes automatizados (jsdom montam o calendário e checam o DOM real), há um playground para ver rodando no navegador:

```bash
yarn dev
# abre /examples/react.html
```

Ele exercita as views, drag & drop / resize / seleção, recorrência, bloqueios e recursos (lotação/buffer), com um log das interações.

### Compatibilidade React

O pacote React declara peers React/React DOM **`^18 || ^19`**. A suíte atual usa React 19.1.0; React 18 não foi executado nesta revisão. StrictMode, remontagem e herança de contexto têm testes de regressão.

## Documentação

| Doc | O que é |
|---|---|
| [`docs/00-STATUS.md`](docs/00-STATUS.md) | **Diário/continuidade** entre sessões. **Leia primeiro.** |
| [`docs/01-ANALISE.md`](docs/01-ANALISE.md) | Análise do uso atual (wsaude-web), das 3 tentativas e requisitos |
| [`docs/02-PLANO.md`](docs/02-PLANO.md) | Plano de execução faseado + ADRs (decisões) |
| [`docs/03-ARQUITETURA.md`](docs/03-ARQUITETURA.md) | Desenho técnico alvo (core headless, anti-rerender, views) |
| [`docs/04-ESTILIZACAO.md`](docs/04-ESTILIZACAO.md) | Tokens, classes e hooks de customização |
| [`docs/05-API.md`](docs/05-API.md) | **Referência completa**: modelo de dados, opções, callbacks, views (todos os campos) |
| [`docs/reference/`](docs/reference) | Referências open-source, modelos Google/Outlook/RFC 5545, validação de recorrência |

## Decisões-chave (resumo)
- **React primeiro**, mas núcleo headless framework-agnostic (extração vanilla é meta).
- **React nativo**, mantendo motores independentes. Preact, ReactIsland, registro de portals e playground antigo foram removidos.
- **Recorrência própria via Temporal API** (rrule.js só como oráculo de teste); polyfill para Safari.
- **Modelo inspirado em RFC 5545**, sem afirmar interoperabilidade completa com Google/Outlook antes de testes de importação/exportação.
- **Bloqueios e horário comercial** como constraints de 1ª classe (não background-events).

Detalhes e alternativas descartadas nos ADRs de [`docs/02-PLANO.md`](docs/02-PLANO.md).

Validação de 07/10/2026: 258 testes em 21 arquivos, 23 verificações no Edge e 18 combinações de view/largura. A [auditoria de segurança](docs/security_best_practices_report.md) registra correções e limites. `yarn audit:dependencies` não encontrou advisories conhecidos no último scan.
