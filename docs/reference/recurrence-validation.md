# Referência — Validação do motor de recorrência (Temporal API vs rrule.js)

Objetivo: decidir com evidência se o **motor próprio via Temporal API** (protótipo do Jackson) é
correto o suficiente para adotarmos, usando **rrule.js como oráculo**. Também define os testes que a
implementação real (`packages/core/recurrence`) precisa passar.

## Como reproduzir

```bash
cd experiments/recurrence-validation
npm install          # rrule@2.8.1 + @js-temporal/polyfill@0.4.4
node harness.mjs     # 28 cenários base
node harness2.mjs    # 16 cenários difíceis (edge cases)
```

`temporal-rrule.mjs` = protótipo do Jackson extraído (classe `TemporalRRule`). O harness compara a
saída dela com a da `rrule.js` para o mesmo `DTSTART` + `RRULE`, em datas (all-day).

## Resultado (sessão 1 — 2026-07-21)

| Suíte | Resultado |
|---|---|
| `harness.mjs` (28 cenários base) | **28/28 ✅** |
| `harness2.mjs` (16 edge cases) | **15/16** — 1 falha real |
| **Total** | **43/44** |

### Cenários que passaram (destaques)
Diário/semanal/mensal/anual; `INTERVAL`; `COUNT`; `UNTIL`; `BYMONTHDAY` positivo **e negativo** (`-1`,`-2`);
`BYDAY` com ordinal simples (`4FR`, `-1MO`, `-1SU`); `BYSETPOS` (±1 com dia útil/fim de semana);
`BYMONTH`; ano bissexto (`Feb 29` a cada 4 anos); "5ª quarta fantasma" (mês sem 5ª quarta → pula);
regra impossível (`Feb 30` → anti-loop, retorna vazio); Halley (`INTERVAL=76`); **EXDATE**;
`COUNT`+`UNTIL` juntos; **WKST implícito** (semanal `INTERVAL=2` começando no domingo bateu com rrule).

### ❌ Falha encontrada (importante)
```
Rule:  FREQ=MONTHLY;BYDAY=2FR,4FR;COUNT=6   (2ª e 4ª sexta do mês)
Nosso: 2024-01-26, 2024-02-23, 2024-03-22, …   ← só a 4ª sexta
rrule: 2024-01-12, 2024-01-26, 2024-02-09, …   ← 2ª E 4ª sexta (correto)
```
**Causa raiz:** o protótipo mapeia qualquer `BYDAY` com prefixo para um **único `bysetpos` global**
(`fromString` faz `options.bysetpos = parseInt(match[1])` sobrescrevendo). Assim ele **não consegue
representar múltiplos ordinais** (2FR **e** 4FR) — guarda só o último.

**Correção definitiva (já refletida no modelo canônico):** o `RRuleModel` deve ter
`byDay: Array<{weekday, ordinal?}>` — **um ordinal por entrada** — em vez de um `bySetPos` global.
Ver `data-model-mapping.md`. Com isso, `2FR,4FR` vira `[{FR,2},{FR,4}]` e o gerador emite os dois.

### ✅ Correção provada (sessão 2)
Implementada no motor `temporal-rrule-v2.mjs` (com `byDay: [{weekday, ordinal|null}]`) e validada em
`harness3.mjs`: **23/23**, incluindo os casos multi-ordinal que antes falhavam:
`FREQ=MONTHLY;BYDAY=2FR,4FR`, `1MO,3MO`, `1SU,-1SU` e `FREQ=YEARLY;BYMONTH=3;BYDAY=1MO,3MO`.
Sem regressão nos demais cenários. **Conclusão: o gap é resolvido por modelo de dados** — nenhuma
mudança na abordagem Temporal foi necessária. Rodar: `node harness3.mjs`.

## Conclusões

1. **A abordagem Temporal é sólida e correta** na esmagadora maioria dos casos RFC 5545 (43/44),
   incluindo os difíceis (negativos, fantasma, impossíveis, DST implícito). **Decisão: adotar Temporal.**
2. **O protótipo não é a implementação final** — precisa de um **modelo de regra mais fiel ao RFC**
   (ordinal por BYDAY; múltiplos BYMONTHDAY; BYSETPOS como lista; WKST explícito).
3. **rrule.js fica fora do runtime** e permanece **apenas como oráculo de teste** (dev dependency).
4. **Compatibilidade Temporal (2026):** nativo em Chrome 144 / Firefox 139+ / Edge; Safari ainda atrás de
   flag → **usar `temporal-polyfill`/`@js-temporal/polyfill`** (fallback automático quando `globalThis.Temporal`
   ausente). Custo de bundle do polyfill deve ser medido na Fase 1 (considerar carregamento condicional).

## Suíte-alvo para a implementação real (Fase 1)
Portar estes 44 cenários para specs (padrão Schedule-X: um arquivo por FREQ) e **adicionar**:
- `2FR,4FR` e `1MO,3MO` (multi-ordinal — o gap corrigido).
- WKST **explícito** ≠ MO (ex.: `WKST=SU` com semanal `INTERVAL=2`) — o protótipo assume semana Mon-based.
- Recorrência **timed com DST real** (ex.: cruzar mudança de horário de verão em `America/Sao_Paulo`
  e em `America/New_York`) comparando o instante UTC — validar o caminho tz-aware + `TimezoneOffsetCache`.
- `RDATE` (datas extras) e `overrides` por ocorrência (mover/cancelar 1 instância).
- Performance: expandir 1 regra infinita numa janela de 1 ano deve ser < alguns ms (fast-forward).
