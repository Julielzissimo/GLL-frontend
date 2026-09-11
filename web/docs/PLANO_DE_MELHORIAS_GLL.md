# Plano de Melhorias e Lacunas — GLL

**Revisão:** 2.1 · **Data da análise:** 10/09/2026 · **Atualização de promoção:** 11/09/2026.

Este plano renova o diagnóstico anterior, preserva os identificadores IMP e prioriza o trabalho restante conforme o código atual. Funcionalidade implementada, publicação na web e aceite de negócio são registros distintos. As ações abaixo são propostas; esta revisão documental não implementa as correções.

**Atualização de 11/09/2026:** a base descrita abaixo foi promovida para produção com a aba `Fornecedores` bloqueada na navegação. A tabela, a RLS e os adaptadores de persistência foram promovidos como preparação técnica, mas o cadastro mestre continua indisponível ao operador e sem integração aos fornecedores livres dos itens. A especificação técnica 2.8 registra o estado promovido.

## 1. Base da revisão e limites

As referências remotas dos dois repositórios foram atualizadas antes da análise.

| Repositório | Produção — main | Homologação — homolog | Diferença funcional observada |
|---|---|---|---|
| GLL-frontend | `8665c3b` | `42d5836` | Cadastro/edição de fornecedores, pesquisa por nome/tags e limitação visual das tags sem limitar o cadastro. |
| GLL-backend | `453cfb6` | `b7f75a5` | Tabela de fornecedores, RLS e migração `20260910120000_add_suppliers.sql`. |

Esses commits identificam a base auditada, anterior à publicação desta revisão. `main` estava contida em `homolog` nos dois repositórios. A especificação técnica vigente é a versão 2.7, referente à produção; o cadastro próprio de fornecedores ainda não integra essa versão.

**Verificado na análise de 10/09:** código dos adaptadores/interface, schema, sete migrações em homologação, workflows, histórico Git e assets públicos dos dois ambientes. `index.html`, `env.js` e `app.js` retornaram HTTP 200; o JavaScript publicado correspondeu à branch de cada ambiente. A suíte então passou **13/13 testes em homologação**; produção continha 11 testes versionados. Na promoção de 11/09, a suíte passou **14/14 testes** e os dois builds foram gerados localmente. São serviços/DOM simulados, sem exercitar o Supabase real. Não houve alteração de dados operacionais nesta análise.

**A verificar no ambiente:** configurações administrativas de autenticação, rotação histórica de senhas, MFA, histórico remoto das migrações, backups e restauração. Não houve ensaio completo de revogação/CRUD com múltiplos usuários reais. Ausência de evidência no repositório não comprova ausência de configuração no serviço.

**Estados:** Aberto — ação necessária; Parcial — parte implementada e pendência identificada; Atendido no escopo atual — comportamento existente, mantendo regressão; A verificar no ambiente — depende de evidência operacional. **P0:** segurança/integridade imediata; **P1:** confiabilidade/operação; **P2:** qualidade e evolução técnica; **P3:** expansão de negócio.

## 2. Correções do diagnóstico anterior

| Tema | Estado atual | Ajuste no plano |
|---|---|---|
| Usuário removido | Login/restauração e RLS exigem cadastro em `app_users`. | Retirar a afirmação de acesso livre por perfil criado em memória. Revogação completa permanece em IMP-001. |
| Gestão de usuários | Navegação Usuários desabilitada; administração orientada ao Supabase. Rotinas legadas e políticas amplas persistem. | Controle na interface não substitui autorização na API: IMP-011 passa a P0. |
| Campos dos itens | Custo, margem, fornecedores e resultado já são editáveis. Frete legado ainda recebe valores fixos no salvamento. | Concentrar IMP-003 na perda residual comprovada. |
| Identificação do edital | SQL usa cascatas de atualização; IndexedDB trata dependentes em transação. | IMP-004 deixa de ser correção crítica; ID interno imutável é evolução arquitetural. |
| Migrações/testes | Migrações versionadas, publicação automatizada e testes já existem. | IMP-012/013 passam a tratar baseline, cobertura e CI obrigatório. |
| Sessão/sincronização | Restauração, saída local, limpeza, avisos e atualização periódica estão em produção. | IMP-016 foca conflitos de gravação, ainda sem bloqueio por versão. |
| Seed remoto | Login/restauração não aplicam demonstração ao Supabase vazio. | IMP-018 atendido no código; regressão explícita de base vazia ainda pendente. |
| Orçamentos | Vínculo, importação, sincronização bidirecional, cálculos, modal e CSV já existem. | IMP-023 sobe para P1 por falhas parciais e exclusões compartilhadas. |
| Fornecedores | Persistência própria promovida, mas navegação bloqueada; nomes/URLs livres nos itens seguem disponíveis. | IMP-028 trata habilitação, consolidação e integração, sem reconstruir a base técnica. |
| Anexos/indicadores | Arquivo privado de edital, itens vencidos, resumos e pendências já existem. | Separar essas entregas de gestão documental completa e indicadores históricos. |

