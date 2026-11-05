# Contrato do cliente — Fluxo de Caixa

> **Arquivo histórico:** a release Fluxo de Caixa foi descontinuada em 05/11/2026. As regras e exemplos abaixo descrevem a versão retirada; não são especificação nem backlog para a futura recriação. A retirada foi registrada na [issue #271](https://github.com/Julielzissimo/GLL-backend/issues/271); os dados e objetos de homologação foram apagados pelo [workflow #42033372202](https://github.com/Julielzissimo/GLL-backend/actions/runs/42033372202). `main` e produção não foram alteradas.

**Release:** Fluxo de Caixa — milestone #13, issue [GLL-backend #261](https://github.com/Julielzissimo/GLL-backend/issues/261).
**Estado:** frontend integrado e publicado em `homolog` em 05/11/2026; build, testes, login/isolamento e R2 sintético passaram no [workflow Pages #41955605032](https://github.com/Julielzissimo/GLL-frontend/actions/runs/41955605032). Produção não faz parte do escopo.

## Telas e acesso

- `Faturamento` mantém o razão por edital e os recebimentos por item.
- `Fluxo de Caixa` consolida reservas, redistribuições, retiradas, despesas gerais e ressarcimentos.
- Participantes financeiros e versões percentuais ficam em `Dados da Empresa`.
- Todas as funções financeiras novas são exclusivas de Administradores; o banco verifica perfil, sessão e organização novamente.
- A interface não oferece importação de XLSX. O importador histórico é local e restrito a URL loopback.

## Regras do fluxo

- Alvos e recebimentos novos só são permitidos para editais `Em Fornecimento` e `Faturado` e itens vencedores com vínculo explícito ao orçamento.
- Lucro objetivo é `max((lance final − custo) × quantidade, 0)`. Base do recebimento é bruta e reconhecimento é proporcional ao recebido acumulado.
- O razão `finance_*` é a origem dos recebimentos de Faturamento; triggers projetam recebimentos, ajustes e estornos em `cashflow_*` na mesma transação. O fluxo não duplica o valor recebido no caixa.
- Reservas capturam os percentuais vigentes. Redistribuições exigem justificativa. Retiradas exigem edital e saldo disponível.
- Correção de lucro reconhecido usa o recebimento mais recente e seu snapshot de percentuais; redução só é aceita contra reserva livre.
- Despesa geral tem pagador empresa, participante ou terceiro. Ressarcimento parcial referencia a despesa original e não cria outra despesa.

## Contrato do cliente

```js
import { createCashflowService } from "../../../web/finance-service.js";

const finance = createCashflowService(supabaseClient, {
  getUserRole: () => appState.currentUserRole,
});
const result = await finance.execute("record_expense", {
  payer_type: "participant",
  participant_payer_id: "uuid-ficticio",
  paid_on: "2026-11-04",
  amount: "1200.00",
  description: "Despesa fictícia",
}, finance.newIdempotencyKey());
```

Use strings decimais com no máximo duas casas para dinheiro. Reutilize a mesma chave idempotente ao repetir uma tentativa cujo resultado de rede ficou incerto. O servidor define empresa e ator pela sessão; nunca envie o tenant pelo payload.

## Operações

`create_participant`, `set_participant_status`, `create_third_party_payer`, `set_percentage_version`, `create_profit_targets`, `adjust_profit_target`, `record_receipt`, `reverse_receipt_allocation`, `redistribute_reservation`, `adjust_reservation`, `withdraw_by_bid`, `reverse_withdrawal`, `record_expense`, `adjust_expense`, `reimburse_expense`, `reverse_reimbursement`, `adjust_cash` e `import_expenses`.

Listas consultam views/tabelas com RLS. Gravações passam por RPC. Não use `.from("cashflow_...").insert/update/delete()`. Registrar uma retirada lança uma saída interna e não executa transferência bancária.
