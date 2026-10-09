# Histórico de eventos do consumidor

`useCalendarHistory` oferece desfazer/refazer limitado para um array de eventos controlado pelo consumidor. Conecte `events` ao `Calendar` e envie cada edição aceita por `commit`. O hook não se conecta ao store do calendário, não observa edições automaticamente e não desfaz transações no servidor.

```tsx
import { Calendar, monthView, useCalendarHistory } from '@jacksoncassemiro/calendara';
import type { CalendarEvent } from '@jacksoncassemiro/calendara';

const views = [monthView];

function Schedule({ initialEvents }: { initialEvents: CalendarEvent[] }) {
  const history = useCalendarHistory({
    initialEvents,
    limit: 50,
    persist: async (events) => {
      const response = await fetch('/api/schedule', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(events),
      });
      if (!response.ok) throw new Error('Não foi possível salvar a agenda');
    },
  });

  const undo = async () => {
    try {
      await history.undo();
    } catch (error) {
      // Apresente o erro de persistência na interface da aplicação.
      console.error(error);
    }
  };

  return <>
    <button disabled={!history.canUndo} onClick={undo}>Desfazer</button>
    <button disabled={!history.canRedo} onClick={() => {
      void history.redo().catch(console.error);
    }}>Refazer</button>
    <Calendar views={views} events={history.events} />
  </>;
}
```

No editor ou handler de arraste, calcule o próximo array completo e execute `await history.commit(nextEvents)`. Apenas o sucesso do callback de persistência altera o array exibido e o histórico. Se o callback rejeitar, a Promise da ação rejeita e preserva os eventos atuais e as duas direções do histórico; trate o erro na aplicação. A persistência recebe uma cópia independente e o hook usa o callback mais recente. Omitir `persist` habilita histórico local.

`commit`, `undo` e `redo` retornam `true` quando aplicados e `false` quando ocupados, indisponíveis, desmontados ou substituídos por uma recarga. `pending` desabilita os dois indicadores de disponibilidade, e uma trava síncrona impede requisições sobrepostas mesmo antes de o React renderizar novamente. Uma edição após desfazer descarta refazer. `limit` tem padrão de 50 snapshots retidos por direção e deve ser um inteiro não negativo; zero desabilita o histórico.

`initialEvents` é lido apenas na inicialização. Após carregar dados externos, chame `history.replaceEvents(loadedEvents)` para substituir o array atual e limpar as duas pilhas sem persistir. Uma ação em andamento não sobrescreve essa substituição, mas `pending` continua true até a persistência terminar. O hook não cancela uma escrita já enviada ao servidor; coordene recargas, autorização, verificações de versão e escritas concorrentes no backend do consumidor.

Snapshots são copiados independentemente com `structuredClone`, preservando eventos completos, incluindo fins exclusivos, overrides de recorrência, IDs de recursos e metadados aninhados. Forneça `cloneSnapshot` quando os metadados incluírem funções ou outros valores que não podem ser copiados por structured clone. Esse callback deve criar cópias independentes de todos os valores mutáveis. Trate `events` retornado como somente leitura e edite por `commit`; mutações diretas não são registradas. O histórico dura apenas a sessão: não é armazenamento persistente nem protocolo de desfazer colaborativo ou no servidor.
