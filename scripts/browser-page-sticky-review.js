async (page) => {
  await page.setViewportSize({ width: 1280, height: 900 });
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
    host.id = 'sticky-fixture';
    document.body.append(host);
    const footer = document.createElement('div');
    footer.style.height = '1200px';
    document.body.append(footer);
    const resources = Array.from({ length: 20 }, (_, index) => ({
      id: `room-${index}`,
      title: `Sala ${index + 1}`,
    }));
    const events = [
      {
        id: 'long',
        calendarId: 'c',
        title: 'Evento longo',
        resourceIds: ['room-0'],
        time: {
          allDay: false,
          start: { dateTime: '2026-10-07T00:00:00', timeZone: 'UTC' },
          end: { dateTime: '2026-10-07T23:00:00', timeZone: 'UTC' },
        },
      },
      {
        id: 'all',
        calendarId: 'c',
        title: 'Congresso',
        resourceIds: ['room-0'],
        time: { allDay: true, start: { date: '2026-10-07' }, end: { date: '2026-10-09' } },
      },
    ];
    window.allDayClicks = 0;
    const app = new CalendarApp({
      temporal: await ensureTemporal(),
      date: '2026-10-07',
      view: 'week',
      resources,
      events,
      onEventClick: () => window.allDayClicks++,
      views: [...BUILTIN_VIEWS, createResourceDayView(resources), createTimelineView(resources)],
      options: { timeZone: 'UTC', startHour: 0, endHour: 24, pxPerMinute: 1.5 },
    });
    app.mount(host);
    await app.ready();
    window.stickyApp = app;
  });
  const results = [];
  for (const view of ['week', 'day', 'resources', 'timeline']) {
    await page.evaluate((view) => {
      window.scrollTo(0, 0);
      window.stickyApp.changeView(view);
    }, view);
    const scroller = page.locator('#sticky-fixture [data-mc-hscroll]');
    await scroller.waitFor();
    const result = await scroller.evaluate(async (scroll) => {
      scroll.scrollLeft = 220;
      const allDayBefore = scroll.querySelector('.mc-allday-row,.mc-resource-allday-row');
      const eventBefore = scroll.querySelector('[data-mc-event^="long"]');
      const before = {
        width: scroll.scrollWidth,
        allDayWidth: allDayBefore?.getBoundingClientRect().width,
        eventLeft: eventBefore?.getBoundingClientRect().left,
        eventWidth: eventBefore?.getBoundingClientRect().width,
      };
      window.scrollTo(0, scroll.getBoundingClientRect().top + window.scrollY + 200);
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const overlay = scroll.nextElementSibling;
      const copy = overlay.querySelector('.mc-page-sticky-content');
      const original = scroll.querySelector(
        '.mc-header-row,.mc-resource-header-row,.mc-timeline-header',
      );
      const viewport = scroll.getBoundingClientRect(),
        o = overlay.getBoundingClientRect(),
        c = (
          copy.querySelector('.mc-gutter-corner,.mc-timeline-corner') ?? copy.firstElementChild
        ).getBoundingClientRect();
      const columnSelector = '.mc-day-header,.mc-resource-header,.mc-timeline-axis';
      const originalCell = (
          original.querySelector(columnSelector) ?? original.children[1]
        ).getBoundingClientRect(),
        copiedCell = (
          copy.querySelector(columnSelector) ?? copy.children[1]
        ).getBoundingClientRect();
      const allDay = scroll.querySelector('.mc-allday-row,.mc-resource-allday-row');
      const allRect = allDay?.getBoundingClientRect();
      const content = scroll.querySelector('[data-mc-event^="long"] .mc-event-content');
      const event = content?.parentElement.getBoundingClientRect(),
        text = content?.getBoundingClientRect();
      return {
        view: scroll.parentElement.dataset.mcView,
        scrollY: window.scrollY,
        scrollLeft: scroll.scrollLeft,
        internalScrollTop: scroll.scrollTop,
        visible: getComputedStyle(overlay).display !== 'none',
        overlayTop: o.top,
        overlayWidth: o.width,
        viewportWidth: scroll.clientWidth,
        cornerDelta: c.left - viewport.left,
        columnDelta: copiedCell.left - originalCell.left,
        clonedData: copy.querySelectorAll('[data-mc-day-header]').length,
        copies: document.querySelector('#sticky-fixture').querySelectorAll('.mc-page-sticky-header')
          .length,
        allDayFixed: !allDay || getComputedStyle(allDay).position === 'fixed',
        allDayDelta: allRect ? allRect.top - o.bottom : 0,
        scrollWidthDelta: scroll.scrollWidth - before.width,
        allDayWidthDelta: allRect ? allRect.width - before.allDayWidth : 0,
        eventLeftDelta: event ? event.left - before.eventLeft : 0,
        eventWidthDelta: event ? event.width - before.eventWidth : 0,
        contentOffset: content
          ? parseFloat(content.style.getPropertyValue('--mc-content-offset'))
          : 0,
        textWithinEvent:
          !text ||
          (text.left >= event.left - 1 &&
            text.right <= event.right + 1 &&
            text.top >= event.top - 1 &&
            text.bottom <= event.bottom + 1),
      };
    });
    if (
      !result.visible ||
      result.internalScrollTop !== 0 ||
      Math.abs(result.overlayTop) > 1 ||
      Math.abs(result.cornerDelta) > 1 ||
      Math.abs(result.columnDelta) > 1 ||
      result.overlayWidth !== result.viewportWidth ||
      result.copies !== 1 ||
      result.clonedData !== 0
    )
      throw new Error(`Cabeçalho de página inválido: ${JSON.stringify(result)}`);
    if (
      !result.allDayFixed ||
      Math.abs(result.allDayDelta) > 1 ||
      Math.abs(result.allDayWidthDelta) > 1 ||
      Math.abs(result.eventLeftDelta) > 1 ||
      Math.abs(result.eventWidthDelta) > 1 ||
      Math.abs(result.scrollWidthDelta) > 1 ||
      !result.textWithinEvent
    )
      throw new Error(`Faixa/conteúdo inválido: ${JSON.stringify(result)}`);
    if (view === 'week') {
      await page.locator('#sticky-fixture [data-mc-allday-event^="all"]').click();
      if ((await page.evaluate(() => window.allDayClicks)) !== 1)
        throw new Error('Faixa fixa perdeu interação');
    }
    results.push(result);
    await page.screenshot({ path: `output/playwright/page-sticky-${view}.png`, fullPage: false });
    const hidden = await scroller.evaluate(async (scroll) => {
      window.scrollTo(0, scroll.getBoundingClientRect().bottom + window.scrollY + 100);
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return getComputedStyle(scroll.nextElementSibling).display === 'none';
    });
    if (!hidden) throw new Error(`Cabeçalho escapou do calendário ${view}`);
  }
  await page.setViewportSize({ width: 375, height: 900 });
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    window.stickyApp.changeView('week');
  });
  const narrowAlignment = await page
    .locator('#sticky-fixture [data-mc-hscroll]')
    .evaluate(async (scroll) => {
      scroll.scrollLeft = 310;
      const original = scroll.querySelector('.mc-allday-row');
      const before = original.children[3].getBoundingClientRect();
      window.scrollTo(0, scroll.getBoundingClientRect().top + window.scrollY + 200);
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const body = scroll.querySelectorAll('.mc-day-col')[2].getBoundingClientRect();
      const fixed = original.children[3].getBoundingClientRect();
      return {
        columnDelta: fixed.left - body.left,
        fixedWidthDelta: fixed.width - before.width,
        scrollLeft: scroll.scrollLeft,
      };
    });
  if (
    Math.abs(narrowAlignment.columnDelta) > 1 ||
    Math.abs(narrowAlignment.fixedWidthDelta) > 1 ||
    narrowAlignment.scrollLeft <= 0
  )
    throw new Error(`Narrow all-day alignment changed: ${JSON.stringify(narrowAlignment)}`);
  results.push({ narrowAlignment });
  const horizontalControls = await page
    .locator('#sticky-fixture [data-mc-hscroll]')
    .evaluate(async (scroll) => {
      const scrollbar = scroll.previousElementSibling.querySelector('.mc-header-scrollbar');
      const positions = [];
      for (const destination of [0, 180, 440]) {
        scrollbar.scrollLeft = destination;
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const label = scroll.querySelector('.mc-allday-label').getBoundingClientRect();
        const axis = scroll.querySelector('.mc-time-axis').getBoundingClientRect();
        positions.push({ scrollLeft: scroll.scrollLeft, labelDelta: label.left - axis.left });
      }
      return {
        positions,
        position: getComputedStyle(scrollbar).position,
        top: scrollbar.getBoundingClientRect().top,
      };
    });
  if (
    horizontalControls.position !== 'fixed' ||
    horizontalControls.top < 0 ||
    horizontalControls.positions.some((position) => Math.abs(position.labelDelta) > 1) ||
    horizontalControls.positions.at(-1).scrollLeft < 400
  )
    throw new Error(
      'Pinned horizontal navigation/label drift: ' + JSON.stringify(horizontalControls),
    );
  results.push({ horizontalControls });

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    window.stickyApp.changeView('month');
    document.querySelectorAll('#sticky-fixture .mc-month-day').forEach((day) => {
      day.style.minHeight = '220px';
    });
  });
  const monthHeader = await page
    .locator('#sticky-fixture .mc-month-weekdays')
    .evaluate(async (header) => {
      window.scrollTo(0, header.getBoundingClientRect().top + window.scrollY + 160);
      await new Promise((resolve) => requestAnimationFrame(resolve));
      return header.getBoundingClientRect().top;
    });
  if (Math.abs(monthHeader) > 1) throw new Error('Month weekday header did not follow page scroll');

  await page.evaluate(() => {
    window.scrollTo(0, 0);
    const events = Array.from({ length: 30 }, (_, index) => {
      const day = index < 15 ? '07' : '08';
      return {
        id: `list-${index}`,
        calendarId: 'c',
        title: `Agenda ${index}`,
        time: {
          allDay: false,
          start: { dateTime: `2026-10-${day}T09:00:00`, timeZone: 'UTC' },
          end: { dateTime: `2026-10-${day}T10:00:00`, timeZone: 'UTC' },
        },
      };
    });
    window.stickyApp.setEvents(events);
    window.stickyApp.changeView('list');
  });
  const listHeaders = page.locator('#sticky-fixture .mc-list-day-header');
  const firstListHeader = await listHeaders.first().evaluate(async (header) => {
    window.scrollTo(0, header.getBoundingClientRect().top + window.scrollY + 100);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    return header.getBoundingClientRect().top;
  });
  if (Math.abs(firstListHeader) > 1)
    throw new Error('Agenda day header did not follow page scroll');
  const secondListHeader = await listHeaders.nth(1).evaluate(async (header) => {
    window.scrollTo(0, header.getBoundingClientRect().top + window.scrollY + 100);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const previous =
      header.parentElement.previousElementSibling.querySelector('.mc-list-day-header');
    return {
      top: header.getBoundingClientRect().top,
      previousBottom: previous.getBoundingClientRect().bottom,
    };
  });
  if (Math.abs(secondListHeader.top) > 1 || secondListHeader.previousBottom > 1)
    throw new Error(
      `Agenda day header did not yield to next section: ${JSON.stringify(secondListHeader)}`,
    );
  results.push({ monthHeader, firstListHeader, secondListHeader });
  return results;
};
