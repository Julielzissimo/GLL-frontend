# Débito Técnico — GLL

**Revisão:** 1.6 · **Data de referência:** 26/09/2026 · **Estado:** débitos ativos de `main` e `homolog`.

Este documento centraliza somente o débito técnico que ainda existe no GLL. Débitos resolvidos são retirados deste registro e transferidos para o Histórico de Melhorias e Débitos (documento interno).

O Plano de Melhorias (documento interno) apresenta prioridade, consequência e benefício em visão executiva. A especificação técnica descreve o comportamento promovido para produção. Este arquivo não altera o funcionamento do sistema nem autoriza a exclusão de dados.

## 1. Como este registro deve ser usado

- Registrar aqui todo novo débito técnico identificado.
- Relacionar o débito à melhoria `IMP` correspondente quando existir.
- Não remover campo, tabela, arquivo ou dado antes de medir uso, dependências e existência de conteúdo em cada ambiente.
- Para quitar um débito, exigir migração ou recuperação, teste, publicação e validação em homologação; depois, retirá-lo deste arquivo e registrá-lo no histórico.
- Atualizar a especificação técnica somente quando a correção for promovida para produção.

**Estados:** Aberto; Parcial; A verificar no ambiente.

**Criticidade:** Crítica — risco imediato de perda ou alteração; Alta — segurança ou continuidade; Média — qualidade, custo ou crescimento; Baixa — manutenção preventiva.

## 2. Resumo executivo

| ID | Débito técnico | Criticidade | Estado | Melhoria relacionada |
|---|---|---|---|---|
| DT-002 | Campos legados duplicam ou ocultam informações | Média | Aberto | IMP-002, IMP-030 |
| DT-003 | Tabelas, stores e arquivos descontinuados permanecem armazenados | Média | Aberto | IMP-002, IMP-030 |
| DT-004 | Exclusão lógica não possui lixeira, restauração ou retenção definida | Alta | Parcial | IMP-014, IMP-030 |
| DT-005 | Parte dos metadados úteis de auditoria não é exibida ou historizada | Média | Parcial | IMP-010, IMP-015, IMP-021, IMP-030 |
| DT-007 | Barreiras automáticas existem, mas integrações reais ainda têm cobertura insuficiente | Alta | Parcial | IMP-013 |
| DT-008 | Backup e restauração completos não foram comprovados | Alta | A verificar | IMP-014 |
| DT-009 | Migração de datas e valores foi aplicada, mas a conversão real e os casos-limite ainda não foram validados funcionalmente | Alta | Parcial; a verificar no ambiente | IMP-015 |
| DT-010 | Gravações concorrentes podem sobrescrever alterações | Alta | Aberto | IMP-016 |
| DT-011 | Configurações reais de autenticação ainda não foram auditadas por completo | Alta | A verificar | IMP-001, IMP-005, IMP-017 |
| DT-013 | Parte das regras existe somente na interface | Alta | Parcial | IMP-024 |
| DT-014 | Banco e armazenamento de anexos podem divergir após falha | Alta | Parcial | IMP-027 |
| DT-016 | Listagens carregam conjuntos completos de dados | Média | Aberto | IMP-020 |
| DT-017 | Falhas não possuem observabilidade e alerta centralizados | Média | Aberto | IMP-021 |
| DT-018 | Acessibilidade ainda não foi validada de ponta a ponta | Média | Parcial | IMP-022 |
| DT-019 | Modo local não possui sincronização e pode reter legado no navegador | Média | Parcial | IMP-026, IMP-030 |
| DT-020 | Fornecedores estruturados não estão integrados aos itens | Média | Parcial em homologação | IMP-028 |
| DT-021 | Autorização por perfil precisa de matriz de testes reais | Média | Parcial avançado | IMP-011 |
| DT-022 | Trilha de status foi aplicada remotamente, mas falta validação funcional com perfis reais | Média | Parcial; a verificar no ambiente | IMP-010 |

## 3. Inventário de campos e informações não exibidas

Um campo oculto pode ser necessário. Esta seção distingue metadados técnicos que devem ser mantidos de informações que precisam ser expostas, reduzidas ou governadas.

### 3.1 Campos ativos e necessários