## 3. Carteira priorizada

| ID | Prioridade atual | Estado | Próximo resultado esperado |
|---|---|---|---|
| IMP-011 | P0 | Parcial | Administração protegida por autorização real. |
| IMP-002 | P0 | Parcial | Legado privado com acesso restrito e retenção definida. |
| IMP-003 | P0 | Parcial | Edição sem apagar campos legados não editados. |
| IMP-001 | P1 | Parcial | Revogação completa e auditável. |
| IMP-005 | P1 | Parcial / a verificar | Demonstração isolada e rotação histórica comprovada. |
| IMP-012 | P1 | Parcial | Instalação e atualização reproduzíveis. |
| IMP-013 | P1 | Parcial | Testes relevantes obrigatórios no CI. |
| IMP-014 | P1 | A verificar no ambiente | Backup completo com restauração demonstrada. |
| IMP-015 | P1 | Parcial | Datas e arredondamentos consistentes. |
| IMP-016 | P1 | Parcial | Gravações concorrentes sem sobrescrita silenciosa. |
| IMP-017 | P1 | Parcial / a verificar | Política de autenticação/sessão validada. |
| IMP-023 | P1 | Parcial | Orçamento e edital coerentes após falhas. |
| IMP-024 | P1 | Parcial | Regras essenciais garantidas no banco. |
| IMP-027 | P1 | Parcial | Anexos e registros recuperáveis após falhas compostas. |
| IMP-029 | P1 | Aberto | Procedimentos coerentes e promoção rastreável. |
| IMP-004 | P2 | Atendido no fluxo atual / evolução aberta | Regressão das cascatas e decisão sobre ID imutável. |
| IMP-010 | P2 | Aberto | Ciclo de vida definido com o negócio. |
| IMP-020 | P2 | Aberto | Paginação e listagens completas em maior volume. |
| IMP-021 | P2 | Aberto | Falhas detectáveis com contexto e responsável. |
| IMP-022 | P2 | Parcial | Uso acessível e responsivo validado. |
| IMP-025 | P2 | Parcial | Documentos com arquivo, validade e versão. |
| IMP-026 | P2 | Parcial | Finalidade e limites do modo local claros. |
| IMP-028 | P2 | Parcial — somente homolog | Cadastro de fornecedores consolidado. |
| IMP-018 | Manutenção | Atendido no fluxo remoto | Login nunca altera dados por seed. |

IMP-010 foi colocado após riscos de dados/operação; auditoria de ações sensíveis continua prioritária em IMP-001/011/023. IMP-024 subiu de P2 para P1 porque validação apenas na tela não protege gravações pela API.

## 4. Segurança e integridade imediata

### IMP-011 — Aplicar autorização por função

**Situação:** `is_app_user()` bloqueia anônimos e contas Auth não cadastradas. Entretanto, as políticas permitem todas as operações aos cadastrados, inclusive em `app_users` e estruturas privadas legadas, sem avaliar `role`. A aba Usuários desabilitada não restringe a API. Evidências: [schema/RLS][B1], `setPage()` e [interface][F7].

**Próxima ação:** restringir administração no servidor, definir administrador/operador e impedir autoelevação e remoção indevida do último administrador. Papéis adicionais e separação por organização dependem de necessidade validada.

**Aceite:** testar diretamente a API com anônimo, Auth sem cadastro, usuário comum e administrador; usuário comum não administra perfis nem acessa dados restritos; proteção funciona independentemente da tela.

