# GLL Radar Engine — contrato necessário ao painel administrativo

**Estado:** proposta de integração; as capacidades abaixo não são rotas implantadas.  
**Atualizado:** 18/10/2026  
**Escopo:** especificar o que falta para habilitar dados detalhados e operações sem criar chamadas para endpoints inexistentes.

## Contratos existentes da Tarefa 4

A documentação de observabilidade v1 do GLL Radar Engine descreve:

- **GET /health/live** — saúde do processo HTTP.
- **GET /health/ready** — prontidão do runtime e do PostgreSQL.
- **GET /metrics** — formato Prometheus.
- **GET /api/internal/v1/metrics** — JSON com schemaVersion, generatedAt e famílias de métricas; cada amostra contém nome, labels e valor.
- **X-Correlation-ID** — identificador de correlação da resposta e dos logs.

As métricas são agregadas. O contrato não inclui IDs de edital, payloads nem labels derivados de URL. Métricas ausentes significam “indisponível”, não zero. Counters e histograms do processo reiniciam com o processo; sua leitura não substitui um histórico durável.

Essas rotas não têm autenticação de usuário e devem ficar em rede interna controlada. O navegador GLL não as consulta diretamente. O painel exige uma integração server-side que autentique o usuário, verifique a função Administrador e alcance o Engine pela rede autorizada. Nenhuma credencial de serviço pode ser entregue ao navegador.

## Proposta de contrato do gateway administrativo — não implementada

Esta é a especificação necessária para integrar o painel. O caminho abaixo é **proposto**, não consta nos contratos existentes e não é chamado pelo frontend nesta branch.

### Transporte e autenticação

- `POST /functions/v1/radar-engine-admin-v1` no backend GLL.
- Corpo JSON com `schemaVersion: "1.0"` e um `operation` fechado. Não aceitar URL, SQL, nomes de host, labels livres nem comandos de shell.
- Exigir `Authorization: Bearer <sessão GLL>`; validar a sessão no servidor, consultar `app_users` por `auth_user_id` e exigir `role = "Administrador"`. Não confiar em papel vindo do bundle, `user_metadata` nem payload enviado pelo navegador.
- A função consulta o Engine apenas pela URL privada configurada no servidor. Se a URL não estiver configurada ou o Engine não estiver acessível, responder indisponível sem revelar host ou segredo.
- `metrics.read` pode chamar apenas os três GETs de saúde/métricas documentados pela Tarefa 4. Os outros `operation` abaixo dependem de contratos novos do Engine e não devem ser habilitados antes da implementação correspondente.
- Retornar `correlationId` em sucesso e erro. Não repassar corpo bruto de erro do Engine, credenciais ou stack trace.

### Leitura de métricas

Requisição:

```json
{"schemaVersion":"1.0","operation":"metrics.read"}
```

Resposta `200`:

```json
{
  "schemaVersion":"1.0",
  "generatedAt":"2026-10-18T12:00:00Z",
  "correlationId":"<uuid>",
  "health":{"live":{"status":"ok"},"ready":{"status":"ok"}},
  "metrics":{"schemaVersion":"1.0","generatedAt":"2026-10-18T12:00:00Z","metrics":[]}
}
```

O gateway preserva as métricas documentadas e seus tipos; não transforma ausências em zero. Códigos esperados: `400` operação ou versão inválida, `401` sessão ausente/inválida, `403` perfil sem permissão, `429` limite excedido, `502` resposta inválida do Engine e `503` Engine indisponível. Mensagens externas devem ser genéricas.

### Operações detalhadas e administrativas necessárias

Os nomes abaixo são propostas para o campo `operation`, não status ou rotas já existentes. No contrato T4, estados de job são `queued`, `running`, `succeeded` e `failed`; revisão não é um estado de job. A UI só poderá apresentar “em revisão” quando um contrato do Engine definir como essa tentativa é contada. Os schemas definitivos devem ser revisados com o contrato de jobs do Engine antes de implementação.

| Operação proposta | Entrada mínima | Saída mínima |
| --- | --- | --- |
| `queues.list` | filtros opcionais `kind`, `status`, `priority`; cursor opaco e `pageSize` limitado pelo servidor | jobs paginados com identificador opaco, tipo, prioridade, estado, criação, última atualização, tentativas, próxima revisão e código de erro sanitizado |
| `queries.list` | cursor opaco e janela temporal limitada pelo servidor | registros por consulta com endpoint fixo, instante, duração, status/categoria, registros retornados, tentativas e código de erro sanitizado |
| `tenders.list` | cursor opaco, estado parcial/completo/falha e filtros documentados | identificador PNCP, estado dos itens, timestamps e versão de snapshot; sem payload completo |
| `tenders.lookup` | `pncpId` validado | resultado persistido resumido e histórico sanitizado do edital |
| `workers.list` | sem filtro livre; paginação se aplicável | identificador opaco, heartbeat, estado, tipo de tarefa e início da tarefa corrente |
| `collection.preview` / `collection.execute` | chave de idempotência; execução vinculada a prévia ainda válida | estimativa, estado da operação e resumo aceito/ignorado |
| `failures.preview` / `failures.execute` | chave de idempotência e seleção validada com máximo configurado | estimativa e contagens de jobs aceitos/ignorados |
| `reconciliation.preview` / `reconciliation.execute` | período válido dentro do máximo configurado, chave de idempotência e confirmação vinculada à prévia | estimativa, estado da operação e resumo aceito |
| `operations.get` | `operationId` opaco | estado, horários, resumo sanitizado e `correlationId` |

