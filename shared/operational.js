import { ceremonyPage } from './ceremony.js';
import { liveScreen, liveTimeline, liveEmpty } from './live-screen.js';
import { stageScreen, stageEmpty, stageTick, stageSync } from './stage-screen.js';
import { enabledItems, liveView, countdown } from './culto.js';
import { saveLiveState, setChecklist, isLocal } from './storage.js';
import { subscribe } from './live-sync.js';
import { $, esc, href, dateLabel, message, selection, nowPanel, timeline, badge, durationLabel, updateCultoHeader } from './ui.js';
export function operationalPage(mode) {
  if(mode==='ceremony')return ceremonyPage();
  const explicitId=new URLSearchParams(location.search).get('id');
  const page={live:'ao-vivo.html',sound:'sonoplastia.html',ceremony:'cerimonial.html',stage:'timer-culto.html'}[mode];
  let sectionFilter='all';
  if(mode==='live'){document.body.classList.add('live-operator');$('#page-heading').hidden=true;}
  let db=null, selected=null, valid=false, busy=false, checked=new Set(), lastSignature='',lastActionError=null;
  function choose(value) { return value.cultos.find(c=>c.id===(explicitId || value.liveState?.cultoId)||explicitId&&c.legacyId===explicitId) || null; }
  function readChecklist(c) {const ids=new Set(enabledItems(c).map(i=>i.id));return new Set((c.checklistIds||[]).filter(id=>ids.has(id)));}
  function render(value) {
    db=value;valid=true;selected=choose(db);message(lastActionError||'',!!lastActionError);
    const signature=JSON.stringify([db,selected?.id]);
    // Não reconstruir a tela a cada polling quando nada mudou (preserva foco).
    if(signature===lastSignature) { tick();return; } lastSignature=signature;
    if(mode==='live'){
      updateCultoHeader(selected);
      const view=selected?liveView(db,selected):null;
      const date=selected?new Intl.DateTimeFormat('pt-BR',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date(selected.date+'T12:00:00')):'';
      $('#content').innerHTML=`<div class="live-page-heading"><div><h1>Culto ao Vivo</h1>${view?'<span class="live-state state-live">AO VIVO</span>':''}<p>${esc(date)}${date?' · ':''}${view?'Em andamento':selected?.status==='finished'?'Finalizado':'Aguardando início'}</p></div><span id="live-connection" role="status"></span></div>`+(selected?liveScreen(selected,view,sectionFilter):liveEmpty(null));
      updateConnection(connectionState);tick();return;
    }
    if(!selected) {
      const text=explicitId ? 'Culto não encontrado.' : mode==='stage' ? 'Nenhum culto em andamento.' : mode==='sound' ? 'Aguardando início do culto.' : mode==='ceremony' ? 'Nenhum culto selecionado.' : 'Nenhum culto ao vivo. Selecione uma programação.';
      if(mode==='stage'){$('#content').innerHTML=stageEmpty();stageSync(connectionState);return;}
      $('#content').innerHTML=selection(db,page,text);return;
    }
    updateCultoHeader(selected);
    const view=liveView(db,selected);
    if(mode==='stage') {
      $('#content').innerHTML=view ? stageScreen(selected,view) : stageEmpty(explicitId?selected:null);
      stageSync(connectionState);tick();return;
    }
    checked=mode==='ceremony' ? readChecklist(selected) : new Set();
    const all=enabledItems(selected);
    const controls=mode==='live' ? `<div class="live-controls v2-card">${view ? `<button class="btn btn-secondary" data-live="previous" ${view.previous ? '' : 'disabled'}>← Anterior</button><button class="btn btn-primary" data-live="next" ${view.next ? '' : 'disabled'}>Próximo →</button><button class="btn btn-danger" data-live="finish">Finalizar culto</button>` : `<button class="btn btn-primary" data-live="start" ${!all.length ? 'disabled' : ''}>${selected.status==='finished' ? 'Iniciar novamente' : 'Iniciar culto'}</button>${!all.length ? '<p>Adicione um momento habilitado na programação para iniciar.</p>' : ''}<a class="btn btn-secondary" href="${esc(href('programacao.html',selected.id))}">Abrir programação</a>`}</div>` : '';
    const progress=mode==='ceremony' ? `<section class="v2-card checklist-progress"><h2>Progresso do culto</h2><p><strong id="check-count">${checked.size} de ${all.length}</strong> momentos concluídos</p><progress id="check-progress" max="${all.length || 1}" value="${checked.size}" aria-label="Progresso do checklist"></progress><p class="muted">${isLocal?'Checklist compartilhado entre abas deste navegador.':'Checklist compartilhado entre os dispositivos conectados.'}</p></section>` : '';
    $('#content').innerHTML=`<div class="section-heading"><div><h2>${esc(selected.title)}</h2><p class="muted">${dateLabel(selected.date)} · ${esc(selected.startTime)}</p></div>${badge(selected.status)}<a class="btn btn-ghost" href="programacoes.html">Trocar culto</a></div>${progress}<div class="live-layout">${nowPanel(selected,view)}</div>${controls}<div class="view-links"><a href="${esc(href('sonoplastia.html',selected.id))}">Sonoplastia</a><a href="${esc(href('cerimonial.html',selected.id))}">Cerimonial</a><a href="${esc(href('timer-culto.html',selected.id))}" target="_blank" rel="noopener">Tela de palco ↗</a></div>${selected.notes ? `<section class="v2-card"><h2>Observações gerais</h2><p class="preserve-lines">${esc(selected.notes)}</p></section>` : ''}${timeline(selected,view,{checklist:mode==='ceremony'?checked:null})}`;
    tick();
  }
  let connectionState='reconnecting';
  function updateConnection(state){connectionState=state;if(mode==='stage')stageSync(state);const el=$('#live-connection');if(el){el.textContent=({synced:'● Sincronizado',local:'● Local · sincronizado entre abas',polling:'● Atualização periódica',reconnecting:'Reconectando…'})[state]||'Reconectando…';el.dataset.state=state;}}
  const sync=subscribe(render,error=>{
    valid=false;lastSignature='';
    message('Reconectando… '+error.message+' O último estado conhecido permanece visível.',true);
    document.querySelectorAll('[data-live],[data-check]').forEach(el=>el.disabled=true);
    if(!db)$('#content').innerHTML='<p>Aguardando conexão com os dados do culto.</p>';
  },{cultoId:explicitId,checklist:mode==='ceremony',onConnection:updateConnection});
  function tick() {
    if(mode==='stage'){stageTick(selected&&db?liveView(db,selected):null);return;}
    if(!selected||!db)return;
    const view=liveView(db,selected);if(!view)return;
    for(const el of document.querySelectorAll('[data-remaining]')) { el.textContent=countdown(view.remaining);el.classList.toggle('time-warning',view.overtime); }
    const progress=$('[data-moment-progress]');if(progress&&view.active.duration!=null)progress.value=view.active.duration===0?100:Math.min(100,view.elapsed/(view.active.duration*60)*100);
    for(const el of document.querySelectorAll('[data-elapsed]'))el.textContent=countdown(view.elapsed);
    for(const el of document.querySelectorAll('[data-overtime]'))el.hidden=!view.overtime;
    for(const el of document.querySelectorAll('[data-clock]'))el.textContent=new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
  }
  const clock=setInterval(tick,1000);
  if(mode==='stage')for(const type of ['online','offline'])window.addEventListener(type,()=>stageSync(connectionState));
  window.addEventListener('pagehide',()=>{clearInterval(clock);sync.stop();},{once:true});
  $('#content').addEventListener('click',async e=>{
    if(e.target.closest('[data-refresh]')){sync.refresh();return;}
    const b=e.target.closest('[data-live]');if(!b||mode!=='live'||busy||!valid||!selected)return;
    if(b.dataset.live==='finish' && !confirm('Deseja finalizar o culto?\n\nIsso encerrará o estado ao vivo, mas manterá o culto no histórico.'))return;
    if(b.dataset.live==='start' && selected.status==='finished' && !confirm('Iniciar novamente este culto? O estado ao vivo será reiniciado.'))return;
    let failure=null;lastActionError=null;
    try {
      busy=true;document.querySelectorAll('[data-live]').forEach(el=>el.disabled=true);
      const value=await saveLiveState(b.dataset.live,selected.id,db.revision);lastSignature='';render(value);
    } catch(error) { failure=error;lastActionError=error.message; }
    finally {busy=false;lastSignature='';await sync.refresh();if(failure)message(failure.message,true);}
  });
  $('#content').addEventListener('change',async e=>{
    if(e.target.id==='live-section-filter'){sectionFilter=e.target.value;const view=selected&&liveView(db,selected);if(selected)$('#live-timeline').innerHTML=liveTimeline(selected,view,sectionFilter);return;}
    const input=e.target.closest('[data-check]');if(!input||mode!=='ceremony'||!selected||!valid)return;
    const id=input.dataset.check;if(!enabledItems(selected).some(i=>i.id===id))return;
    const desired=input.checked;input.disabled=true;
    try {
      const value=await setChecklist(selected.id,id,desired,db.revision);lastSignature='';render(value);
      $('#content').querySelector(`[data-check="${CSS.escape(id)}"]`)?.focus();
    } catch(error){input.checked=!desired;input.disabled=false;message('Não foi possível salvar o checklist: '+error.message,true);}
  });
  return sync;
}
