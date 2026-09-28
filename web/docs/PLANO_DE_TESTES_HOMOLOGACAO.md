# Plano de Testes de Homologação — GLL

| Campo | Valor |
|---|---|
| Versão | 1.0 |
| Data-base | 28/09/2026 |
| Ambiente-alvo | `homolog` |
| Aplicação | Gerenciador de Licitações Locais (GLL) |
| Objetivo | Selecionar e executar somente a regressão proporcional às funcionalidades afetadas por cada implantação, sem perder a cobertura dos fluxos críticos. |

## 1. Como usar este plano em cada implantação

1. Registre no relatório da rodada o commit do frontend, o commit do backend, as migrações e os arquivos alterados.
2. Marque os domínios afetados na matriz da seção 4. Considere impacto direto, dependências, dados compartilhados, permissões, cálculos e saídas em PDF/CSV.
3. Execute sempre a suíte `CORE`. Execute também todos os casos dos domínios marcados e os casos indicados na coluna **Regressão associada**.
4. Para mudanças de banco, execute `DB`, `ACL` e os domínios que leem ou gravam as tabelas/funções afetadas. Para mudanças em componentes ou estilos compartilhados, execute `NAV`, `UX` e todos os módulos consumidores.
5. Registre resultado, evidência e defeito por ID de caso. Um caso é `Aprovado`, `Reprovado`, `Bloqueado` ou `Não aplicável`, sempre com justificativa nos dois últimos estados.
6. Não promova para produção enquanto houver falha P0/P1, migração não comprovada, divergência de manifesto ou caso selecionado sem resultado.

### 1.1 Seleção rápida por tipo de alteração

| Alteração | Suítes mínimas |
|---|---|
| Texto, rótulo ou ajuda isolada | `CORE` + domínio da tela + `UX-01` a `UX-04` |
| CSS, Design System ou componente compartilhado | `CORE`, `NAV`, `UX` + telas consumidoras |
| Navegação, URL ou menu | `CORE`, `NAV` + domínios alcançados pela rota |
| Autenticação, sessão, perfil ou RLS | `CORE`, `AUT`, `ACL`, `SYNC`, `DB` + todos os domínios cujas políticas mudaram |
| Licitação ou seus dependentes | `CORE`, `BID`, `STA`, `ATT`, `QTD`, `CAL`, `CHK`, `FAL`, `CSV`, `ACL`, `SYNC` |
| Orçamento ou item | `CORE`, `QTD`, `CAL`, `CSV`, `BID`, `PROP`, `ACL`, `SYNC` |
| Cálculo, precisão ou formatação numérica | `CORE`, `CAL`, `QTD`, `BID`, `PROP` |
| Fornecedor | `CORE`, `SUP`, `ACL`, `SYNC` |
| Dados da empresa ou representante | `CORE`, `EMP`, `DEC`, `PROP`, `ACL`, `SYNC` |
| Declaração ou ativo visual | `CORE`, `DEC`, `EMP`, `ACL`, `UX` |
| Proposta comercial | `CORE`, `PROP`, `QTD`, `CAL`, `EMP`, `ACL`, `SYNC`, `UX` |
| Migração, trigger, RPC, Storage ou schema | `CORE`, `DB`, `ACL` + todos os domínios consumidores |
| Build, workflow ou publicação | `CORE`, `REL` + fumaça dos domínios incluídos na entrega |

## 2. Criticidade e profundidade

| Prioridade | Definição | Exemplos | Tratamento |
|---|---|---|---|
| P0 | Indisponibilidade, exposição entre organizações, perda/corrupção de dados ou implantação incorreta. | Login impossível, RLS vazando dados, migração parcial. | Interromper a rodada e bloquear promoção. |
| P1 | Fluxo principal ou cálculo financeiro incorreto, sem alternativa segura. | Total, lucro ou PDF errado; salvamento falha. | Bloquear promoção. |
| P2 | Função secundária degradada com alternativa. | Filtro, tooltip ou ordenação incorreta. | Corrigir ou obter aceite formal do risco. |
| P3 | Problema cosmético sem perda funcional ou de acessibilidade. | Espaçamento isolado. | Registrar e priorizar. |

