# Radar — preparação para produção (#542)

A ponte da #539 identificava a origem como `production` e bloqueava a importação mesmo na aplicação de produção. O modo somente leitura agora depende da combinação entre origem do catálogo e ambiente da sessão: homologação lendo produção fica sem seleção/importação; produção usando o próprio catálogo preserva a importação com cache completo. Configuração ausente mantém a restrição para dados remotos de produção.

A promoção também habilita a consulta explícita dos documentos em produção, sem habilitar fallback de metadados, coletor Edge ou worker antigo. O backend já fornece a ação autenticada de documentos. O teste de isolamento do build verifica essa configuração.

As fixtures E2E foram alinhadas ao contrato de `radar-details` de #539, com caminhos separados para detalhes, status e documentos. Dois cenários de navegador cobrem a restrição em homologação e a importação nativa em produção usando apenas dados fictícios locais.

Esta PR é para homologação. Ela não publica produção e não representa aprovação dos gates da release.
