// @vitest-environment jsdom
/** @jsxImportSource react */
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useCompactCalendar } from '../../src/react/useCompactCalendar.js';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('responds to container width and disconnects on unmount', () => {
  let notify: ResizeObserverCallback;
  const disconnect = vi.fn();
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: ResizeObserverCallback) { notify = callback; }
    observe() {}
    disconnect = disconnect;
  });
  function Example() {
    const { compact, containerRef } = useCompactCalendar();
    return <div ref={containerRef}>{compact ? 'compact' : 'wide'}</div>;
  }
  const view = render(<Example />);
  act(() => notify!([{ contentRect: { width: 375 } } as ResizeObserverEntry], {} as ResizeObserver));
  expect(screen.getByText('compact')).toBeTruthy();
  act(() => notify!([{ contentRect: { width: 1000 } } as ResizeObserverEntry], {} as ResizeObserver));
  expect(screen.getByText('wide')).toBeTruthy();
  view.unmount();
  expect(disconnect).toHaveBeenCalledOnce();
});
