# Camada web — Fluxo de Caixa

## Integração

- `web/finance-ledger.js` implementa o ledger compartilhado entre Faturamento e Fluxo de Caixa e o componente `createFinanceLedgerPanel`.
- `web/finance.js` monta a página consolidada de caixa e reservas; `web/finance-expenses.js` mantém despesas e ressarcimentos; `web/finance-reservations.js` apresenta reservas, redistribuições e retiradas.
- `web/financial-participants.js` integra participantes e versões percentuais a Dados da Empresa.
- `web/finance-service.js` centraliza os RPCs e as chaves idempotentes.
- `web/finance-money.js` usa centavos inteiros e precisão fixa para valores, reconhecimento proporcional e rateios.
- Recebimentos e ajustes enviados pelo Faturamento são projetados no livro geral `cashflow_*` pelo bridge transacional do backend.
- A rota, a navegação e os formulários financeiros são restritos a Administradores. RLS e RPCs repetem a validação no servidor.

## Acessibilidade e design system

Novos módulos reutilizam tokens e padrões existentes do GLL. Stories do ledger e de reservas usam dados fictícios. Storybook é somente ferramenta local de desenvolvimento; não integra o artefato publicado do Pages.

## Validação local

- `npm test`: 239 aprovados.
- `npm run build:homolog`: concluído.
- `npm run build-storybook`: concluído com aviso de chunks grandes; revisão visual pendente.
- `npm run test:e2e:finance-local`: um e2e local aprovado para despesa de terceiro e dois ressarcimentos parciais.

## Publicação em homologação

- Integrada à branch `homolog` no commit `4d4ea41a8d5c5decf97683795869a108f4895b3d`.
- [Workflow Pages #41955605032](https://github.com/Julielzissimo/GLL-frontend/actions/runs/41955605032) aprovou os testes obrigatórios, build, publicação e verificação do commit em `/homolog/`.
- No mesmo workflow, login/isolamento em homologação e teste R2 com arquivo sintético passaram; o teste de produção foi ignorado.
- Não foram criados lançamentos financeiros em homologação; os fluxos de negócio foram exercitados somente com fixtures locais descartáveis.

O e2e de negócio permite apenas o servidor local, Supabase local e o host estático versionado do cliente Supabase. Builds geram artefatos locais; a publicação em homologação ocorre somente pelo processo oficial. Produção não foi alterada.