### IMP-002 — Concluir a proteção do legado privado

**Situação:** modelo antigo e seed operacional saíram do frontend público. `app_settings`, `budget_models`, `budget_rows` e arquivos privados permanecem no backend. As políticas permitem acesso aos cadastrados; ausência de consumo pela tela não significa inacessibilidade pela API. Evidências: [schema][B1] e [runbook][B3].

**Próxima ação:** junto de IMP-011, restringir o legado e definir finalidade, responsável e prazo de retenção. Remoção depende de decisão explícita sobre preservação histórica e recuperação.

**Aceite:** bundle sem dados operacionais/pessoais reais; usuário sem atribuição administrativa não acessa o legado; retenção e eventual retirada registradas. Esta revisão não reproduz dados desses registros.

### IMP-003 — Preservar campos não editados do item

**Situação:** custo e fornecedores já são editáveis. `collectItemData()` ainda envia sempre `freight_included: 1` e `unit_freight: 0`, embora esses campos não apareçam no formulário. Evidência: [coleta de campos][F2].

**Próxima ação:** preservar valores existentes não editáveis; definir modelo canônico, espelhamento legado e migração antes de remover campos; conferir conversores orçamento–edital.

**Aceite:** item sintético com frete não padrão mantém esse valor após editar só a descrição nos dois adaptadores; ida e volta preserva custo, fornecedores, resultado e campos não alterados.

## 5. Confiabilidade e operação

### IMP-001 — Completar a revogação de acesso

**Situação:** login/restauração exigem perfil e as atualizações detectam sua retirada. A rotina legada `deleteUser()` remove apenas `app_users`; não exclui/bane Auth nem audita a ação. A administração usual é feita no Supabase. Evidências: [adaptadores/autenticação][F1] e [RLS][B1].

**Próxima ação:** definir procedimento de bloqueio/reativação e revogação de sessões, com autor, motivo e data; automatizar no servidor se a gestão pela aplicação voltar ao escopo. Distinguir bloqueio de dados pela RLS, invalidação de tokens e exclusão de conta.

**Aceite:** revogado não acessa tabelas/Storage nem recupera acesso ao recarregar; novos logins e renovação seguem a política; comportamento e prazo de invalidação de tokens vigentes documentados/testados; evento auditado.

### IMP-005 — Isolar credenciais de demonstração

**Situação:** modo local recria administrador demonstrativo conhecido. Builds publicados usam Supabase e não o criam remotamente. Rotação histórica nos dois projetos é exigida no runbook, mas não foi comprovada. Evidências: `ensureDefaultUser()` em [F1], [build][F4] e [runbook][B3].

**Próxima ação:** restringir demonstração a uso local; impedir fallback silencioso para IndexedDB em implantação com configuração remota ausente/inválida; registrar confirmação de rotação sem senhas. Se houver uso local operacional, adotar primeiro acesso controlado.

**Aceite:** builds remotos não caem em demonstração; conta remota não aceita credencial demonstrativa; confirmação de rotação registrada por ambiente, sem segredo.

### IMP-012 — Fechar migrações e baseline

**Situação:** sete migrações em homolog, seis em main; schema consolidado; workflow manual de produção com confirmação, dry-run e conferência de histórico. IndexedDB já usa versão e `onupgradeneeded` (4 em homolog, 3 em produção). A primeira migração SQL pressupõe tabelas existentes. O schema já cria fornecedores, enquanto sua migração usa `CREATE TABLE` sem cláusula de existência; executar ambos sem alinhar histórico pode conflitar. Evidências: [migrações][B2], [workflow][B4] e adaptador local [F1].

**Próxima ação:** definir baseline, registro de histórico por ambiente, instalação de banco vazio, comparação schema/implantação, upgrades IndexedDB e recuperação por migração. Versionar a validação de homologação.

**Aceite:** banco limpo e versão anterior chegam ao mesmo schema; reaplicação reconhece o que já foi executado; histórico remoto coincide com arquivos; recuperação ensaiada. Migração de fornecedores precede seu frontend na promoção.

### IMP-013 — Tornar testes e CI uma barreira de publicação

