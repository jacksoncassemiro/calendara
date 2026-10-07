# Auditoria de segurança e comportamento — 07/10/2026

Escopo: biblioteca TypeScript/React, demo local, dependências e execução das interações. Não há backend, autenticação ou autorização implementados neste repositório. Esta revisão não comprova segurança de aplicações consumidoras.

## Resultado

`yarn verify`: 270 testes em 22 arquivos, tipos, builds e consumo do tarball único por ESM/CJS/TypeScript aprovados. `yarn test:browser`: 29 verificações no Edge e 18 combinações de view/largura, sem erros de execução registrados. `yarn audit:dependencies`: zero advisories conhecidos no scan de 07/10/2026 às 20:31 UTC, 162 dependências contabilizadas pelo Yarn. Evidência gerada: `output/security/dependency-audit.json`.

## Achados corrigidos

| ID | Severidade | Evidência / risco | Correção |
|---|---|---|---|
| SEC-01 | Alta | Ferramentas antigas de desenvolvimento tinham advisories de execução de código/leitura de arquivos. Não era uma vulnerabilidade comprovada no bundle publicado. | Vite 8.3.3 e Vitest 5.0.3, lockfile Yarn atualizado; novo scan sem advisories conhecidos. |
| SEC-02 | Média | RRULE externo aceitava campos desconhecidos ou valores inválidos, com risco de resultado incorreto e processamento excessivo. | `src/core/recurrence/parser.ts:27`: validação de strings e modelos, limite de 4096 caracteres, rejeição de campos não suportados. `engine.ts:50`: orçamento de períodos com erro explícito; filtros impossíveis de mês/dia retornam vazio. |
| BUG-01 | Média | Resultados de eventSource podiam sobrescrever estado mais recente; dois commits rejeitados podiam restaurar uma versão otimista anterior. | Tokens de fetch e invalidação em `setEvents`; cadeia de rollback em `src/react/app/calendarApp.ts:747`, com testes de rejeições concorrentes e edições independentes. |
| BUG-02 | Média | Atualizações de props provocavam trabalho redundante e buscas intermediárias; recursos capturados pelas fábricas de views ficavam desatualizados. | Atualizações agrupadas e comparação de dados imutáveis; contexto de recursos atual para Recursos/Timeline; testes de integração de slots, recursos e buscas. |

Os advisories de ferramentas incluíam [Vitest API](https://github.com/advisories/GHSA-9crc-q9x8-hgqq), [Vitest UI](https://github.com/advisories/GHSA-5xrq-8626-4rwp), [Vite no Windows](https://github.com/advisories/GHSA-v6wh-96g9-6wx3) e [esbuild dev server](https://github.com/advisories/GHSA-67mh-4wv8-2f99). A migração de configuração segue o [guia oficial do Vite](https://vite.dev/guide/migration).

## Limites e responsabilidades

- Não foram encontrados sinks `dangerouslySetInnerHTML`, `eval`, `new Function` ou inserção de HTML bruto nas fontes da biblioteca. Títulos são conteúdo React. Slots personalizados executam código do consumidor; essa aplicação deve evitar HTML não confiável, conforme a [documentação React](https://react.dev/reference/react-dom/components/common#dangerously-setting-the-inner-html). A inspeção não equivale a pentest ou fuzzing.
- Constraints/capacidade no cliente são regras de interface. O servidor consumidor deve repetir autorização e validação do agendamento, inclusive em gravações concorrentes. Rollback otimista não implementa transação entre clientes.
- RRULE tem subconjunto explícito, não conformidade completa com RFC 5545. O orçamento limita períodos; não estabelece um SLA de CPU para eventos ou janelas arbitrariamente grandes. Para dados externos, restrinja volume e janela também na aplicação.
- Props devem ser imutáveis. Comparação de dados evita atualização equivalente, mas não detecta mutação feita sobre o mesmo objeto já armazenado. Callbacks diferentes continuam sendo mudanças relevantes.
- Gestos multiday/all-day e editor reutilizável foram adicionados e exercitados no Edge. Navegação completa por células, ergonomia touch em dispositivos reais e calendário preenchido em SSR continuam pendentes. Não há paridade completa com concorrentes.
- O iterador civil de datas gregorianas foi adotado após comparação diferencial. O protótipo completo de eventos sem Temporal permanece experimental. Passou em 50 cenários, 13 integrações e um cenário no Edge sem Temporal global. Falta uma política validada para DST fold/gap e entradas extremas; [relatório e medições](../experiments/civil-recurrence/REPORT.md).

## Reprodução

```sh
yarn verify
yarn test:browser
yarn audit:dependencies
node experiments/civil-recurrence/validate.mjs 10
```

Os testes de navegador geram screenshots em `output/playwright`. Edge em larguras móveis verifica layout; não substitui testes em Safari/iOS ou Android. Publicação no registry e implantação não foram executadas.
