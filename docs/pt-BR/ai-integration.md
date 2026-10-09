# Integrar o Calendara com uma assistente de IA

[English](../en/ai-integration.md) · [Documentação](README.md)

Use este guia ao gerar código de uma aplicação que consome o Calendara. As instruções de manutenção do repositório ficam no `AGENTS.md`; elas não são requisitos de integração da aplicação.

## Confirme a API primeiro

- Confira a versão instalada e suas declarações TypeScript exportadas. A documentação do site pode descrever mudanças mais recentes que sua instalação.
- Siga o [guia de instalação](getting-started.md). A distribuição usa arquivos versionados das GitHub Releases; não invente uma instalação pelo registro npm ou uma URL de release ainda não publicada.
- Consulte o [guia da API](api.md), a [referência gerada dos contratos](https://jacksoncassemiro.me/calendara/docs/pt-BR/api-reference.md) e o [guia de recursos](features.md). A referência dos contratos é gerada pelos tipos e JSDoc do código-fonte.
- Importe de `@jacksoncassemiro/calendara`, de sua exportação `/core` ou de `/styles.css`; evite caminhos internos do código-fonte. O CSS opcional é separado do estilo do site da documentação.

## Preserve os contratos de integração

- Passe um array `views` não vazio, com nomes únicos. Mantenha as definições estáveis, fora do componente ou memoizadas. Registre apenas as views necessárias.
- `initialView` e `initialDate` configuram a montagem. `view` e `date` solicitam navegação quando seus valores mudam; não são estado estritamente controlado. Observe os callbacks de navegação ou o handle do calendário.
- Eventos precisam de `id`, `calendarId`, `title` e `time`. Limites com horário usam `dateTime` ISO local e `timeZone` IANA; eventos de dia inteiro usam `date` ISO. Os términos são exclusivos. Preserve toda a duração e a identidade original da ocorrência recorrente ao editar.
- A aplicação é responsável pela persistência. Retornar `false` ou rejeitar um callback assíncrono de gesto desfaz seu candidato. Persista antes de atualizar o estado autoritativo da aplicação; trate carregamento e erros. Encaminhe os sinais de cancelamento da fonte de eventos e carregue todo o intervalo visível.
- Capacidade dos recursos, restrições de expediente, sobreposição visual e buffers são regras distintas. Valide todos os recursos atribuídos; o backend deve impedir gravações concorrentes inválidas. Colorir um dia não bloqueia agendamentos.
- Use hooks em componentes React ou hooks, nunca diretamente em callbacks como `renderEvent`. Retorne um componente do callback quando o conteúdo personalizado precisar de hooks.
- Deixe `locale` formatar datas e números. Forneça o dicionário agrupado para os textos da interface; mensagens dinâmicas recebem valores por funções. Consulte as chaves suportadas no guia da API.
- A responsividade acompanha o container do calendário. Teste um container estreito em uma página larga e também janelas pequenas. O scroll automático nas bordas vem habilitado; deslizar normalmente no touch continua sendo scroll nativo antes de iniciar um arrasto.
- Os painéis de mês, ano e trimestre usam seis semanas por padrão. `options.monthFixedWeeks: false` permite quatro a seis semanas. Busque também as datas adjacentes incluídas no intervalo visível.
- Leia os [limites das views extras](extended-views.md), a [recorrência](recurrence.md) e o [suporte a ICS](ics.md) antes de prometer comportamentos não suportados. Não presuma que toda view permite arrastar ou que toda propriedade ICS é preservada na importação e exportação.

## Exemplo mínimo com estado

Este exemplo mantém os dados em memória. Substitua sua função de confirmação pela persistência da aplicação antes de utilizá-lo com dados remotos.

```tsx
import { useState } from 'react';
import {
  Calendar,
  applyEventTimeChange,
  monthView,
  weekView,
  type CalendarEvent,
  type EventChange,
} from '@jacksoncassemiro/calendara';
import '@jacksoncassemiro/calendara/styles.css';

const views = [weekView, monthView];
const initialEvents: CalendarEvent[] = [
  {
    id: 'appointment-1',
    calendarId: 'appointments',
    title: 'Agendamento',
    time: {
      allDay: false,
      start: { dateTime: '2026-10-09T09:00:00', timeZone: 'America/Sao_Paulo' },
      end: { dateTime: '2026-10-09T10:00:00', timeZone: 'America/Sao_Paulo' },
    },
  },
];

export function Schedule() {
  const [events, setEvents] = useState(initialEvents);
  function commit(change: EventChange) {
    setEvents((current) => applyEventTimeChange({ events: current, change }));
    return true;
  }
  return (
    <Calendar
      views={views}
      events={events}
      initialDate="2026-10-09"
      options={{ timeZone: 'America/Sao_Paulo' }}
      onEventDrop={commit}
      onEventResize={commit}
    />
  );
}
```

Valide o código gerado com os tipos instalados e um build de produção. Exercite navegação, edição rejeitada, limites de fuso horário e o layout em container estreito relevante para a aplicação.
