# Histórico de mudanças

[English](CHANGELOG.md). Versões seguem SemVer. Datas em YYYY-MM-DD.

## [Unreleased]

- Adiciona recursos hierárquicos e virtualização vertical da timeline, preservando capacidade fora da tela, foco/gesto ativos e dados de impressão.
- Adiciona desfazer/refazer do consumidor com persistência assíncrona e importação/exportação ICS estrita com diagnósticos.
- Suporta sete frequências de recorrência e filtros BYWEEKNO/de horário; rejeita combinações inválidas, incluindo COUNT com UNTIL (mudança de validação incompatível).
- Adiciona direção explícita, coordenadas espelhadas e scroll fixo; amplia regressões de touch simulado.
- Organiza 27 exemplos focados em um catálogo pesquisável, com demonstrações de histórico, ICS e timeline hierárquica/RTL.
- Contém títulos no planejamento anual, esclarece preparo versus bloqueio fixo, separa labels de recursos fixos e mantém o indicador de horário abaixo do eixo.
- Oculta scrollbar horizontal duplicado quando o controle superior sincronizado está ativo.
- Compartilha exemplos com destaque e cópia de código e amplia a comparação de integração EN/PT.

## [0.2.0] - 2026-10-09

### Adicionado

- Colunas de recursos em vários dias, timelines agrupadas por recurso em períodos diário/semanal/mensal, painéis de vários meses/ano/trimestre e planejamento anual; views registradas explicitamente.
- Agenda imprimível do período visível e saída PDF nativa do navegador, independente do recorte de recursos renderizado.
- Contratos com entradas nomeadas nos utilitários do núcleo e na navegação de views próprias; sobrecargas posicionais e adaptadores de compatibilidade removidos (mudança incompatível).
- Auditoria de contratos e referência gerada EN/PT abrangem controlador, editor e tipos de integração de views próprias.

- `renderDayHeader` personaliza cabeçalhos de dias/recursos preservando o conteúdo padrão; decoração do dia responde aos dados da API do consumidor.
- Scrollbar horizontal sincronizada acima de grades de horários e timelines com transbordamento.

### Corrigido

- Recorrência usa o iterador civil existente com uma implementação Temporal injetada; o motor anterior permanece apenas como referência de desenvolvimento. O bundle de consumidor Mês + Dia diminui de 146.041 para 70.925 bytes gzip na comparação com versões fixadas.
- Catálogos duplicados da API e ferramentas de migração pontual retirados; registros de engenharia preservam decisões e cenários neutros.
- Deslizar por toque faz scroll sem exibir brevemente um gesto; segurar habilita movimentos intencionais.
- Rótulos de dia inteiro permanecem alinhados ao eixo de horários durante scroll da página e horizontal.
- Semanas do mês com limite de eventos têm altura uniforme; ver mais cabe nas células estreitas e o número de hoje usa destaque compacto.
- Cores do exemplo de estados do dia funcionam nos dois temas. Exemplos focados exibem a configuração aplicada e a fonte da view própria.
- Guias de publicação contêm instruções reutilizáveis, sem histórico de conversa ou aprovação.

## [0.1.1] - 2026-10-08

### Adicionado

- Limite compacto do mês configurável pela largura do calendário (`monthCompactBreakpoint`, padrão `false` mantém cartões; uma largura habilita).
- Exemplos focados com código de integração e contêiner redimensionável; playground geral preservado.
- Índice da documentação separa guias públicos dos registros de engenharia arquivados.

### Corrigido

- Navegação compartilhada entre documentação/playground, toggles compactos de idioma/tema e link de retorno funcional.
- Contraste do editor escuro; buffers de preparação diferenciados dos bloqueios fixos.
- Arrasto de saída mantém a captura do ponteiro e exibe um cartão flutuante fora da grade; retorno e cancelamento removem a prévia.
- Mês compacto distingue hoje, a data selecionada e os marcadores de ponto/quantidade de eventos, usa células menores e mantém cartões em larguras intermediárias.

A versão 0.1.0 foi retirada a pedido do mantenedor durante o reinício do histórico. Instale a 0.1.1 pelo asset da release.

## [0.1.0] - 2026-10-08

Primeira release experimental sob licença MIT.

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
- Pacotes publicados são imutáveis; documentação/playground podem receber deploys separados.
