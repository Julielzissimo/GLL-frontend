import '../../web/project-management/model.js';
import '../../web/project-management/components.js';
import '../../web/project-management/project-management.css';
export default {title:'Patterns/Gestão do Projeto',tags:['autodocs']};
const issue={id:'example',number:42,repository:'GLL-frontend',title:'Revisar filtros do backlog',labels:['type:ux-ui','priority:medium'],fields:{Status:'Homologação'},assignees:['responsavel']};
export const IssueCard={render:()=>window.GLLProjectComponents.card(issue)};
export const EmptyState={render:()=>window.GLLProjectComponents.empty('Nenhuma demanda encontrada para os filtros selecionados.')};
export const Board={render:()=>`<div class="pm-board">${['Backlog','Homologação','Concluído'].map(s=>`<section class="pm-column"><h2>${s}</h2>${s==='Homologação'?window.GLLProjectComponents.card(issue):''}</section>`).join('')}</div>`};
