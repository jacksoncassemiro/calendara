/** Delegated keyboard focus with shared slot validation. @remarks Português: Foco por teclado com a mesma validação dos slots. */
interface KeyboardSlotActivation {
  /** Slot date, YYYY-MM-DD. @remarks Português: Data do slot, YYYY-MM-DD. */
  dateISO: string;
  /** Inclusive start in minutes since midnight. @remarks Português: Início inclusivo em minutos desde meia-noite. */
  startMin: number;
  /** Exclusive end in minutes since midnight. @remarks Português: Fim exclusivo em minutos desde meia-noite. */
  endMin: number;
  /** Associated resource, when present. @remarks Português: Recurso associado, quando presente. */
  resourceId?: string | undefined;
}

interface KeyboardGridInput {
  /** Native keyboard event. @remarks Português: Evento nativo do teclado. */
  event: KeyboardEvent;
  /** Calendar root containing focusable slots. @remarks Português: Raiz do calendário com slots focáveis. */
  root: HTMLElement;
  /** Activate a slot, using minutes since midnight. @remarks Português: Ativa um slot em minutos desde meia-noite. */
  activate: (slot: KeyboardSlotActivation) => void;
}

/** Navigate or activate slots using the keyboard. @remarks Português: Navega ou ativa slots pelo teclado. */
export function keyboardGrid({ event, root, activate }: KeyboardGridInput): void {
  const target =
    event.target instanceof HTMLElement
      ? event.target.closest<HTMLElement>('[data-mc-cell-start]')
      : null;
  if (!target || !root.contains(target)) return;
  const cells = [...root.querySelectorAll<HTMLElement>('[data-mc-cell-start]')];
  const column = target.parentElement;
  const peers = cells.filter((cell) => cell.parentElement === column);
  const start = Number(target.dataset.mcCellStart),
    end = Number(target.dataset.mcCellEnd);
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    activate({
      dateISO: target.dataset.mcCellDate!,
      startMin: start,
      endMin: end,
      resourceId: target.dataset.mcCellResource,
    });
    return;
  }
  let next: HTMLElement | undefined;
  const index = peers.indexOf(target);
  const horizontal = column?.dataset.mcSlot === 'x';
  const direction = getComputedStyle(root).direction === 'rtl' ? -1 : 1;
  const previous = horizontal ? (direction === 1 ? 'ArrowLeft' : 'ArrowRight') : 'ArrowUp';
  const following = horizontal ? (direction === 1 ? 'ArrowRight' : 'ArrowLeft') : 'ArrowDown';
  if (event.key === previous) next = peers[Math.max(0, index - 1)];
  if (event.key === following) next = peers[Math.min(peers.length - 1, index + 1)];
  if (event.key === 'Home') next = (event.ctrlKey ? cells : peers)[0];
  if (event.key === 'End') next = (event.ctrlKey ? cells : peers).at(-1);
  if (
    horizontal
      ? event.key === 'ArrowUp' || event.key === 'ArrowDown'
      : event.key === 'ArrowLeft' || event.key === 'ArrowRight'
  ) {
    const columns = [...new Set(cells.map((cell) => cell.parentElement))];
    const delta = horizontal
      ? event.key === 'ArrowDown'
        ? 1
        : -1
      : (event.key === 'ArrowRight' ? 1 : -1) * direction;
    const destination = columns[columns.indexOf(column) + delta];
    next = cells.find(
      (cell) => cell.parentElement === destination && Number(cell.dataset.mcCellStart) === start,
    );
  }
  if (next) {
    event.preventDefault();
    for (const cell of cells) cell.tabIndex = -1;
    next.tabIndex = 0;
    next.focus();
    next.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }
}
