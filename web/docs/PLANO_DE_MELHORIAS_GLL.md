# Plano de Melhorias e Lacunas — GLL

**Revisão:** 3.1 · **Data da análise:** 22/09/2026 · **Público:** responsáveis pelo negócio e pela operação do GLL.

Este documento apresenta, em linguagem direta, as melhorias recomendadas para tornar o GLL mais seguro, confiável e fácil de evoluir. Ele atualiza o diagnóstico com o estado das branches `main` (produção) e `homolog` (homologação). Esta revisão não promove funcionalidades para produção e, portanto, não altera a especificação técnica vigente.

## 1. Como ler este plano

Cada melhoria informa a situação, a ação recomendada, as consequências de não aplicá-la, as vantagens de aplicá-la e a evidência necessária para considerá-la pronta.

| Prioridade | Significado para o negócio |
|---|---|
| P0 — imediata | Pode causar perda ou alteração silenciosa de informação importante. |
| P1 — alta | Pode afetar segurança, continuidade da operação ou confiança nos dados. |
| P2 — planejada | Melhora qualidade, produtividade e capacidade de crescimento. |
| P3 — evolução | Amplia o produto e depende de decisão de negócio. |
| Manutenção | Já foi atendida e deve continuar protegida contra regressões. |

Os estados usados são **Aberto**, **Parcial**, **Atendido** e **A verificar no ambiente**.

## 2. Resumo da análise atual

| Repositório | Produção — `main` | Homologação — `homolog` | Diferença observada em homologação |
|---|---|---|---|
| GLL-frontend | `7822fcb` | `e2fcbc6` | Novos textos de status, exclusão lógica de orçamentos, filtro de vínculos e testes obrigatórios antes da publicação. |
| GLL-backend | `468d9cc` | `8624ab3` | Exclusão lógica de orçamentos, limite de um edital por orçamento e documentação revisada. |

A especificação técnica 3.8 representa a produção de 20/09/2026. Foram verificados código, schema, 25 migrações, testes, builds, publicação e documentação. Os **32 testes existentes passaram** e os builds de homologação e produção foram gerados com sucesso.

Avanços desde a revisão anterior:

- controle de acesso por organização, administrador e analista no banco e na interface;
- exclusão lógica de editais, preservando os dados;
- limites de inatividade e duração total da sessão;
- fornecedores e produtos estruturados em homologação;
- em homologação, preservação de orçamentos excluídos e vínculo de um orçamento com somente um edital.

Principais riscos restantes:

1. Editar um item ainda pode substituir silenciosamente campos antigos de frete.
2. Sincronização entre edital e orçamento e tratamento de anexos podem terminar pela metade após falha de rede.
3. Não há restauração completa de backup comprovada.
4. O frontend já bloqueia a publicação quando seus testes falham, mas o backend ainda não possui barreira equivalente e a suíte usa serviços simulados.
5. A documentação operacional contém instruções contraditórias sobre um arquivo legado.

Os testes atuais usam simulações e não substituem testes completos no Supabase real com diferentes usuários e permissões.

## 3. Débito técnico

O registro técnico detalhado foi centralizado em [Débito Técnico — GLL](./DEBITO_TECNICO_GLL.md). Esse documento é a fonte oficial para campos não exibidos, compatibilidades legadas, estruturas descontinuadas, riscos técnicos e ações de quitação. O presente plano mantém a visão de prioridade e impacto para o negócio, evitando duplicar inventários que poderiam ficar divergentes.

## 4. Carteira priorizada

| ID | Prioridade | Estado | Resultado esperado |
|---|---|---|---|
| IMP-003 | P0 | Parcial | Edição não apaga valores que o usuário não alterou. |
| IMP-001, 005, 012–017, 023, 024, 027, 029 | P1 | Parcial ou a verificar | Segurança, recuperação e gravações confiáveis. |
| IMP-002, 010, 011, 020–022, 025, 026, 028, 030 | P2 | Aberto ou parcial | Operação sustentável e crescimento seguro. |
| IMP-004, 018 | Manutenção | Atendido | Comportamentos já corrigidos protegidos por testes. |

