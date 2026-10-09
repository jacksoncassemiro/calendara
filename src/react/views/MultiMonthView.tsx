import { createElement } from 'react';
import type { TemporalLike } from '../../core/index.js';
import type { CalendarView, ViewRenderContext } from '../viewTypes.js';
import { monthView } from './MonthView.js';
import { formatDate } from './formatting/timeLabels.js';

type PlainDate = InstanceType<TemporalLike['PlainDate']>;

/** Multi-month display configuration.
 * @remarks Português: Configuração da exibição de vários meses
 */
export interface MultiMonthViewOptions {
  /** Consecutive months, 1–24; default 12.
   * @remarks Português: Meses consecutivos, 1–24; padrão 12
   */
  months?: number;
  /** Unique view identifier; defaults to multi-month.
   * @remarks Português: Identificador único da view; padrão multi-month
   */
  name?: string;
  /** Selector label; defaults to Multiple months.
   * @remarks Português: Rótulo do seletor; padrão Multiple months
   */
  label?: string;
  /** Align the first month; default month.
   * @remarks Português: Alinhamento do primeiro mês; padrão month
   */
  alignment?: 'month' | 'quarter' | 'year';
}

/** Display independent month panels sharing one controller and event source.
 * @remarks Português: Exibe painéis mensais compartilhando controlador e fonte de eventos
 */
export function createMultiMonthView({
  months = 12,
  name = 'multi-month',
  label = 'Multiple months',
  alignment = 'month',
}: MultiMonthViewOptions = {}): CalendarView {
  if (!Number.isInteger(months) || months < 1 || months > 24)
    throw new RangeError('months must be an integer from 1 to 24');
  if (!['month', 'quarter', 'year'].includes(alignment))
    throw new RangeError('Unsupported month alignment');
  const firstMonth = (date: PlainDate): PlainDate =>
    date.with({
      day: 1,
      month:
        alignment === 'year'
          ? 1
          : alignment === 'quarter'
            ? Math.floor((date.month - 1) / 3) * 3 + 1
            : date.month,
    });
  const panelMonths = (date: PlainDate): PlainDate[] =>
    Array.from({ length: months }, (_, index) => firstMonth(date).add({ months: index }));
  return {
    name,
    label,
    getRange(date, context) {
      const panels = panelMonths(date);
      const startDate = monthView.getRange(panels[0]!, context).startDate;
      const endDate = monthView.getRange(panels.at(-1)!, context).endDate;
      return {
        startDate,
        endDate,
        days: context.dateUtils.eachDayOfRange({ start: startDate, end: endDate.add({ days: 1 }) }),
      };
    },
    navigate({ direction, date }) {
      const alignmentMonths = alignment === 'year' ? 12 : alignment === 'quarter' ? 3 : 1;
      const navigationMonths = Math.ceil(months / alignmentMonths) * alignmentMonths;
      return firstMonth(date).add({
        months: direction === 'next' ? navigationMonths : -navigationMonths,
      });
    },
    getTitle(range, context) {
      const first = range.days.find((date) => date.day === 1) ?? range.startDate;
      const last = first.add({ months: months - 1 });
      const title = (date: PlainDate) =>
        formatDate({
          date,
          locale: context.options.locale,
          options: { month: 'long', year: 'numeric' },
        });
      return months === 1 ? title(first) : `${title(first)} – ${title(last)}`;
    },
    render(context) {
      return createElement(MultiMonthPanels, {
        context,
        panels: panelMonths(
          context.temporal.PlainDate.from(
            context.referenceDateISO ??
              (
                context.range.days[Math.floor(context.range.days.length / 2)] ??
                context.range.startDate
              ).toString(),
          ),
        ),
      });
    },
  };
}

function MultiMonthPanels({
  context,
  panels,
}: {
  /** Shared controller data and consumer callbacks.
   * @remarks Português: Dados compartilhados do controlador e callbacks do consumidor
   */
  context: ViewRenderContext;
  /** First date of each visible month.
   * @remarks Português: Primeira data de cada mês visível
   */
  panels: PlainDate[];
}) {
  return (
    <div className="mc-multi-month" data-mc-multi-month>
      {panels.map((month) => {
        const range = monthView.getRange(month, context);
        return (
          <section
            className="mc-multi-month-panel"
            key={month.toString()}
            data-mc-month-panel={month.toString().slice(0, 7)}
            aria-label={formatDate({
              date: month,
              locale: context.options.locale,
              options: { month: 'long', year: 'numeric' },
            })}
          >
            <h2>
              {formatDate({
                date: month,
                locale: context.options.locale,
                options: { month: 'long', year: 'numeric' },
              })}
            </h2>
            {monthView.render({ ...context, range, referenceDateISO: month.toString() })}
          </section>
        );
      })}
    </div>
  );
}

/** Calendar year displayed as month panels.
 * @remarks Português: Ano civil exibido em painéis mensais
 */
export const yearView = createMultiMonthView({
  months: 12,
  name: 'year',
  label: 'Year',
  alignment: 'year',
});
/** Calendar quarter displayed as three month panels.
 * @remarks Português: Trimestre civil exibido em três painéis mensais
 */
export const quarterView = createMultiMonthView({
  months: 3,
  name: 'quarter',
  label: 'Quarter',
  alignment: 'quarter',
});
