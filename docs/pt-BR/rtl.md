# Direção do calendário

Defina `options.direction` explicitamente para espelhar o layout do calendário independentemente do idioma dos rótulos de data. O padrão é `ltr`; um locale árabe ou hebraico não seleciona RTL automaticamente.

```tsx
import { Calendar, monthView, weekView } from '@jacksoncassemiro/calendara';

const views = [monthView, weekView];

export function Schedule() {
  return <Calendar views={views} events={[]} options={{
    direction: 'rtl',
    locale: 'ar',
    timeZone: 'Asia/Riyadh',
  }} />;
}
```

A opção aplica `dir` à raiz do calendário e acompanha mudanças nas opções. A navegação embutida mantém a semântica de período anterior/seguinte e espelha os símbolos das setas. Células do mês, datas do planejamento anual e slots de horário seguem a direção horizontal exibida ao usar as setas do teclado. Cima/baixo mantém o significado vertical. Timelines horizontais leem horários crescentes a partir do início lógico: a borda direita em RTL. A localização dos slots usa essa borda para seleção, movimento e redimensionamento; os eixos verticais continuam avançando para baixo.

O tema distribuído usa posicionamento lógico para colunas, faixas de eventos e controles horizontais. Rolagem horizontal e cópias fixas dos cabeçalhos preservam o sinal do deslocamento nativo e usam retângulos físicos da área visível para recorte. Estilos do consumidor, views próprias, toolbars próprias e conteúdo de `renderEvent` também devem usar propriedades lógicas como `inset-inline-start`, `padding-inline` e `text-align: start`. Evite impor posições físicas com `left` em elementos que acompanham o eixo de tempo.

A direção não traduz os textos do editor ou os rótulos da toolbar para árabe/hebraico. O editor embutido oferece português e inglês; use seu próprio editor para idiomas adicionais. O conteúdo da aplicação pode precisar de `dir="auto"` ou `<bdi>` em títulos com direções misturadas. Impressão, cada renderer próprio, dispositivos físicos de toque, Safari e leitores de tela exigem validação por cenário; definir a direção não certifica cobertura completa de acessibilidade RTL.