## 5. Melhorias de prioridade imediata e alta

### IMP-003 — Preservar campos não editados do item

**Situação atual:** ao salvar um item, o sistema ainda envia valores fixos para dois campos antigos de frete que não aparecem no formulário. Uma edição simples pode trocar dados existentes sem aviso.

**Melhoria recomendada:** manter os valores existentes dos campos que não aparecem na tela e decidir, depois, se eles serão exibidos, migrados ou removidos.

**Consequências de não aplicar:** informações comerciais podem mudar silenciosamente, afetando cálculos, propostas e a confiança nos dados.

**Vantagens ao aplicar:** editar uma descrição deixa de alterar valores não relacionados e diminui o risco de prejuízo por dado sobrescrito.

**Como saber que está pronta:** editar somente a descrição preserva frete e todos os demais valores no modo local e no Supabase.

### IMP-001 — Completar a revogação de acesso

**Situação atual:** retirar o perfil bloqueia a visualização, mas não garante, sozinho, o bloqueio da conta de autenticação e de todas as sessões. Não há trilha completa de quem revogou, quando e por quê.

**Melhoria recomendada:** definir um procedimento único para bloquear, reativar e encerrar sessões, com responsável, data e motivo.

**Consequências de não aplicar:** uma pessoa desligada pode manter uma sessão válida por algum tempo, sem evidência completa da revogação.

**Vantagens ao aplicar:** desligamentos ficam rápidos, previsíveis e auditáveis.

**Como saber que está pronta:** o revogado não acessa banco ou arquivos, não retorna ao recarregar e o evento fica registrado.

### IMP-005 — Isolar credenciais de demonstração

**Situação atual:** o modo local tem usuário demonstrativo conhecido. Os ambientes publicados usam Supabase, mas não há comprovação versionada da troca das antigas credenciais nos dois ambientes.

**Melhoria recomendada:** manter a demonstração somente local, impedir fallback silencioso e registrar a confirmação de troca de credenciais sem guardar senhas.

**Consequências de não aplicar:** alguém pode usar uma demonstração pensando estar no ambiente real ou uma credencial histórica pode continuar válida.

**Vantagens ao aplicar:** fica claro onde os dados são reais e cai o risco de acesso por senha exposta no histórico.

**Como saber que está pronta:** publicação sem configuração falha claramente, a senha demonstrativa não funciona remotamente e a rotação está confirmada.

### IMP-012 — Tornar as atualizações do banco reproduzíveis

**Situação atual:** existem schema consolidado, 25 migrações e publicação protegida. Ainda não há ensaio versionado provando que uma base vazia e uma base antiga chegam ao mesmo resultado.

**Melhoria recomendada:** definir a linha de base oficial e testar instalação limpa, atualização anterior e recuperação após falha.

**Consequências de não aplicar:** uma nova instalação pode falhar, repetir uma mudança ou ficar diferente da produção.

**Vantagens ao aplicar:** atualizações e recuperações tornam-se previsíveis e com menor risco de parada.

**Como saber que está pronta:** bases nova e antiga terminam iguais, repetir a atualização não causa conflito e o histórico remoto confere.

### IMP-013 — Usar testes como barreira de publicação

**Situação atual:** há 32 testes, todos aprovados nesta revisão. O Pages agora executa a suíte e bloqueia a publicação quando ela falha. A maioria dos cenários ainda usa serviços simulados, e o backend não possui barreira equivalente para schema e políticas.

**Melhoria recomendada:** manter a barreira do frontend e ampliar testes reais de permissões, migrações, concorrência e frete. Criar validação obrigatória de schema e políticas no backend.

**Consequências de não aplicar:** problemas que dependem do Supabase real ou do backend podem passar pelas simulações e chegar ao ambiente publicado.

