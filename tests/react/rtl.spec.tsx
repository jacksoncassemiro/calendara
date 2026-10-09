// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { Calendar } from '../../src/react/Calendar.js';
import { yearPlannerView } from '../../src/react/views/YearPlannerView.js';
import { monthView } from '../../src/react/views/MonthView.js';
import {
  InteractionEngine,
  DEFAULT_OPTIONS,
  validateCalendarOptions,
} from '../../src/core/index.js';
import { keyboardGrid } from '../../src/react/app/keyboardGrid.js';
import { usePageStickyHeaders } from '../../src/react/views/hooks/usePageStickyHeaders.js';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it('propagates explicit direction and mirrors toolbar arrows without changing navigation semantics', async () => {
  const views = [monthView];
  const { container, rerender } = render(
    <Calendar views={views} initialDate="2026-10-09" options={{ direction: 'rtl' }} />,
  );
  await waitFor(() =>
    expect(container.querySelector('[data-mc-root]')?.getAttribute('dir')).toBe('rtl'),
  );
  expect(container.querySelector('[data-mc-nav-prev]')?.textContent).toBe('›');
  expect(container.querySelector('[data-mc-nav-next]')?.textContent).toBe('‹');
  fireEvent.click(container.querySelector('[data-mc-nav-next]')!);
  expect(container.querySelector('[data-mc-month-day="2026-11-09"]')).toBeTruthy();
  rerender(<Calendar views={views} options={{ direction: 'ltr' }} />);
  expect(container.querySelector('[data-mc-root]')?.getAttribute('dir')).toBe('ltr');
  expect(container.querySelector('[data-mc-nav-prev]')?.textContent).toBe('‹');
});

it('moves year-planner focus to the earlier day on ArrowRight in RTL', async () => {
  const { container } = render(
    <Calendar views={[yearPlannerView]} initialDate="2026-10-09" options={{ direction: 'rtl' }} />,
  );
  await waitFor(() =>
    expect(container.querySelector('[data-mc-year-planner-date="2026-10-09"] button')).toBeTruthy(),
  );
  const day = container.querySelector<HTMLButtonElement>(
    '[data-mc-year-planner-date="2026-10-09"] button',
  )!;
  day.focus();
  fireEvent.keyDown(day, { key: 'ArrowRight' });
  expect(
    document.activeElement
      ?.closest('[data-mc-year-planner-date]')
      ?.getAttribute('data-mc-year-planner-date'),
  ).toBe('2026-10-08');
  fireEvent.keyDown(document.activeElement!, { key: 'ArrowLeft' });
  expect(
    document.activeElement
      ?.closest('[data-mc-year-planner-date]')
      ?.getAttribute('data-mc-year-planner-date'),
  ).toBe('2026-10-09');
});

it('maps RTL horizontal pointer positions to increasing time from the right edge', () => {
  const root = document.createElement('div');
  root.dir = 'rtl';
  root.innerHTML =
    '<div data-mc-slot="x" data-mc-slot-date="2026-10-09" data-mc-slot-resource="room"></div>';
  document.body.append(root);
  const surface = root.firstElementChild as HTMLElement;
  surface.getBoundingClientRect = () =>
    ({ left: 100, right: 700, top: 0, bottom: 100, width: 600, height: 100 }) as DOMRect;
  const engine = new InteractionEngine({
    getGridBounds: () => ({ startMin: 360, endMin: 960 }),
    getSlotMinutes: () => 30,
    getMinDurationMin: () => 15,
    resolveOccurrence: () => null,
    evaluate: () => ({ valid: true }),
    callbacks: {
      onDraftChange: vi.fn(),
      commitMove: vi.fn(),
      commitResize: vi.fn(),
      commitSelect: vi.fn(),
      clickEvent: vi.fn(),
      clickEmpty: vi.fn(),
      blocked: vi.fn(),
    },
  });
  engine.attach(root);
  expect(engine.locatePointerSlot(640, 50)).toEqual({
    dateISO: '2026-10-09',
    minuteOfDay: 420,
    resourceId: 'room',
  });
  expect(engine.locatePointerSlot(160, 50)?.minuteOfDay).toBe(900);
  engine.detach();
  root.remove();
});

