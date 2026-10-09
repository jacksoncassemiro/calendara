# Calendara 0.2.0

Scope: release the completed audit/API changes, extended views, printing, mobile/sticky repairs, focused examples and recurrence/fallback optimization through protected GitHub Releases.

Breaking change: contextual utility/controller operations use named input objects; positional overloads are removed. The independent consumer must call applyEventTimeChange({ events, change }).

Native Temporal remains preferred; temporal-polyfill 1.0.5 is the sole production fallback. Former providers remain development comparison oracles. No registry publication, published-archive replacement or history rewrite.

Flow: validated feature PR → develop → release/0.2.0 → main; synchronize release changes back to develop. Existing tag/version/changelog must match. Draft creation remains isolated behind the release environment; verify checksum and independent installation before publishing.

Português: publicar a versão com contratos nomeados, views adicionais e correções validadas. Preservar o fluxo protegido, conferir tag/pacote/changelog/checksum e instalar no consumidor antes de publicar; sem substituir releases antigas ou reescrever histórico.