**Vantagens ao aplicar:** erros chegam menos aos usuários e cada publicação possui evidência objetiva de qualidade.

**Como saber que está pronta:** frontend e backend bloqueiam a entrega em caso de falha, e o resultado identifica commit, ambiente e cenários reais ou simulados.

### IMP-014 — Comprovar backup e restauração

**Situação atual:** o CSV não contém toda a base, relações, usuários e anexos. Não foi encontrado teste documentado de restauração completa.

**Melhoria recomendada:** definir conteúdo, frequência, retenção, responsável, perda máxima e tempo de recuperação; restaurar uma cópia isolada.

**Consequências de não aplicar:** após falha ou exclusão acidental, parte dos dados pode não voltar ou a recuperação pode demorar demais.

**Vantagens ao aplicar:** o negócio sabe quanto pode perder, quanto tempo leva para voltar e quem deve agir.

**Como saber que está pronta:** banco e arquivos são restaurados, conferidos e o tempo e a perda observados ficam registrados.

### IMP-015 — Uniformizar datas e valores monetários

**Situação atual:** arredondamentos estão distribuídos no navegador e datas usam formatos diferentes, algumas sem fuso horário.

**Melhoria recomendada:** definir regra única para centavos, quantidades, margens, datas e horários em tela, banco e exportação.

**Consequências de não aplicar:** totais podem divergir por centavos e sessões podem aparecer em horário incorreto.

**Vantagens ao aplicar:** propostas, margens e horários tornam-se consistentes em todos os dispositivos.

**Como saber que está pronta:** tela, banco e CSV concordam em arredondamento, custo zero, margem negativa, frações e fusos diferentes.

### IMP-016 — Impedir sobrescrita entre usuários

**Situação atual:** o GLL recebe mudanças de outras sessões e preserva formulários com aviso, mas não confirma se o registro mudou depois do início da edição.

**Melhoria recomendada:** associar versão a cada registro e recusar salvamento sobre versão antiga, permitindo comparar ou recarregar.

**Consequências de não aplicar:** a última pessoa a salvar pode apagar silenciosamente o trabalho de outra.

**Vantagens ao aplicar:** conflitos ficam visíveis e os rascunhos são preservados.

**Como saber que está pronta:** a segunda sessão recebe conflito claro e não sobrescreve nem recria registro removido.

### IMP-017 — Consolidar autenticação e sessão

**Situação atual:** a sessão é restaurada, limpa dados ao sair e expira após 120 minutos inativa ou 8 horas totais. A versão do cliente Supabase está fixada. Regras reais de senha, recuperação, MFA e tentativas ainda não foram comprovadas.

**Melhoria recomendada:** revisar e testar as configurações do Supabase e definir controles obrigatórios por perfil.

**Consequências de não aplicar:** a interface pode parecer segura enquanto o serviço aceita controles mais fracos do que o esperado.

**Vantagens ao aplicar:** a política fica comprovada em todo o caminho de autenticação.

**Como saber que está pronta:** login, recuperação, expiração, saída, falha de rede e controles adicionais funcionam em homologação.

### IMP-023 — Tornar orçamento e edital consistentes

**Situação atual:** homologação limita um orçamento a um edital, oculta os já usados e preserva orçamentos excluídos. A sincronização ainda faz várias gravações, e a mensagem de exclusão diz que itens serão apagados mesmo quando passam a ser preservados.

**Melhoria recomendada:** executar vínculo, troca, sincronização e exclusão como operações completas no servidor e corrigir as mensagens.

**Consequências de não aplicar:** uma falha pode atualizar só um lado, e uma mensagem incorreta pode levar a decisão mal informada.

**Vantagens ao aplicar:** edital e orçamento permanecem coerentes e o usuário entende o efeito real da ação.

**Como saber que está pronta:** falhas em qualquer etapa deixam tudo como antes ou concluem toda a operação.

