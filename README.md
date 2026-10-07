# Meu Calendário

Biblioteca React nativa de calendário e agenda. **Um único pacote**, com motores TypeScript internos e CSS personalizável por tokens. Versão 0.0.0 em desenvolvimento; publicação no registry ainda não efetuada.

## Consumo

```sh
yarn add @meucalendario/calendar react react-dom
```

```tsx
import {Calendar, useCalendar, type CalendarEvent} from '@meucalendario/calendar';
import '@meucalendario/calendar/styles.css';

const events: CalendarEvent[] = [{
  id:'consulta', calendarId:'agenda', title:'Consulta',
  time:{allDay:false,
    start:{dateTime:'2026-10-07T09:00:00',timeZone:'America/Sao_Paulo'},
    end:{dateTime:'2026-10-07T10:00:00',timeZone:'America/Sao_Paulo'}}
}];
export function Agenda() {
  const {ref,api}=useCalendar();
  return <><button onClick={()=>api.today()}>Hoje</button>
    <Calendar apiRef={ref} events={events} date="2026-10-07" view="week"
      options={{timeZone:'America/Sao_Paulo'}} /></>;
}
```

Props devem ser imutáveis. Mudanças são agrupadas e dados equivalentes deduplicados. Para persistir movimentos controlados, use onEventDrop/onEventResize e applyEventTimeChange no seu estado; retornar false/rejeitar reverte o commit otimista. A biblioteca não grava no servidor.

## Recursos atuais

- Dia, semana, mês, agenda, N dias, recursos e timeline; createReactView para views próprias com hooks/providers React.
- Drag/resize de eventos timed entre dias e de intervalos all-day na faixa de dias; transferência entre recursos, constraints, capacidade/buffers e rollback concorrente.
- CalendarEventEditor opcional para criação/edição/reagendamento/exclusão, ocorrência/esta e seguintes/série, recursos e validação assíncrona. Forneça validate/onSave/onDelete; monte com key da ocorrência ao trocar de evento. splitEventSeries divide o mestre em passado e nova série futura; veja examples/react-playground.tsx.
- Mês compacto com lista do dia, toolbar compacta, useCompactCalendar e rolagem interna. O editor oferece alternativa ao gesto de arrastar.
- Mês desktop com drag/resize, limite de três eventos por dia e botão “+N mais” que abre a lista completa. Configure `options.monthMaxEvents` com um inteiro (inclusive zero) ou `false` para mostrar todos; no celular a lista permanece completa.
- Setas e Home/End navegam pelos horários em dia/semana/recursos/timeline e pelos dias do mês. Enter/Espaço selecionam um horário respeitando constraints e capacidade; eventos podem ser ativados pelo teclado.
- Recorrência com rrule-temporal 2.2.8 integrada a RDATE, EXDATE, cancelamentos e overrides. Contrato público: DAILY/WEEKLY/MONTHLY/YEARLY, INTERVAL, COUNT, UNTIL, BYMONTH, BYMONTHDAY, BYDAY, BYSETPOS, WKST e BYYEARDAY (YEARLY). Não expõe ainda todos os campos/frequências suportados pela dependência.
- CSS público em styles.css com tokens --mc-*. Não é necessário instalar Tailwind.

O motor sem interface pode ser importado por **@meucalendario/calendar/core**, entrada do mesmo pacote. iterateCivilDates(model,dtStart,window) permanece como utilitário independente de datas ISO sem Temporal. A expansão dos eventos usa rrule-temporal; a composição de duração/overrides e o restante do calendário ainda usam Temporal, com polyfill carregado sob demanda. A dependência contém também seu fallback interno; esta migração não elimina polyfills nem reduz o bundle. Início de série num gap DST é rejeitado explicitamente.

## Desenvolvimento e validação

```sh
yarn install
yarn dev                     # /examples/react.html
yarn verify                  # tipos, testes, builds e consumo do tarball
yarn test:browser            # fluxos e layouts no Edge
yarn audit:dependencies
node scripts/compare-recurrence.mjs
node scripts/compare-recurrence-events.mjs
```

React/React DOM ^18 ou ^19 são peers; a validação atual executou React 19. Compatibilidade física Safari/iOS/Android não foi comprovada. SSR gera o container inicial. Ainda faltam subdiárias, ICS, virtualização, undo/redo, RTL e impressão; não há paridade completa com concorrentes. “Esta e seguintes” exige corte numa ocorrência ativa gerada pela RRULE, mesmo tipo de horário e timezone; mudanças incompatíveis com filtros são rejeitadas.

Leia [estado vigente](docs/00-STATUS.md), [API](docs/05-API.md), [estilização](docs/04-ESTILIZACAO.md), [comparação de concorrentes](docs/06-REVISAO-COMPETITIVA.md), [adoção de recorrência](experiments/civil-recurrence/ADOPTION.md) e [auditoria](docs/security_best_practices_report.md).
