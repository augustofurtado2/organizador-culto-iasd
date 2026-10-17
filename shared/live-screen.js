import { enabledItems, getSections, sectionSchedule, TYPES, MEDIA_TYPES, countdown } from './culto.js';
import { esc, icon, href, dateLabel, plannedWindow } from './ui.js';

const typeIcons={welcome:'people',worship:'music',prayer:'people',offering:'book',special_music:'music',children:'people',sermon:'book',video:'play',information:'note',transition:'play',school:'book',closing:'clock'};
const momentPaths={prayer:'<path d="m12 3-3 9-5 5 4 4 4-6 4 6 4-4-5-5-3-9zM12 3v12"/>',offering:'<rect x="3" y="9" width="18" height="12" rx="1"/><path d="M12 9v12M3 13h18M12 9C3 9 4 1 9 4l3 5c9 0 8-8 3-5z"/>',special_music:'<rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/>',transition:'<path d="M3 12h18m-7-7 7 7-7 7"/>'};
const momentIcon=item=>momentPaths[item.type]?`<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${momentPaths[item.type]}</svg>`:icon(typeIcons[item.type]||'note');
export function timelineState(item,view){
  if(view?.active.id===item.id)return 'live';
  if(view?.state.completedItemIds.includes(item.id))return 'completed';
  if(view?.next?.id===item.id)return 'next';
  return 'pending';
}
const labels={live:'AO VIVO',completed:'Concluído',next:'Próximo',pending:'Pendente'};
const stateBadge=state=>`<span class="live-state state-${state}">${labels[state]}</span>`;
const minutes=value=>value==null?'Duração não definida':`${value} ${value===1?'minuto':'minutos'}`;
function clock(value){return value&&Number.isFinite(Date.parse(value))?new Date(value).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):'—';}
function lengthLabel(value){return value>=60?`${Math.floor(value/60)}h${value%60?String(value%60).padStart(2,'0')+'min':''}`:`${value}min`;}
export function scheduleSummary(c){
  const sections=getSections(c).filter(s=>s.enabled).map(s=>{
    const items=enabledItems(c).filter(i=>i.section===s.type),range=sectionSchedule(c,s.type);
    const known=items.filter(i=>i.duration!=null).reduce((n,i)=>n+i.duration,0);
    return {...s,...range,items,known,unknown:items.some(i=>i.duration==null)};
  }).filter(s=>s.items.length);
  const items=enabledItems(c),start=sections[0]?.start,end=sections.at(-1)?.end;
  return {sections,start,end,known:sections.reduce((n,s)=>n+s.known,0),unknown:items.some(i=>i.duration==null)};
}
export function liveTimeline(c,view,filter='all'){
  return getSections(c).filter(s=>s.enabled&&(filter==='all'||filter===s.type)).map(s=>{
    const items=enabledItems(c).filter(i=>i.section===s.type);if(!items.length)return '';
    return `<section class="live-timeline-section"><h3>${esc(s.label)}</h3><ol>${items.map(i=>{
      const state=timelineState(i,view);
      return `<li class="live-timeline-row timeline-moment is-${state}" data-timeline-item="${esc(i.id)}" ${state==='live'?'aria-current="step"':''}><time>${esc(i.computedTime||'—')}</time><span class="live-timeline-dot" aria-hidden="true"></span><div><strong>${esc(i.label)}</strong>${i.responsible?`<span class="muted">${esc(i.responsible)}</span>`:''}</div>${stateBadge(state)}</li>`;
    }).join('')}</ol></section>`;
  }).join('');
}
export function liveEmpty(c,canStart=true){
  return `<section class="v2-card live-empty"><div class="live-empty-icon">${icon('play')}</div><h2>Nenhum culto em andamento</h2><p>Inicie uma programação para usar o modo ao vivo.</p>${c?`<p><strong>${esc(c.title)}</strong> · ${dateLabel(c.date)} · ${c.status==='finished'?'Culto finalizado':'Planejado'}</p>`:''}<div class="action-row">${c&&canStart?`<button class="btn btn-primary" data-live="start" ${enabledItems(c).length?'':'disabled'}>${c.status==='finished'?'Iniciar novamente':'Iniciar culto'}</button>`:''}<a class="btn btn-secondary" href="programacoes.html">Ver programações</a></div></section>`;
}
export function liveScreen(c,view,filter='all'){
  if(!view)return liveEmpty(c);
  const items=enabledItems(c),active=view.active,position=items.findIndex(i=>i.id===active.id)+1;
  const completed=items.filter(i=>view.state.completedItemIds.includes(i.id)).length;
  const percent=Math.round(completed/items.length*100),section=getSections(c).find(s=>s.type===active.section);
  const songs=active.hasSongs?active.songs:[],total=scheduleSummary(c);
  const summary=(label,value,ico)=>`<div class="live-fact">${icon(ico)}<div><span>${label}</span><strong>${esc(value||'—')}</strong></div></div>`;
  return `<section class="live-summary">${summary(c.title,dateLabel(c.date),'calendar')}${summary('Início previsto',c.startTime,'clock')}${summary('Ancião do dia',c.elder,'people')}${summary('Cerimonial',c.ceremonyLead,'people')}<a href="${esc(href('programacao.html',c.id))}">Ver programação completa</a></section>
  <div class="live-operation-grid">
    <section class="v2-card live-focus live-now"><div class="live-now-heading"><span class="live-state state-live">● AGORA</span><span>Momento ${position} de ${items.length} · ${esc(section?.label||'')}</span>${momentIcon(active)}</div><h2>${esc(active.label)}</h2>${active.responsible?`<div class="live-responsible"><span>Responsável</span><strong>${esc(active.responsible)}</strong></div>`:''}<p class="live-planned">${esc(plannedWindow(active))}<span>${minutes(active.duration)}</span></p><div class="live-timers"><div><span>Decorridos</span><strong data-elapsed>${countdown(view.elapsed)}</strong></div><div><span>Restantes</span><strong data-remaining>${countdown(view.remaining)}</strong></div></div><progress data-moment-progress max="100" value="0" aria-label="Tempo decorrido do momento" ${active.duration==null?'hidden':''}></progress><p class="live-time-caption" data-time-caption>${active.duration==null?'Duração não definida. O tempo decorrido continua sendo registrado.':'Tempo contado a partir do início real deste momento.'}</p><p class="live-overtime" data-overtime ${view.overtime?'':'hidden'}>Tempo previsto esgotado. Aguardando avanço do momento.</p></section>
    <section class="v2-card next-focus live-next"><span class="live-eyebrow">Próximo momento</span>${view.next?`${momentIcon(view.next)}<h2>${esc(view.next.label)}</h2>${view.next.responsible?`<p>${esc(view.next.responsible)}</p>`:''}<p class="muted">${esc(view.next.computedTime||'Horário não definido')} · ${minutes(view.next.duration)}</p>`:'<h2>Último momento do culto</h2><p class="muted">Conclua o momento ou finalize o culto.</p>'}</section>
    <section class="v2-card live-controls"><h2>Controle do culto</h2><div class="live-step-buttons"><button class="btn btn-secondary" data-live="previous" ${view.previous?'':'disabled'}>← Anterior</button><button class="btn btn-primary" data-live="next" ${view.next?'':'disabled'}>Próximo →</button></div><button class="btn btn-secondary live-complete" data-live="${view.next?'next':'finish'}">Marcar como concluído</button><p class="muted">${view.next?'Conclui este momento e ativa o próximo.':'Conclui o último momento e finaliza o culto.'}</p><button class="btn live-finish" data-live="finish">Finalizar culto</button></section>
    ${songs.length?`<section class="v2-card live-songs"><h2>${icon('music')} Músicas deste momento</h2><ol>${songs.map(song=>`<li>${esc(typeof song==='string'?song:[song.reference,song.title].filter(Boolean).join(' — '))}</li>`).join('')}</ol></section>`:''}
    <section class="v2-card live-sequence"><div class="section-heading"><h2>Sequência do culto</h2><label class="live-filter">Seção<select id="live-section-filter"><option value="all">Todas as seções</option>${getSections(c).filter(s=>s.enabled).map(s=>`<option value="${esc(s.type)}" ${filter===s.type?'selected':''}>${esc(s.label)}</option>`).join('')}</select></label></div><div id="live-timeline">${liveTimeline(c,view,filter)}</div></section>
    <section class="v2-card live-details"><h2>Informações deste momento</h2><dl><dt>Tipo</dt><dd>${esc(TYPES[active.type]||active.type||'—')}</dd><dt>Responsável</dt><dd>${esc(active.responsible||'—')}</dd><dt>Duração</dt><dd>${minutes(active.duration)}</dd><dt>Horário previsto</dt><dd>${esc(plannedWindow(active))}</dd><dt>Horário real</dt><dd>${clock(view.state.activeStartedAt)} — Em andamento</dd>${active.mediaType&&active.mediaType!=='none'?`<dt>Mídia</dt><dd>${esc(MEDIA_TYPES[active.mediaType]||'Mídia')}${active.mediaTitle?' — '+esc(active.mediaTitle):''}</dd>`:''}<dt>Observações</dt><dd class="preserve-lines">${esc(active.note||'—')}</dd></dl></section>
    <section class="v2-card live-progress"><h2>Progresso do culto</h2><strong>${completed} de ${items.length} momentos concluídos</strong><div class="live-percent">${percent}%</div><progress max="${items.length}" value="${completed}" aria-label="Momentos concluídos"></progress><p class="muted">Em operação: momento ${position} de ${items.length}.</p></section>
    <section class="v2-card live-total"><h2>Tempo total previsto</h2><strong>${esc(total.start||'—')} — ${esc(total.end||'Horário indefinido')}</strong><p>${lengthLabel(total.known)}${total.unknown?' de durações definidas':''}</p>${total.unknown?'<p class="muted">Há duração não definida. O último horário pode representar apenas o início do encerramento.</p>':''}${total.sections.map(s=>`<div class="live-section-duration"><strong>${esc(s.label)}</strong><span>${esc(s.start||'—')} — ${esc(s.end||'Horário indefinido')}</span><span>${lengthLabel(s.known)}${s.unknown?' + duração não definida':''}</span></div>`).join('')}${c.notes?`<p class="preserve-lines"><strong>Observações gerais</strong><br>${esc(c.notes)}</p>`:''}</section>
  </div>`;
}