**Situação:** 13 testes passam em homolog, sendo 11 de sessão/sincronização já promovidos e dois relativos a fornecedores. São mocks. Pages só gera/publica builds, sem executar testes nem validar PR; alteração isolada no arquivo de testes não está no filtro. Evidências: [suíte][F5] e [Pages][F6].

**Próxima ação:** validar PR e pré-deploy com suíte existente e builds. Priorizar testes que reproduzam frete legado, RLS/Auth, migrações, concorrência, sincronização/cascatas, cálculos, fornecedores e CSV; acrescentar regressão explícita de login/restauração com base Supabase vazia e sem seed. Distinguir integração real de mocks.

**Aceite:** teste falho bloqueia entrega; riscos críticos possuem cenários com dados sintéticos; evidência de homologação identifica commit e resultado. Backend também valida schema/RLS no CI.

### IMP-014 — Comprovar backup e restauração

**Situação:** CSV de itens existe, com escape e proteção de fórmulas, mas não exporta todos os campos, relações e anexos, nem restaura a base. Não foi encontrado ensaio versionado de recuperação; backup gerenciado permanece a verificar. Evidência: `downloadItemsCsv()` em [F1].

**Próxima ação:** inventariar proteção atual e definir frequência, retenção, responsável, perda máxima aceitável de dados (RPO) e tempo de recuperação (RTO). Incluir banco, relações, Storage e IndexedDB se operacional.

**Aceite:** restaurar cópia isolada, verificar vínculos/arquivos/acesso e medir RPO/RTO; procedimento registrado. CSV continua exportação operacional, sem ser apresentado como backup.

### IMP-015 — Uniformizar datas e precisão monetária

**Situação:** banco usa `numeric` e total gerado em orçamento. Parte das datas é texto, `opening_date` é `date` e fornecedores em homolog usa `timestamptz`. Cliente calcula com `Number` e arredondamentos distribuídos; timestamps não são uniformes. Evidências: [schema][B1] e cálculos/normalizadores [F1].

**Próxima ação:** definir fuso dos eventos, UTC para timestamps e tratamento de datas civis; migrar legados e padronizar arredondamento de custo/lance/margem/quantidade/totais, com representação decimal controlada no cliente.

**Aceite:** cliente/banco/exportação concordam em centavos, custo zero, margem negativa e quantidade fracionária; sessões mantêm o horário correto entre dispositivos; regra documentada e testada.

### IMP-016 — Impedir sobrescrita por concorrência

**Situação:** broadcast, foco/conectividade e consulta periódica de 15 segundos atualizam dados e preservam formulários com aviso. Não há versão esperada no salvamento; fornecedor aberto não integra `selectedDataSignature()`. Evidência: [atualização entre clientes][F3] e gravações [F1].

**Próxima ação:** versão/timestamp controlado no servidor e condição de atualização/exclusão; permitir comparar/recarregar diante de conflito. Cobrir fornecedores e exclusão durante edição.

**Aceite:** segundo cliente salva versão antiga e recebe conflito explícito, com rascunho preservado, sem sobrescrever o primeiro nem recriar registro removido. Aviso visual não substitui condição no banco.

### IMP-017 — Consolidar autenticação e sessão

**Situação:** restauração, saída local, limpeza e descarte de respostas tardias já existem. Modo local usa SHA-256 simples; Supabase é carregado por versão principal, sem fixação exata. Política real de senha, recuperação, MFA e proteção contra tentativas não foi auditada. Evidências: [frontend][F1] e [testes][F5].

**Próxima ação:** validar/documentar configurações; definir política de sessão, fixar dependência e avaliar CSP. Se local for operacional, substituir derivação demonstrativa de senha por mecanismo apropriado.

**Aceite:** expiração, saída, falha de rede e troca de usuário não exibem dados da sessão anterior; recuperação/controles adotados testados em homolog; versões e configuração identificáveis. Revogação administrativa está em IMP-001.

### IMP-023 — Tornar o vínculo orçamento–edital consistente

**Situação:** vínculo, importação, cálculos e sincronização bidirecional existem, porém com múltiplas chamadas sequenciais no cliente. Excluir item vinculado pelo edital exclui o item do orçamento e seus correspondentes em outros editais por cascata. Excluir orçamento desvincula cabeçalhos, mas elimina itens compartilhados; retirar só o vínculo preserva itens independentes. Evidências: `syncBidWithQuotation()`, `saveItem()`, `deleteItem()` e `syncQuotationItemToBids()` em [F1], mais [FKs][B1].

