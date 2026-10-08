# Tema padrão e documentação dos contratos

## Evidência e direção

O screenshot `output/layout-review/external-drag-react-preview.png` mostra controles do playground ocupando mais destaque que a agenda, toolbar densa e pouca hierarquia entre dias, horários e eventos. Essa observação é visual; não constitui estudo de usabilidade com participantes.

`styles.css` é o tema padrão distribuído em `@meucalendario/calendar/styles.css`. Usa classes `mc-*` e tokens `--mc-*`, com escopo de calendário. A aplicação pode personalizar tokens. `examples/react-playground.css` é CSS externo da demonstração: página, controles e dialog. A geometria temporal é calculada no código e aplicada inline; trocar cores ou fontes não deve modificar intervalos de tempo.

Direção: agenda operacional, adequada a recepção/profissionais e uso pessoal. Superfície branca, divisórias discretas, texto legível, destaque na data/ação selecionada; nenhum font externo, efeito decorativo ou sequência de cards. Recursos clínicos não recebem regras de negócio fixas. Referência: [Impeccable](https://github.com/pbakaus/impeccable), com processo de crítica e iteração visual; habilidades locais `frontend-design` e `design-critique` aplicadas.

Paleta proposta: branco `#ffffff`, superfície `#f8fafc`, texto `#223246`, secundário `#59677b`, divisória `#dce3eb`, ação `#1959b3`. Fonte do sistema/Segoe UI; números de horário tabulares. Hierarquia da toolbar, datas, eventos e foco deve facilitar leitura da agenda, sem transformar densidade em decoração.

## Critérios de aceite

- Tema padrão útil sem CSS externo do playground.
- Tokens existentes continuam personalizáveis; cor de evento fornecida pelo usuário preservada.
- Nenhum estilo de calendário vaza para o host; CSS externo da demo fica identificado.
- Grid temporal, margem de interação, alças, scroll horizontal e headers fixos preservados.
- Verificar desktop e 320/375px, eventos curtos/densos e labels extremos; inspecionar screenshots.
- Sem adicionar dependência de Tailwind ou trocar para CSS Modules nesta fatia.

## JSDoc bilíngue

É útil nos contratos públicos que aparecem no autocomplete. Adotar resumo em inglês e `@remarks Português:` para as regras relevantes, com `@param`/`@returns` apenas quando esclarecem intenção. Não traduzir identificadores nem repetir o tipo em prosa. Documentação de uso permanece em português e pode receber tradução própria.

Não duplicar todos os comentários internos: aumenta ruído e cria duas versões que podem divergir. Na revisão de cada módulo, remover comentários históricos incorretos e explicar intenção/regras em um idioma consistente. O contrato deve ter uma única verdade na tipagem/testes, e as descrições bilíngues precisam expressar a mesma regra.

Comentários mantidos devem ser diretos e breves. Preferir uma frase por idioma; explicar intenção, unidade ou limite somente quando necessário. Evitar repetir o nome/tipo ou narrar o código.

Prioridade nesta fatia: props iniciais versus requests, seleção de views, callbacks e persistência, validação, recursos e extensão React. Depois expandir de modo incremental aos contratos restantes do core; evitar uma tradução massiva sem revisão semântica.