Para alteração de baixo risco, execute o caminho feliz e uma validação negativa de cada caso selecionado. Para banco, cálculos, permissões, sincronização e documentos, inclua limites, erro, concorrência e persistência após recarregar.

## 3. Pré-condições, dados e evidências

### 3.1 Perfis e massa controlada

- `ADM-A`: administrador da organização A.
- `ANA-A1` e `ANA-A2`: analistas da organização A, com atribuições diferentes.
- `ADM-B`: administrador de uma organização B, usado exclusivamente para testes de isolamento.
- Um edital ativo sem orçamento; um edital com orçamento e três itens; um edital `Faturado`; um edital `Desclassificado`; um edital excluído logicamente.
- Itens com valores de limite, casas decimais, fornecedores, especificações técnicas e combinação de vencidos/não vencidos.
- Arquivos de teste permitidos e rejeitados, sem dados reais ou pessoais.
- Dados de empresa e representantes fictícios, com CNPJ/CPF matematicamente válidos.

Todo dado de teste deve ter prefixo identificável, por exemplo `HML-AAAAMMDD-`, e ser removido ou excluído logicamente ao final quando isso não prejudicar a evidência.

### 3.2 Evidência mínima por caso

- ID, data/hora, executor, navegador e perfil usado;
- commits publicados e URL de homologação;
- dados de entrada sem segredo ou dado pessoal;
- resultado esperado e observado;
- captura de tela ou arquivo gerado quando houver interface/PDF/CSV;
- consulta ou resposta sanitizada quando houver banco/RPC/RLS;
- ID do defeito e severidade quando reprovado.

## 4. Matriz de impacto funcional

| Domínio | Escopo | Dependências principais | Regressão associada |
|---|---|---|---|
| `CORE` | Disponibilidade, login, leitura e salvamento básico | Publicação, Auth, Supabase | Sempre |
| `AUT` | Login, logout, restauração e expiração | Auth, armazenamento de sessão | `ACL`, `SYNC` |
| `NAV` | Menu, rotas, histórico e responsividade | `index.html`, estado de navegação | `UX` |
| `DSH` | Painel, contadores e próximas sessões | Licitações, documentos | `BID`, `STA`, `CAL` |
| `BID` | CRUD, filtros, garantia, exclusão lógica | Itens, orçamentos, usuários | `STA`, `QTD`, `ACL`, `SYNC` |
| `STA` | Ciclo de vida, bloqueio e auditoria | Licitação, histórico | `BID`, `CAL`, `ACL` |
| `ATT` | Quatro anexos privados do edital | Storage, licitação | `ACL`, `DB` |
| `QTD` | Orçamentos, vínculo e itens compartilhados | Licitação, propostas | `BID`, `CAL`, `PROP`, `SYNC` |
| `CAL` | Dinheiro, quantidade, margem, lucro e totais | Itens, propostas | `BID`, `QTD`, `PROP` |
| `CSV` | Exportação de itens | Licitação, orçamento | `BID`, `QTD`, `SEC` |
| `CHK` | Checklist documental | Licitação | `DSH`, `STA` |
| `FAL` | Histórico de falhas | Status `Desclassificado` | `STA` |
| `SUP` | Fornecedores e produtos | Feature flag, organização | `ACL`, `SYNC` |
| `USR` | Usuários e atribuições | Perfis, RLS | `ACL`, `BID`, `QTD` |
| `EMP` | Empresa e representantes | Declarações, propostas | `DEC`, `PROP`, `ACL` |
| `DEC` | Biblioteca e geração de declarações | Empresa, Storage, PDF | `EMP`, `ACL`, `UX` |
| `PROP` | Propostas comerciais e PDF | Edital, orçamento, empresa | `QTD`, `CAL`, `EMP`, `ACL` |
| `SYNC` | Atualização entre clientes e recuperação de rede | Todos os agregados remotos | Domínio alterado |
| `ACL` | Perfis, organização e RLS | Todas as tabelas/RPCs/Storage | Domínio alterado |
| `DB` | Migrações, schema, integridade e rollback | Supabase | `ACL`, domínio alterado |
| `UX` | Acessibilidade, responsividade e feedback | Design System | Telas alteradas |
| `REL` | Manifesto, testes, build e Pages | Frontend e backend | `CORE` |

