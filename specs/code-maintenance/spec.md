# Named inputs and contract documentation

## Contract

Utilities with multiple contextual inputs accept one named object. Internal callers, examples and tests use that single contract. Positional overloads and compatibility adapters are removed.

Date utility methods are included in the review, along with standalone functions, callbacks and method signatures. Unary conversions and conventional binary comparisons retain their direct inputs. Custom-view navigation receives a named object.

Necessary JSDoc is concise in English and Portuguese. Input fields explain meaning, units and optional defaults. Public documentation describes reusable integration guidance rather than conversation or approval history.

## Validation

`yarn audit:contracts` rejects implementations and method/function contracts with three or more positional parameters, checks exported interface member documentation and flags narrative comments missing Portuguese. Two-argument helpers are reviewed manually: standard comparators, assertions, language pairs and externally prescribed callbacks keep their direct inputs. Generated API documentation checks both languages independently.

`yarn verify` validates types, behavior, package consumption and the documentation build. Browser scenarios validate interactions and layout separately.

## Contrato em português

Utilitários com várias entradas contextuais recebem um único objeto nomeado, usado nas chamadas internas, exemplos e testes. Sobrecargas posicionais e adaptadores de compatibilidade são removidos. A revisão inclui métodos retornados por fábricas, funções, callbacks e assinaturas de métodos.

Conversões unárias e comparações binárias convencionais mantêm seus contratos. Navegação de views próprias recebe um objeto nomeado. JSDoc necessário é curto, em inglês e português, com significado, unidades e padrões dos campos. A documentação pública contém orientações de integração reutilizáveis.

A auditoria gera um inventário para classificação manual; a validação integrada cobre tipos, comportamento, consumo do pacote e site. Testes de navegador verificam interações e layout separadamente.

## Migration coverage / Cobertura da migração

- Core expansion, recurrence, constraints, geometry, occupancy and resource-column builders use one input object. / Expansão, recorrência, restrições, geometria, ocupação e montagem de colunas de recursos usam um objeto de entrada.
- Date methods with contextual inputs, custom-view navigation and gesture normalization have one contract. / Métodos de data com entradas contextuais, navegação de views próprias e normalização de gestos possuem um contrato único.
- Rendering helpers, test fixtures and browser scenario helpers use the same named-input convention. / Helpers de renderização, fixtures de teste e cenários de navegador seguem a mesma convenção de entradas nomeadas.
- Existing release assets remain unchanged; these source-contract changes require the next version's migration notes. / Artefatos já publicados permanecem intactos; as mudanças de contrato exigem notas de migração na próxima versão.

## Validation record / Registro de validação

2026-10-08: `yarn verify` passed 351 tests in 33 suites, type checks, package build/consumption and site build. `yarn test:browser`, `yarn format:check`, `yarn check:publication` and `git diff --check` passed. Contract audit reported zero undocumented exported interface members, zero signatures/implementations with three or more positional parameters and zero narrative source comments missing Portuguese.

2026-10-08: `yarn verify` aprovou 351 testes em 33 suítes, tipos, construção/consumo do pacote e construção do site. Navegador, formatação, metadados de publicação e checagem do diff passaram. A auditoria registrou zero membros de interfaces exportadas sem JSDoc, zero contratos/implementações com três ou mais parâmetros posicionais e zero comentários narrativos do código sem português.