| Campo ou grupo | Onde permanece | Exibição atual | Motivo e ação recomendada |
|---|---|---|---|
| Identificadores `id` | Todas as entidades principais | Não são exibidos, exceto o ID comercial do orçamento | Mantêm identidade e relações. Devem ficar protegidos e incluídos em backup. |
| Chaves `bid_id`, `quotation_id`, `quotation_item_id` e `supplier_id` | Itens, documentos, falhas, orçamentos e produtos | O usuário vê o registro relacionado, não a chave técnica | Necessárias aos vínculos. Não remover. Validar integridade nas migrações e restaurações. |
| `organization_id` | Editais, orçamentos, fornecedores, produtos, usuários e configurações | O nome da organização aparece em contexto; o identificador não | Necessário para separar empresas e aplicar RLS. Manter oculto. |
| `auth_user_id` e `created_by` | Usuários, editais e orçamentos | A interface mostra o nome do criador, não o UUID | Necessários à autoria e autorização. Mostrar somente em diagnóstico administrativo controlado. |
| `assigned_to` | Editais e orçamentos | A atribuição é gerenciada por analista, mas o valor técnico não aparece no formulário do registro | Manter e criar histórico de atribuições para auditoria. |
| `created_at` e `updated_at` | Editais, orçamentos, usuários, fornecedores, produtos e outros registros | Quase nunca exibidos | Úteis para suporte, mas não substituem histórico. Padronizar formato/fuso e exibir em detalhe administrativo quando necessário. |
| `failure_history.created_at` | Histórico de falhas | Não exibido na tabela de falhas | A data dá contexto de negócio. Deve ser apresentada ao usuário. |
| `deleted_at` | Editais e orçamentos | Registros marcados deixam de aparecer | Necessário à exclusão lógica, mas exige retenção, lixeira e restauração administrativa. |
| `organizations.cnpj` | Organizações | Consultado pelo frontend, mas não exibido; somente o nome aparece | Decidir se o administrador precisa vê-lo. Se não precisar, deixar de consultar o dado. |
| Caminho interno, tipo e outros metadados de `edital_files` | Editais e Storage | Nome, tamanho e ações aparecem; caminho interno não | Necessários para localizar e autorizar arquivos. Manter protegidos e verificar em backup. |
| `quotation_items.total` | Itens de orçamento | Valor é exibido, mas não editável | Campo calculado pelo banco. Manter e testar igualdade com o cálculo da interface. |
| `app_users.created_at` | Usuários | Não exibido | Pode apoiar auditoria de acesso. Avaliar exibição administrativa junto com trilha de criação/remoção. |
| `suppliers.created_at`, `suppliers.updated_at` e equivalentes de produtos | Fornecedores e produtos | Não exibidos | Podem apoiar suporte e auditoria. Padronizar e exibir somente quando houver necessidade definida. |

### 3.2 Registros preservados, mas invisíveis após exclusão

| Informação | Persistência atual | Lacuna | Destino recomendado |
|---|---|---|---|
| Editais com `bids.deleted_at` | Registro, itens, documentos, falhas e anexos permanecem | Não existe lixeira ou restauração na interface | Criar consulta/restauração administrativa, retenção e descarte auditado. |
| Orçamentos com `quotations.deleted_at` | Orçamento e itens permanecem | Não existe lixeira ou restauração na interface | Criar recuperação administrativa e definir retenção e descarte auditado. |
| Arquivos ligados a registros excluídos | Objetos permanecem no bucket privado | Operação comum não os encontra; backup e descarte não estão formalizados | Incluir na reconciliação de anexos, backup e política de retenção. |

## 4. Campos legados ainda preservados

