async (page) => {
  await page.mouse.up();
  await page.reload();
  await page.setViewportSize({ width: 1300, height: 900 });
  await page.getByRole('button', { name: 'Dia', exact: true }).click();
  const duration = page.getByRole('combobox', { name: 'Duração do slot', exact: true });
  const size = page.getByRole('combobox', { name: 'Tamanho do slot', exact: true });
  const interval = page.getByRole('combobox', { name: 'Intervalo dos rótulos', exact: true });
  await duration.selectOption('30');
  await size.selectOption('2');
  await interval.selectOption('60');
  const measure = () =>
    page
      .locator('[data-mc-hscroll] .mc-hour-label')
      .evaluateAll((nodes) =>
        nodes.slice(0, 3).map((n) => ({ text: n.textContent, y: n.getBoundingClientRect().top })),
      );
  const first = await measure();
  if (first[1].text !== '08:00' || Math.abs(first[1].y - first[0].y - 120) > 0.5)
    throw new Error('30min slots 60px with hourly labels incorrect');
  await duration.selectOption('60');
  const second = await measure();
  if (
    Math.abs(second[1].y - second[0].y - 60) > 0.5 ||
    (await interval.inputValue()) !== '60' ||
    (await size.inputValue()) !== '2'
  )
    throw new Error('Duration changed independent controls');
  await duration.selectOption('15');
  await interval.selectOption('30');
  const third = await measure();
  if (Math.abs(third[1].y - third[0].y - 120) > 0.5 || third[1].text !== '07:30')
    throw new Error('15min slots 60px with half-hour labels incorrect');
  await page.screenshot({ path: 'output/playwright/slot-controls.png' });
  return { thirty: first, sixty: second, fifteen: third };
};
