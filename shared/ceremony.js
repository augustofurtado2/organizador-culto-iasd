import { enabledItems, liveView, getSections, songLabel, TYPES, MEDIA_TYPES } from './culto.js';
import { setChecklist } from './storage.js';
import { subscribe } from './live-sync.js';
import { $, esc, href, icon, plannedWindow, durationLabel, message } from './ui.js';

function songs(item){return item.hasSongs&&item.songs.length?`<div class="ceremony-songs"><h3>${icon('music')} Músicas</h3><ul>${item.songs.map(s=>`<li>${esc(songLabel(s))}</li>`).join('')}</ul></div>`:'';}
function details(item){return `<p class="ceremony-planned">${esc(plannedWindow(item))} · ${durationLabel(item)}</p>${songs(item)}${item.mediaType&&item.mediaType!=='none'?`<div class="ceremony-media">${icon('play')}<div><strong>Mídia</strong><p>${esc(MEDIA_TYPES[item.mediaType]||'Mídia')}${item.mediaTitle?' — '+esc(item.mediaTitle):''}</p></div></div>`:''}${item.note?`<div class="ceremony-note"><strong>Observação</strong><p>${esc(item.note)}</p></div>`:''}`;}
function responsible(item){return item.responsible?`<p class="ceremony-responsible">${esc(item.responsible)}</p>`:'';}
function clock(value){return value&&Number.isFinite(Date.parse(value))?new Date(value).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):'';}
export function ceremonyPage(){
  document.body.classList.add('ceremony-mobile');$('#page-heading').hidden=true;
  const explicitId=new URLSearchParams(location.search).get('id');
  let db=null,culto=null,valid=false,pending=false,signature='',previousActive=null,previousCulto=null,connection='reconnecting',errorText='',readError=false;
  const header=document.querySelector('.v2-header');
  header.innerHTML=`<div class="ceremony-brand"><span>IASD Boa Vista</span><h1>Cerimonial</h1><p id="ceremony-date"></p></div><div class="ceremony-header-actions"><span id="ceremony-live-status"></span><details class="header-menu"><summary aria-label="Abrir menu">${icon('more')}</summary><nav aria-label="Menu do cerimonial"><a href="index.html">Início</a><a href="programacoes.html">Programações</a><a href="ao-vivo.html">Culto ao Vivo</a><a href="sonoplastia.html">Sonoplastia</a><a href="musicas.html">Músicas</a><a href="timer-culto.html">Tela de Palco</a></nav></details></div>`;
  function updateConnection(state){connection=state;const el=$('#ceremony-connection');if(el){el.textContent=({synced:'● Sincronizado',local:'● Local · sincronizado entre abas',polling:'● Atualização periódica',reconnecting:'Reconectando…'})[state]||'Reconectando…';el.dataset.state=state;}}
  function render(value){
    const nextSignature=JSON.stringify(value);db=value;valid=true;
    if(nextSignature===signature){document.querySelectorAll('[data-check]').forEach(el=>el.disabled=pending);return;}
    signature=nextSignature;
    const oldCurrent=$('.ceremony-current'),oldBox=oldCurrent?.getBoundingClientRect();
    const following=scrollY<150||!matchMedia('(min-width:900px)').matches&&!!oldBox&&(oldBox.top>=0&&oldBox.bottom<=innerHeight);
    const anchor=[...document.querySelectorAll('[data-ceremony-item]')].find(el=>{const r=el.getBoundingClientRect();return r.bottom>0&&r.top<innerHeight;});
    const anchorId=anchor?.dataset.ceremonyItem,anchorTop=anchor?.getBoundingClientRect().top;
    const scrollBefore=scrollY,openIds=new Set([...document.querySelectorAll('[data-moment-details][open]')].map(el=>el.dataset.momentDetails));
    const focused=document.activeElement?.dataset.check,focusedDetails=document.activeElement?.closest('[data-moment-details]')?.dataset.momentDetails;
    culto=db.cultos.find(c=>c.id===(explicitId||db.liveState?.cultoId)||explicitId&&c.legacyId===explicitId)||null;
    const view=culto?liveView(db,culto):null;
    const date=culto?new Intl.DateTimeFormat('pt-BR',{weekday:'long',day:'numeric',month:'long'}).format(new Date(culto.date+'T12:00:00')):'';
    $('#ceremony-date').textContent=date?date[0].toUpperCase()+date.slice(1):'';
    $('#ceremony-live-status').innerHTML=view?'<span class="ceremony-badge ceremony-is-live">● AO VIVO</span>':culto?`<span class="ceremony-badge ceremony-is-pending">${culto.status==='finished'?'Finalizado':'Planejado'}</span>`:'';
    if(!culto){
      const next=db.cultos.filter(c=>c.status==='planned').sort((a,b)=>a.date.localeCompare(b.date))[0];
      $('#content').innerHTML=`<div id="ceremony-connection" role="status"></div><section class="v2-card ceremony-empty"><h2>${explicitId?'Culto não encontrado.':'Nenhum culto em andamento'}</h2><p>Quando o culto for iniciado, a programação aparecerá aqui.</p>${next&&!explicitId?`<a class="btn btn-secondary" href="${esc(href('cerimonial.html',next.id))}">Ver próxima programação</a>`:''}</section>`;
      previousActive=null;previousCulto=null;updateConnection(connection);return;
    }
    const items=enabledItems(culto),validIds=new Set(items.map(i=>i.id)),checked=new Set((culto.checklistIds||[]).filter(id=>validIds.has(id)));
    const count=checked.size,percent=items.length?Math.round(count/items.length*100):0;
    const list=view?items.slice(items.findIndex(i=>i.id===view.active.id)+2,items.findIndex(i=>i.id===view.active.id)+4):[];
    $('#content').innerHTML=`<div class="ceremony-context"><span>${esc(culto.title)}</span><span id="ceremony-connection" role="status"></span></div><section class="v2-card checklist-progress"><div><h2>Progresso do culto</h2><strong id="check-count">${count} de ${items.length}</strong><span> momentos concluídos</span><span class="ceremony-percent">${percent}%</span></div><progress id="check-progress" value="${count}" max="${items.length||1}" aria-label="Momentos marcados no checklist"></progress></section><div class="ceremony-layout"><div class="ceremony-follow">${view?`<section class="v2-card ceremony-current"><div class="ceremony-card-heading"><span class="ceremony-badge ceremony-is-live">● AGORA</span><span>${esc(getSections(culto).find(s=>s.type===view.active.section)?.label||'')}</span></div><h2>${esc(view.active.label)}</h2>${responsible(view.active)}<p class="ceremony-planned">${esc(plannedWindow(view.active))}<span>${durationLabel(view.active)}</span></p>${clock(view.state.activeStartedAt)?`<p class="ceremony-real">Iniciado às ${clock(view.state.activeStartedAt)}</p>`:''}${songs(view.active)}</section><section class="v2-card ceremony-next"><span class="ceremony-badge ceremony-is-next">PRÓXIMO</span>${view.next?`<time>${esc(view.next.computedTime||'Horário não calculado')}</time><h2>${esc(view.next.label)}</h2>${responsible(view.next)}<p class="ceremony-planned">${durationLabel(view.next)}</p>`:'<h2>Último momento do culto</h2>'}${list.length?`<div class="ceremony-after"><h3>Depois</h3>${list.map(i=>`<p><time>${esc(i.computedTime||'Horário não calculado')}</time> ${esc(i.label)}</p>`).join('')}</div>`:''}</section>`:`<section class="v2-card ceremony-empty"><h2>Nenhum culto em andamento</h2><p>${culto.status==='finished'?'Culto finalizado. Você pode consultar o checklist e a programação.':'Prévia da programação. O momento atual aparecerá quando o culto for iniciado.'}</p></section>`}</div><section class="ceremony-timeline"><h2>Programação completa</h2>${getSections(culto).filter(s=>s.enabled).map(s=>`<section class="ceremony-section"><h3>${esc(s.label)}</h3>${items.filter(i=>i.section===s.type).map(i=>{
      const active=view?.active.id===i.id,next=view?.next?.id===i.id,done=checked.has(i.id),state=active?'live':next?'next':done?'completed':'pending';
      return `<article class="ceremony-item ${done?'is-checked':''} ceremony-item-${state}" data-ceremony-item="${esc(i.id)}" ${active?'aria-current="step"':''}><label class="ceremony-check"><input type="checkbox" data-check="${esc(i.id)}" ${done?'checked':''} ${pending?'disabled':''} aria-label="${done?'Desmarcar':'Marcar como concluído'}: ${esc(i.label)}"><span class="sr-only">${done?'Concluído':'Marcar como concluído'}</span></label><details data-moment-details="${esc(i.id)}" ${openIds.has(i.id)?'open':''}><summary><div class="ceremony-item-top"><time>${esc(i.computedTime||'Horário não calculado')}</time><span class="ceremony-badge ceremony-is-${state}">${active?'AGORA':next?'Próximo':done?'✓ Concluído':'Pendente'}</span></div><h4>${esc(i.label)}</h4>${responsible(i)}${done&&(active||next)?'<span class="ceremony-check-note">✓ Marcado no checklist</span>':''}${i.mediaType&&i.mediaType!=='none'?`<span class="ceremony-media-hint">${icon('play')}${esc(MEDIA_TYPES[i.mediaType]||'Mídia')}${i.mediaTitle?' · '+esc(i.mediaTitle):''}</span>`:''}<span class="ceremony-expand">Ver detalhes ${icon('list')}</span></summary><div class="ceremony-item-details"><span class="ceremony-type">${esc(TYPES[i.type]||i.type)}</span>${details(i)}</div></details></article>`;
    }).join('')}</section>`).join('')}</section></div>`;
    updateConnection(connection);message(errorText,!!errorText);
    if(focused)document.querySelector(`[data-check="${CSS.escape(focused)}"]`)?.focus({preventScroll:true});
    else if(focusedDetails)document.querySelector(`[data-moment-details="${CSS.escape(focusedDetails)}"] summary`)?.focus({preventScroll:true});
    const advanced=previousCulto===culto.id&&previousActive&&view?.active.id&&previousActive!==view.active.id;
    previousActive=view?.active.id||null;previousCulto=culto.id;
    if(advanced&&following){requestAnimationFrame(()=>$('.ceremony-current')?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'}));}
    else if(scrollBefore>0){
      window.scrollTo({top:scrollBefore,behavior:'instant'});
      const target=anchorId&&document.querySelector(`[data-ceremony-item="${CSS.escape(anchorId)}"]`);if(target)window.scrollBy({top:target.getBoundingClientRect().top-anchorTop,behavior:'instant'});
    }
  }
  const sync=subscribe(render,error=>{
    valid=false;readError=true;signature='';updateConnection('reconnecting');
    document.querySelectorAll('[data-check]').forEach(el=>el.disabled=true);
    errorText='Reconectando… As últimas informações continuam visíveis. Aguarde a conexão para marcar o checklist.';
    message(errorText,true);
  },{cultoId:explicitId,checklist:true,onConnection:state=>{if(state!=='reconnecting'&&valid&&readError){readError=false;errorText='';message('');}updateConnection(state);}});
  $('#content').addEventListener('change',async e=>{
    const input=e.target.closest('[data-check]');if(!input||!culto||!valid||pending)return;
    const itemId=input.dataset.check,desired=input.checked,id=culto.id,restoreFocus=document.activeElement===input;
    if(!enabledItems(culto).some(i=>i.id===itemId))return;
    pending=true;document.querySelectorAll('[data-check]').forEach(el=>el.disabled=true);
    try{const result=await setChecklist(id,itemId,desired,db.revision);errorText='';signature='';render(result);}
    catch(error){input.checked=!desired;errorText='Não foi possível salvar o checklist. '+error.message;message(errorText,true);}
    finally{pending=false;signature='';await sync.refresh();if(restoreFocus&&culto?.id===id&&document.activeElement===document.body)document.querySelector(`[data-check="${CSS.escape(itemId)}"]`)?.focus({preventScroll:true});}
  });
  window.addEventListener('pagehide',()=>sync.stop(),{once:true});return sync;
}
