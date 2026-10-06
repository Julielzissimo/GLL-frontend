(function(root){
  const M=root.GLLProjectModel,C=root.GLLProjectComponents,E=C.escape;
  const tabs=['Visão Geral','Backlog','Board','Roadmap','Releases','Homologação','Produção','Bugs','Changelog','Decisões'];
  function createProjectManagement({container,getClient,isAdmin}) {
    let items=[],cursor=null,hasMore=false,total=0,tab='Visão Geral',repository='GLL-backend',metadata=null,filters={},group='',sort='updatedAt',data=null,busy=false,epoch=0,lastSync=null,initialized=false;
    const option=(v,label=v)=>`<option value="${E(v)}">${E(label)}</option>`;
    async function api(action,params={}) {
      if(!isAdmin()) throw new Error('Somente Administradores podem acessar a Gestão do Projeto.');
      const client=getClient();
      if(!client) throw new Error('A integração GitHub requer uma sessão autenticada no GLL.');
      const {data,error}=await client.functions.invoke('project-management',{body:{action,repository,...params}});
      if(error) {
        let message=data?.error;
        try {message=(await error.context.json()).error;} catch {}
        throw new Error(message||'Não foi possível acessar a integração. Verifique a conexão e a publicação do backend.');
      }
      if(data?.error) throw new Error(data.error);
      return data;
    }
    function error(message) {container.querySelector('[data-error]').innerHTML=`<div class="pm-error" role="alert">${E(message)}</div>`;}
    function visible() {return M.filterItems(items,{...filters,...(tab==='Bugs'?{type:'Bug'}:{})}).sort((a,b)=>String(M.value(b,sort)).localeCompare(String(M.value(a,sort)),'pt-BR'));}
    function shell() {
      container.innerHTML=`<div class="page-heading"><div><span class="eyebrow">Configurações</span><h1>Gestão do Projeto</h1><p>Acompanhe o desenvolvimento do GLL no GitHub.</p></div></div><nav class="pm-tabs" aria-label="Gestão do Projeto">${tabs.map(t=>`<button type="button" class="quiet-action" data-tab="${E(t)}" aria-current="${t===tab?'page':'false'}">${E(t)}</button>`).join('')}</nav><div class="pm-toolbar"><label>Repositório <select data-repository>${['GLL-backend','GLL-frontend'].map(r=>`<option ${repository===r?'selected':''}>${r}</option>`).join('')}</select></label><button class="quiet-action" data-refresh>Atualizar</button><button class="primary-action" data-create>Nova demanda</button><span class="pm-muted" data-sync>${lastSync?'Atualizado em '+E(new Date(lastSync).toLocaleString('pt-BR')):'Ainda não sincronizado'}</span></div><div data-error></div><div data-content></div><dialog class="pm-dialog" aria-labelledby="pmDialogTitle"><div data-dialog></div></dialog>`;
    }
    async function load({more=false}={}) {
      if(busy) return;
      busy=true;const generation=epoch;
      shell();container.setAttribute('aria-busy','true');container.querySelector('[data-content]').innerHTML=C.empty('Carregando informações do GitHub…');
      try {
        const connection=await api('connection');
        if(!connection.configured) {
          container.querySelector('[data-content]').innerHTML=`<section class="section-band"><h2>Conectar ao GitHub Project</h2><p>Informe o número do Project dedicado ao GLL. Os campos de gestão serão preparados no GitHub.</p><p class="pm-muted">A credencial deve estar cadastrada pelo responsável técnico nos secrets de homologação. Não informe tokens nesta tela.</p><form class="pm-form" data-submit="configure">${field('number','Número do Project',{value:'1'})}<div class="pm-wide" role="alert" data-form-error></div><button class="primary-action" type="submit">Vincular Project</button></form></section>`;
          return;
        }
        if(!metadata) metadata=await api('metadata');
        if(['Releases','Changelog'].includes(tab)) data=await api('releases',{refresh:true});
        else if(['Homologação','Produção'].includes(tab)) data=await api('environment',{environment:tab==='Produção'?'production':'homolog',refresh:true});
        else {
          const result=await api('items',{cursor:more?cursor:null});
          if(generation!==epoch)return;
          items=more?[...items,...result.items.filter(i=>!items.some(old=>old.id===i.id))]:result.items;
          cursor=result.pageInfo.endCursor;hasMore=result.pageInfo.hasNextPage;total=result.totalCount;data=result;
        }
        if(generation!==epoch)return;
        lastSync=new Date().toISOString();initialized=true;render();
      } catch(e) {if(generation===epoch){error(e.message);container.querySelector('[data-content]').innerHTML=C.empty('Não foi possível sincronizar esta visualização. Use Atualizar para tentar novamente.');}}
      finally {if(generation===epoch){busy=false;container.setAttribute('aria-busy','false');}}
    }
    function filterBar() {
      return `<div class="pm-filters"><label>Pesquisar<input data-filter="search" value="${E(filters.search||'')}" placeholder="ID, título ou descrição"></label>${[['type','Tipo'],['status','Status'],['priority','Prioridade'],['module','Módulo'],['release','Release'],['assignee','Responsável']].map(([key,title])=>`<label>${title}<select data-filter="${key}">${option('','Todos')}${[...new Set(items.flatMap(i=>key==='assignee'?i.assignees:[M.value(i,key)]))].filter(Boolean).sort().map(v=>`<option ${filters[key]===v?'selected':''}>${E(v)}</option>`).join('')}</select></label>`).join('')}<label>Agrupar<select data-group>${option('','Sem agrupamento')}${[['status','Status'],['type','Tipo'],['release','Release'],['module','Módulo']].map(([v,l])=>`<option value="${v}" ${group===v?'selected':''}>${l}</option>`).join('')}</select></label><label>Ordenar<select data-sort>${[['updatedAt','Atualização recente'],['title','Título (Z–A)'],['priority','Prioridade (Z–A)']].map(([v,l])=>`<option value="${v}" ${sort===v?'selected':''}>${l}</option>`).join('')}</select></label></div>`;
    }
    function table(rows) {return rows.length?`<div class="table-wrap"><table><thead><tr>${['ID','Título','Tipo','Status','Prioridade','Módulo','Release','Responsável','Atualização'].map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(i=>`<tr><td>${E(i.repository)} #${i.number}</td><td><button class="pm-title" data-detail="${E(i.id)}">${E(i.title)}</button></td>${['type','status','priority','module','release','assignee'].map(k=>`<td>${E(M.value(i,k)||'—')}</td>`).join('')}<td>${E(new Date(i.updatedAt).toLocaleDateString('pt-BR'))}</td></tr>`).join('')}</tbody></table></div>`:C.empty();}
    function render() {
      const target=container.querySelector('[data-content]');const rows=visible().filter(i=>i.repository===repository);
      container.querySelector('[data-sync]').textContent=lastSync?'Atualizado em '+new Date(lastSync).toLocaleString('pt-BR'):'';
      if(['Backlog','Bugs','Board'].includes(tab)) {
        const body=tab==='Board'?`<div class="pm-board">${M.statuses.map(status=>`<section class="pm-column" data-drop="${E(status)}"><h2>${E(status)} · ${rows.filter(i=>M.value(i,'status')===status).length}</h2>${rows.filter(i=>M.value(i,'status')===status).map(C.card).join('')}</section>`).join('')}</div>`:group?Object.entries(M.groupItems(rows,group)).map(([name,entries])=>`<h2>${E(name)}</h2>${table(entries)}`).join(''):table(rows);
        target.innerHTML=filterBar()+body+pagination();
      } else if(tab==='Visão Geral') {
        const counts=[['Backlog',rows.filter(i=>M.value(i,'status')==='Backlog').length],['Em desenvolvimento',rows.filter(i=>M.value(i,'status')==='Em desenvolvimento').length],['Homologação',rows.filter(i=>M.value(i,'status')==='Homologação').length],['Bugs abertos',rows.filter(i=>M.value(i,'type')==='Bug'&&i.state==='OPEN').length],['Bugs críticos',rows.filter(i=>M.value(i,'type')==='Bug'&&M.value(i,'priority')==='Crítica'&&i.state==='OPEN').length]];
        const next=metadata?.milestones.filter(m=>m.state==='open').sort((a,b)=>(a.due_on||'9999').localeCompare(b.due_on||'9999'))[0];
        target.innerHTML=`<p>${C.link(data?.project?.url,'Abrir GitHub Project')} · Homologação: <strong>${E(metadata?.branches.homolog)}</strong> · Produção: <strong>${E(metadata?.branches.production)}</strong></p><dl class="pm-metrics">${counts.map(([label,n])=>`<div><dt>${label}</dt><dd>${n}</dd></div>`).join('')}</dl><p class="pm-muted">Indicadores dos ${rows.length} itens carregados deste repositório.${hasMore?' Carregue os demais itens para completar a contagem.':''}</p>${next?`<section class="section-band"><h2>Próxima entrega: ${E(next.title)}</h2><p>${next.closed_issues} de ${next.open_issues+next.closed_issues} Issues concluídas · ${next.due_on?E(new Date(next.due_on).toLocaleDateString('pt-BR')):'Sem previsão'}</p><progress class="pm-progress" value="${next.closed_issues}" max="${Math.max(1,next.open_issues+next.closed_issues)}"></progress></section>`:C.empty('Nenhum milestone aberto para a próxima entrega.')}${pagination()}`;
      } else if(tab==='Roadmap') {
        target.innerHTML=`<label>Organizar por <select data-roadmap><option>Milestone</option><option>Mês</option><option>Trimestre</option><option>Release</option></select></label><div data-roadmap-content>${roadmap('Milestone')}</div>`;
      } else if(['Releases','Changelog'].includes(tab)) {
        target.innerHTML=(tab==='Releases'?'<button class="primary-action" data-release>Preparar release</button>':'')+(data?.releases?.length?data.releases.map(r=>`<article class="pm-release"><h2>${C.link(r.html_url,r.name||r.tag_name)}</h2><p>${E(r.tag_name)} · ${r.draft?'Rascunho':r.prerelease?'Pré-release':'Publicada'} · ${E(r.author?.login)} · ${E(new Date(r.published_at||r.created_at).toLocaleDateString('pt-BR'))}</p><pre class="pm-detail">${E(r.body||'Sem notas de versão.')}</pre></article>`).join(''):C.empty('Nenhuma release encontrada.'));
      } else if(['Homologação','Produção'].includes(tab)) {
        target.innerHTML=`<p>Branch <strong>${E(data.branch)}</strong> · ${E(data.head?.slice(0,12))}${data.aheadBy!==null?' · '+data.aheadBy+' commits à frente de produção':''}</p><p class="pm-muted">${E(data.note)}</p><h2>${tab==='Produção'?'Última release':'Commits em homologação'}</h2>${tab==='Produção'?(data.releases?.[0]?C.link(data.releases[0].html_url,data.releases[0].tag_name):C.empty('Nenhuma release publicada.')):''}<ul>${data.commits.map(c=>`<li>${C.link(c.html_url,c.sha.slice(0,8))} ${E(c.commit.message.split('\n')[0])}</li>`).join('')}</ul><h2>Histórico de execução</h2><ul>${data.runs.map(r=>`<li>${C.link(r.html_url,r.name)} · ${E(r.conclusion||r.status)} · ${E(r.head_sha.slice(0,8))} · ${E(new Date(r.created_at).toLocaleString('pt-BR'))}</li>`).join('')}</ul><p class="pm-muted">Registre os testes e a aprovação abrindo a demanda no Backlog.</p>`;
      } else if(tab==='Decisões') target.innerHTML=`<div class="pm-toolbar"><button class="primary-action" data-decision>Registrar decisão</button><button class="quiet-action" data-audit>Consultar auditoria</button></div>${table(rows.filter(i=>i.labels.includes('decision')||i.title.startsWith('ADR:')))}${pagination()}`;
    }
    function pagination() {return `<p class="pm-muted">${items.length} itens carregados do Project (${total} no total, incluindo outros repositórios e rascunhos).</p>${hasMore?'<button class="quiet-action" data-more>Carregar mais itens</button>':''}`;}
    function roadmap(mode) {
      const milestones=metadata?.milestones||[];
      if(!milestones.length)return C.empty('Nenhum milestone disponível.');
      const groups={};
      for(const m of milestones) {const date=m.due_on?.slice(0,10);const key=mode==='Mês'?(date?.slice(0,7)||'Sem previsão'):mode==='Trimestre'?(date?`${date.slice(0,4)} · Q${Math.ceil(Number(date.slice(5,7))/3)}`:'Sem previsão'):m.title;(groups[key]??=[]).push(m);}
      return Object.entries(groups).map(([name,entries])=>`<section class="pm-release"><h2>${E(name)}</h2>${entries.map(m=>`<p>${C.link(m.html_url,m.title)} · ${E(m.state==='open'?'Planejada':'Concluída')} · ${m.closed_issues}/${m.closed_issues+m.open_issues} Issues · ${m.due_on?E(new Date(m.due_on).toLocaleDateString('pt-BR')):'Sem previsão'}</p><progress class="pm-progress" value="${m.closed_issues}" max="${Math.max(1,m.closed_issues+m.open_issues)}"></progress>`).join('')}</section>`).join('');
    }
    function dialog(title,content) {const d=container.querySelector('dialog');d.querySelector('[data-dialog]').innerHTML=`<h2 id="pmDialogTitle">${E(title)}</h2>${content}<div class="pm-toolbar"><button class="quiet-action" data-close>Fechar</button></div>`;d.showModal();}
    function field(name,title,{textarea=false,options=null,required=true,value=''}={}) {return `<label ${textarea?'class="pm-wide"':''}>${E(title)}${options?`<select name="${name}" ${required?'required':''}>${options}</select>`:textarea?`<textarea name="${name}" ${required?'required':''}>${E(value)}</textarea>`:`<input name="${name}" value="${E(value)}" ${required?'required':''} maxlength="${name==='title'?240:5000}">`}</label>`;}
    function createForm(kind) {
      const milestones=option('','Sem release definida')+(metadata?.milestones||[]).filter(m=>m.state==='open').map(m=>option(m.number,m.title)).join('');
      let fields='';
      if(kind==='create') fields=field('title','Título')+field('type','Tipo',{options:Object.entries(M.types).map(([v,l])=>option(v,l)).join('')})+field('priority','Prioridade',{options:Object.entries(M.priorities).map(([v,l])=>option(v,l)).join('')})+field('module','Módulo')+field('milestone','Release prevista / milestone',{options:milestones,required:false})+field('assignee','Responsável',{options:option('','Sem responsável')+(metadata?.assignees||[]).map(a=>option(a.login)).join(''),required:false})+field('description','Contexto / descrição',{textarea:true})+`<details class="pm-wide"><summary>Detalhes e evidências (bugs e critérios de aceitação)</summary><div class="pm-form">${['Problema','Objetivo','Solução proposta','Critérios de aceitação','Impactos','Dependências','Ambiente','Passos para reproduzir','Comportamento atual','Comportamento esperado','Evidências','Severidade','Navegador','Dispositivo','Usuário afetado','Frequência'].map(n=>field('detail:'+n,n,{textarea:true,required:false})).join('')}</div></details>`;
      if(kind==='decision') fields=field('title','Título')+field('status','Status',{options:['Proposta','Aceita','Substituída','Rejeitada','Depreciada'].map(s=>option(s)).join('')})+['Contexto','Problema','Alternativas','Decisão','Justificativa','Consequências'].map(n=>field('detail:'+n,n,{textarea:true})).join('');
      if(kind==='prepare_release') fields=field('version','Versão (vMAJOR.MINOR.PATCH)')+field('milestone','Milestone',{options:milestones})+field('reason','Justificativa para mudança MAJOR',{textarea:true,required:false})+'<p class="pm-wide">Será criado um rascunho no GitHub com notas agrupadas pelas categorias das Issues.</p>';
      dialog(kind==='create'?'Nova demanda':kind==='decision'?'Registrar decisão':'Preparar release',`<form class="pm-form" data-submit="${kind}">${fields}<div class="pm-wide" role="alert" data-form-error></div><button class="primary-action" type="submit">${kind==='prepare_release'?'Criar rascunho':'Salvar no GitHub'}</button></form>`);
    }
    async function detail(id) {
      const item=items.find(i=>i.id===id);if(!item)return;
      dialog(item.title,`<p>${C.link(item.url,`${item.repository} #${item.number}`)} · ${C.badge(M.value(item,'status'))}</p><pre class="pm-detail">${E(item.body)}</pre><p>Criado por ${E(item.author)} em ${E(new Date(item.createdAt).toLocaleDateString('pt-BR'))}</p><div class="pm-toolbar"><button class="quiet-action" data-edit="${E(id)}">Alterar campos</button><button class="quiet-action" data-validation="${E(id)}">Registrar teste</button><button class="primary-action" data-approve="${E(id)}">Aprovar para produção</button></div><h3>Pull Requests vinculadas</h3>${item.prs?.length?item.prs.map(p=>`<p>${C.link(p.url,p.title)} · ${E(p.headRefName||'')}</p>`).join(''):C.empty('Nenhuma PR de fechamento vinculada.')}<button class="quiet-action" data-history="${E(id)}">Carregar comentários e vínculos</button><div data-history-content></div>`);
    }
    function editForm(id,action) {
      const item=items.find(i=>i.id===id);if(!item)return;
      container.querySelector('dialog').close();
      let fields=action==='update'?field('field','Campo',{options:['Status','Prioridade','Módulo','Release','Data prevista'].map(s=>option(s)).join('')})+field('value','Novo valor',{options:M.statuses.filter(s=>s!=='Pronto para produção').map(s=>option(s)).join('')}):field('reason',action==='approve'?'Justificativa da aprovação':'Observações e motivo',{textarea:true});
      if(action==='validation')fields=field('result','Resultado',{options:['Aguardando teste','Em teste','Aprovado','Reprovado','Necessita ajuste'].map(s=>option(s)).join('')})+fields+field('expected','Comportamento esperado',{textarea:true,required:false})+field('evidence','Evidência (descrição ou link)',{textarea:true,required:false});
      dialog(action==='approve'?'Aprovar para produção':action==='validation'?'Registrar teste':'Alterar demanda',`<form class="pm-form" data-submit="${action}" data-item="${E(id)}">${fields}<p class="pm-wide">${action==='approve'?'O aceite será registrado. Não haverá merge ou publicação automática.':'A atualização será persistida no GitHub.'}</p><div class="pm-wide" role="alert" data-form-error></div><button class="primary-action" type="submit">Confirmar</button></form>`);
    }
    async function move(id,status) {
      const item=items.find(i=>i.id===id);if(!item||busy)return;
      if(status==='Pronto para produção'){editForm(id,'approve');return;}
      busy=true;
      try {await api('update',{repository:item.repository,number:item.number,updatedAt:item.updatedAt,itemUpdatedAt:item.itemUpdatedAt,field:'Status',value:status});}
      catch(e){error(e.message);busy=false;render();return;}
      busy=false;await load();
    }
    container.addEventListener('click',async event=>{
      const b=event.target.closest('button');if(!b)return;
      if(b.hasAttribute('data-close')) {container.querySelector('dialog').close();return;}
      if(busy)return;
      try {
        if(b.dataset.tab){tab=b.dataset.tab;await load();}
        else if(b.hasAttribute('data-refresh')){metadata=null;await load();}
        else if(b.hasAttribute('data-more')) await load({more:true});
        else if(b.hasAttribute('data-create'))createForm('create');
        else if(b.hasAttribute('data-release'))createForm('prepare_release');
        else if(b.hasAttribute('data-decision'))createForm('decision');
        else if(b.dataset.detail)await detail(b.dataset.detail);
        else if(b.dataset.edit)editForm(b.dataset.edit,'update');
        else if(b.dataset.approve)editForm(b.dataset.approve,'approve');
        else if(b.dataset.validation)editForm(b.dataset.validation,'validation');
        else if(b.dataset.history){b.disabled=true;const item=items.find(i=>i.id===b.dataset.history);const result=await api('detail',{repository:item.repository,number:item.number});container.querySelector('[data-history-content]').innerHTML=result.comments.map(c=>`<article><p>${C.link(c.html_url,c.user.login)}</p><pre class="pm-detail">${E(c.body)}</pre></article>`).join('')+result.timeline.filter(t=>t.source?.issue||t.commit_url).map(t=>`<p>${C.link(t.source?.issue?.html_url||t.commit_url,t.source?.issue?.title||t.commit_id)}</p>`).join('');}
        else if(b.hasAttribute('data-audit')){const result=await api('audit');dialog('Auditoria',result.events.map(e=>`<article class="pm-release"><strong>${E(e.operation)} · ${E(e.resource)}</strong><p>${E(e.outcome)} · ${E(e.actor_id)} · ${E(new Date(e.created_at).toLocaleString('pt-BR'))}</p><pre class="pm-detail">${E(JSON.stringify({antes:e.previous_value,depois:e.new_value},null,2))}</pre></article>`).join('')||C.empty('Nenhuma ação registrada.'));}
      } catch(e){error(e.message);b.disabled=false;}
    });
    container.addEventListener('change',async event=>{
      const el=event.target;
      if(el.dataset.filter){filters[el.dataset.filter]=el.value;render();}
      else if(el.hasAttribute('data-repository')){repository=el.value;metadata=null;await load();}
      else if(el.hasAttribute('data-group')){group=el.value;render();}
      else if(el.hasAttribute('data-sort')){sort=el.value;render();}
      else if(el.hasAttribute('data-roadmap'))container.querySelector('[data-roadmap-content]').innerHTML=roadmap(el.value);
      else if(el.dataset.status)await move(el.dataset.status,el.value);
      else if(el.name==='field'){
        const label=el.form.elements.value.parentElement;
        const choices=el.value==='Status'?M.statuses.filter(s=>s!=='Pronto para produção'):el.value==='Prioridade'?Object.values(M.priorities):null;
        label.outerHTML=field('value','Novo valor',{options:choices?.map(s=>option(s)).join('')||null});
      }
    });
    container.addEventListener('dragstart',event=>{const card=event.target.closest('[data-issue]');if(card&&!busy)event.dataTransfer.setData('text/plain',card.dataset.issue);});
    container.addEventListener('dragover',event=>{if(event.target.closest('[data-drop]'))event.preventDefault();});
    container.addEventListener('drop',event=>{const col=event.target.closest('[data-drop]');if(col){event.preventDefault();void move(event.dataTransfer.getData('text/plain'),col.dataset.drop);}});
    container.addEventListener('submit',async event=>{
      const form=event.target;if(!form.dataset.submit)return;event.preventDefault();if(busy)return;
      const values=Object.fromEntries(new FormData(form));values.details={};
      for(const key of Object.keys(values))if(key.startsWith('detail:')){values.details[key.slice(7)]=values[key];delete values[key];}
      const item=items.find(i=>i.id===form.dataset.item);
      if(item)Object.assign(values,{repository:item.repository,number:item.number,updatedAt:item.updatedAt,itemUpdatedAt:item.itemUpdatedAt});
      busy=true;form.querySelector('button[type="submit"]').disabled=true;
      try {await api(form.dataset.submit,values);container.querySelector('dialog').close();busy=false;metadata=null;await load();}
      catch(e){form.querySelector('[data-form-error]').textContent=e.message;form.querySelector('button[type="submit"]').disabled=false;busy=false;}
    });
    return {async showPage(){if(!isAdmin())return; if(!initialized)await load();},reset(){epoch++;items=[];metadata=null;initialized=false;busy=false;lastSync=null;container.innerHTML='';}};
  }
  root.GLLProjectManagement={createProjectManagement};
})(window);
