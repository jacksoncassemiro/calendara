async (page) => {
    await page.reload();
    await page.setViewportSize({ width: 1280, height: 1000 });
    await page.evaluate(async () => {
        const { CalendarApp, ensureTemporal, createResourceDayView, createTimelineView } = await import('/src/index.ts');
        document.querySelector('main').style.display = 'none';
        const host = document.createElement('div');
        host.id = 'draft-fixture';
        document.body.append(host);
        const resources = [{ id: 'room', title: 'Sala', capacity: false }], event = { id: 'feedback', calendarId: 'c', title: 'Consulta', resourceIds: ['room'], time: { allDay: false, start: { dateTime: '2026-10-07T09:00:00', timeZone: 'UTC' }, end: { dateTime: '2026-10-07T10:00:00', timeZone: 'UTC' } } };
        const app = new CalendarApp({ temporal: await ensureTemporal(), date: '2026-10-07', view: 'day', resources, events: [event], views: [createResourceDayView(resources), createTimelineView(resources)], options: { timeZone: 'UTC', startHour: 8, endHour: 13, pxPerMinute: 2 } });
        app.mount(host);
        await app.ready();
        window.draftApp = app;
        window.draftOriginal = event;
    });
    const root = page.locator('#draft-fixture'), results = [];
    for (const view of ['day', 'week', 'resources', 'timeline', 'month']) {
        await page.evaluate(view => { window.draftApp.setEvents([window.draftOriginal]); window.draftApp.changeView(view); window.scrollTo(0, 0); }, view);
        const event = root.locator('[data-mc-event^="feedback@"]').first(), handle = event.locator('[data-mc-resize="end"]');
        await handle.scrollIntoViewIfNeeded();
        const from = await handle.boundingBox();
        const target = view === 'month' ? root.locator('[data-mc-month-day="2026-10-08"]') : view === 'week' ? root.locator('[data-mc-day="2026-10-07"] [data-mc-cell-start="660"]') : root.locator('[data-mc-cell-start="660"]');
        await target.scrollIntoViewIfNeeded();
        const to = await target.boundingBox();
        await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
        await page.mouse.down();
        await page.mouse.move(view === 'timeline' ? to.x + 1 : to.x + to.width / 2, view === 'month' ? to.y + 60 : view === 'timeline' ? to.y + to.height / 2 : to.y + 1, { steps: 10 });
        const preview = root.locator('[data-mc-draft]').first();
        await preview.waitFor();
        const label = await preview.locator('.mc-draft-time').innerText();
        if (view === 'month' ? !label.includes('08/10/2026 10:00') : label !== '09:00–11:00')
            throw new Error(view + ': horário da prévia incorreto ' + label);
        const pending = await page.evaluate(() => window.draftApp.getState().events[0].time.end.dateTime);
        if (pending !== '2026-10-07T10:00:00')
            throw new Error(view + ': estado salvo alterado antes do fim do gesto');
        await page.screenshot({ path: 'output/layout-review/draft-feedback-' + view + '.png', fullPage: true });
        await page.mouse.up();
        await page.waitForFunction(expected => window.draftApp.getState().events[0].time.end.dateTime === expected, view === 'month' ? '2026-10-08T10:00:00' : '2026-10-07T11:00:00');
        results.push(view + ': intervalo da prévia muda antes do commit');
    }
    return results;
};