**Próxima ação:** validar efeito das alterações/exclusões compartilhadas com o negócio, mostrar alcance e executar mudanças relacionadas em transação no servidor, com repetição segura. Garantir que item e edital se refiram ao mesmo orçamento. Registrar autoria; proposta/PDF continua evolução opcional.

**Aceite:** dois editais no mesmo orçamento, troca/retirada de vínculo, números duplicados e falha intermediária cobertos; operação confirma tudo ou preserva estado anterior; exclusão informa registros afetados; cálculos seguem IMP-015.

### IMP-024 — Garantir regras essenciais no banco

**Situação:** existem FKs/unicidade; orçamento tem não negatividade e total gerado; fornecedores tem validação básica de nome/site. Núcleo ainda aceita status/modalidade livres, flags numéricas e valores sem todas as restrições da tela. Evidência: [schema][B1].

**Próxima ação:** restrições de domínio, valores, flags, listas JSON e pertencimento de vínculos; auditar/migrar legados antes de ativá-las. Não exigir quantidade inteira onde a aplicação aceita fração.

**Aceite:** API rejeita payload inválido e aceita dados válidos; correção de legados rastreável; banco e adaptadores concordam nas regras.

### IMP-027 — Recuperar falhas entre banco e anexos

**Situação:** upload tenta limpar arquivo novo se metadados falharem. Mas exclusão remove o objeto antes da linha; falha posterior deixa referência sem arquivo. Remoção do anexo substituído pode falhar e apenas gerar aviso no console. Salvar edital antes do upload também admite sucesso parcial. Evidência: `saveBidAttachment()`, `deleteBid()` e `saveBid()` em [F1].

**Próxima ação:** fluxo recuperável com estado de processamento, repetição segura e reconciliação de objetos órfãos; integrar IMP-014/021. Sincronização de itens permanece em IMP-023, sem duplicar escopo.

**Aceite:** falhas em cada etapa não aparecem como sucesso completo; repetição converge para estado consistente; não há perda de anexo sem recuperação prevista.

### IMP-029 — Alinhar procedimentos e documentação de promoção

**Situação:** README orienta não aplicar `private-settings.sql` em novas instalações, mas runbook e seção de implantação da especificação ainda mandam executá-lo. A especificação 2.7 contém trechos antigos sobre permissões, gestão de usuários ativa e quantidade inteira. Já descrever 11 testes e não incluir cadastro próprio de fornecedores é coerente com produção. Evidências: [README][B5], [runbook][B3] e [especificação][B6].

**Próxima ação:** corrigir runbook na próxima entrega operacional; na próxima promoção aprovada, revisar integralmente a especificação contra o código promovido, incluindo fornecedores somente se fizer parte dela. Registrar versões e validações por ambiente.

**Aceite:** procedimento único e coerente; documentação no fluxo de promoção; `main` integrada de volta a `homolog` nos dois repositórios por merge. Esta revisão altera o plano e não antecipa atualização da especificação em homolog.

## 6. Qualidade e evolução técnica

### IMP-004 — Decidir sobre identificação técnica imutável

**Situação:** SQL usa `ON UPDATE CASCADE`; IndexedDB atualiza dependentes em transação; caminho do anexo independe da identificação. Não foi comprovada falha atual de cascata. Evidências: [schema][B1] e `saveBid()`/`updateChildrenBidId()` em [F1].

**Próxima ação:** regressão da renomeação com dependentes ativos, orçamento e anexo; avaliar ID interno antes de criar integrações/vínculos externos.

**Aceite:** renomear preserva relações e download nos dois adaptadores; decisão arquitetural registrada. Migrar ID somente com benefício/compatibilidade demonstrados.

### IMP-010 — Definir ciclo de vida e histórico de status

**Situação:** quatro status e normalização de `Reprovada` para `Desclassificado`; sem máquina/histórico de transições. `is_won` é resultado de item, não ciclo completo do edital. Evidências: [frontend][F1] e [schema][B1].

