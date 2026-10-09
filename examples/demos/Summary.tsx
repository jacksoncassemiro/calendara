import type { ViewRenderContext } from '@jacksoncassemiro/calendara';

export function Summary(context: ViewRenderContext) {
  return (
    <section className="focused-summary">
      <h2>{context.referenceDateISO}</h2>
      <ul>
        {context.occurrences.map((occurrence) => (
          <li key={`${occurrence.masterId}-${occurrence.originalStart}`}>
            <button onClick={() => context.onEventClick?.(occurrence)}>
              {occurrence.event.title}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