| Campo | Função antiga | Uso atual no código | Risco | Plano de quitação |
|---|---|---|---|---|
| `bids.edital_link` | Campo “Link do edital”, removido da tela | Apenas normalizado na leitura; não existe consulta ou edição na interface | Pode conter informação desconhecida do usuário | Medir preenchimento, exportar se necessário e remover em migração aprovada. |
| `bids.edital_file_path` | Caminho do único anexo antigo | Fallback quando a lista moderna não existe | Remover cedo pode tornar anexo histórico inacessível | Migrar para `edital_files` e testar download. |
| `bids.edital_file_name` | Nome do único anexo antigo | Fallback de compatibilidade | Duplicidade de metadados | Migrar com caminho, tipo e tamanho. |
| `bids.edital_file_type` | Tipo do único anexo antigo | Fallback de compatibilidade | Duplicidade de metadados | Migrar e validar arquivos históricos. |
| `bids.edital_file_size` | Tamanho do único anexo antigo | Fallback de compatibilidade | Duplicidade de metadados | Migrar e validar limites/exibição. |
| `items.description` | Texto técnico e recipiente de compatibilidade em versões antigas | Espelha `technical_registration_text` e é usado como fallback | Duas fontes podem divergir | Migrar todos os registros e adotar um campo canônico. |
| `items.supplier_link` | Um fornecedor por item | Espelha o primeiro valor de `supplier_links` | Pode divergir da lista moderna | Validar lista, interromper espelhamento e remover. |
| `edital_file_blob` no IndexedDB | Arquivo armazenado dentro do registro local | Fallback para bases locais antigas | Dados grandes e invisíveis no navegador | Migrar ao abrir/exportar e testar base antiga antes de retirar. |

Os campos legados ainda ativos devem ser medidos apenas por contagens e classificações administrativas, sem publicar valores operacionais ou pessoais.

## 5. Estruturas e informações descontinuadas

| Estrutura | Situação atual | Consequências de não quitar | Vantagens da quitação | Ação segura |
|---|---|---|---|---|
| `budget_models` | Tabela da antiga aba “Modelo de Orçamento”; não acessada pelo frontend | Dados invisíveis continuam protegidos, copiados e confundidos com o orçamento atual | Modelo de dados mais simples e menor superfície de manutenção | Medir registros, definir retenção, exportar e remover por migração. |
| `budget_rows` | Linhas da antiga aba “Modelo de Orçamento”; não acessadas | Mesmo risco de retenção invisível e custo operacional | Menos dados órfãos e menor custo de backup | Tratar junto com `budget_models`, preservando vínculo histórico quando necessário. |
| `app_settings` | Configurações privadas da antiga proposta/modelo; frontend não consulta | Configuração sem uso ainda exige acesso, segurança e backup | Menor superfície de segurança e instruções mais claras | Classificar conteúdo e remover somente após descartar dependências. |
| `supabase/private-settings.sql` | Script legado de configurações privadas | Pode ser aplicado por engano devido a documentação contraditória | Instalação nova mais previsível | Não automatizar; corrigir guias e retirar após decisão sobre `app_settings`. |
| `supabase/seed-data.json` privado | Fotografia operacional histórica fora da interface | Pode reter informação sensível ou desatualizada sem finalidade definida | Retenção e acesso passam a ser conscientes | Definir proprietário, finalidade, prazo e descarte. Não reproduzir valores neste documento. |
| Stores IndexedDB antigas `budget_models` e `budget_rows` | Podem permanecer em navegadores atualizados, embora o código atual não as acesse | Dados invisíveis ocupam espaço no computador do usuário | Navegador local fica coerente com o modelo atual | Criar migração local controlada ou orientar exportação e limpeza. |

## 6. Demais débitos por domínio

### 6.1 Segurança e acesso

- **DT-011:** confirmar rotação de credenciais, política de senha, recuperação, MFA, proteção contra tentativas e revogação de sessões.
- **DT-021:** testar diretamente a API com anônimo, usuário removido, analista, administrador e usuário de outra organização.
- **Risco de não quitar:** acesso indevido pode não ser detectado pela interface.
- **Benefício:** separação de dados e revogação tornam-se comprováveis.

### 6.2 Banco, migrações e recuperação

- **DT-008:** provar backup e restauração de banco, relações e Storage.
- **DT-013:** levar ao banco regras de domínio ainda existentes apenas na interface.
- **Risco de não quitar:** instalação, recuperação ou integração pode produzir dados inválidos ou ambiente diferente da produção.
- **Benefício:** mudanças previsíveis e recuperação mensurável.

### 6.3 Consistência de gravação

- **DT-009:** validar com dados reais as regras já aplicadas para centavos, arredondamento, datas e fusos, incluindo registros convertidos e casos-limite.
- **DT-010:** impedir sobrescrita por versão antiga.
- **DT-014:** reconciliar banco e anexos após falha.
- **Risco de não quitar:** perda silenciosa, valores divergentes ou sucesso parcial.
- **Benefício:** dados permanecem confiáveis mesmo com duas pessoas ou falha de rede.