it('moves horizontal slot keyboard focus in RTL reading order and rejects invalid direction', () => {
  const root = document.createElement('div');
  root.dir = 'rtl';
  root.innerHTML =
    '<div data-mc-slot="x"><button data-mc-cell-date="2026-10-09" data-mc-cell-start="360" data-mc-cell-end="390"></button><button data-mc-cell-date="2026-10-09" data-mc-cell-start="390" data-mc-cell-end="420"></button></div>';
  document.body.append(root);
  const cells = root.querySelectorAll('button');
  root.addEventListener('keydown', (event) => keyboardGrid({ event, root, activate: vi.fn() }));
  cells[0]!.focus();
  act(() => fireEvent.keyDown(cells[0]!, { key: 'ArrowLeft' }));
  expect(document.activeElement).toBe(cells[1]);
  fireEvent.keyDown(cells[1]!, { key: 'ArrowRight' });
  expect(document.activeElement).toBe(cells[0]);
  root.remove();
  expect(() => validateCalendarOptions({ ...DEFAULT_OPTIONS, direction: 'auto' as 'rtl' })).toThrow(
    'direction',
  );
});

it('preserves negative RTL scroll synchronization and clips pinned content using physical rectangles', () => {
  const frames: FrameRequestCallback[] = [];
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    frames.push(callback);
    return frames.length;
  });
  function StickyExample() {
    const ref = usePageStickyHeaders('en');
    return (
      <div dir="rtl">
        <div ref={ref} style={{ direction: 'rtl' }}>
          <div className="mc-header-row">
            <div className="mc-gutter-corner" />
          </div>
          <div className="mc-allday-row">
            <div />
          </div>
        </div>
      </div>
    );
  }
  const { container } = render(<StickyExample />);
  const scroller = container.querySelector<HTMLElement>('.mc-top-scrollbar')!;
  const header = scroller.querySelector<HTMLElement>('.mc-header-row')!;
  const allDay = scroller.querySelector<HTMLElement>('.mc-allday-row')!;
  Object.defineProperties(scroller, {
    clientWidth: { value: 400 },
    scrollWidth: { value: 900 },
    clientHeight: { value: 600 },
    scrollHeight: { value: 600 },
  });
  scroller.scrollLeft = -120;
  scroller.getBoundingClientRect = () =>
    ({ left: 100, right: 500, top: -20, bottom: 580, width: 400, height: 600 }) as DOMRect;
  header.getBoundingClientRect = () =>
    ({ left: -280, right: 620, top: -20, bottom: 20, width: 900, height: 40 }) as DOMRect;
  allDay.getBoundingClientRect = () => ({ height: 30 }) as DOMRect;
  act(() => {
    frames.splice(0).forEach((callback) => callback(0));
  });
  const scrollbar = container.querySelector<HTMLElement>('.mc-header-scrollbar')!;
  expect(scrollbar.dir).toBe('rtl');
  expect(scrollbar.scrollLeft).toBe(-120);
  expect(container.querySelector<HTMLElement>('.mc-page-sticky-content')?.style.transform).toBe(
    'translateX(-380px)',
  );
  expect(container.querySelector<HTMLElement>('.mc-page-sticky-corner')?.style.transform).toBe(
    'translateX(-120px)',
  );
  expect(allDay.style.clipPath).toBe('inset(0 120px 0 380px)');
  fireEvent.scroll(scrollbar);
  scrollbar.scrollLeft = -200;
  fireEvent.scroll(scrollbar);
  expect(scroller.scrollLeft).toBe(-200);
});
