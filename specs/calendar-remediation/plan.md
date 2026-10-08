# Plano técnico

1. **Contrato público:** preservar `CalendarView` independente e lista exata; publicar callbacks React e `EventSourceContext`; manter props por atualização e documentar que data/view atuais não são controlled estritos.
2. **Ciclo de fonte:** AbortController por requisição, identificação da requisição atual, cancelamento em troca/range/destroy. Opções declarativas substituem defaults; atualização imperativa continua patch.
3. **Recursos:** reutilizar ConstraintEngine e um conjunto efetivo por recurso, evitando motores paralelos. Aplicar a mesma composição na geometria visual e avaliação da interação.
4. **Manutenção:** renomear por símbolos, preservar cenários; extrair condições apenas quando expressam regra compartilhada. Não fundir layouts semanticamente diferentes.
5. **Arrasto externo:** compartilhar geometria/validação do InteractionEngine, ponte React para fontes externas, callback de saída opcional. Não instalar outra biblioteca de drag nem trocar renderizador.
6. **Validação central:** agentes editam escopos separados; um processo executa Yarn e navegador após integração. Corrigir falhas antes de marcar tarefa concluída.

## Referências de comportamento

- [FullCalendar: external dragging](https://fullcalendar.io/docs/external-dragging) e [entre calendários](https://fullcalendar.io/docs/other-calendar-dragging).
- [Mantine Schedule: week view](https://mantine.dev/schedule/week-view/), com callbacks de drag/drop externo.
- [Spec Kit: spec-of-specs](https://github.com/github/spec-kit/blob/main/docs/concepts/spec-of-specs.md): manter escopo pequeno e rastreabilidade.

## Riscos e decisões

- Callback de drop externo não equivale a persistência concluída: estado externo continua responsabilidade da aplicação; não há remoção automática na origem.
- Recorrência não deve perder o mestre ao exportar uma ocorrência.
- Não misturar múltiplos agentes e processos de navegador no mesmo playground.
- Seleção de views controla registro/renderização; a importação interna de defaults ainda pode limitar a exclusão do bundle.