## 5. Suíte obrigatória de fumaça

| ID | P | Procedimento | Resultado esperado |
|---|:---:|---|---|
| CORE-01 | P0 | Abrir a URL de homologação em sessão anônima. | HTTPS responde, identifica Homologação e exibe login sem dado protegido. |
| CORE-02 | P0 | Entrar como `ADM-A` e recarregar a página. | Autentica, carrega o perfil/organização corretos e restaura a sessão. |
| CORE-03 | P1 | Abrir Visão geral, Licitações, Orçamento, Geração de Documentos, Fornecedores e Configurações. | Nenhuma tela quebra; carregamentos terminam e erros não aparecem no console. |
| CORE-04 | P1 | Criar ou editar um registro do domínio alterado, salvar e recarregar. | Confirmação visível e dados persistidos sem duplicidade. |
| CORE-05 | P0 | Sair e tentar voltar pela URL/histórico. | Sessão e dados em memória são limpos; tela protegida não reaparece. |
| CORE-06 | P0 | Consultar `deployment.json` de homologação. | O commit publicado é exatamente o commit esperado da branch `homolog`. |

## 6. Autenticação, navegação e painel

| ID | P | Procedimento | Resultado esperado |
|---|:---:|---|---|
| AUT-01 | P1 | Tentar login vazio, e-mail inválido, senha errada e credencial válida. | Campos obrigatórios e erro seguro; somente a credencial válida entra. |
| AUT-02 | P0 | Remover o usuário de `app_users` durante uma sessão. | O próximo ciclo de sincronização encerra a visualização autenticada. |
| AUT-03 | P0 | Simular 120 minutos de inatividade e oito horas de duração absoluta. | Cada limite exige nova autenticação antes de ler tabelas protegidas. |
| AUT-04 | P1 | Interromper a rede e restaurá-la. | Falha transitória preserva sessão/dados; nova tentativa aplica snapshot completo. |
| NAV-01 | P2 | Recolher/expandir o menu no desktop e abrir em tela estreita. | Estado e `aria-expanded` são coerentes; menu estreito é sobreposto e fechável. |
| NAV-02 | P1 | Navegar para página e registro, recarregar e usar Voltar/Avançar. | URL legível restaura o mesmo contexto e preserva parâmetros externos. |
| NAV-03 | P2 | Expandir Geração de Documentos e alternar Propostas/Declarações. | Submenu, foco, destaque e largura funcionam sem sobreposição. |
| NAV-04 | P1 | Entrar como analista e tentar rotas administrativas pela interface e URL. | Usuários e Design System ficam indisponíveis; não há acesso indireto. |
| DSH-01 | P1 | Comparar total e contadores por status com a lista de editais ativos. | Contagens ignoram excluídos e correspondem aos filtros. |
| DSH-02 | P2 | Conferir próximas sessões e pendências documentais. | Ordenação/data em São Paulo e pendências conferem com os registros. |

## 7. Licitações, status e anexos

