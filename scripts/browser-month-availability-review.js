async (page) => {
  await page.reload();
  await page.setViewportSize({ width: 1280, height: 950 });
  await page.evaluate(async () => {
    const { CalendarApp, monthView, ensureTemporal } = await import('/src/index.ts');
    document.querySelector('main').style.display = 'none';
    const host = document.createElement('div');
    host.id = 'availability-fixture';
    document.body.append(host);
    const constraints = {
      businessHours: [{ daysOfWeek: [1, 2, 3, 4, 5], startTime: '08:00', endTime: '18:00' }],
      blocked: [
        { scope: 'time', date: '2026-10-08', startTime: '08:00', endTime: '17:55' },
        { scope: 'time', date: '2026-10-09', startTime: '08:00', endTime: '12:00' },
        { scope: 'time', date: '2026-10-09', startTime: '12:00', endTime: '18:00' },
      ],
    };
    const event = {
      id: 'closed',
      calendarId: 'c',
      title: 'Reserva existente',
      time: {
        allDay: false,
        start: { dateTime: '2026-10-09T09:00:00', timeZone: 'UTC' },
        end: { dateTime: '2026-10-09T10:00:00', timeZone: 'UTC' },
      },
    };
    window.availabilityClicks = 0;
    window.availabilityCreates = 0;
    const app = new CalendarApp({
      views: [monthView],
      temporal: await ensureTemporal(),
      date: '2026-10-07',
      view: 'month',
      events: [event],
      constraints,
      options: { timeZone: 'UTC', startHour: 8, endHour: 18 },
      onEventClick: () => window.availabilityClicks++,
      onDateClick: () => window.availabilityCreates++,
    });
    app.mount(host);
    await app.ready();
    window.availabilityApp = app;
  });
  const root = page.locator('#availability-fixture');
  const day = (date) => root.locator('[data-mc-month-day="' + date + '"]');
  if (await day('2026-10-08').getAttribute('data-mc-unavailable'))
    throw new Error('Cinco minutos livres marcaram dia como fechado');
  for (const date of ['2026-10-09', '2026-10-10', '2026-10-11']) {
    if ((await day(date).getAttribute('data-mc-unavailable')) !== 'true')
      throw new Error('Dia fechado sem indicação: ' + date);
    const painted = await day(date).evaluate(
      (element) => getComputedStyle(element).backgroundImage !== 'none',
    );
    if (!painted) throw new Error('Indicação sem pintura visual: ' + date);
  }
  await day('2026-10-09').locator('[data-mc-event]').click();
  if ((await page.evaluate(() => window.availabilityClicks)) !== 1)
    throw new Error('Evento existente inacessível no dia fechado');
  await day('2026-10-10').locator('.mc-month-daynum').click();
  if ((await page.evaluate(() => window.availabilityCreates)) !== 0)
    throw new Error('Dia fechado abriu criação');
  await root.locator('[data-mc-availability-legend]').waitFor();
  await page.screenshot({
    path: 'output/layout-review/month-availability-desktop.png',
    fullPage: true,
  });
  await page.setViewportSize({ width: 375, height: 850 });
  await root.locator('.mc-month-compact').waitFor();
  const closed = day('2026-10-09').locator('.mc-month-daynum');
  if (!(await closed.getAttribute('aria-label')).includes('sem horários disponíveis'))
    throw new Error('Mês mobile não anunciou indisponibilidade');
  await closed.click();
  await root.locator('.mc-month-detail').filter({ hasText: 'Reserva existente' }).waitFor();
  await page.screenshot({
    path: 'output/layout-review/month-availability-mobile.png',
    fullPage: true,
  });
  await page.evaluate(() => window.availabilityApp.setConstraints({}));
  if (await root.locator('[data-mc-unavailable]').count())
    throw new Error('Indicadores não reagiram à remoção das regras');
  return [
    'Mês: expediente, bloqueios somados e disponibilidade parcial consistentes',
    'Dia fechado impede criação e conserva eventos',
    'Mobile: indicação acessível, seleção e lista preservadas',
  ];
};
