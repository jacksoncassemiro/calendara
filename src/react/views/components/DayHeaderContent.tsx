import type { ReactNode } from 'react';
import type { DayStyleInfo, ViewRenderContext } from '../../viewTypes.js';

interface DayHeaderContentProps extends DayStyleInfo {
  /** Resolved view data and consumer callbacks. @remarks Português: Dados resolvidos da view e callbacks do consumidor. */
  context?: ViewRenderContext | undefined;
  /** Built-in header content to preserve or wrap. @remarks Português: Conteúdo padrão do cabeçalho para preservar ou envolver. */
  defaultContent: ReactNode;
  /** Whether this date is selected in compact month mode. @remarks Português: Indica se esta data está selecionada no mês compacto. */
  isSelected?: boolean;
}

/** Resolve custom heading content while preserving built-in content.
 * @remarks Português: Resolve cabeçalho personalizado preservando o conteúdo padrão.
 */
export function DayHeaderContent(props: DayHeaderContentProps) {
  const { context, defaultContent, dateISO, viewName, resourceId, isSelected } = props;
  if (!context?.renderDayHeader) return <>{defaultContent}</>;
  const todayISO = context.temporal.Instant.fromEpochMilliseconds(context.nowMs)
    .toZonedDateTimeISO(context.options.timeZone)
    .toPlainDate()
    .toString();
  return (
    <>
      {context.renderDayHeader({
        dateISO,
        viewName,
        defaultContent,
        isToday: dateISO === todayISO,
        ...(resourceId === undefined ? {} : { resourceId }),
        ...(isSelected === undefined ? {} : { isSelected }),
      })}
    </>
  );
}