| ID | P | Procedimento | Resultado esperado |
|---|:---:|---|---|
| BID-01 | P1 | Criar edital com número, órgão e sessão; omitir cada obrigatório. | Registro recebe UUID interno imutável; ausências são rejeitadas. |
| BID-02 | P1 | Criar dois editais com o mesmo número. | Ambos são aceitos, possuem IDs distintos e podem ser abertos separadamente. |
| BID-03 | P1 | Editar modalidade, entrega, prazo opcional, link de sessão e garantia. | Dados persistem; prazo pode ficar vazio; link aceita apenas HTTP/HTTPS normalizado. |
| BID-04 | P2 | Combinar filtros de órgão, data, status e depósito confirmado. | Interseção correta, estado vazio correto e limpeza restaura a lista. |
| BID-05 | P1 | Excluir após confirmar e cancelar em uma segunda tentativa. | Confirmação controla a ação; excluído some, mas dados/dependentes permanecem no banco. |
| BID-06 | P1 | Conferir criador ativo e registro cujo criador saiu de `app_users`. | Nome preservado tem prioridade; fallback é `Usuário Removido`/`UR`. |
| BID-07 | P1 | Abrir, remover e tentar salvar link de sessão inválido. | Abre em nova aba com proteção; remoção persiste; esquema inválido é rejeitado. |
| STA-01 | P1 | Percorrer cada transição permitida da matriz vigente. | Todas salvam somente com motivo e geram uma entrada de histórico. |
| STA-02 | P0 | Tentar transição proibida, motivo vazio e `UPDATE` direto no status. | Interface, adaptador e banco rejeitam sem alteração parcial. |
| STA-03 | P1 | Conferir histórico depois de mudança. | Estado anterior/novo, motivo, nome/e-mail, data/hora e ordem decrescente corretos. |
| STA-04 | P0 | Entrar em `Faturado` e tentar alterar/excluir edital, item, documento e falha. | Tudo fica somente leitura no frontend e banco; somente retorno para `Aprovada` é permitido. |
| STA-05 | P1 | Conferir `Descartada`, `Aprovada`, `Faturado` e `Disputada`. | Indicadores usam somente itens vencidos; nos demais status usam todos os itens. |
| ATT-01 | P1 | Anexar quatro arquivos permitidos e tentar o quinto. | Quatro uploads privados persistem; quinto é rejeitado. |
| ATT-02 | P1 | Testar 20 MB, acima de 20 MB, download e remoção individual. | Limite é por arquivo; download é íntegro; modal próprio confirma remoção. |
| ATT-03 | P1 | Acessar anexo como usuário sem direito e validar anexo legado. | Acesso indevido falha; legado continua disponível sem reaparecer após remoção. |

## 8. Orçamentos, itens, cálculos e CSV

