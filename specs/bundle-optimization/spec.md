# Recurrence bundle optimization

Status: implemented and validated. / Português: implementado e validado.

- Reuse the existing civil iterator for supported RRULE dates, using one injected Temporal implementation for zoned times. Retain the former provider only as an independent development oracle.
- Preserve COUNT before exclusions, skip nonexistent local times before BYSETPOS/COUNT, inclusive UNTIL/window bounds, original identity, overrides and full event duration.
- Prefer native Temporal; load temporal-polyfill 1.0.5 lazily as the fallback and retry/cache contracts. No global host mutation or FullCalendar calendar dependency.
- Keep one React package and existing lazy overflow behavior. Automatic virtualization and native-popover replacement are separate proposals.

Português: reutilizar o iterador civil, preservar recorrência/fusos/identidade, manter Temporal nativo primeiro e fallback lazy existente. Pacote único; virtualização automática e substituição do popover ficam fora desta implementação.

Acceptance: independent differential rules/zones, integrated recurrence/gesture tests, consumed archive, measured before/after consumer bundles and aligned public EN/PT docs.
