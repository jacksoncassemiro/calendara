async (page) => {
  await page.mouse.up();
  await page.reload();
  await page.setViewportSize({ width: 1000, height: 800 });
  await page.getByRole('button', { name: 'Linha do tempo', exact: true }).click();
  const spacing = page.getByRole('combobox', { name: 'Tamanho do slot', exact: true });
  await page
    .getByRole('combobox', { name: 'Intervalo dos rótulos', exact: true })
    .selectOption('0');
  const measurements = [];
  for (const value of ['1', '2']) {
    await spacing.selectOption(value);
    await page.locator('[data-mc-hscroll] .mc-timeline-axis').waitFor();
    const result = await page.locator('[data-mc-hscroll] .mc-timeline-axis').evaluate((el) => {
      const labels = [...el.querySelectorAll('.mc-timeline-hour')].map((n) => ({
        text: n.textContent,
        left: n.getBoundingClientRect().left,
        right: n.getBoundingClientRect().right,
      }));
      return {
        width: el.getBoundingClientRect().width,
        labels,
        collisions: labels.slice(1).some((l, i) => l.left < labels[i].right + 4),
      };
    });
    if (result.collisions) throw new Error('Timeline labels overlap at scale ' + value);
    measurements.push(result);
    await page.screenshot({
      path: 'output/layout-review/timeline-spacing-' + value + '.png',
      fullPage: true,
    });
  }
  if (Math.abs(measurements[1].width / measurements[0].width - 2) > 0.01)
    throw new Error('Wide scale did not double time width');
  await page
    .getByRole('combobox', { name: 'Intervalo dos rótulos', exact: true })
    .selectOption('30');
  const explicit = [];
  for (const value of ['1', '2']) {
    await spacing.selectOption(value);
    explicit.push(
      await page.locator('[data-mc-hscroll] .mc-timeline-axis').evaluate((el) => ({
        width: el.getBoundingClientRect().width,
        labels: [...el.querySelectorAll('.mc-timeline-hour')].map((n) => n.textContent),
      })),
    );
  }
  if (
    JSON.stringify(explicit[0].labels) !== JSON.stringify(explicit[1].labels) ||
    explicit[0].labels[1] !== '07:30'
  )
    throw new Error('Explicit label interval changed with scale');
  await page
    .getByRole('combobox', { name: 'Intervalo dos rótulos', exact: true })
    .selectOption('60');
  const hourly = await page.locator('[data-mc-hscroll] .mc-timeline-hour').allTextContents();
  if (hourly[1] !== '08:00' || hourly.length * 2 !== explicit[1].labels.length)
    throw new Error('Hourly labels do not control frequency');
  return measurements.map((m) => ({
    width: m.width,
    labelCount: m.labels.length,
    collisions: m.collisions,
  }));
};
