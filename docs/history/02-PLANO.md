> Engineering archive / Arquivo de engenharia. Consulte os guias públicos EN/PT para o contrato atual.

# Plano de desenvolvimento

O plano segue especificação, implementação e validação por fatias. Consulte [tarefas e evidências](../../specs/calendar-remediation/tasks.md). O [snapshot 0.1.0](status-0.1.0.md) descreve somente aquela versão.

## Fluxo

1. Descrever o cenário, o problema e os critérios de aceite.
2. Definir o contrato público e exemplos de uso.
3. Implementar a menor alteração coerente com esse contrato.
4. Validar a integração existente e reproduzir o comportamento no navegador quando necessário.
5. Atualizar documentação, mudanças e estado da tarefa com evidências reais.

## Áreas

- API React: seleção de views, estado inicial, callbacks e formulários próprios.
- Dados: recorrência, fusos, identidade de ocorrências e fontes remotas.
- Interação: seleção, movimento, redimensionamento, recusa e arraste externo.
- Recursos: disponibilidade, capacidades, buffers e múltiplas associações.
- Interface: densidade, overflow, cabeçalhos fixos, responsividade e tokens.
- Manutenção: nomes claros, responsabilidades, duplicações comprovadas e arquivos sem uso.
- Publicação: pacote verificável, documentação bilíngue e release reproduzível.

Funcionalidades candidatas ficam no backlog até terem cenário, contrato e validação definidos. Testes em viewport pequeno não substituem testes físicos em dispositivos e tecnologias assistivas.
