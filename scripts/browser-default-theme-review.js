async (page) => {
  await page.reload();
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.evaluate(async () => {
    document.querySelector('main').style.display = 'none';
    for (const stylesheet of document.querySelectorAll('style[data-vite-dev-id]')) {
      if (stylesheet.dataset.viteDevId.endsWith('/examples/react-playground.css')) stylesheet.remove();
    }
    const { CalendarApp, ensureTemporal, BUILTIN_VIEWS, createResourceDayView, createTimelineView } = await import('/src/index.ts');
    const host = document.createElement('div');
    host.id = 'default-theme-calendar';
    document.body.append(host);
    const resources = [{ id: 'room', title: 'Sala de triagem', capacity: false }];
    const event = { id: 'short', calendarId: 'agenda', title: 'Coleta', color: '#9f1239', resourceIds: ['room'],
      time: { allDay: false, start: { dateTime: '2026-10-07T09:00:00', timeZone: 'UTC' },
        end: { dateTime: '2026-10-07T09:15:00', timeZone: 'UTC' } } };
    const app = new CalendarApp({ initialDate: '2026-10-07', initialView: 'day', temporal: await ensureTemporal(),
      resources, events: [event], views: [...BUILTIN_VIEWS, createResourceDayView(), createTimelineView()],
      options: { timeZone: 'UTC', startHour: 8, endHour: 13, pxPerMinute: 1.5 } });
    app.mount(host); await app.ready();
    window.defaultTheme = app;
  });
  const root = page.locator('#default-theme-calendar');
  const styles = await root.locator('[data-mc-root]').evaluate(element => ({
    font: getComputedStyle(element).fontFamily,
    text: getComputedStyle(element).color,
    demoStyles: [...document.querySelectorAll('style[data-vite-dev-id]')].some(style => style.dataset.viteDevId.endsWith('/examples/react-playground.css')),
  }));
  if (styles.demoStyles || !styles.font.includes('Segoe UI') || styles.text !== 'rgb(34, 50, 70)') throw new Error('Default theme depends on demo CSS');
  const eventStyle = await root.locator('[data-mc-event]').evaluate(element => ({
    shadow: getComputedStyle(element).boxShadow,
    height: element.getBoundingClientRect().height,
    contentHeight: element.querySelector('.mc-event-content').getBoundingClientRect().height,
  }));
  if (!eventStyle.shadow.includes('159, 18, 57') || eventStyle.contentHeight > eventStyle.height) throw new Error('Short event/custom color broken: ' + JSON.stringify(eventStyle));
  await page.screenshot({ path: 'output/layout-review/default-theme-desktop.png', fullPage: true });
  await root.locator('[data-mc-root]').evaluate(element => {
    element.style.setProperty('--mc-color-btn-active-bg', '#0f766e');
    element.style.setProperty('--mc-color-bg', '#fafaf9');
  });
  const themed = await root.locator('.mc-view-btn.mc-active').evaluate(element => getComputedStyle(element).backgroundColor);
  if (themed !== 'rgb(15, 118, 110)') throw new Error('User theme tokens ignored');
  const results = ['Tema independente do CSS externo; evento curto e cor própria preservados; tokens aplicáveis'];
  for (const width of [375, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const view of ['day', 'month', 'resources', 'timeline']) {
      await page.evaluate(view => window.defaultTheme.changeView(view), view);
      if (view === 'month') {
        await root.getByRole('heading', { name: /quarta-feira, 7 de outubro de 2026/ }).waitFor();
      }
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (overflow > 1) throw new Error('Page horizontal overflow ' + view + '/' + width + ': ' + overflow);
      const title = await root.locator('[data-mc-title]').boundingBox();
      if (!title || title.width > width) throw new Error('Title clipped ' + view + '/' + width);
      await page.screenshot({ path: `output/layout-review/default-theme-${view}-${width}.png`, fullPage: true });
    }
    results.push(width + 'px: Dia, Mês, Recursos e Timeline sem overflow lateral da página');
  }
  await page.evaluate(() => { window.defaultTheme.changeView('month'); window.defaultTheme.setDate('2026-10-09'); });
  await root.getByRole('heading', { name: /sexta-feira, 9 de outubro de 2026/ }).waitFor();
  results.push('Mês compacto seleciona a data de referência e acompanha navegação no mesmo mês');
  return results;
}