| ID | P | Procedimento | Resultado esperado |
|---|:---:|---|---|
| QTD-01 | P1 | Criar, editar, pesquisar, selecionar, recolher/expandir e excluir orçamento. | CRUD persiste; ID/edital/órgão filtram; exclusão é lógica. |
| QTD-02 | P1 | No edital sem vínculo, localizar/vincular existente e criar novo. | Lista mostra apenas elegíveis; criação herda número/órgão e abre o primeiro item. |
| QTD-03 | P0 | Tentar vincular um orçamento a dois editais ativos, a outra organização ou excluído. | Banco rejeita todos; nenhum vínculo parcial. |
| QTD-04 | P1 | Trocar/limpar vínculo e abrir a aba Orçamento no edital. | Resumo e editor correspondem ao novo vínculo; acesso concedido pelo edital funciona. |
| QTD-05 | P0 | Criar/editar/excluir item no orçamento vinculado e depois pelo edital. | Sincronização bidirecional é atômica, sem duplicidade e preserva IDs relacionados. |
| QTD-06 | P1 | Salvar número repetido no mesmo orçamento e número igual em outro. | Repetição no mesmo é rejeitada; em outro é aceita. |
| QTD-07 | P1 | Preencher quantidade, unidade, custo, valor final, lance mínimo, marca/modelo, texto e fornecedores. | Valores persistem com precisão correta; negativos são rejeitados; lista aceita nomes/URLs. |
| QTD-08 | P1 | Adicionar especificações completas, parciais e linha vazia. | Completas/parciais persistem; somente linha totalmente vazia é descartada. |
| QTD-09 | P2 | Fechar modal com e sem alterações e testar texto longo/tela estreita. | Confirma descarte apenas quando sujo; modal rola internamente e tabela rola sem alargar a página. |
| QTD-10 | P1 | Marcar vários itens vencidos nos status aplicáveis e recarregar. | Cada checkbox persiste imediatamente; linha destaca; em `Faturado` fica visível e bloqueado. |
| CAL-01 | P1 | Usar valor final `150,00`, custo `100,00`, quantidade `3`. | Lucro do item = `(150 - 100) × 3` = `R$ 150,00`. |
| CAL-02 | P1 | Usar valor final `150,00` e custo `100,00`. | Margem efetiva = `(150 - 100) / 150 × 100` = `33,3333%`. |
| CAL-03 | P1 | Usar custo `100,00` e margem desejada `20%`; depois `100%`. | Valor com margem = `100 / (1 - 0,20)` = `R$ 125,00`; 100% ou mais não gera preço. |
| CAL-04 | P1 | Usar unitário `19,99` e quantidade `1,2345`. | Total da linha arredondado a duas casas = `R$ 24,68`. |
| CAL-05 | P1 | Somar linhas com frações de centavo e conferir cabeçalho. | Cada linha e acumulado seguem arredondamento monetário consistente, sem erro binário visível. |
| CAL-06 | P1 | Testar zero, vazio, separador brasileiro, quatro casas de quantidade/margem e quinta casa. | Vazio segue regra do campo; zero é preservado; precisão excedente é rejeitada/arredondada de modo consistente. |
| CAL-07 | P1 | Alterar custo/margem simulada sem confirmar valor final. | Calculadora não altera o valor final nem o faturamento. |
| CAL-08 | P1 | Conferir total, lucro total e margem consolidada com valores negativos de lucro. | Totais batem com as linhas incluídas; margem consolidada usa lucro total/faturamento total e aceita prejuízo. |
| CSV-01 | P1 | Baixar itens de edital e de orçamento com/sem itens. | Ordem numérica, nomes sanitizados e cabeçalho mesmo sem linhas. |
| CSV-02 | P0 | Incluir acentos, aspas, `;`, quebras e células iniciadas por `=`, `+`, `-`, `@`. | UTF-8 BOM, delimitador `;`, escape correto e apóstrofo neutralizam injeção de planilha. |
| CSV-03 | P1 | Conferir colunas e fornecedores múltiplos. | Campos previstos, marca/modelo separados, fallback técnico e fornecedores unidos por ` | `. |

## 9. Checklist, falhas, fornecedores e usuários

| ID | P | Procedimento | Resultado esperado |
|---|:---:|---|---|
| CHK-01 | P1 | Criar, editar, marcar posse e excluir documento. | Tipo obrigatório; persistência correta; ausentes destacados e refletidos no painel. |
| FAL-01 | P1 | Acessar histórico fora e dentro de `Desclassificado`. | Aba/salvamento somente no status correto; tipo e descrição obrigatórios. |
| FAL-02 | P2 | Registrar plano de ação e conferir data. | Texto opcional e timestamp automático persistem. |
| SUP-01 | P1 | Criar, editar, pesquisar por nome/produto/tag, filtrar e ordenar fornecedores. | Busca ignora acentos; tags não duplicam; contagem e ordenação conferem. |
| SUP-02 | P1 | Manter produtos e excluir fornecedor. | Produtos persistem e são removidos em cascata com o fornecedor. |
| SUP-03 | P1 | Conferir feature flag em homologação e produção. | Fluxo habilitado apenas em homologação enquanto essa regra estiver vigente. |
| USR-01 | P1 | Como administrador, listar, pesquisar e filtrar perfis. | Apenas usuários da organização e totais corretos. |
| USR-02 | P0 | Atribuir editais/orçamentos a analista da mesma organização e tentar outro perfil/organização. | Primeiro caso persiste; demais são rejeitados. |
| USR-03 | P0 | Entrar como cada analista após atribuir/remover acesso. | Vê próprios/atribuídos e orçamento ligado a edital acessível; remoção revoga acesso. |

