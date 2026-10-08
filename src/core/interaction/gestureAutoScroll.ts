interface PointerPosition {
  clientX: number;
  clientY: number;
}

const EDGE_SIZE_PX = 36;
const MAX_SPEED_PX_PER_SECOND = 600;

/** Scroll existing containers during a gesture; never create a new scroll area. */
export class GestureAutoScroll {
  private frame: number | null = null;
  private pointer: PointerPosition | null = null;
  private previousTime = 0;
  private scrolling = false;

  constructor(
    private readonly root: HTMLElement,
    private readonly onScroll: () => void,
  ) {}

  update(pointer: PointerPosition): void {
    this.pointer = pointer;
    const windowRef = this.root.ownerDocument.defaultView;
    if (this.frame === null && !this.scrolling && windowRef?.requestAnimationFrame) {
      this.previousTime = 0;
      this.frame = windowRef.requestAnimationFrame(this.tick);
    }
  }

  stop(): void {
    if (this.frame !== null) this.root.ownerDocument.defaultView?.cancelAnimationFrame(this.frame);
    this.frame = null;
    this.pointer = null;
    this.previousTime = 0;
  }

  private readonly tick = (time: number): void => {
    this.frame = null;
    const windowRef = this.root.ownerDocument.defaultView;
    const pointer = this.pointer;
    if (!windowRef || !pointer || !this.root.isConnected) return;
    const elapsedSeconds = this.previousTime
      ? Math.min((time - this.previousTime) / 1000, 0.05)
      : 1 / 60;
    this.previousTime = time;
    const rootRect = this.root.getBoundingClientRect();
    if (
      pointer.clientX < rootRect.left ||
      pointer.clientX > rootRect.right ||
      pointer.clientY < Math.max(0, rootRect.top) ||
      pointer.clientY > Math.min(windowRef.innerHeight, rootRect.bottom)
    )
      return;

    const hit = this.root.ownerDocument.elementFromPoint(pointer.clientX, pointer.clientY);
    let node: HTMLElement | null =
      hit instanceof HTMLElement && this.root.contains(hit) ? hit : this.root;
    let movedX = false;
    let movedY = false;
    while (node) {
      const style = windowRef.getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      if (!movedX && /auto|scroll/.test(style.overflowX) && node.scrollWidth > node.clientWidth) {
        const before = node.scrollLeft;
        node.scrollLeft +=
          edgeSpeed(
            pointer.clientX,
            Math.max(0, rect.left),
            Math.min(windowRef.innerWidth, rect.right),
          ) * elapsedSeconds;
        movedX = node.scrollLeft !== before;
      }
      if (!movedY && /auto|scroll/.test(style.overflowY) && node.scrollHeight > node.clientHeight) {
        const before = node.scrollTop;
        node.scrollTop +=
          edgeSpeed(
            pointer.clientY,
            Math.max(0, rect.top),
            Math.min(windowRef.innerHeight, rect.bottom),
          ) * elapsedSeconds;
        movedY = node.scrollTop !== before;
      }
      node = node.parentElement;
    }
    const page = this.root.ownerDocument.scrollingElement;
    if (!movedY && page && page.scrollHeight > windowRef.innerHeight) {
      const before = page.scrollTop;
      page.scrollTop += edgeSpeed(pointer.clientY, 0, windowRef.innerHeight) * elapsedSeconds;
      movedY = page.scrollTop !== before;
    }
    if (movedX || movedY) {
      this.scrolling = true;
      try {
        this.onScroll();
      } finally {
        this.scrolling = false;
      }
      if (this.pointer) this.frame = windowRef.requestAnimationFrame(this.tick);
    }
  };
}

function edgeSpeed(position: number, start: number, end: number): number {
  const edge = Math.min(EDGE_SIZE_PX, (end - start) / 2);
  if (edge <= 0) return 0;
  if (position < start + edge)
    return -MAX_SPEED_PX_PER_SECOND * Math.max(0, 1 - (position - start) / edge);
  if (position > end - edge)
    return MAX_SPEED_PX_PER_SECOND * Math.max(0, 1 - (end - position) / edge);
  return 0;
}
