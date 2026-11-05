# Reservas e retiradas — contrato da tela

**Release:** Fluxo de Caixa — milestone #13, issue [GLL-backend #261](https://github.com/Julielzissimo/GLL-backend/issues/261).
**Estado:** testado em Supabase local descartável; publicação em homologação depende dos workflows oficiais.

## Ações

- Preparar alvos para itens vencedores de edital em `Em Fornecimento` ou `Faturado`.
- Registrar recebimento parcial por item. O RPC calcula o reconhecimento proporcional e o bridge projeta a mesma entrada em Financeiro na transação de origem.
- Criar reservas automáticas usando os percentuais vigentes capturados no recebimento. Um item com lucro objetivo zero não cria reserva.
- Redistribuir saldo entre beneficiários elegíveis, com valor positivo e justificativa.
- Registrar retirada por edital e beneficiário. O servidor recalcula disponibilidade de reserva, saldo agregado e caixa global sob lock.
- Ajustar lucro reconhecido no recebimento mais recente, respeitando os percentuais snapshot e a reserva ainda não retirada.
- Estornar sem apagar operações. Recebimentos usam ordem LIFO por item.

## Valores e auditoria

O componente usa strings decimais e aritmética inteira em centavos. O servidor refaz cálculos e limites na transação, registra autoria, justificativa e timestamp, e bloqueia alterações diretas ao histórico.

Uma retirada é lançamento de caixa, não integração bancária nem confirmação de pagamento externo. A publicação e o smoke test de homologação serão registrados na documentação da release após seus workflows.
