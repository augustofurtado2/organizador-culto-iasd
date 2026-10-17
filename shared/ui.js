import { STATUS, getSections, sectionSchedule, MEDIA_TYPES, songLabel, enabledItems, formatTime, parseTime, countdown } from './culto.js';
import { isLocal, usesSupabase } from './storage.js';
export const $ = (selector, parent = document) => parent.querySelector(selector);
export const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const href = (page, id) => page + (id ? '?id=' + encodeURIComponent(id) : '');
export const dateLabel = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? value.split('-').reverse().join('/') : 'Sem data';
export const badge = status => `<span class="status-badge status-${esc(status)}">${esc(STATUS[status] || status)}</span>`;
const paths = { calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M7 14h2M13 14h2M7 18h2"/>', play:'<circle cx="12" cy="12" r="9"/><path d="m10 8 6 4-6 4z"/>', sound:'<path d="M4 9v6M8 5v14M12 8v8M16 3v18M20 9v6"/>', people:'<circle cx="9" cy="7" r="3"/><path d="M3 21v-4a6 6 0 0 1 12 0v4M17 4a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 5v2"/>', edit:'<path d="m15 4 5 5M4 20l4-1L21 6l-5-5L3 14z"/>', more:'<circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>', save:'<path d="M4 3h13l4 4v14H3V3zM7 3v6h10V3M7 21v-8h10v8"/>', copy:'<rect x="8" y="8" width="12" height="13" rx="1"/><path d="M16 8V3H3v13h5"/>', note:'<path d="M5 3h11l4 4v14H5zM9 9h7M9 13h7M9 17h4"/>',  home: '<path d="m3 10 9-7 9 7v10H3zM9 20v-7h6v7"/>', list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h1M3 12h1M3 18h1"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6l4 2"/>', music: '<path d="M9 18V5l11-2v13M9 8l11-2"/><ellipse cx="6" cy="18" rx="3" ry="3"/><ellipse cx="17" cy="16" rx="3" ry="3"/>', book: '<path d="M12 5v16M12 5C8 2 4 3 2 4v15c3-1 7-1 10 2 3-3 7-3 10-2V4c-3-1-7-2-10 1Z"/>', settings: '<path d="M4 7h16M4 17h16"/><circle cx="8" cy="7" r="3"/><circle cx="16" cy="17" r="3"/>' };
export const icon = name => `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.list}</svg>`;
export function shell(title, key, { stage = false } = {}) {
  if (!stage) {
    const id = new URLSearchParams(location.search).get('id');
    const links = key==='live' ? [['index.html','Início','home','home'],['programacoes.html','Programações','calendar','list'],['ao-vivo.html','Culto ao Vivo','play','live'],['sonoplastia.html','Sonoplastia','sound','sound'],['cerimonial.html','Cerimonial','people','ceremony'],['musicas.html','Músicas','music','music'],['timer-culto.html','Tela de Palco','clock','stage'],['configuracoes.html','Configurações','settings','settings']] : [['programacao.html','Programação','calendar','editor'],['ao-vivo.html','Culto ao vivo','play','live'],['sonoplastia.html','Sonoplastia','sound','sound'],['cerimonial.html','Cerimonial','people','ceremony'],['musicas.html','Músicas','music','music'],['programacoes.html','Cultos','calendar','list']];
    $('#navigation').innerHTML = `<aside class="app-sidebar"><a class="app-brand" href="index.html" aria-label="IASD Boa Vista — Início"><img src="assets/adventist-symbol-white.svg" alt="" width="54" height="54"><div><strong>Igreja Adventista<br>do Sétimo Dia</strong><span>Boa Vista</span></div></a><nav aria-label="Navegação principal">${links.map(([page,label,ico,k],index) => `<a class="${index===4?'nav-divider':''}" href="${esc(href(page==='programacao.html'&&!id?'programacoes.html':page, ['editor','live','ceremony','sound','stage'].includes(k) ? id : null))}" data-nav="${k}" ${k===key ? 'aria-current="page"' : ''}>${icon(ico)}${label}</a>`).join('')}</nav><p class="sidebar-note">Organizador de Culto<br>IASD Boa Vista<br>v2.0</p></aside>`;
    const header=document.querySelector('.v2-header');
    header.innerHTML=`<a class="header-app-name" href="index.html">Organizador de Culto</a><div class="header-context"><span id="header-date">${icon('calendar')}<span></span></span><span id="header-status"></span><details class="header-menu"><summary aria-label="Mais opções">${icon('more')}</summary><nav aria-label="Mais opções"><a href="index.html">${icon('home')}Início</a><a href="programacao.html?new=1">${icon('calendar')}Novo culto</a><a href="timer-culto.html${id?'?id='+encodeURIComponent(id):''}" data-context-link="stage">${icon('clock')}Tela de palco</a><a href="configuracoes.html" ${key==='settings'?'aria-current="page"':''}>${icon('settings')}Configurações</a></nav></details></div>`;
    const heading=document.createElement('h1');heading.id='page-heading';heading.className='page-title';heading.textContent=title;
    $('#content').before(heading);
    updateCultoHeader(null);
    $('#page-heading').textContent = title;
  }
  $('#storage-mode').textContent = isLocal ? 'Modo local · dados somente neste navegador. Para outros aparelhos, use a versão publicada.' : usesSupabase ? 'Dados compartilhados · Supabase Realtime' : 'Dados compartilhados · atualização a cada 30 segundos';
}
export function updateCultoHeader(culto){
  const el=$('#header-date span');if(!el)return;
  const value=culto?.date;
  const date=value&&/^\d{4}-\d{2}-\d{2}$/.test(value)?new Date(value+'T12:00:00'):new Date();
  const label=new Intl.DateTimeFormat('pt-BR',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(date);
  el.textContent=label.charAt(0).toUpperCase()+label.slice(1);
  $('#header-status').innerHTML=culto?badge(culto.status):'';
  if(culto)for(const link of document.querySelectorAll('[data-nav],[data-context-link]')){
    const key=link.dataset.nav||link.dataset.contextLink;
    if(['editor','live','sound','ceremony','stage'].includes(key))link.href=href({editor:'programacao.html',live:'ao-vivo.html',sound:'sonoplastia.html',ceremony:'cerimonial.html',stage:'timer-culto.html'}[key],culto.id);
  }
}
globalThis.addEventListener?.('culto-connection',event=>{
  let el=document.getElementById('connection-state');
  if(!el){el=document.createElement('span');el.id='connection-state';el.setAttribute('role','status');document.getElementById('storage-mode')?.append(el);}
  el.textContent=' · '+({synced:'● Sincronizado',reconnecting:'Reconectando…',local:'● Local',polling:'● Atualização periódica'}[event.detail]||'');
});
export function message(text, error = false) {
  const el = $('#message'); el.textContent = text; el.className = `notice ${error ? 'error' : ''}`; el.hidden = !text;
}
export function empty(text, action = '') { return `<div class="empty-state"><p>${esc(text)}</p>${action}</div>`; }
export function cultoCard(c, actions = true) {
  return `<article class="v2-card culto-summary"><div class="section-heading"><h2>${esc(c.title)}</h2>${badge(c.status)}</div><p class="date-heading">${dateLabel(c.date)} <span>· ${esc(c.startTime)}</span></p><dl class="facts"><div><dt>Momentos habilitados</dt><dd>${enabledItems(c).length}</dd></div><div><dt>Ancião</dt><dd>${esc(c.elder || 'Não definido')}</dd></div><div><dt>Líder cerimonial</dt><dd>${esc(c.ceremonyLead || 'Não definido')}</dd></div></dl>${actions ? `<div class="action-row"><a class="btn btn-primary" href="${esc(href('programacao.html',c.id))}">${c.status === 'finished' ? 'Visualizar programação' : 'Abrir programação'}</a><a class="btn btn-secondary" href="${esc(href('ao-vivo.html',c.id))}">${c.status === 'live' ? 'Acompanhar culto' : 'Abrir modo ao vivo'}</a></div>` : ''}</article>`;
}
export function selection(db, page, text) {
  return empty(text) + (db.cultos.length ? `<div class="culto-grid">${[...db.cultos].sort((a,b)=>b.date.localeCompare(a.date)).map(c=>`<a class="v2-card selection-link" href="${esc(href(page,c.id))}"><strong>${esc(c.title)}</strong><span>${dateLabel(c.date)} · ${esc(c.startTime)}</span>${badge(c.status)}</a>`).join('')}</div>` : '<a class="btn btn-primary" href="programacao.html?new=1">Criar primeiro culto</a>');
}
export const durationLabel = item => item.duration==null?'Duração não definida':`${item.duration} min`;
export const mediaInfo = item => item.mediaType && item.mediaType!=='none'?`<p class="media-info"><strong>${esc(MEDIA_TYPES[item.mediaType]||'Mídia')}${item.mediaTitle?':':''}</strong>${item.mediaTitle?' '+esc(item.mediaTitle):''}</p>`:'';
export function plannedWindow(item){if(!item.computedTime)return 'Horário ainda não calculado';return item.computedTime+(item.duration==null?'':' — '+formatTime(parseTime(item.computedTime)+item.duration));}
export function timeline(c, view, { checklist = null } = {}) {
  const completed = new Set(checklist ? [] : view?.state.completedItemIds || (c.status === 'finished' ? c.lastLiveState?.completedItemIds : []) || []);
  return getSections(c).filter(s=>s.enabled).map(({type:section,label}) => {
    const items = c.items.filter(i=>i.section === section && i.enabled);
    if (!items.length) return '';
    return `<section class="timeline-section"><h2>${esc(label)}</h2><p class="muted">${esc(sectionSchedule(c,section).start)} → ${esc(sectionSchedule(c,section).end||'horário indefinido')}${sectionSchedule(c,section).endIsMarker?' · último início':''}</p><div class="v2-timeline">${items.map(i=>{
      const checked = checklist?.has(i.id), active = view?.active.id === i.id;
      return `<article class="v2-card timeline-moment ${active ? 'is-current' : ''} ${checked ? 'is-checked' : ''}"><div class="moment-top"><span class="time-badge">${esc(i.computedTime)}</span><h3>${esc(i.label)}</h3><span class="status-badge">${active ? 'AGORA' : checked || completed.has(i.id) ? 'Concluído' : view?.next?.id === i.id ? 'Próximo' : 'Pendente'}</span></div>${i.responsible?`<p class="muted">${esc(i.responsible)}</p>`:''}<p class="muted">${durationLabel(i)}</p>${mediaInfo(i)}${i.hasSongs && i.songs.length ? `<div class="selected-songs"><span class="muted">Músicas selecionadas</span><ol>${i.songs.map(s=>`<li>${esc(songLabel(s))}</li>`).join('')}</ol></div>` : ''}${i.note ? `<p class="moment-note">${esc(i.note)}</p>` : ''}${checklist ? `<label class="check-control"><input type="checkbox" data-check="${esc(i.id)}" ${checked ? 'checked' : ''}> ${checked ? 'Concluído' : 'Marcar como concluído'}</label>` : ''}</article>`;
    }).join('')}</div></section>`;
  }).join('');
}
export function nowPanel(c, view) {
  if (!view) return `<section class="v2-card">${badge(c.status)}<h2>${c.status === 'finished' ? 'Culto finalizado' : 'Aguardando início do culto'}</h2><p>Horário previsto: ${esc(c.startTime)} · ${dateLabel(c.date)}</p></section>`;
  const i = view.active;
  return `<section class="v2-card live-focus"><span class="chip chip-live">AGORA</span><h2>${esc(i.label)}</h2>${i.responsible?`<p>${esc(i.responsible)}</p>`:''}<p class="muted">Previsto: ${plannedWindow(i)} · Início real: ${new Date(view.state.activeStartedAt).toLocaleTimeString('pt-BR')}</p><div class="time-metrics"><div><strong data-elapsed>${countdown(view.elapsed)}</strong><span>decorridos</span></div><div><strong data-remaining>${countdown(view.remaining)}</strong><span>${view.remaining==null?'Duração não definida':'restantes'}</span></div></div><p class="muted" data-overtime ${view.overtime ? '' : 'hidden'}>Tempo previsto esgotado. Aguardando avanço do momento.</p>${mediaInfo(i)}${i.hasSongs && i.songs.length ? `<div class="selected-songs"><h3>Músicas selecionadas</h3><ol>${i.songs.map(s=>`<li>${esc(songLabel(s))}</li>`).join('')}</ol></div>` : ''}${i.note ? `<p class="moment-note">${esc(i.note)}</p>` : ''}</section><section class="v2-card next-focus"><span class="eyebrow">Próximo momento</span><h2>${esc(view.next?.label || 'Último momento do culto')}</h2>${view.next ? `<p>${view.next.responsible?esc(view.next.responsible)+' · ':''}${esc(view.next.computedTime)}</p>` : ''}</section>`;
}