### IMP-024 — Garantir regras essenciais no banco

**Situação atual:** banco já protege acessos, relações, valores não negativos e vínculo único em homologação. Status, modalidade e alguns indicadores ainda aceitam valores fora da tela.

**Melhoria recomendada:** levar as regras essenciais ao banco após corrigir dados antigos incompatíveis.

**Consequências de não aplicar:** integrações ou erros podem gravar dados que a tela nunca permitiria.

**Vantagens ao aplicar:** qualquer origem de gravação segue as mesmas regras e melhora a qualidade dos dados.

**Como saber que está pronta:** o banco rejeita dados inválidos e aceita todos os casos legítimos.

### IMP-027 — Recuperar falhas entre banco e anexos

**Situação atual:** arquivos e registros ficam em serviços separados. Algumas ordens de falha podem deixar referência sem arquivo, arquivo sem registro ou edital salvo sem todos os anexos.

**Melhoria recomendada:** criar estado de processamento, repetição segura e reconciliação de arquivos órfãos ou referências quebradas.

**Consequências de não aplicar:** o usuário pode acreditar em sucesso completo e descobrir depois que o arquivo se perdeu.

**Vantagens ao aplicar:** falhas ficam visíveis e recuperáveis, reduzindo o risco de perder documentos.

**Como saber que está pronta:** falhar em cada etapa não gera falso sucesso e repetir a operação converge para estado correto.

### IMP-029 — Unificar procedimentos e documentação

**Situação atual:** o README diz para não instalar `private-settings.sql` em bases novas; `docs/supabase.md` ainda manda instalá-lo. As evidências de publicação também não ficam em um registro único.

**Melhoria recomendada:** eliminar instruções contraditórias e registrar commit, migrações, testes, URL e validação por publicação.

**Consequências de não aplicar:** pessoas podem instalar ou promover o sistema de maneiras diferentes e esquecer etapas.

**Vantagens ao aplicar:** publicações tornam-se repetíveis, auditáveis e menos dependentes da memória.

**Como saber que está pronta:** README, guia e workflow concordam e cada deploy possui evidência única.

## 6. Melhorias planejadas

### IMP-011 — Comprovar e endurecer a autorização por perfil

**Situação atual:** organizações, administradores, analistas e restrições por autoria/atribuição já reduziram o risco original. Faltam testes completos com usuários reais e proteção de operações administrativas futuras.

**Melhoria recomendada:** testar API e interface com anônimo, removido, analista, administrador e pessoa de outra organização.

**Consequências de não aplicar:** uma falha de configuração pode permitir acesso maior que o devido sem ser percebida.

**Vantagens ao aplicar:** a separação dos dados ganha prova objetiva e permite evoluir a gestão de usuários com segurança.

**Como saber que está pronta:** acessos proibidos falham mesmo quando alguém contorna a tela.

### IMP-002 — Definir destino dos dados legados privados

**Situação atual:** modelos e configurações antigas não são mais usados pela tela e ganharam restrições, mas continuam guardados sem prazo formal.

**Melhoria recomendada:** definir utilidade, responsável, acesso, prazo de retenção e exportação antes de remover conteúdo.

**Consequências de não aplicar:** dados desnecessários aumentam exposição e confundem o que deve ser protegido.

**Vantagens ao aplicar:** o ambiente fica mais simples, com regra clara de preservação histórica.

**Como saber que está pronta:** cada conjunto tem finalidade e prazo; o desnecessário é exportado ou removido por processo aprovado.

### IMP-030 — Governar campos ocultos e descontinuados

**Situação atual:** o inventário central de [Débito Técnico — GLL](./DEBITO_TECNICO_GLL.md) identifica metadados necessários, campos antigos, informações ocultas relevantes e módulos descontinuados ainda presentes no banco ou no navegador. Não existe um responsável e uma decisão de destino para cada grupo.

