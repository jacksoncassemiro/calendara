async (page) => {
  await page.goto('http://127.0.0.1:5180/examples/react.html');
  await page.evaluate(async () => {
    const calendar = await import('/src/index.ts');
    const host = document.createElement('div');
    document.body.replaceChildren(host);
    const resources = Array.from({ length: 500 }, (_, index) => ({
      id: `room-${index}`,
      title: `Room ${index}`,
      capacity: 1,
      bufferAfter: 30,
    }));
    const event = {
      id: 'last',
      calendarId: 'c',
      title: 'Last resource appointment',
      resourceIds: ['room-499'],
      time: {
        allDay: false,
        start: { dateTime: '2026-10-07T09:00', timeZone: 'UTC' },
        end: { dateTime: '2026-10-07T10:00', timeZone: 'UTC' },
      },
    };
    const app = new calendar.CalendarApp({
      temporal: await calendar.ensureTemporal(),
      date: '2026-10-07',
      view: 'virtual',
      views: [
        calendar.createResourceTimelineView({
          name: 'virtual',
          duration: 'day',
          virtualization: { height: 320, overscan: 2 },
        }),
      ],
      options: { timeZone: 'UTC', startHour: 8, endHour: 18 },
      resources,
      events: [event],
    });
    app.mount(host);
    await app.ready();
    window.virtualApp = app;
    window.virtualCandidate = {
      ...event,
      id: 'candidate',
      time: {
        ...event.time,
        start: { dateTime: '2026-10-07T10:15', timeZone: 'UTC' },
        end: { dateTime: '2026-10-07T10:45', timeZone: 'UTC' },
      },
    };
  });
  const rows = page.locator('[data-mc-period-resource]');
  if ((await rows.count()) > 20) throw new Error('Virtual resource DOM is unbounded');
  const before = await page.evaluate(() => {
    const scroller = document.querySelector('[data-mc-hscroll]');
    return {
      height: scroller.scrollHeight,
      validity: window.virtualApp.evaluateEvent(window.virtualCandidate).valid,
    };
  });
  if (before.height < 20000 || before.validity)
    throw new Error('Virtual height or hidden resource occupancy is incorrect');
  await page.evaluate(() => {
    const scroller = document.querySelector('[data-mc-hscroll]');
    scroller.scrollTop = scroller.scrollHeight;
  });
  await page.getByRole('button', { name: 'Room 499', exact: true }).waitFor();
  await page.locator('[data-mc-event^="last@"]').waitFor();
  await page.getByRole('button', { name: 'Room 499', exact: true }).focus();
  await page.keyboard.press('ArrowUp');
  await page.waitForFunction(
    () => document.activeElement?.getAttribute('aria-label') === 'Room 498',
  );
  if ((await rows.count()) > 20) throw new Error('Focus pin grew resource DOM');
  const eventBounds = await page.locator('[data-mc-event^="last@"]').boundingBox();
  await page.mouse.move(
    eventBounds.x + eventBounds.width / 2,
    eventBounds.y + eventBounds.height / 2,
  );
  await page.mouse.down();
  await page.evaluate(() => {
    document.querySelector('[data-mc-hscroll]').scrollTop = 0;
  });
  await page.waitForTimeout(100);
  if (!(await page.locator('[data-mc-event^="last@"]').count()))
    throw new Error('Pointer source unmounted during virtual scroll');
  await page.keyboard.press('Escape');
  await page.mouse.up();
  const printed = await page.evaluate(() => {
    const append = document.body.append.bind(document.body);
    let markup = '';
    document.body.append = function (...nodes) {
      const frame = nodes.find((node) => node instanceof HTMLIFrameElement);
      if (frame) markup = frame.srcdoc;
      else append(...nodes);
    };
    try {
      window.virtualApp.print();
    } finally {
      document.body.append = append;
    }
    return markup;
  });
  if (!printed.includes('Last resource appointment'))
    throw new Error('Print omitted offscreen event');
  await page.screenshot({ path: 'output/layout-review/virtual-resources.png' });
  await page.evaluate(async () => {
    window.virtualApp.destroy();
    const calendar = await import('/src/index.ts');
    const host = document.createElement('div');
    document.body.replaceChildren(host);
    const app = new calendar.CalendarApp({
      temporal: await calendar.ensureTemporal(),
      date: '2026-10-07',
      view: 'tree',
      views: [
        calendar.createResourceTimelineView({
          name: 'tree',
          duration: 'day',
          hierarchy: true,
          collapsedResourceIds: ['clinic'],
        }),
      ],
      options: { timeZone: 'UTC', startHour: 8, endHour: 18 },
      resources: [
        { id: 'clinic', title: 'Clinic' },
        { id: 'room', title: 'Room', parentId: 'clinic' },
        { id: 'device', title: 'Device', parentId: 'room' },
      ],
      events: [],
    });
    app.mount(host);
    await app.ready();
    window.virtualApp = app;
  });
  if ((await rows.count()) !== 1) throw new Error('Initial tree collapse failed');
  await page.getByRole('button', { name: 'Clinic', exact: true }).click();
  if ((await rows.count()) !== 3) throw new Error('Nested tree expansion failed');
  await page.getByRole('button', { name: 'Room', exact: true }).click();
  if ((await rows.count()) !== 2) throw new Error('Nested tree collapse failed');
  return {
    resourceCount: 500,
    mountedLimit: 20,
    fullHeight: before.height,
    offscreenCapacity: 'preserved',
    tree: 'nested expand/collapse',
  };
};
