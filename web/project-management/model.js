(function(root) {
  const statuses=['Backlog','Planejado','Ready','Em desenvolvimento','Em revisão','Homologação','Bloqueado','Pronto para produção','Concluído','Cancelado'];
  const types={feature:'Feature',improvement:'Improvement',bug:'Bug',refactor:'Refactor','tech-debt':'Technical Debt','ux-ui':'UX/UI',security:'Security',docs:'Documentation',infrastructure:'Infrastructure'};
  const priorities={critical:'Crítica',high:'Alta',medium:'Média',low:'Baixa'};
  function label(item,prefix) {return (item.labels||[]).find(l=>l.startsWith(prefix+':'))?.slice(prefix.length+1)||'';}
  function value(item,key) {
    if(key==='type') return item.fields.Tipo||types[label(item,'type')]||'Sem tipo';
    if(key==='status') return item.fields.Status||(item.state==='CLOSED'?'Concluído':'Backlog');
    if(key==='priority') return item.fields.Prioridade||priorities[label(item,'priority')]||'Sem prioridade';
    if(key==='module') return item.fields['Módulo']||label(item,'module');
    if(key==='release') return item.fields.Release||item.milestone?.title||'';
    if(key==='assignee') return item.assignees.join(', ');
    return item[key]||'';
  }
  function filterItems(items,filters={}) {
    return items.filter(item=>Object.entries(filters).every(([key,filter])=>!filter||(key==='search'?`${item.number} ${item.title} ${item.body}`.toLocaleLowerCase('pt-BR').includes(filter.toLocaleLowerCase('pt-BR')):key==='assignee'?item.assignees.includes(filter):value(item,key)===filter)));
  }
  function groupItems(items,key) {return items.reduce((groups,item)=>{const name=value(item,key)||'Sem definição';(groups[name]??=[]).push(item);return groups;},{});}
  root.GLLProjectModel={statuses,types,priorities,value,filterItems,groupItems};
})(typeof window==='undefined'?globalThis:window);