**Próxima ação:** acordar significado, transições, pré-condições, reabertura e motivo; persistir origem/destino, autor/data no servidor. Cancelada, suspensa, vencida e perdida são propostas a validar, não requisitos aprovados.

**Aceite:** API rejeita transição inválida; mudanças têm trilha consultável; efeito em itens vencidos e indicadores definido/testado.

### IMP-020 — Paginar e reduzir recargas completas

**Situação:** `getAll()` usa `select('*')`; `reloadData()` busca oito conjuntos completos em homolog, inclusive periodicamente. Filtros/resumos são locais. Já existem índices de vínculos de orçamento. Evidências: [carregamento][F3] e [schema][B1].

**Próxima ação:** filtros/paginação/agregações no servidor, campos necessários e atualização incremental; medir índices com consultas reais.

**Aceite:** massa maior que o limite de retorno da API aparece completa por páginas, com contagens/exportação corretas; atualização não recarrega tudo; orçamento de desempenho e medição registrados.

### IMP-021 — Dar visibilidade às falhas operacionais

**Situação:** mensagens na tela/console, sem mecanismo central de erros, métricas e alertas identificado no repositório. Evidência: tratamento de erros em [F1].

**Próxima ação:** registrar ambiente, versão, operação, duração e correlação, priorizando login, carga, sincronização e anexos; definir responsável por alerta.

**Aceite:** falha sintética detectada/localizável sem senhas, tokens ou conteúdo comercial/pessoal nos logs; retenção e resposta definidas.

### IMP-022 — Completar acessibilidade e usabilidade

**Situação:** navegação responsiva, tabelas com rolagem, diálogos, carregamento e rascunhos já evoluíram. Ainda há linhas de itens/documentos/falhas acionadas só por clique, semântica de abas incompleta e confirmações nativas; não houve auditoria completa. Evidências: [HTML][F7], `renderItems()`, `renderDocuments()` e `renderFailures()` em [F1].

**Próxima ação:** validar teclado, foco, leitor de tela, contraste, erros, zoom/celular e conteúdo longo; acesso às tags completas sem depender de hover. Usar WCAG 2.2 AA como referência de aceite.

**Aceite:** fluxos essenciais completados por teclado/leitor; diálogos com foco adequado; conteúdo e ações acessíveis com zoom/tela pequena; achados demonstrados corrigidos.

### IMP-025 — Expandir gestão documental

**Situação:** checklist e um arquivo privado por edital, até 20 MB, com download autenticado. Checklist não tem arquivo próprio, emissão/validade, responsável ou versão. Evidências: [bucket/documentos][B1] e [interface][F7].

**Próxima ação:** documentos reutilizáveis com arquivo privado, validade, responsável, versões, alertas e retenção; acesso autenticado ou URLs assinadas curtas conforme o fluxo.

**Aceite:** usuário autorizado consulta versão/vencimento; acesso indevido bloqueado; substituição preserva histórico exigido e recuperação.

### IMP-026 — Esclarecer persistência local

**Situação:** builds usam Supabase; IndexedDB separado com armazenamento por ambiente; não há sincronização offline entre adaptadores. Evidências: `createStore()` em [F1] e [build][F4].

**Próxima ação:** manter finalidade explícita de demonstração/desenvolvimento e explicar limpeza do navegador. Uso offline operacional requer escopo próprio de transferência/sincronização e conflitos.

**Aceite:** usuário sabe onde os dados estão; falha de rede não promete gravação sincronizada; anunciar transferência/sincronização só depois de implementada e validada.

### IMP-028 — Habilitar e consolidar fornecedores

**Situação:** produção contém tabela, RLS, adaptadores e interface de cadastro/edição de nome, site opcional, contato e tags, mas a navegação mantém a página bloqueada. A busca preparada ignora acentos/maiúsculas; tags são deduplicadas e limitadas apenas na apresentação. O cadastro não se relaciona aos textos livres dos itens e não possui arquivamento/exclusão ou regra de duplicidade. Evidências: [fornecedores][F8], [schema][B1] e [testes][F5].

**Próxima ação:** validar persistência/RLS com usuários reais, definir identidade, duplicidade e arquivamento e então habilitar cadastro, consulta, edição, pesquisa e tags na web. Integrar seleção aos itens preservando texto histórico. Cobrir conflito em edição e falha de carregamento.

