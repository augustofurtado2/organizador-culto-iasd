import { enabledItems } from './culto.js';
import { mutate, duplicateCulto } from './storage.js';
import { subscribe } from './live-sync.js';
import { $, esc, href, empty, cultoCard, message, dateLabel } from './ui.js';
export function dashboardPage(listOnly = false) {
  let db,busy=false,filter='all';
  function render(value) {
    db=value;message('');
    const sorted=[...db.cultos].sort((a,b)=>b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt));
    const today=new Date(), day=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    const live=db.cultos.find(c=>c.id===db.liveState?.cultoId);
    const next=db.cultos.filter(c=>c.status==='planned' && c.date>=day).sort((a,b)=>a.date.localeCompare(b.date)||a.startTime.localeCompare(b.startTime))[0];
    const list=(items,management)=>items.map(c=>`<div>${cultoCard(c)}<div class="list-actions">${c.status==='planned' && enabledItems(c).length ? `<button class="btn btn-secondary" data-action="start" data-id="${esc(c.id)}" ${busy?'disabled':''}>Iniciar culto</button>` : ''}${management ? `<button class="btn btn-ghost" data-action="duplicate" data-id="${esc(c.id)}" ${busy?'disabled':''}>Duplicar</button><button class="btn btn-danger" data-action="delete" data-id="${esc(c.id)}" ${c.status==='live'||busy?'disabled':''}>Excluir</button>` : ''}</div></div>`).join('');
    $('#content').innerHTML= !sorted.length ? empty('Nenhum culto programado.','<a class="btn btn-primary" href="programacao.html?new=1">Criar primeiro culto</a>') : listOnly ? `<div class="section-heading"><h2>Cultos salvos</h2><span class="muted">${sorted.length} programações</span><label>Exibir <select id="status-filter"><option value="all" ${filter==='all'?'selected':''}>Todos</option><option value="planned" ${filter==='planned'?'selected':''}>Planejados</option><option value="finished" ${filter==='finished'?'selected':''}>Finalizados</option></select></label></div><div class="culto-grid">${list(sorted.filter(c=>filter==='all'||c.status===filter),true)}</div>` : `${live ? `<section><h2 class="section-title-v2">Culto em andamento</h2>${cultoCard(live)}</section>` : ''}<section><h2 class="section-title-v2">Próximo culto</h2>${next ? list([next],false) : empty('Nenhum próximo culto planejado.','<a class="btn btn-secondary" href="programacao.html?new=1">+ Novo Culto</a>')}</section><section><div class="section-heading"><h2>Últimos cultos</h2><a href="programacoes.html">Ver todas as programações</a></div><div class="culto-grid">${list(sorted.slice(0,6),false)}</div></section>`;
  }
  const sync=subscribe(render,error=>message(error.message+' Os dados não puderam ser atualizados.',true));
  $('#content').addEventListener('change',e=>{if(e.target.id==='status-filter'){filter=e.target.value;render(db);}});
  $('#content').addEventListener('click',async e=>{
    const b=e.target.closest('[data-action]');if(!b||busy)return;
    const c=db.cultos.find(c=>c.id===b.dataset.id);if(!c)return;
    if(b.dataset.action==='delete' && !confirm(`Excluir “${c.title}” de ${dateLabel(c.date)}? Esta ação remove a programação salva.`))return;
    try {
      busy=true;b.disabled=true;
      if(b.dataset.action==='duplicate') { const result=await duplicateCulto(c.id,db.revision);location.href=href('programacao.html',result.id);return; }
      if(b.dataset.action==='start') { await mutate({type:'start',id:c.id},db.revision);location.href=href('ao-vivo.html',c.id);return; }
      await mutate({type:'delete',id:c.id},db.revision);
      await sync.refresh();
    } catch(error) { message(error.message,true); }
    finally { busy=false; if(b.isConnected)b.disabled=false; }
  });
  return sync;
}
