# Referência — Agenda Desvinculada (Recursos / Exames e Equipamentos)

Destilação **focada na biblioteca** do conceito de "agenda desvinculada" (o dono do horário é um
**recurso** — sala/equipamento/leito/cadeira — e não um profissional). Baseado na pesquisa de mercado
do Jackson (Feegow, ProDoctor, GestãoDS). Aqui só entra o que **a lib de calendário precisa suportar**;
regras clínicas/negócio ficam no app consumidor.

> **Decisão:** isto passa a ser **requisito de 1ª classe** (não backlog). Confirma e amplia o que o
> `referencias-open-source.md` chamou de "Resources/grouping" (Syncfusion). Sim — é a mesma coisa.

## ⚠️ Fronteira: o que é da LIB vs o que é do APP (evitar acoplar regra de negócio)
O conceito padrão e genérico de calendário é **`Resource`** — e é só isso que a biblioteca conhece.
**A lib NÃO tem conceito de "profissional", "exame" ou "clínica".** Um profissional, uma sala, um
equipamento e um leito são todos, para a lib, apenas `Resource` — distinguidos por um `type` que é uma
**string opaca definida pelo app** (a lib não interpreta) e por `metadata` livre.

| A biblioteca oferece (genérico) | O app consumidor decide (domínio) |
|---|---|
| `Resource { id, title, type, capacity, buffers, businessHours, parentId, metadata }` | O que cada `type` significa ("profissional", "sala", "RM") |
| `event.resourceIds: string[]` (0..N) | Se algum recurso é **obrigatório** num agendamento |
| Conflito visual + callbacks (`onDropBlocked`, etc.) | Qual recurso um procedimento exige (auto-resolução) |
| Lotação (`capacity`) e buffers como números | Reserva atômica no backend, fila/triagem, PACS/RIS |

Assim, "profissional opcional" **não** é um campo/flag da lib: simplesmente a lib nunca exige recurso
algum — a obrigatoriedade (se houver) é validada pelo app nos callbacks. **Trocar o valor de `type` ou
estender via `metadata` cobre qualquer domínio** (clínica, salão, oficina, coworking) sem mudar a lib.

## Por que impacta a arquitetura da lib
Uma "agenda por profissional" é um caso particular de "agenda por recurso" onde o recurso é a pessoa.
Se a lib tratar **recurso como entidade genérica de agenda** e a **view Timeline/Resource** como
1ª classe, cobrimos consulta *e* exame/equipamento com o mesmo núcleo.

## O que a lib precisa oferecer

### 1. Recurso como entidade de agenda (genérica)
Profissional, sala, equipamento e leito são todos **"recursos"** (colunas/linhas de agenda). A lib não
precisa saber a semântica clínica — só que um evento pode pertencer a **1..N recursos**.

### 2. Evento com múltiplos recursos (reserva atômica na UI)
Um agendamento pode ocupar vários recursos ao mesmo tempo (ex.: sala + aparelho + técnico). A lib
representa `event.resourceIds: string[]` e, ao renderizar/validar drag&drop, considera **todos**. A
atomicidade transacional é do backend; a lib garante a **consistência visual e de conflito**.

### 3. Capacidade / lotação por recurso (sobreposição configurável)
Cada recurso tem `capacity` (1 = não sobrepõe; N = N eventos simultâneos — ex.: soroterapia com N
poltronas, sala de infiltração "até 20"). A geometria de layout e a checagem de conflito usam isso.

### 4. Buffers (preparo/limpeza)
`bufferBefore`/`bufferAfter` por recurso (ou por par recurso×procedimento). O slot só fica livre após o
buffer. Renderizado como zona morta e considerado no ConstraintEngine.

### 5. Escala/disponibilidade própria do recurso
Recurso tem `businessHours` e bloqueios **próprios** (equipamento em manutenção toda segunda de manhã,
não atende feriado). Ou seja, os mesmos conceitos de `businessHours`/`blocking` já previstos valem
**por recurso**, não só por profissional.

### 6. Views orientadas a recurso
- **Timeline/Resource view**: recursos em **linhas**, tempo no eixo horizontal (padrão Syncfusion timeline).
- **Multiagenda (columns)**: recursos/profissionais em **colunas** lado a lado (Feegow "Agenda Múltipla",
  GestãoDS "multiagenda"). É uma variação da week/day view com N colunas por recurso.
- Agrupamento e toggle de visibilidade por recurso (e por grupo/unidade).

### 7. Nenhum recurso é obrigatório pela lib
A biblioteca nunca exige recurso algum num evento (`resourceIds` pode ser vazio). Se, no domínio do app,
um agendamento precisa de um "profissional" ou de um recurso específico, essa obrigatoriedade é validada
**no app** (nos callbacks). Isso cobre naturalmente cenários como telerradiologia / plantão / pool de
técnicos — sem a lib saber que "profissional" existe.

### 8. Agrupamento e atributos extras via genéricos
Agrupar/filtrar recursos usa `parentId` (hierarquia genérica) e `type` (string opaca). Atributos de
domínio (unidade física, CBO, "abstrato RM" vs "concreto RM-Philips-sala3", substituição por equivalente)
vão em `metadata` — a lib não os interpreta, só os carrega.

## Modelo de dados
A definição canônica de `CalendarResource` (genérica, sem semântica de domínio) e de
`event.resourceIds` está em **`data-model-mapping.md`** — fonte única, para não divergir. Aqui só o
resumo: `Resource` tem `type` (string opaca), `capacity`, `bufferBefore/After`, `businessHours` próprio,
`parentId` (agrupamento) e `metadata` (extensão livre do app). `type` não é enum da lib.

## O que fica FORA da lib (é do app consumidor)
- Regra "procedimento X exige recursos A+B+CBO Y" (auto-resolução de recursos).
- Reserva transacional atômica no backend; fila/triagem de PA (Manchester); PACS/RIS; pacotes/séries de
  sessões como entidade de negócio. A lib só agenda/renderiza/valida conflito visual; oferece os **ganchos**
  (múltiplos recursos, capacidade, buffer, escala) para o app implementar essas regras.

## Impacto no plano
- Move **Timeline/Resource view** e o **modelo de Recurso** de "backlog" para uma **fase própria**
  (ver `02-PLANO.md`, Fase 3B). O núcleo (tipos, store, constraint) já deve nascer "resource-aware"
  desde a Fase 1 para não exigir refação — `resourceIds` e `CalendarResource` entram nos tipos base.