**Melhoria recomendada:** manter um catálogo versionado com responsável, finalidade, exibição, prazo de retenção e destino de cada campo legado. Antes de remover, medir a existência de dados por ambiente, exportar o que precisar ser preservado, migrar dependências e validar homologação.

**Consequências de não aplicar:** informações invisíveis podem ser alteradas, esquecidas ou acumuladas; a empresa continua protegendo e copiando dados sem saber se ainda são necessários, e uma limpeza direta pode apagar histórico importante.

**Vantagens ao aplicar:** usuários sabem quais informações existem, a base fica mais simples, backups diminuem e futuras mudanças têm menor risco de perda ou incompatibilidade.

**Como saber que está pronta:** todos os itens do registro de débito técnico possuem decisão; campos removidos têm migração, exportação e teste; campos mantidos possuem justificativa, proteção e forma de consulta quando necessária.

### IMP-004 — Manter a identificação interna estável

**Situação atual:** atendido. O sistema separa identificador interno do número visível, aceita números repetidos e preserva relações.

**Melhoria recomendada:** manter testes ao mudar cadastro, importação, vínculos ou anexos.

**Consequências de não aplicar:** uma regressão pode quebrar vínculos quando o número se repetir ou for corrigido.

**Vantagens ao aplicar:** números podem ser corrigidos sem perder itens e arquivos.

**Como saber que está pronta:** o teste continua passando e relações permanecem após mudanças.

### IMP-010 — Registrar histórico de status

**Situação atual:** os status e mensagens foram atualizados, e editais faturados têm proteção. Não existe histórico com autor, data e motivo.

**Melhoria recomendada:** definir transições permitidas e registrar cada mudança.

**Consequências de não aplicar:** não é possível explicar com segurança quem mudou o processo e por quê.

**Vantagens ao aplicar:** a operação ganha rastreabilidade e indicadores mais confiáveis.

**Como saber que está pronta:** mudança inválida é recusada e toda transição tem origem, destino, responsável e data.

### IMP-020 — Paginar e reduzir recargas

**Situação atual:** a aplicação busca conjuntos inteiros periodicamente. Funciona hoje, mas tende a piorar com o volume.

**Melhoria recomendada:** buscar apenas campos e páginas necessárias, com resumos no servidor e atualização incremental.

**Consequências de não aplicar:** listas podem ficar lentas ou incompletas, principalmente no celular.

**Vantagens ao aplicar:** telas ficam rápidas e confiáveis mesmo com mais dados.

**Como saber que está pronta:** volume acima do limite da API aparece completo, paginado e com tempo medido.

### IMP-021 — Dar visibilidade às falhas

**Situação atual:** há mensagens e console, mas não serviço central com alertas, versão, ambiente e responsável.

**Melhoria recomendada:** registrar falhas relevantes sem dados sensíveis, gerar alertas e definir responsáveis.

**Consequências de não aplicar:** erros podem ser descobertos só após reclamação e sem contexto para diagnóstico.

**Vantagens ao aplicar:** problemas são percebidos cedo e resolvidos mais rápido.

**Como saber que está pronta:** falha controlada gera alerta com ambiente e versão, sem expor conteúdo sensível.

### IMP-022 — Completar acessibilidade e usabilidade

**Situação atual:** há navegação responsiva e suporte parcial ao teclado, mas algumas ações dependem de clique, hover ou foco inadequado.

**Melhoria recomendada:** testar com teclado, leitor de tela, zoom e celular usando WCAG 2.2 AA como referência.

**Consequências de não aplicar:** parte das pessoas pode não conseguir concluir tarefas ou pode cometer erros em telas pequenas.

**Vantagens ao aplicar:** mais pessoas usam o sistema com autonomia e a interface melhora para todos.

**Como saber que está pronta:** fluxos principais são concluídos sem mouse e sem perda de conteúdo em zoom/celular.

### IMP-025 — Expandir gestão documental

