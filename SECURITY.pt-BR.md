# Política de segurança

[English](SECURITY.md)

## Relato privado

Use [relato privado de vulnerabilidades no GitHub](https://github.com/jacksoncassemiro/calendara/security/advisories/new) quando habilitado. Informe versão, reprodução, impacto e exemplo mínimo sem dados reais de pacientes/usuários. Se o canal privado estiver indisponível, abra issue solicitando contato privado, sem publicar exploração. Ainda não há prazo de resposta ou garantia formal de versões suportadas.

## Limites do consumidor

Calendara é uma biblioteca cliente, não um serviço de autorização ou agendamento transacional. Valide permissões, entradas, regras e capacidade concorrente no servidor. Trate eventos remotos como dados não confiáveis. Texto React escapa títulos; renderizadores próprios devem evitar HTML/URLs inseguros. Não exponha segredos em metadados, bundles ou exemplos.

Em fontes remotas, repasse AbortSignal e trate falhas. Cancelamento impede resultado obsoleto na interface, mas não desfaz gravação no servidor. Defina persistência/rollback para edições e arraste externo. Use janela finita ao expandir recorrência ilimitada. Revalide todos os recursos atribuídos antes de confirmar reserva.

## Build e release

CI usa token somente de leitura; apenas o job de rascunho recebe escrita no repositório. A release valida tag existente/versão, ancestralidade de main, pacote, interações no browser e checksum. Configure proteção de branches e revisores do environment no GitHub. Não execute código não confiável de contribuidor com segredos de produção nem use `pull_request_target` para compilar seu checkout.

Instale um asset de versão fixa e preserve `yarn.lock`. Confira `SHA256SUMS`; checksum e pacote compartilham a mesma fronteira de publicador, portanto checksum isolado não prova procedência. Execute `yarn audit:dependencies` e revise o relatório antes da release. Ausência de avisos conhecidos não comprova inexistência de vulnerabilidades.