**Aceite:** cadastro validado em homolog, persistência/RLS testadas e tags preservadas. Integração aos itens e comparação de preços são entregas separadas; não bloqueiam automaticamente a promoção do cadastro básico aprovado.

### IMP-018 — Manter a remoção do seed remoto automático

**Situação:** atendido no fluxo remoto atual por inspeção do código; login/restauração não inserem demonstração. Rotinas de seed persistem, mas inicialização/reset demonstrativo está isolado do uso remoto autenticado. Evidências: `main()`, `enterAuthenticatedView()` e `resetSeedData()` em [F1]. A suíte ainda não possui regressão explícita de base remota vazia; incluí-la em IMP-013.

**Aceite de manutenção:** Supabase vazio permanece vazio após login, restauração/atualização; esses caminhos não chamam `applySeed()`. Reavaliar em novos fluxos de inicialização.

## 7. Expansões de negócio — P3

Dependem de prioridade e processo validado, após contenção dos riscos de autorização e perda de dados.

| Evolução | Base existente | Incremento proposto |
|---|---|---|
| Alertas de prazos/sessões | Próximas sessões e pendências no painel. | Alertas configuráveis, responsáveis e entrega acompanhada. |
| Captura de editais | Cadastro manual, link e anexo. | Extração de portais/PDFs, revisão humana e origem rastreável. |
| Comparação de fornecedores | Nomes/URLs nos itens; cadastro próprio em homolog. | Cotações estruturadas por item, validade e condições comerciais. |
| Resultados | Item vencido, status e falhas. | Colocação, concorrentes, motivos de perda e resultado consolidado. |
| Pós-licitação | Sem módulo identificado. | Contrato, empenho, entrega, faturamento e recebimento. |
| Indicadores históricos | Contadores, totais/margens atuais. | Conversão/vitória, tendências e causas de falha por período. |
| Biblioteca/propostas | Checklist, anexo e orçamentos. | Documentos reutilizáveis e proposta/PDF determinístico. |
| E-mail/calendário | Sem integração identificada. | Eventos/notificações com autorização, preferências e rastreamento. |
| API de negócio/webhooks | Cliente já usa API Supabase. | Contratos estáveis de integração, escopo, idempotência e auditoria. |

## 8. Sequência e responsabilidades propostas

As etapas indicam ordem, não prazo contratado. Estimativas/datas e a pessoa responsável devem ser definidas ao fechar o escopo de cada entrega.

| Etapa | Escopo e dependências | Responsabilidade proposta | Evidência para avançar |
|---|---|---|---|
| 1 — Conter riscos | IMP-011/002/003; testes específicos de 013 e verificação de backup/rotação (014/005). | Desenvolvimento + administração Supabase. | Permissões testadas, legado restrito e frete preservado em homolog. |
| 2 — Gravações confiáveis | IMP-012/013/014/015/016/023/024/027; completar 001/017. Fundação pode ocorrer em paralelo à etapa 1. | Desenvolvimento/operação; negócio decide exclusões compartilhadas. | Banco reproduzível, restauração comprovada e conflitos/falhas sem perda silenciosa. |
| 3 — Consolidar uso | IMP-010/020/021/022/025/026/028 e avaliação de 004. | Produto + desenvolvimento + usuários de homolog. | Fluxos aceitos, desempenho medido e lacunas tratadas no escopo aprovado. |
| 4 — Expandir | Incrementos P3 selecionados conforme necessidade e dependências. | Responsável de negócio + desenvolvimento. | Benefício, regras e aceite definidos por incremento. |

IMP-029 acompanha toda promoção; IMP-018 permanece em regressão. O cadastro básico de fornecedores já disponível pode seguir promoção própria após aceite, migração verificada e documentação, sem esperar todas as evoluções de IMP-028.

## 9. Critérios de entrega e promoção

**Implementado em homologação:**

1. Identificar ID, escopo, responsável, risco, dependências e aceite.
2. Versionar alterações/migrações e recuperação proporcional ao risco.
3. Executar testes relevantes, distinguindo mocks de integração real.
4. Publicar em `homolog` e validar na web, registrando URL, commit e resultado.
5. Atualizar o plano com evidências/pendências e obter aceite de negócio quando necessário.