### 6.4 Qualidade e operação

- **DT-007:** manter as barreiras do frontend e do backend e ampliar a cobertura de schema, RLS e integrações reais.
- **DT-016:** paginar e atualizar dados de forma incremental.
- **DT-017:** centralizar erros, métricas e alertas sem dados sensíveis.
- **DT-018:** validar fluxos com teclado, leitor de tela, zoom e celular.
- **Risco de não quitar:** falhas chegam ao usuário, diagnóstico demora e desempenho degrada com crescimento.
- **Benefício:** publicações mais seguras e operação sustentável.

### 6.5 Evolução e manutenção

- **DT-019:** deixar explícitos os limites do modo local e limpar legado do IndexedDB.
- **DT-020:** integrar fornecedor/produto estruturado aos itens preservando histórico textual.
- **DT-022:** manter a migração aplicada e validar com usuários e perfis reais as transições com autor, data e motivo.
- **Risco de não quitar:** comportamento ambíguo, duplicidade e decisões sem histórico.
- **Benefício:** evolução do produto com menor retrabalho e maior rastreabilidade.

## 7. Ordem recomendada de quitação

| Ordem | Débitos | Condição de saída |
|---|---|---|
| 1 — Validar comportamento no ambiente remoto | DT-009, DT-022 | Conversões e transições conferidas com dados e perfis reais no Supabase. |
| 2 — Garantir acesso e recuperação | DT-008, DT-011, DT-021 | Revogação e permissões testadas; restauração demonstrada. |
| 3 — Garantir consistência | DT-010, DT-013, DT-014 | Conflitos e falhas não causam estado parcial ou inválido. |
| 4 — Governar legado | DT-002, DT-003, DT-004, DT-005, DT-019 | Cada item possui retenção, migração, consulta ou descarte aprovado. |
| 5 — Sustentar crescimento | DT-007, DT-016, DT-017, DT-018, DT-020 | Publicação protegida, operação observável e experiência validada. |

## 8. Critério para retirar um débito do registro ativo

Um débito só pode ser retirado deste arquivo quando:

1. dependências e dados existentes forem medidos por ambiente;
2. decisão de manter, exibir, migrar ou remover estiver registrada;
3. houver backup, exportação ou reversão proporcional ao risco;
4. migração e código forem testados, incluindo registros antigos;
5. a alteração estiver publicada e validada na web de homologação;
6. a melhoria correspondente também for retirada do Plano de Melhorias;
7. na promoção, a especificação técnica for atualizada no mesmo fluxo;
8. produção for sincronizada de volta para homologação conforme as regras do projeto;
9. solução, data, evidências e testes de regressão forem registrados no Histórico de Melhorias e Débitos.

Para mudanças que envolvam mais de um repositório, o encerramento também exige um manifesto único com os commits esperados de frontend e backend e uma verificação automática de que cada commit está contido nas branches publicadas. A existência do código em uma branch de implementação não constitui entrega.

## 9. Base e limites do levantamento

Base funcional comprometida analisada, anterior aos commits exclusivamente documentais desta revisão: frontend `a9b28a6` em `main` e `b34344a` em `homolog`; backend `8564777` em `main` e `5a4e98f` em `homolog`. `main` está contida em `homolog` nos dois repositórios. Foram inspecionados schema, migrações, adaptadores, interface, testes, documentação e as execuções recentes dos workflows. Alterações locais ainda não comprometidas nos dois repositórios foram preservadas e não foram tratadas como estado publicado.

Não foram consultados ou reproduzidos valores operacionais. O frontend de homologação foi publicado com sucesso no commit `b34344a`, com 40 testes e confirmação do commit na web. O workflow cruzado confirmou manifestos, commits e migrações no backend `5a4e98f`; o workflow protegido comprovou 31 migrações locais e remotas, ausência de pendências e disponibilidade do serviço. Essa evidência confirma a implantação técnica, mas não substitui a validação funcional de dados convertidos e transições com usuários reais. Backup gerenciado, configurações de autenticação, conteúdo efetivo dos campos legados e stores existentes nos navegadores continuam **a verificar no ambiente**.

