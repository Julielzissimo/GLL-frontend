(function(root) {
  function escape(value) {return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function link(url,text) {try {const parsed=new URL(url);if(parsed.protocol!=='https:'||parsed.hostname!=='github.com') return escape(text);} catch {return escape(text);}return `<a href="${escape(url)}" target="_blank" rel="noopener noreferrer">${escape(text)} ↗</a>`;}
  function badge(text) {return `<span class="pm-badge">${escape(text)}</span>`;}
  function empty(text='Nenhum item encontrado.') {return `<div class="pm-empty" role="status">${escape(text)}</div>`;}
  function card(item) {const m=root.GLLProjectModel;return `<article class="pm-issue" draggable="true" data-issue="${escape(item.id)}"><small>${escape(item.repository)} #${item.number}</small><button class="pm-title" data-detail="${escape(item.id)}">${escape(item.title)}</button><div>${badge(m.value(item,'type'))} ${badge(m.value(item,'priority'))}</div><small>${escape(m.value(item,'assignee')||'Sem responsável')}</small><label>Mover para<select data-status="${escape(item.id)}">${m.statuses.map(s=>`<option ${m.value(item,'status')===s?'selected':''}>${escape(s)}</option>`).join('')}</select></label></article>`;}
  root.GLLProjectComponents={escape,link,badge,empty,card};
})(typeof window==='undefined'?globalThis:window);
