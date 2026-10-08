# Histórico de mudanças

[English](CHANGELOG.md). Versões seguem SemVer. Datas em YYYY-MM-DD.

## [Unreleased]

Sem alterações após a base preparada para 0.1.0.

## [0.1.0] - 2026-10-08

Candidato à primeira release; ainda não publicado.

### Adicionado

- Calendário React nativo, views selecionáveis/próprias, recursos e capacidade/regras por recurso.
- Recorrência, exceções, edição de ocorrência/série/seguintes e callbacks de persistência assíncrona.
- Arraste/redimensionamento, prévias, popovers de excesso e arraste externo opcional.
- Validação compartilhada com editor, callbacks de navegação/loading/erro e fontes remotas canceláveis.
- Layout responsivo, cabeçalhos fixos no scroll da página, tema padrão e API documentada em dois idiomas.
- CI GitHub e empacotamento manual de draft release com SHA-256; licença MIT.
- Site de API/demo bilíngue com busca para GitHub Pages, skill de revisão e checagem Prettier.
- Temas claro/escuro/sistema persistentes no site e playground, com playground/editor em inglês e português.
- Cenários demonstráveis e comparação reproduzível de bundles visível; exemplo Resumo aprimorado.
- Painéis de modelos de entrada e arquivo externo com persistência controlada pelo consumidor.
- Auto-scroll nos gestos usa o scroll existente; desative com `autoScroll: false`.

### Corrigido

- Data inicial no fuso configurado e seleção da data no mês compacto.
- Buscas remotas desnecessárias ao mudar views inativas ou sua ordem.
- Reset de opções declarativas, composição de regras e validação de todos os recursos do evento.
- Prévia de arraste externo ao entrar pela primeira vez na faixa de dia inteiro.
- Geometria dos cabeçalhos/dia inteiro/horários/recursos e divisões mais claras durante o scroll.
- Início de arraste externo por ponteiro e acesso à área de saída no playground.
- Compatibilidade de dependências: fallback Temporal 0.5.1, React de desenvolvimento 19.3.0 e jsdom 30.1.2.
- Views obrigatórias removem registro automático e melhoram a eliminação de código não usado.

### Limites conhecidos

- Runtime validado: React 19/Edge. Safari/mobile físico e leitores de tela ainda precisam de validação.
- Sem persistência automática, RFC 5545 completo, exportação ICS, virtualização ou timeline de recursos de vários dias.
- Nenhuma release foi enviada; URLs de instalação só funcionam após o mantenedor publicar o draft.
