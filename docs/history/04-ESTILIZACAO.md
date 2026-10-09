# Decisão de apresentação e geometria

Registro de engenharia. A [seção de tema da API](../pt-BR/api.md#tema) e [styles.css](../../styles.css) definem a utilização e os tokens atuais.

## Separação de responsabilidades

Posição, altura, largura e escala dos eventos fazem parte da geometria necessária para representar os intervalos. Cores, bordas, fontes e estados visuais pertencem ao tema CSS opcional.

O CSS de `examples` personaliza somente o site e as demonstrações. O tema distribuído pela biblioteca fica em `styles.css`; uma aplicação pode usar seus tokens ou uma folha própria.

## Pontos de extensão

- `renderEvent` fornece conteúdo React para o cartão; hooks pertencem ao componente retornado.
- `renderDayHeader` permite personalizar o cabeçalho preservando `defaultContent` quando necessário.
- `getDayStyle` aplica decoração por data e recurso; disponibilidade continua definida pelas constraints.
- Atributos `data-mc-*` usados pelos gestos devem ser preservados ao personalizar a apresentação.

## Responsividade

A largura do contêiner determina as adaptações do calendário, inclusive quando ele está dentro de um painel menor que a janela. Uma aplicação pode escolher outras views, mas a biblioteca deve preservar navegação e acesso aos eventos em containers estreitos.

O mês permite cartões com overflow ou seleção compacta por configuração. Cabeçalhos e barras de rolagem precisam manter o alinhamento entre datas, recursos e grade horária.