## 10. Dados da empresa

| ID | P | Procedimento | Resultado esperado |
|---|:---:|---|---|
| EMP-01 | P1 | Abrir Configurações > Dados da Empresa como administrador e analista. | Administrador edita; analista visualiza sem ações de gravação. |
| EMP-02 | P1 | Salvar razão social e CNPJ válido; testar vazio, tamanho e dígitos verificadores inválidos. | Formata sem perder dígitos; somente CNPJ válido persiste. |
| EMP-03 | P1 | Adicionar, ordenar e remover representantes com nome, CPF, cargo e principal. | Lista persiste na ordem; CPF válido/sem duplicidade; no máximo um principal. |
| EMP-04 | P1 | Salvar representantes sem marcar principal. | Primeiro representante se torna principal; declarações recebem seus dados. |
| EMP-05 | P0 | Forçar falha durante o salvamento transacional. | Empresa, representantes e configuração de declaração permanecem no estado anterior. |
| EMP-06 | P0 | Tentar ler/alterar dados da organização B. | RLS isola leitura e escrita; nenhuma informação cruza organizações. |

## 11. Declarações

| ID | P | Procedimento | Resultado esperado |
|---|:---:|---|---|
| DEC-01 | P1 | Salvar configuração, introdução, logo e marca-d'água. | Dados persistem por organização; aceita PNG/JPEG/WebP até 5 MB e rejeita demais. |
| DEC-02 | P1 | Criar/editar/excluir modelo geral e específico de edital; pesquisar/filtrar. | Biblioteca compartilhada persiste; modelo específico aparece somente no edital correspondente. |
| DEC-03 | P2 | Digitar `{{`, escolher variáveis e testar todas as variáveis catalogadas. | Sugestões aparecem no diálogo ativo e inserem chaves corretas. |
| DEC-04 | P1 | Compor declaração avulsa e vinculada, reordenar blocos e adicionar texto manual. | Ordem, numeração, dados do edital e texto manual aparecem no snapshot/PDF. |
| DEC-05 | P1 | Deixar variável usada sem valor e tentar visualizar/gerar. | Modal lista cada dado ausente uma vez e impede geração. |
| DEC-06 | P1 | Visualizar PDF A4 com várias páginas e identidade visual. | Texto não corta/sobrepõe, acentos corretos, paginação e ativos com proporção adequada. |
| DEC-07 | P0 | Gerar definitivamente e abrir pelo histórico. | PDF privado e snapshot imutável; autor/data em São Paulo; URL assinada temporária abre o arquivo. |
| DEC-08 | P0 | Tentar acessar modelo, ativo ou PDF da organização B. | RLS/Storage negam acesso. |

## 12. Propostas comerciais

