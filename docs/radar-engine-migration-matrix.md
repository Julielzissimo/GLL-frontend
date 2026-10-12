# Matriz de migração do Radar Engine

Esta matriz registra a adaptação da Fase 9 e os pontos que dependem da validação do Radar Engine na VPS. A leitura da interface usa apenas as tabelas já publicadas no Supabase. Os coletores e agendamentos existentes permanecem ativos até a integração da VPS ser confirmada em homologação.

## Estado atual e transição

| Fluxo ou componente | Estado nesta entrega | Próxima ação após validar a VPS |
| --- | --- | --- |
| `radar-search` e `radar_licitacoes` | Mantidos. A pesquisa e os filtros existentes continuam usando os editais persistidos. A ação explícita de atualizar cobertura continua disponível enquanto os coletores antigos forem necessários. | Substituir a atualização de cobertura pelo endpoint autenticado da VPS e comparar a cobertura sincronizada. |
| `radar-collector` e rotina de coleta PNCP | Mantidos e sem alterações. A coleta segue responsável pela cobertura atual enquanto a VPS ainda não está integrada ao GLL. | Desativar a função e seus agendamentos somente após validar coleta incremental, sincronização e observabilidade da VPS em homologação. |
| `radar-details` — ação `details` | Retirada do caminho de abertura e atualização normal do edital. Pode ser chamada somente por ação explícita quando `GLL_RADAR_DETAILS_FALLBACK_HOMOLOG=true`; o padrão é `false`. A chamada antiga também pode enfileirar sincronização de itens. | Remover a contingência depois de comprovar o fluxo de sincronização da VPS e a leitura integral do cache. |
| `radar-details` — ações `documents` e `metadata` | Não são chamadas ao abrir ou atualizar um edital. A consulta de documentos só aparece como ação manual quando a flag de contingência está ligada. A interface não consulta metadados externos. | Encaminhar documentos e metadados à VPS, se isso fizer parte do contrato aprovado, ou manter os documentos fora desta tela. |
| `radar-items-worker` e filas de sincronização de itens | Mantidos no backend atual; esta entrega não altera workers, tabelas, RPCs ou agendamentos. A abertura do edital não cria uma tarefa. | Desativar o worker e o agendamento apenas depois de validar na VPS paginação, publicação atômica, retomada e reprocessamento. |
| `radar-import` | Mantido para preservar a importação transacional. A função ainda consulta detalhes e itens do PNCP quando a pessoa confirma uma importação; essa ação explícita fica fora da abertura e atualização normal do edital. | Trocar a consulta de origem pelo snapshot publicado no cache e validar seleção, deduplicação e vínculos antes de retirar a dependência externa. |
| `radar_itens_sync` e `radar_itens` | Mantidos como cache. O frontend lê `radar_itens_sync` com a sessão autenticada e busca somente `radar_itens.versao_sincronizacao` publicada. RLS continua limitando a leitura a usuários GLL e à versão publicada. | Preservar as tabelas como persistência/consulta do GLL; mudar apenas o produtor para a VPS conforme contrato validado. |
| Identificação e confirmação de plataforma | Mantidas. A tela lê a classificação armazenada e continua permitindo a confirmação existente de Administrador. Nenhuma classificação é recalculada ao abrir o edital. | Mover a classificação automática para a VPS; manter a confirmação manual com autorização do GLL, caso continue necessária. |
| Importação para edital, orçamento e propostas | Mantida. A seleção/importação continua usando o fluxo existente e a identidade dos itens do edital. | Validar que o payload sincronizado pela VPS preserva os mesmos identificadores e os dados usados por orçamentos e propostas. |
| Indicadores administrativos do Engine | Não incluídos. O repositório da VPS consultado nesta fase declara que o endpoint autenticado, o worker PNCP e o adaptador de sincronização com o GLL ainda não estão implementados; não há fonte protegida validada para indicadores operacionais. | Criar indicadores simples após existir um endpoint protegido e estável com estado, última sincronização e falhas. |

## Verificações necessárias antes de desligar coletores antigos

1. Validar em homologação a autenticação do endpoint VPS, o contrato de payload e a autorização de gravação no Supabase.
2. Confirmar sincronização incremental e idempotente de editais, plataformas e itens, incluindo retomada após falha e publicação de versões completas.
3. Comparar a cobertura da VPS com os dados existentes e verificar logs de sucesso, atraso e falha.
4. Validar pesquisa, filtros, favoritos, confirmação de plataforma, importação de itens, orçamentos e propostas.
5. Preparar mudança versionada e reversível para pausar cron, fila e workers antigos; confirmar que nenhum caminho automático do Supabase consulta o PNCP.
6. Publicar e validar a homologação depois de cada mudança que afete código implantável.

Até esses pontos serem confirmados, coletores e agendamentos do Supabase não devem ser removidos nem desativados. Esta matriz não atualiza a especificação técnica de produção.
