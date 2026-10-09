async (page) => {
  const errors = [];
  const recordError = (error) => errors.push(error.message);
  page.on('pageerror', recordError);
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.goto(
    'http://127.0.0.1:5180/examples/features.html?demo=year-planner&lang=en&theme=dark',
  );
  await page.evaluate(async () => {
    const calendar = await import('/src/index.ts');
    document.querySelector('main').hidden = true;
    const host = document.createElement('div');
    host.id = 'planner-overflow-fixture';
    document.body.append(host);
    const events = Array.from({ length: 5 }, (_, index) => ({
      id: `planner-${index}`,
      calendarId: 'fixture',
      title: `Planner appointment ${index}`,
      time: { allDay: true, start: { date: '2026-10-07' }, end: { date: '2026-10-08' } },
    }));
    window.plannerOverflowApp = new calendar.CalendarApp({
      temporal: await calendar.ensureTemporal(),
      date: '2026-10-07',
      view: 'year-planner',
      views: [calendar.yearPlannerView, calendar.dayView],
      events,
      options: { timeZone: 'UTC', locale: 'en-US' },
      onMonthMoreClick: (info) => {
        window.plannerOverflowInfo = {
          date: info.dateISO,
          total: info.occurrences.length,
          hidden: info.hiddenOccurrences.length,
        };
        return window.cancelPlannerOverflow ? false : undefined;
      },
      onEventClick: (occurrence) => {
        window.clickedPlannerEvent = occurrence.event.id;
      },
    });
    window.plannerOverflowApp.mount(host);
    await window.plannerOverflowApp.ready();
  });
  const trigger = page.locator(
    '#planner-overflow-fixture [data-mc-year-planner-date="2026-10-07"] .mc-month-more',
  );
  await trigger.waitFor();
  if (
    await trigger.evaluate(
      (node) => node.tagName !== 'BUTTON' || getComputedStyle(node).height !== '24px',
    )
  )
    throw new Error('Planner does not share the month trigger');
  await trigger.click();
  await page.locator('[data-mc-month-detail-event]').last().waitFor();
  if ((await page.locator('[data-mc-month-detail-event]').count()) !== 5)
    throw new Error('Planner overflow loses events');
  const info = await page.evaluate(() => window.plannerOverflowInfo);
  if (info.date !== '2026-10-07' || info.total !== 5 || info.hidden !== 3)
    throw new Error(JSON.stringify(info));
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.activeElement?.classList.contains('mc-month-more'));
  await page.setViewportSize({ width: 360, height: 800 });
  await trigger.click();
  await page.locator('[data-mc-month-detail-event]').last().waitFor();
  const popupBounds = await page.locator('.mc-month-popover').boundingBox();
  if (popupBounds.x < 0 || popupBounds.x + popupBounds.width > 361)
    throw new Error('Planner popover escapes narrow viewport');
  await page.screenshot({
    path: 'output/layout-review/planner-overflow-narrow.png',
    fullPage: false,
  });
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.evaluate(() => {
    window.cancelPlannerOverflow = true;
  });
  await trigger.click();
  if (await page.locator('.mc-month-popover').count()) throw new Error('Cancelled overflow opened');
  await page.evaluate(() => {
    window.cancelPlannerOverflow = false;
  });
  await trigger.click();
  await page.locator('[data-mc-month-detail-event]').first().click();
  if (!(await page.evaluate(() => window.clickedPlannerEvent)))
    throw new Error('Planner event callback missing');
  await page.evaluate(() => {
    window.plannerOverflowApp.setRenderMonthMore(
      (info) => `Custom planner ${info.occurrences.length}/${info.hiddenOccurrences.length}`,
    );
  });
  await trigger.click();
  await page.getByText('Custom planner 5/3', { exact: false }).waitFor();
  if (!(await page.locator('.mc-month-popover').textContent()).includes('Custom planner 5/3'))
    throw new Error('Custom overflow data missing');
  await page.screenshot({
    path: 'output/layout-review/planner-shared-overflow.png',
    fullPage: false,
  });
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.plannerOverflowApp.setOptions({ monthMoreView: 'day' }));
  await trigger.click();
  await page.locator('#planner-overflow-fixture [data-mc-day="2026-10-07"]').waitFor();
  await page.evaluate(() => {
    window.plannerOverflowApp.destroy();
    document.getElementById('planner-overflow-fixture').remove();
  });
  page.off('pageerror', recordError);
  if (errors.length) throw new Error(errors.join('\n'));
  return {
    info,
    escapeFocus: true,
    customContent: true,
    cancellation: true,
    eventClick: true,
    dayNavigation: true,
    errors,
  };
};