| ID | P | Procedimento | Resultado esperado |
|---|:---:|---|---|
| PROP-01 | P1 | Criar proposta para edital ativo com orçamento e tentar edital sem orçamento/excluído. | Elegíveis aparecem; proposta é única por edital/organização; inválidos são rejeitados. |
| PROP-02 | P1 | Conferir inicialização. | Itens do orçamento, representante principal, prazo de entrega, colunas e seções padrão são carregados. |
| PROP-03 | P1 | Selecionar itens, editar somente overrides e salvar rascunho. | Mudança vale apenas na proposta; quantidade não negativa com quatro casas; status `Rascunho`. |
| PROP-04 | P0 | Confirmar alteração permanente de valor final. | Atualiza orçamento e item do edital, recalcula margem/total, volta a rascunho e cria histórico com ator. |
| PROP-05 | P1 | Confirmar mudanças permanentes nos campos permitidos e tentar campo proibido. | Descrição, marca, modelo, fabricante, unidade e quantidade sincronizam; demais são rejeitados. |
| PROP-06 | P1 | Selecionar quantidade `3` e valor final `150,00`. | Total de linha `R$ 450,00`; total da proposta soma somente itens selecionados e linhas arredondadas. |
| PROP-07 | P1 | Conferir extenso para `R$ 100,00`, `R$ 1,01`, zero e centavos. | `cem reais`, singular/plural e centavos correspondem ao valor numérico arredondado. |
| PROP-08 | P2 | Ativar, renomear, redimensionar e reordenar colunas; criar/reutilizar/remover personalizada. | PDF/preview respeita configuração; largura aceita 5% a 100%; valores ficam na coluna correta. |
| PROP-09 | P2 | Ativar/reordenar seções, inserir bloco, usar variáveis e salvar seção reutilizável padrão. | Conteúdo e ordem persistem; nova proposta recebe padrões. |
| PROP-10 | P1 | Configurar data, representante, entrega, validade, pagamento, logo, marca-d'água, rodapé e assinatura. | Preview e PDF refletem opções e dados atuais sem inserir automaticamente informação não selecionada. |
| PROP-11 | P1 | Finalizar sem item ou sem coluna; depois cumprir ambos. | Incompleta é rejeitada; válida fica `Finalizada`, com data e versão incrementada. |
| PROP-12 | P1 | Alterar proposta finalizada. | Retorna a `Rascunho`, limpa finalização e exige nova conferência. |
| PROP-13 | P1 | Sair/trocar com alteração não salva e escolher continuar/descartar. | Modal próprio preserva ou descarta conforme escolha, sem ação acidental. |
| PROP-14 | P1 | Gerar PDF curto e multipágina. | Nome `Proposta Final - {edital}.pdf` é seguro; tabela não corta; assinatura fica no fim da última página sem sobrepor. |
| PROP-15 | P0 | Gerar duas versões e abrir histórico. | Cada PDF/snapshot é imutável, privado e baixável; total, itens, status, autor e data corretos. |
| PROP-16 | P0 | Acessar proposta/PDF da organização B ou item alheio ao orçamento. | RPC, RLS, triggers e Storage rejeitam. |

## 13. Sincronização, acesso e banco

| ID | P | Procedimento | Resultado esperado |
|---|:---:|---|---|
| SYNC-01 | P1 | Abrir duas sessões e alterar edital, orçamento, item, fornecedor e exclusão. | Segunda sessão atualiza por realtime/polling sem recarregar manualmente. |
| SYNC-02 | P1 | Manter formulário sujo enquanto outra sessão altera/exclui o registro. | Rascunho local não é sobrescrito; aviso persistente informa conflito. |
| SYNC-03 | P1 | Omitir notificação realtime e aguardar polling; ocultar aba; salvar durante refresh. | Polling recupera; pausa em aba oculta e durante salvamento; retoma com snapshot coerente. |
| SYNC-04 | P0 | Encerrar sessão ou iniciar refresh novo antes de resposta antiga. | Resposta atrasada não repopula dados; requisição mais nova vence. |
| ACL-01 | P0 | Para cada tabela/RPC/Storage alterado, testar anônimo, analista autorizado, não autorizado, admin A e admin B. | Matriz de permissão corresponde ao perfil e isola organizações. |
| ACL-02 | P0 | Tentar trocar `organization_id`, criador e atribuição por chamada direta. | Organização/criador imutáveis; atribuição limitada a analista da mesma organização. |
| ACL-03 | P0 | Tentar executar funções internas de consistência diretamente. | `anon` e `authenticated` não possuem execução; somente RPCs públicas previstas funcionam. |
| DB-01 | P0 | Rodar verificador de checksums/migrações. | Histórico imutável, manifesto coerente e nenhuma migração alterada retroativamente. |
| DB-02 | P0 | Executar `db push --dry-run` em homologação e revisar plano. | Somente migrações esperadas aparecem, no ambiente correto e sem comando destrutivo inesperado. |
| DB-03 | P0 | Aplicar em base com dados legados e em base vazia descartável. | Dados são preservados e schema final é equivalente. |
| DB-04 | P0 | Reaplicar e simular falha transacional. | Reaplicação não tem pendência; falha não deixa objetos/dados parciais e permite recuperação. |
| DB-05 | P1 | Conferir constraints, cascatas, unicidade, triggers e precisão do domínio alterado. | Banco rejeita invariantes inválidas mesmo sem frontend. |