**Situação atual:** cada edital tem checklist e até quatro anexos, mas não há validade, responsável, versão ou arquivo por item do checklist.

**Melhoria recomendada:** criar documentos reutilizáveis com validade, responsável, versões, alertas e retenção.

**Consequências de não aplicar:** documento vencido ou incorreto pode ser usado e o histórico pode se perder.

**Vantagens ao aplicar:** há menos conferência manual e avisos antes do vencimento.

**Como saber que está pronta:** validade e histórico são consultáveis, acessos indevidos falham e substituições preservam versões.

### IMP-026 — Esclarecer o modo local

**Situação atual:** o modo local grava só no navegador, usa demonstração e não sincroniza com a nuvem.

**Melhoria recomendada:** mostrar essa limitação claramente e documentar limpeza e reinício da demonstração.

**Consequências de não aplicar:** alguém pode perder dados ao limpar o navegador ou trocar de computador.

**Vantagens ao aplicar:** ninguém confunde demonstração com ambiente operacional.

**Como saber que está pronta:** tela e documentação explicam armazenamento, ausência de sincronização e limpeza.

### IMP-028 — Consolidar fornecedores e produtos

**Situação atual:** homologação tem fornecedores, tags e produtos estruturados. Produção mantém a aba bloqueada. Eles ainda não substituem nomes e links livres dos itens e não há regra completa de duplicidade, arquivamento ou histórico de preços.

**Melhoria recomendada:** validar com usuários, definir duplicidade/arquivamento e integrar fornecedor e produto aos itens preservando o histórico.

**Consequências de não aplicar:** cadastros ficam duplicados e a base estruturada pouco ajuda a montar cotações.

**Vantagens ao aplicar:** informações podem ser reaproveitadas e comparações de preço tornam-se possíveis.

**Como saber que está pronta:** cadastro, produtos, permissões e conflitos passam em homologação e a integração não apaga dados antigos.

### IMP-018 — Manter login remoto sem demonstração automática

**Situação atual:** atendido e protegido por teste automatizado. Login e restauração remotos não criam dados demonstrativos, e o cenário de base remota vazia foi incluído na suíte obrigatória.

**Melhoria recomendada:** manter o teste na barreira da IMP-013 e reavaliá-lo quando o fluxo de inicialização mudar.

**Consequências de não aplicar:** uma regressão futura pode inserir demonstração em ambiente real sem ser percebida.

**Vantagens ao aplicar:** ambientes novos permanecem vazios até ação autorizada.

**Como saber que está pronta:** base vazia continua vazia após login, recarga e restauração de sessão.

## 7. Expansões de negócio — P3

| Evolução | Consequências de não aplicar | Vantagens ao aplicar |
|---|---|---|
| Alertas de prazos | Prazos dependem de conferência manual. | Responsáveis recebem avisos e reduzem atrasos. |
| Captura de editais/PDFs | Cadastro continua manual e sujeito a erro. | Parte dos dados é extraída com revisão humana. |
| Comparação de fornecedores | Condições ficam espalhadas em textos e links. | Preços, validade e condições são comparáveis. |
| Resultados e concorrentes | Pouca explicação sobre ganhos e perdas. | Decisões usam histórico e motivos. |
| Pós-licitação | Contrato, entrega e recebimento ficam fora do GLL. | Processo acompanhado até a conclusão financeira. |
| Indicadores históricos | Painel mostra o momento, não tendências. | Gestão acompanha conversão, margem e causas por período. |
| Biblioteca/propostas | Montagem permanece repetitiva. | Modelos são reutilizados com consistência. |
| E-mail/calendário | Avisos são repetidos manualmente. | Eventos chegam aos canais usados pela equipe. |
| API/webhooks | Integrações dependem de tabelas internas. | Outros sistemas usam contratos estáveis e auditáveis. |

## 8. Sequência recomendada

