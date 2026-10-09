# Dense month panels and wrapped timeline labels

## Scope / Escopo

Correct year/quarter panel alignment, clipped wrapped resource/group titles and crowded automatic timeline labels. Preserve explicit label intervals and consumer event limits; no public API change.

Corrige painéis desalinhados de ano/trimestre, nomes de recursos/grupos cortados e horários automáticos sobrecarregados. Preserva intervalos explícitos e limites de eventos do consumidor; sem mudança de API pública.

## Evidence / Evidência

- The multi-month grid previously aligned each panel at its independent intrinsic height. Grid rows now share the largest panel height; flexible month weeks fill each panel.
- Group rows previously reserved 44 px while the rendered label needed 58.59 px. Intrinsic DOM measurements now contribute to resource/group heights and virtual offsets; ResizeObserver handles font/width changes.
- The hierarchical demo forced hourly labels into 180 px days, creating an 88 px staggered axis. Automatic spacing keeps the axis at 30 px without overriding explicit consumer intervals.

Browser regression: `scripts/browser-dense-panels-review.js`; desktop and 360 px containers, 20 overlapping events, multi-day events, year/quarter geometry, wrapped group/resource labels, font resizing, 120 resources and RTL virtualization. Screenshots are Git-ignored outputs in `output/layout-review/dense-*.png`. Desktop simulation does not constitute physical mobile/Safari validation.

Regressão no navegador: containers desktop e de 360 px, 20 eventos sobrepostos, eventos de vários dias, geometria de ano/trimestre, nomes longos, mudança de fonte, 120 recursos e virtualização RTL. Capturas ignoradas pelo Git em `output/layout-review/dense-*.png`. Simulação desktop não equivale a teste físico de celular/Safari.
