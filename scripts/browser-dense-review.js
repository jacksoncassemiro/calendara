async (page) => {
  const runtimeErrors = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  await page.setViewportSize({ width: 375, height: 900 });
  await page.reload();
  await page.locator('[data-mc-root]').waitFor();
  await page.evaluate(async () => {
    const {
      BUILTIN_VIEWS,
      CalendarApp,
      ensureTemporal,
      createResourceDayView,
      createTimelineView,
    } = await import('/src/index.ts');
    document.querySelector('main').style.display = 'none';
    const host = document.createElement('div');
    host.id = 'dense-fixture';
    document.body.append(host);
    const events = Array.from({ length: 32 }, (_, index) => ({
      id: `dense-${index}`,
      calendarId: 'c',
      title: `Reserva ${index}`,
      color: '#2563eb',
      resourceIds: ['room'],
      time: {
        allDay: false,
        start: { dateTime: '2026-10-07T09:00:00', timeZone: 'UTC' },
        end: { dateTime: '2026-10-07T10:00:00', timeZone: 'UTC' },
      },
    }));
    for (let index = 0; index < 6; index++)
      events.push({
        id: `short-${index}`,
        calendarId: 'c',
        title: `Curto ${index}`,
        resourceIds: ['room'],
        time: {
          allDay: false,
          start: {
            dateTime: `2026-10-07T11:${String(index * 5).padStart(2, '0')}:00`,
            timeZone: 'UTC',
          },
          end: {
            dateTime: `2026-10-07T11:${String(index * 5 + 5).padStart(2, '0')}:00`,
            timeZone: 'UTC',
          },
        },
      });
    const resources = [{ id: 'room', title: 'Sala com eventos concorrentes' }];
    const app = new CalendarApp({
      temporal: await ensureTemporal(),
      date: '2026-10-07',
      view: 'day',
      events,
      resources,
      views: [...BUILTIN_VIEWS, createResourceDayView(resources), createTimelineView(resources)],
      options: { timeZone: 'UTC', startHour: 8, endHour: 12 },
      onEventClick: () => {},
    });
    app.mount(host);
    await app.ready();
    window.denseApp = app;
  });
  const results = [];
  for (const width of [320, 375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const view of ['day', 'resources', 'timeline']) {
      await page.evaluate((view) => window.denseApp.changeView(view), view);
      await page.screenshot({
        path: `output/layout-review/dense-after-${width}-${view}.png`,
        fullPage: true,
      });
      results.push(
        await page.evaluate((view) => {
          const root = document.querySelector('#dense-fixture'),
            nodes = [...root.querySelectorAll('[data-mc-event]')];
          const overlaps = [];
          for (let i = 0; i < nodes.length; i++)
            for (let j = i + 1; j < nodes.length; j++) {
              if (nodes[i].parentElement !== nodes[j].parentElement) continue;
              const a = nodes[i].getBoundingClientRect(),
                b = nodes[j].getBoundingClientRect();
              const width = Math.min(a.right, b.right) - Math.max(a.left, b.left),
                height = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
              if (width > 0.5 && height > 0.5)
                overlaps.push([nodes[i].dataset.mcEvent, nodes[j].dataset.mcEvent, width, height]);
            }
          const axis = root.querySelector('.mc-timeline-axis')?.getBoundingClientRect();
          const firstTrack = root.querySelector('.mc-timeline-track')?.getBoundingClientRect();
          return {
            view,
            width: innerWidth,
            events: nodes.length,
            overlapCount: overlaps.length,
            examples: overlaps.slice(0, 3),
            headerSeparated: !axis || (axis.height > 0 && axis.bottom <= firstTrack.top),
          };
        }, view),
      );
    }
  }
  for (const result of results) {
    if (result.events !== 38 || result.overlapCount !== 0 || !result.headerSeparated)
      throw new Error(`Layout inválido: ${JSON.stringify(result)}`);
  }
  if (runtimeErrors.length) throw new Error(`Browser errors: ${runtimeErrors.join('; ')}`);
  return results;
};