**Concluído em produção, após aprovação da promoção:**

1. Revisar/atualizar `docs/especificacao-tecnica/ESPECIFICACAO_TECNICA_GLL.md` e documentos afetados no mesmo fluxo.
2. Aplicar migrações antes do frontend dependente; publicar versão identificada e validar na web.
3. Confirmar que documentação corresponde ao código/schema implantados.
4. Atualizar refs remotas e fazer merge de `main` em `homolog` nos dois repositórios, preservando histórico/ajustes, sem rebase ou force push.
5. Publicar `homolog`, comprovar que contém o commit promovido e repetir validação se a sincronização afetar código implantável.

Não atualizar a especificação por alteração limitada a homolog. Manter distinguíveis os estados implementado, publicado em homologação, validado pelo negócio e promovido.

## 10. Fontes e rastreabilidade

- **Frontend auditado:** [adaptadores/código][F1], [itens][F2], [sincronização][F3], [build][F4], [testes][F5], [Pages][F6], [HTML][F7] e [fornecedores][F8].
- **Backend auditado:** [schema/RLS][B1], [migrações][B2], [runbook][B3], [workflow][B4], [README][B5] e [especificação 2.7][B6]. Links do backend exigem acesso ao repositório privado.
- **Publicações anteriores à revisão:** [homolog em 42d5836][D1] e [promoção de sessão em 8665c3b][D2], concluídas com sucesso. Pages não comprova sozinho configuração do banco.
- **Ambientes:** [homologação][H1] e [produção][H2]. **Leitura desta revisão:** [plano em homologação][H3].

[F1]: https://github.com/Julielzissimo/GLL-frontend/blob/42d583647aee837d698fd191cbe3970c088f12d5/web/app.js
[F2]: https://github.com/Julielzissimo/GLL-frontend/blob/42d583647aee837d698fd191cbe3970c088f12d5/web/app.js#L2441
[F3]: https://github.com/Julielzissimo/GLL-frontend/blob/42d583647aee837d698fd191cbe3970c088f12d5/web/app.js#L1595
[F4]: https://github.com/Julielzissimo/GLL-frontend/blob/42d583647aee837d698fd191cbe3970c088f12d5/scripts/build-web.mjs
[F5]: https://github.com/Julielzissimo/GLL-frontend/blob/42d583647aee837d698fd191cbe3970c088f12d5/scripts/session-sync.test.mjs
[F6]: https://github.com/Julielzissimo/GLL-frontend/blob/42d583647aee837d698fd191cbe3970c088f12d5/.github/workflows/pages.yml
[F7]: https://github.com/Julielzissimo/GLL-frontend/blob/42d583647aee837d698fd191cbe3970c088f12d5/web/index.html
[F8]: https://github.com/Julielzissimo/GLL-frontend/blob/42d583647aee837d698fd191cbe3970c088f12d5/web/app.js#L2676
[B1]: https://github.com/Julielzissimo/GLL-backend/blob/b7f75a5/supabase/schema.sql
[B2]: https://github.com/Julielzissimo/GLL-backend/tree/b7f75a5/supabase/migrations
[B3]: https://github.com/Julielzissimo/GLL-backend/blob/b7f75a5/docs/supabase.md
[B4]: https://github.com/Julielzissimo/GLL-backend/blob/b7f75a5/.github/workflows/supabase-production.yml
[B5]: https://github.com/Julielzissimo/GLL-backend/blob/b7f75a5/README.md
[B6]: https://github.com/Julielzissimo/GLL-backend/blob/453cfb6/docs/especificacao-tecnica/ESPECIFICACAO_TECNICA_GLL.md
[D1]: https://github.com/Julielzissimo/GLL-frontend/actions/runs/34475032066
[D2]: https://github.com/Julielzissimo/GLL-frontend/actions/runs/34473503527
[H1]: https://julielzissimo.github.io/GLL-frontend/homolog/
[H2]: https://julielzissimo.github.io/GLL-frontend/
[H3]: https://julielzissimo.github.io/GLL-frontend/homolog/docs/plano-de-melhorias.html