As operações de coleta, reprocessamento e reconciliação precisam de prévia seguida de confirmação explícita. A confirmação deve estar vinculada ao ator, parâmetros e expiração; execução duplicada deve responder conflito sem enfileirar outro job. O gateway aplica rate limit por ator/operação e limite de intervalo, paginação e tamanho configurados no servidor.

### Auditoria e dependências

Cada ação manual grava evento append-only antes da execução e atualiza o resultado ao concluir: ator autenticado, operação, parâmetros sanitizados ou hash, instante, resultado, `correlationId` e chave de idempotência. O armazenamento e a política de retenção da auditoria ainda precisam ser definidos no backend. Nenhuma migration, tabela ou função de banco é criada por esta entrega.

O Engine precisa implementar e publicar os contratos para filas detalhadas, histórico PNCP, editais, workers e comandos antes de o gateway encaminhar essas operações. Enquanto isso, somente `metrics.read` pode ser implementada, após confirmar que as rotas T4 estão no OpenAPI publicado e acessíveis em rede privada a partir do backend.

### Estado de verificação em 18/10/2026

A documentação observability-v1.md e as alterações correspondentes foram encontradas no worktree da Tarefa 4, ainda com arquivos modificados ou não rastreados. Não havia evidência de que o contrato JSON estivesse incorporado em origin/homologacao nem de que estivesse publicado. O openapi.yaml consultado não listava as rotas de métricas, embora observability-v1.md as descrevesse. Portanto, a implementação do painel não presume disponibilidade operacional do endpoint JSON.

## Capacidades administrativas que faltam

A Tarefa 4 não define dados individuais nem mutações administrativas. As operações abaixo são requisitos propostos para um gateway protegido; ainda não têm host, caminho HTTP ou implementação. O painel não envia chamadas para elas.

| Capacidade | Dados mínimos necessários |
| --- | --- |
| Visão de workers | Estado de prontidão, heartbeat, início da tarefa corrente, tipo de tarefa e atraso. Identificadores devem ser estáveis e não revelar hosts ou segredos. |
| Listagem de filas | Cursor, tipo, prioridade, estado, criação/atualização, tentativas, próxima revisão, duração e código de erro sanitizado. Estados devem refletir os enums reais do Engine, inclusive distinguir falha persistente de execução em revisão. |
| Histórico de consultas PNCP | Endpoint fixo, início, duração, categoria/status HTTP, registros retornados, número da tentativa, limite de tentativas e código de erro. Não registrar URLs livres, cabeçalhos, corpos ou dados pessoais. |
| Editais e histórico | Identificador PNCP, timestamps, estado dos itens parcial/completo, versão do snapshot, job relacionado e erro sanitizado. Paginação obrigatória. Valores sigilosos e payloads completos não devem ser retornados. |
| Coleta incremental | Solicitação limitada aos escopos permitidos, deduplicação por chave de idempotência e resumo do trabalho aceito. |
| Reprocessamento de falhas | Seleção validada, limite máximo de jobs por solicitação, preservação do histórico e resposta com contagens aceitas/ignoradas. |
| Consulta de licitação | Validar o identificador PNCP e retornar um resultado do processamento persistido; não aceitar URL, SQL ou caminho arbitrário. |
| Reconciliação de período | Intervalo máximo configurável, estimativa de impacto antes da confirmação, chave de idempotência e estado consultável da operação. |
| Auditoria | Registro append-only com ator, organização/contexto autorizado, ação, parâmetros sanitizados ou hash, instante, resultado, correlation ID e chave de idempotência. |

O contrato final deverá declarar schemas versionados, paginação, enums, limites, erros e compatibilidade. Não se deve traduzir comandos CLI em endpoints sem contrato e autorização explícitos.

## Segurança obrigatória do gateway

- Validar a sessão GLL no servidor e recusar usuários sem perfil ativo ou sem papel Administrador.
- Manter o Engine em rede interna; o gateway é o único consumidor das rotas internas.
- Guardar credenciais de serviço em secret store server-side. Nunca expor token, endereço interno ou chave HMAC no bundle web.
- Aplicar autorização e rate limiting por ator e operação no servidor.
- Exigir chave idempotente para mutações e devolver conflito explícito para duplicidade ou operação incompatível em andamento.
- Exigir prévia de impacto e confirmação explícita em coleta/reconciliação/reprocessamento custosos.
- Gravar auditoria antes de executar e atualizar o resultado ao concluir, sem apagar tentativas anteriores.
- Retornar correlation ID e erros tipados, sem stack trace, credenciais, corpo PNCP ou valores sigilosos.
- Não fornecer shell, Docker, acesso SQL, acesso ao banco ou proxy HTTP arbitrário.

## Uso pelo painel nesta entrega

O painel conhece apenas os caminhos de leitura declarados na Tarefa 4 através de uma interface injetável de integração protegida. Nenhuma integração server-side está configurada nesta branch; por isso os números permanecem indisponíveis e os controles ficam desabilitados. Filas agregadas e contadores de chamadas não são apresentados como histórico individual. Os recursos detalhados serão habilitados após aprovação e implementação do contrato do gateway.
