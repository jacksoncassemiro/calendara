async (page) => {
  await page.mouse.up();
  await page.reload();
  await page.setViewportSize({ width: 900, height: 650 });
  await page.evaluate(async () => {
    const { CalendarApp, dayView, createTimelineView, ensureTemporal } =
      await import('/src/index.ts');
    document.querySelector('main').style.display = 'none';
    const host = document.createElement('div');
    host.id = 'auto-scroll-calendar';
    document.body.append(host);
    const resources = [{ id: 'room', title: 'Sala', capacity: false }];
    const event = {
      id: 'scroll',
      calendarId: 'agenda',
      title: 'Arraste longo',
      resourceIds: ['room'],
      time: {
        allDay: false,
        start: { dateTime: '2026-10-07T09:00:00', timeZone: 'UTC' },
        end: { dateTime: '2026-10-07T10:00:00', timeZone: 'UTC' },
      },
    };
    window.autoScrollApp = new CalendarApp({
      temporal: await ensureTemporal(),
      views: [dayView, createTimelineView()],
      initialView: 'day',
      initialDate: '2026-10-07',
      resources,
      events: [event],
      options: {
        startHour: 7,
        endHour: 21,
        pxPerMinute: 2,
        timeZone: 'UTC',
        defaultResourceCapacity: false,
      },
      onEventMove: () => {
        window.autoScrollCommits = (window.autoScrollCommits ?? 0) + 1;
      },
    });
    window.autoScrollApp.mount(host);
    await window.autoScrollApp.ready();
  });
  const root = page.locator('#auto-scroll-calendar');
  const event = root.locator('[data-mc-event^="scroll@"]');
  const box = await event.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + 25);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, 642, { steps: 8 });
  await page.waitForFunction(() => window.scrollY > 100);
  const firstScroll = await page.evaluate(() => window.scrollY);
  await page.waitForFunction((start) => window.scrollY > start + 100, firstScroll);
  const draft = await root.locator('.mc-draft').first().textContent();
  if (!draft.includes('Arraste longo')) throw new Error('Auto-scroll perdeu preview do evento');
  await page.keyboard.press('Escape');
  await page.mouse.up();
  const stoppedAt = await page.evaluate(() => window.scrollY);
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
  if ((await page.evaluate(() => window.scrollY)) !== stoppedAt)
    throw new Error('Auto-scroll continuou após cancelamento');
  if (await page.evaluate(() => window.autoScrollCommits ?? 0))
    throw new Error('Escape persistiu gesto');

  await page.evaluate(() => {
    window.autoScrollApp.changeView('timeline');
    window.scrollTo(0, 0);
  });
  const scroller = root.locator('[data-mc-hscroll]');
  const timelineBox = await event.boundingBox();
  await page.mouse.move(timelineBox.x + 15, timelineBox.y + 15);
  await page.mouse.down();
  const scrollBox = await scroller.boundingBox();
  await page.mouse.move(Math.min(897, scrollBox.x + scrollBox.width - 5), timelineBox.y + 15, {
    steps: 8,
  });
  await page.waitForFunction(
    () => document.querySelector('#auto-scroll-calendar [data-mc-hscroll]').scrollLeft > 100,
  );
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await page.evaluate(() => {
    window.autoScrollApp.setOptions({ autoScroll: false });
    document.querySelector('#auto-scroll-calendar [data-mc-hscroll]').scrollLeft = 0;
  });
  const disabledBox = await event.boundingBox();
  await page.mouse.move(disabledBox.x + 15, disabledBox.y + 15);
  await page.mouse.down();
  await page.mouse.move(Math.min(897, scrollBox.x + scrollBox.width - 5), disabledBox.y + 15, {
    steps: 8,
  });
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 150)));
  if ((await scroller.evaluate((element) => element.scrollLeft)) !== 0)
    throw new Error('autoScroll:false ignorado');
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await page.screenshot({ path: 'output/layout-review/auto-scroll-timeline.png', fullPage: true });
  return [
    'Página rola no gesto sem scroll vertical extra',
    'Timeline rola lateralmente',
    'Escape cancela sem persistir',
    'autoScroll:false desativa',
  ];
};
