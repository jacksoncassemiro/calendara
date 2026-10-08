async (page) => {
  await page.reload();
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.evaluate(async () => {
    const calendar = await import('/src/index.ts');
    document.querySelector('main').style.display = 'none';
    const source = document.createElement('button');
    source.id = 'external-card';
    source.textContent = 'Consulta externa';
    source.style.cssText = 'margin:20px;padding:20px;touch-action:none';
    document.body.append(source);
    const outside = document.createElement('div');
    outside.id = 'external-destination';
    outside.textContent = 'Destino externo';
    outside.style.cssText =
      'position:fixed;right:5px;top:5px;padding:20px;background:white;z-index:9999';
    document.body.append(outside);
    const host = document.createElement('div');
    host.id = 'external-calendar';
    document.body.append(host);
    const event = {
      id: 'external',
      calendarId: 'agenda',
      title: 'Consulta externa',
      time: {
        allDay: false,
        start: { dateTime: '2026-10-07T09:00:00', timeZone: 'UTC' },
        end: { dateTime: '2026-10-07T09:30:00', timeZone: 'UTC' },
      },
    };
    const resources = [{ id: 'room', title: 'Sala', capacity: false }];
    const app = new calendar.CalendarApp({
      initialDate: '2026-10-07',
      initialView: 'day',
      temporal: await calendar.ensureTemporal(),
      resources,
      views: [
        ...calendar.BUILTIN_VIEWS,
        calendar.createResourceDayView(resources),
        calendar.createTimelineView(resources),
      ],
      options: { timeZone: 'UTC', startHour: 8, endHour: 13, pxPerMinute: 2 },
      onExternalEventDrop: (change) => {
        window.externalReceived = change;
        app.setEvents([change.event]);
      },
      onEventDropOutside: (info) => {
        window.externalExported = { id: info.occurrence.masterId, target: info.target?.id };
      },
      onDropBlocked: (info) => {
        window.externalBlocked = info;
      },
    });
    app.mount(host);
    await app.ready();
    source.addEventListener('pointerdown', (pointer) =>
      calendar.beginExternalEventDrag(event, pointer),
    );
    window.externalFixture = { app, event };
  });
  const root = page.locator('#external-calendar');
  const source = page.locator('#external-card');
  const results = [];
  for (const view of ['day', 'week', 'resources', 'timeline', 'month']) {
    await page.evaluate((view) => {
      const { app } = window.externalFixture;
      app.setEvents([]);
      app.setConstraints({});
      app.changeView(view);
      window.externalReceived = null;
      window.externalExported = null;
      window.externalBlocked = null;
      window.scrollTo(0, 0);
    }, view);
    const destination =
      view === 'month'
        ? root.locator('[data-mc-month-day="2026-10-08"]')
        : view === 'week'
          ? root.locator('[data-mc-day="2026-10-07"] [data-mc-cell-start="660"]')
          : root.locator('[data-mc-cell-start="660"]');
    const target = await destination.boundingBox();
    const card = await source.boundingBox();
    await page.mouse.move(card.x + 10, card.y + 10);
    await page.mouse.down();
    await page.mouse.move(
      view === 'timeline' ? target.x + 1 : target.x + target.width / 2,
      view === 'month'
        ? target.y + 65
        : view === 'timeline'
          ? target.y + target.height / 2
          : target.y + 1,
      { steps: 15 },
    );
    await root
      .locator('[data-mc-draft]')
      .first()
      .waitFor({ timeout: 3000 })
      .catch(() => {
        throw new Error('Timed external preview missing: ' + view);
      });
    if (!(await root.locator('.mc-draft-title').first().innerText()).includes('Consulta externa'))
      throw new Error('Missing external title: ' + view);
    await page.mouse.up();
    await page
      .waitForFunction(() => window.externalReceived !== null, null, { timeout: 3000 })
      .catch(async () => {
        throw new Error(
          'Receive missing ' +
            view +
            ': ' +
            JSON.stringify(
              await page.evaluate(() => ({
                blocked: window.externalBlocked,
                events: window.externalFixture.app.getState().events,
              })),
            ),
        );
      });
    const received = await page.evaluate(() => window.externalReceived.event);
    const expectedStart = view === 'month' ? '2026-10-08T09:00:00' : '2026-10-07T11:00:00';
    if (received.time.start.dateTime !== expectedStart)
      throw new Error('Wrong received time ' + view + ': ' + received.time.start.dateTime);
    if (['resources', 'timeline'].includes(view) && received.resourceIds.join(',') !== 'room')
      throw new Error('Missing destination resource');
    const existing = root.locator('[data-mc-event]').first();
    const existingRect = await existing.boundingBox();
    const outsideRect = await page.locator('#external-destination').boundingBox();
    await page.mouse.move(
      existingRect.x + existingRect.width / 2,
      existingRect.y + existingRect.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(outsideRect.x + 10, outsideRect.y + 10, { steps: 15 });
    await page.mouse.up();
    await page
      .waitForFunction(() => window.externalExported !== null, null, { timeout: 3000 })
      .catch(async () => {
        throw new Error(
          'Export missing ' +
            view +
            ': ' +
            JSON.stringify(
              await page.evaluate(() => ({
                events: window.externalFixture.app.getState().events,
                draft: document.querySelector('[data-mc-draft]')?.textContent,
              })),
            ),
        );
      });
    const exported = await page.evaluate(() => ({
      ...window.externalExported,
      events: window.externalFixture.app.getState().events.length,
    }));
    if (exported.target !== 'external-destination' || exported.events !== 1)
      throw new Error('Export deleted/target incorrect ' + view);
    results.push(
      view + ': entrada com preview, horário/recurso e persistência; saída sem exclusão automática',
    );
  }
  for (const view of ['resources', 'timeline']) {
    await page.evaluate((view) => {
      const { app, event } = window.externalFixture;
      event.time = { allDay: true, start: { date: '2026-10-07' }, end: { date: '2026-10-09' } };
      app.setEvents([{ ...event, id: 'seed', title: 'Faixa existente', resourceIds: ['room'] }]);
      app.changeView(view);
      window.externalReceived = null;
      window.scrollTo(0, 0);
    }, view);
    const target = await root.locator('[data-mc-allday-cell="2026-10-07"]').boundingBox();
    await page.evaluate((target) => {
      window.lastExternalPoint = {
        x: target.x + target.width / 2,
        y: target.y + target.height / 2,
      };
    }, target);
    const card = await source.boundingBox();
    await page.mouse.move(card.x + 10, card.y + 10);
    await page.mouse.down();
    await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 10 });
    await root
      .locator('[data-mc-draft]')
      .first()
      .waitFor({ timeout: 3000 })
      .catch(async () => {
        await page.screenshot({
          path: 'output/layout-review/external-all-day-failure.png',
          fullPage: true,
        });
        throw new Error(
          'All-day external preview missing: ' +
            view +
            ' ' +
            JSON.stringify(
              await page.evaluate(() => ({
                target: document.elementFromPoint(
                  window.lastExternalPoint.x,
                  window.lastExternalPoint.y,
                )?.className,
                draft: window.externalFixture.app.draft,
                gesture: window.externalFixture.app.interaction.gesture && {
                  anchor: window.externalFixture.app.interaction.gesture.anchor,
                  lastDraft: window.externalFixture.app.interaction.gesture.lastDraft,
                  origin: window.externalFixture.app.interaction.gesture.origin,
                },
                blocked: window.externalBlocked,
                state: window.externalFixture.app.getState().viewName,
              })),
            ),
        );
      });
    if (!(await root.locator('.mc-draft-title').first().innerText()).includes('Consulta externa')) {
      throw new Error('Preview all-day externo perdeu título: ' + view);
    }
    await page.mouse.up();
    await page.waitForFunction(() => window.externalReceived !== null);
    const received = await page.evaluate(() => window.externalReceived.event);
    if (
      !received.time.allDay ||
      received.time.start.date !== '2026-10-07' ||
      received.time.end.date !== '2026-10-09'
    ) {
      throw new Error('Intervalo exclusivo all-day externo incorreto: ' + view);
    }
    results.push(view + ': all-day externo preserva título, recurso e duração de dois dias');
  }
  await page.evaluate(() => {
    const { app } = window.externalFixture;
    window.externalFixture.event.time = {
      allDay: false,
      start: { dateTime: '2026-10-07T09:00:00', timeZone: 'UTC' },
      end: { dateTime: '2026-10-07T09:30:00', timeZone: 'UTC' },
    };
    app.setEvents([]);
    app.changeView('day');
    app.setConstraints({
      blocked: [{ date: '2026-10-07', scope: 'time', startTime: '11:00', endTime: '12:00' }],
    });
    window.externalReceived = null;
    window.externalBlocked = null;
  });
  const blockedTarget = await root.locator('[data-mc-cell-start="660"]').boundingBox();
  const sourceRect = await source.boundingBox();
  await page.mouse.move(sourceRect.x + 10, sourceRect.y + 10);
  await page.mouse.down();
  await page.mouse.move(blockedTarget.x + blockedTarget.width / 2, blockedTarget.y + 1, {
    steps: 15,
  });
  await page.mouse.up();
  await page.waitForFunction(() => window.externalBlocked !== null, null, { timeout: 3000 });
  if (
    await page.evaluate(
      () =>
        window.externalReceived !== null ||
        window.externalFixture.app.getState().events.length !== 0,
    )
  )
    throw new Error('Blocked external event inserted');
  await page.screenshot({ path: 'output/layout-review/external-drag-blocked.png', fullPage: true });
  results.push('Bloqueio recusa entrada externa sem inserção');
  await page.reload();
  await page.setViewportSize({ width: 1280, height: 1600 });
  await page.getByRole('button', { name: 'Dia', exact: true }).click();
  const demoSource = page.getByRole('button', {
    name: 'Arrastar agendamento externo · 30 minutos',
  });
  const demoCard = await demoSource.boundingBox();
  const demoSlot = await page.locator('[data-mc-cell-start="480"]').boundingBox();
  await page.mouse.move(demoCard.x + 20, demoCard.y + 15);
  await page.mouse.down();
  await page.mouse.move(demoSlot.x + demoSlot.width / 2, demoSlot.y + 1, { steps: 15 });
  await page.locator('[data-mc-draft]').waitFor();
  await page.screenshot({
    path: 'output/layout-review/external-drag-react-preview.png',
    fullPage: true,
  });
  await page.mouse.up();
  await page
    .getByRole('status')
    .filter({ hasText: 'Agendamento externo recebido e salvo' })
    .waitFor();
  const demoReceived = page.locator('[data-mc-event]').filter({ hasText: 'Agendamento externo' });
  await demoReceived.waitFor();
  const demoReceivedRect = await demoReceived.boundingBox();
  const demoOutsideRect = await page.locator('[data-demo-drop-zone]').boundingBox();
  await page.mouse.move(
    demoReceivedRect.x + demoReceivedRect.width / 2,
    demoReceivedRect.y + demoReceivedRect.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(demoOutsideRect.x + 15, demoOutsideRect.y + 15, { steps: 15 });
  await page.mouse.up();
  await page.getByRole('status').filter({ hasText: 'saída recebida' }).waitFor();
  if ((await demoReceived.count()) !== 1)
    throw new Error('Demo removed outgoing event automatically');
  results.push('Playground React usa o hook real e recebe saída sem excluir o evento');
  return results;
};