## 14. Experiência, acessibilidade e compatibilidade

| ID | P | Procedimento | Resultado esperado |
|---|:---:|---|---|
| UX-01 | P1 | Executar fluxo somente por teclado, inclusive modais e menu. | Ordem lógica, foco visível, foco preso no modal e retorno ao acionador. |
| UX-02 | P1 | Inspecionar nomes acessíveis, rótulos, mensagens e contraste. | Controles têm nome/estado; erros usam texto e região viva; contraste AA. |
| UX-03 | P2 | Testar 320 px, tablet e desktop com zoom de 200%. | Sem perda de conteúdo/ação; rolagem horizontal fica limitada a tabelas. |
| UX-04 | P1 | Testar carregamento, sucesso, erro, vazio, confirmação e duplo clique. | Feedback bloqueia duplicidade, explica próximo passo e não deixa estado indefinido. |
| UX-05 | P2 | Validar versões atuais de Chrome e Edge. | Fluxos selecionados e downloads funcionam de modo equivalente. |
| UX-06 | P1 | Compilar Storybook e inspecionar componentes alterados, sem publicá-lo. | Catálogo compila; tokens/componentes são reutilizados; artefato Pages não contém Storybook. |

## 15. Publicação e critérios de saída

| ID | P | Procedimento | Resultado esperado |
|---|:---:|---|---|
| REL-01 | P0 | Comparar `.release/manifest.json` do frontend e backend. | Arquivos idênticos; branch `homolog`; commits/migrações existem e pertencem à branch. |
| REL-02 | P1 | Executar testes automatizados, build de homologação e Storybook. | `npm test`, `npm run build:homolog` e `npm run build-storybook` concluem sem falha. |
| REL-03 | P0 | Validar workflows da entrega. | Integridade, migração quando aplicável e Pages concluem com evidências. |
| REL-04 | P0 | Comparar commit remoto, workflow e `deployment.json`; abrir a URL final. | Os três apontam para a entrega esperada e a aplicação está operacional. |
| REL-05 | P1 | Arquivar relatório da rodada com casos selecionados e resultados. | Escopo, aprovações, falhas, evidências e risco residual ficam rastreáveis. |

A rodada é aprovada quando: todos os casos selecionados foram executados; não há defeito P0/P1 aberto; P2/P3 possuem decisão registrada; testes/build/workflows passaram; migrações e RLS foram comprovadas quando aplicáveis; e o commit correto foi observado na URL de homologação.

## 16. Modelo de relatório da rodada

```text
Entrega:
Data/hora:
Responsável:
Frontend commit:
Backend commit:
Migrações:
Domínios afetados:
Justificativa da seleção:
Casos CORE executados:
Casos de regressão executados:
Resultados (aprovado/reprovado/bloqueado/N/A):
Defeitos e severidade:
Evidências/URLs:
Risco residual:
Decisão: aprovar | rejeitar | repetir
Aprovador:
```

## 17. Rastreabilidade da cobertura

Este plano foi derivado do comportamento observável na branch `homolog`, incluindo `web/index.html`, `web/app.js`, `web/declarations.js`, `web/company-data.js`, `web/commercial-proposals.js`, testes automatizados, workflows, schema e migrações. Ele é deliberadamente independente da especificação de produção: funcionalidades exclusivas de homologação podem ser testadas aqui sem antecipar sua incorporação em `docs/especificacao-tecnica/ESPECIFICACAO_TECNICA_GLL.md`.