| Etapa | Escopo | Evidência para avançar |
|---|---|---|
| 1 — Evitar perda silenciosa | IMP-003 e teste da IMP-013. | Campos não exibidos são preservados. |
| 2 — Proteger acesso e recuperação | IMP-001, 005, 011, 014 e 017. | Revogação, rotação e restauração comprovadas. |
| 3 — Tornar gravações confiáveis | IMP-012, 015, 016, 023, 024 e 027. | Migrações repetíveis, conflitos visíveis e falhas recuperáveis. |
| 4 — Sustentar crescimento | IMP-002, 010, 020–022, 025, 026, 028, 029 e 030. | Procedimentos coerentes, legado governado e experiência validada. |
| 5 — Expandir | Evoluções P3 escolhidas. | Benefício, regra, responsável e aceite definidos. |

IMP-004 e IMP-018 permanecem em manutenção. Código escrito não basta: é necessário publicar em homologação, validar na web e registrar evidência.

## 9. Critérios de entrega e promoção

**Em homologação:** definir escopo e risco; implementar; testar; publicar em `homolog`; validar na web; registrar URL, commit, resultado e pendências.

**Após aprovação para produção:** atualizar a especificação e documentos afetados; aplicar migrações antes do frontend; publicar e validar produção; fazer merge de `main` em `homolog` nos dois repositórios, sem rebase ou force push; republicar e revalidar homologação.

A especificação técnica não deve ser atualizada por mudança restrita a homologação. **Implementado**, **publicado em homologação**, **validado pelo negócio** e **promovido** são estados diferentes.

## 10. Limites da análise

Não foram alterados dados operacionais. Ainda dependem de comprovação no serviço: senha e recuperação, MFA, proteção contra tentativas, histórico remoto de migrações, backups, restauração e revogação de sessões. Ausência de evidência no repositório não prova ausência do recurso; apenas indica que ele não foi confirmado.

## 11. Fontes e rastreabilidade técnica

- **Frontend:** [produção][F1], [testes de homologação][F2], [Pages][F3] e [branch homolog][F4].
- **Backend:** [schema de produção][B1], [migrações de homologação][B2], [guia][B3], [workflow][B4] e [branch homolog][B5].
- **Ambientes:** [homologação][H1], [produção][H2] e [plano publicado][H3].

[F1]: https://github.com/Julielzissimo/GLL-frontend/blob/7822fcb8b8ad53721c2b0d9477ce17cc7f8f477b/web/app.js
[F2]: https://github.com/Julielzissimo/GLL-frontend/blob/e2fcbc6/scripts/session-sync.test.mjs
[F3]: https://github.com/Julielzissimo/GLL-frontend/blob/7822fcb8b8ad53721c2b0d9477ce17cc7f8f477b/.github/workflows/pages.yml
[F4]: https://github.com/Julielzissimo/GLL-frontend/tree/e2fcbc6
[B1]: https://github.com/Julielzissimo/GLL-backend/blob/468d9ccfc2292f92f05d9bdbfe3fbbb9a15c13e7/supabase/schema.sql
[B2]: https://github.com/Julielzissimo/GLL-backend/tree/3d276dcfe63d66f6311c218e1c27ad70574c798b/supabase/migrations
[B3]: https://github.com/Julielzissimo/GLL-backend/blob/468d9ccfc2292f92f05d9bdbfe3fbbb9a15c13e7/docs/supabase.md
[B4]: https://github.com/Julielzissimo/GLL-backend/blob/468d9ccfc2292f92f05d9bdbfe3fbbb9a15c13e7/.github/workflows/supabase-production.yml
[B5]: https://github.com/Julielzissimo/GLL-backend/tree/3d276dcfe63d66f6311c218e1c27ad70574c798b
[H1]: https://julielzissimo.github.io/GLL-frontend/homolog/
[H2]: https://julielzissimo.github.io/GLL-frontend/
[H3]: https://julielzissimo.github.io/GLL-frontend/homolog/docs/plano-de-melhorias.html
