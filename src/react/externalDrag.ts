import { useCallback, useEffect, useRef, type PointerEventHandler } from 'react';
import type {
  CalendarEvent,
  EventChange,
  EventOccurrence,
  OutsideDropTarget,
} from '../core/index.js';

/** Receive the proposed event for insertion and persistence.
 * @remarks Português: A aplicação insere e salva change.event; a origem não é removida
 * automaticamente.
 */
export type ExternalEventDropHandler = (change: EventChange) => void | Promise<void>;

/** Occurrence released outside, without automatic deletion.
 * @remarks Português: Ocorrência solta fora, sem excluir automaticamente evento ou série.
 */
export interface EventDropOutsideInfo extends OutsideDropTarget {
  /** Original occurrence, including its recurring-series identity.
   * @remarks Português: Preserva a identidade da ocorrência e da série para o fluxo do consumidor.
   */
  occurrence: EventOccurrence;
}

/** Internal bridge for external pointer transfers.
 * @remarks Português: Ponte interna para transferências por ponteiro.
 * @internal
 */
export interface ExternalDragReceiver {
  /** Check whether a pointer is over a receiving surface.
   * @remarks Português: Verifica se o ponto está sobre uma superfície receptora.
   */
  canReceive(clientX: number, clientY: number): boolean;
  /** Start a transfer only when the receiver accepts the candidate.
   * @remarks Português: Retorna true quando o receptor inicia o gesto para esse candidato.
   */
  start(event: CalendarEvent, pointer: PointerEvent): boolean;
  /** Cancel the active transfer and its preview.
   * @remarks Português: Cancela a transferência ativa e limpa sua prévia.
   */
  cancel(): void;
}

const receivers = new Map<HTMLElement, ExternalDragReceiver>();

/** Register a receiver and return its cleanup function.
 * @remarks Português: Registra o receptor; a função retornada remove o registro.
 * @internal
 */
export function registerExternalDragReceiver(
  root: HTMLElement,
  receiver: ExternalDragReceiver,
): () => void {
  receivers.set(root, receiver);
  return () => {
    receivers.delete(root);
  };
}

/** Start typed transfer; ignore readonly events and reject recurring series.
 * @remarks Português: Use candidato sem recorrência e ID próprio; o receptor valida, sem salvar a
 * origem.
 * @returns Cancellation and listener cleanup.
 */
export function beginExternalEventDrag(event: CalendarEvent, pointer: PointerEvent): () => void {
  if (pointer.button !== 0 || event.editable === false) return () => {};
  if (event.recurrence) {
    throw new RangeError(
      '[calendara] arrasto externo requer um evento sem recorrência; escolha uma ocorrência antes',
    );
  }
  const source = pointer.currentTarget instanceof Element ? pointer.currentTarget : pointer.target;
  if (!(source instanceof Element)) return () => {};
  pointer.preventDefault();
  const documentRef = source.ownerDocument;
  let activeReceiver: ExternalDragReceiver | undefined;
  let ended = false;
  const removeListeners = (): void => {
    documentRef.removeEventListener('pointermove', move);
    documentRef.removeEventListener('pointerup', finish);
    documentRef.removeEventListener('pointercancel', cancelPointer);
    documentRef.removeEventListener('keydown', keydown);
  };
  const cancel = (): void => {
    if (ended) return;
    ended = true;
    removeListeners();
    activeReceiver?.cancel();
  };
  const finish = (released: PointerEvent): void => {
    if (released.pointerId !== pointer.pointerId) return;
    ended = true;
    removeListeners();
  };
  const cancelPointer = (cancelled: PointerEvent): void => {
    if (cancelled.pointerId === pointer.pointerId) cancel();
  };
  const keydown = (keyboard: KeyboardEvent): void => {
    if (keyboard.key === 'Escape') cancel();
  };
  const move = (moved: PointerEvent): void => {
    if (moved.pointerId !== pointer.pointerId || activeReceiver) return;
    if (Math.hypot(moved.clientX - pointer.clientX, moved.clientY - pointer.clientY) < 5) return;
    for (const [root, receiver] of receivers) {
      if (root.ownerDocument !== documentRef || !root.isConnected) continue;
      if (!receiver.canReceive(moved.clientX, moved.clientY)) continue;
      if (receiver.start(event, moved)) {
        activeReceiver = receiver;
        break;
      }
    }
  };
  documentRef.addEventListener('pointermove', move);
  documentRef.addEventListener('pointerup', finish);
  documentRef.addEventListener('pointercancel', cancelPointer);
  documentRef.addEventListener('keydown', keydown);
  return cancel;
}

/** Bind external cards; readonly events are ignored and recurring series rejected.
 * @remarks Português: Aplique onPointerDown; toque usa touchAction: none. Ignora somente
 * leitura e rejeita séries. Cancela ao desmontar, sem salvar ou remover a origem.
 */
export function useCalendarDraggable(event: CalendarEvent): {
  onPointerDown: PointerEventHandler<HTMLElement>;
} {
  const cancelRef = useRef<(() => void) | null>(null);
  useEffect(() => () => cancelRef.current?.(), []);
  const onPointerDown = useCallback<PointerEventHandler<HTMLElement>>(
    (pointer) => {
      cancelRef.current?.();
      cancelRef.current = beginExternalEventDrag(event, pointer.nativeEvent);
    },
    [event],
  );
  return { onPointerDown };
}
