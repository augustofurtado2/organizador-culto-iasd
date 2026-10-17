import { baseCulto, PEOPLE, newItem, newSection, computeTimes, TYPES, MEDIA_TYPES, getSections, timingMode, sectionSchedule, songTitle, songLabel, clone, validateCulto, uid } from './culto.js';
import { loadCollection, saveCulto, duplicateCulto } from './storage.js';
import { $, esc, href, message, selection, badge, icon, updateCultoHeader } from './ui.js';
import { openPicker } from './music.js';

export async function editorPage() {
  let db=await loadCollection(),dirty=false,saving=false;
  const params=new URLSearchParams(location.search),id=params.get('id');
  if(!id&&!params.has('new')){$('#content').innerHTML=selection(db,'programacao.html','Selecione uma programação ou crie um culto.');return;}
  const existing=id?db.cultos.find(c=>c.id===id||c.legacyId===id):null;
  if(id&&!existing){$('#content').innerHTML=selection(db,'programacao.html','Culto não encontrado.');return;}
  let draft=existing?clone(existing):baseCulto(localDate()),saved=!!existing,revision=db.revision;
  function materialize(){draft.timingMode=timingMode(draft);draft.sections=getSections(draft).map((s,position)=>({...s,id:s.id||uid(),position}));}
  materialize();
  let selectedId=matchMedia('(min-width:1200px)').matches?draft.items[0]?.id||null:null;
  if(draft.status==='live'){$('#content').innerHTML=`<section class="v2-card"><h2>Esta programação está ao vivo</h2><p>Finalize o culto antes de editar sua programação.</p><a class="btn btn-primary" href="${esc(href('ao-vivo.html',draft.id))}">Abrir controle ao vivo</a></section>`;return;}
  const mark=()=>{dirty=true;$('#save-state').textContent='Alterações não salvas';};
  function range(type){const r=sectionSchedule(draft,type);return r.start?`${r.start} → ${r.end||'horário indefinido'}${r.endIsMarker?' · último início':''}`:'Sem horário calculado';}
  function recalc(){
    try{
      computeTimes(draft);
      draft.items.forEach(i=>{const el=document.getElementById('time-'+i.id);if(el)el.textContent=i.computedTime||(!i.enabled?'Desabilitado':'Aguardando duração anterior');});
      for(const el of document.querySelectorAll('[data-section-range]'))el.textContent=range(el.dataset.sectionRange);
      const active=draft.items.find(i=>i.id===selectedId);if(active&&$('[data-panel-time]'))$('[data-panel-time]').textContent=active.computedTime||'Horário indefinido';
    }catch{/* horário ainda em edição */}
  }
  function field(label,key,type='text',required=false){const names=PEOPLE[key]||[];return `<label class="v2-field">${label}<input name="${key}" type="${type}" value="${esc(draft[key])}" ${required?'required':''} ${key==='title'?'maxlength="200"':''} ${names.length?`list="people-${key}" autocomplete="off"`:''}>${names.length?`<datalist id="people-${key}">${names.map(n=>`<option value="${esc(n)}">`).join('')}</datalist>`:''}</label>`;}
  function sectionManager(){
    return `<section class="v2-card"><div class="section-heading"><h2>Seções da programação</h2><button type="button" class="btn btn-secondary" data-action="section-add">+ Adicionar seção</button></div>${getSections(draft).map((s,index)=>`<div class="section-editor" data-section-editor="${esc(s.type)}"><label class="v2-field">Nome da seção<input data-section-field="label" value="${esc(s.label)}" required></label><label class="check-control"><input type="checkbox" data-section-field="enabled" ${s.enabled?'checked':''}> Habilitada</label>${draft.timingMode==='independent'?`<label class="v2-field">Início da seção<input type="time" data-section-field="startTime" value="${esc(s.startTime)}" required></label>`:''}<div class="order-controls"><button type="button" class="btn btn-ghost" data-action="section-up" ${index===0?'disabled':''} aria-label="Subir seção">↑</button><button type="button" class="btn btn-ghost" data-action="section-down" ${index===draft.sections.length-1?'disabled':''} aria-label="Descer seção">↓</button><button type="button" class="btn btn-danger" data-action="section-remove" ${draft.sections.length===1?'disabled':''}>Remover seção</button></div></div>`).join('')}</section>`;
  }
  function draw(){
    document.body.classList.add('compact-program');
    computeTimes(draft);
    updateCultoHeader(draft);
    $('#page-heading').hidden=true;
    $('#content').innerHTML=`<form id="editor-form"><div class="section-heading program-toolbar"><div><h2>${saved?'Programação do '+new Intl.DateTimeFormat('pt-BR',{weekday:'long'}).format(new Date((draft.date||localDate())+'T12:00:00')).replace(/^./,letter=>letter.toUpperCase()):'Novo culto'}</h2><p class="program-intro">Edite as seções e momentos do culto. Os horários são calculados automaticamente.</p></div>${saved?`<button class="btn btn-secondary" type="button" data-action="duplicate">${icon('copy')} Duplicar culto</button>`:''}<button class="btn btn-primary" type="submit">${icon('save')} Salvar</button><p id="save-state" role="status">${dirty?'Alterações não salvas':saved?'Programação carregada':'Ainda não salvo'}</p></div><div class="program-facts">${field('Data','date','date',true)}${field('Início do culto','startTime','time',true)}${field('Ancião do dia','elder')}${field('Cerimonial','ceremonyLead')}<label class="v2-field">Observações gerais<textarea name="notes" rows="1" placeholder="—">${esc(draft.notes)}</textarea></label></div><details class="v2-card program-general"><summary>Nome e cálculo de horários</summary><div class="form-grid">${field('Nome da programação','title','text',true)}<label class="v2-field">Cálculo de horários<select name="timingMode" id="timing-mode"><option value="continuous" ${draft.timingMode==='continuous'?'selected':''}>Sequência contínua entre seções</option><option value="independent" ${draft.timingMode==='independent'?'selected':''}>Horários por seção (compatibilidade)</option></select></label></div></details><details class="v2-card program-settings"><summary>Seções e equipe de sonoplastia</summary>${sectionManager()}<section class="v2-card"><div class="section-heading"><h2>Equipe de sonoplastia</h2><button type="button" class="btn btn-secondary" data-action="team-add">+ Responsável</button></div><div id="team-list"></div></section></details><div class="program-workspace"><div class="program-sections">${getSections(draft).map(s=>`<section class="v2-card program-section"><div class="section-heading program-section-heading"><div><h2 data-section-heading="${esc(s.type)}">${esc(s.label)}</h2><span class="section-count" data-section-count="${esc(s.type)}">${draft.items.filter(i=>i.section===s.type).length} momentos</span><p class="muted" data-section-range="${esc(s.type)}">${esc(range(s.type))}</p></div><div class="moment-add-controls"><label>Tipo do novo momento<select data-preset-section="${esc(s.type)}">${Object.entries(TYPES).map(([type,label])=>`<option value="${type}" ${type==='other'?'selected':''}>${esc(label)}</option>`).join('')}</select></label><button type="button" class="btn btn-secondary" data-action="add" data-section="${esc(s.type)}">+ Adicionar momento</button></div></div><div class="moment-columns" aria-hidden="true"><span>#</span><span>Horário</span><span>Duração</span><span>Momento</span><span>Responsável</span><span>Tipo</span><span></span></div><div id="items-${esc(s.type)}" class="editor-items"></div></section>`).join('')}</div><aside id="moment-panel" class="moment-panel" aria-label="Editar momento"></aside></div><div class="editor-actions"><button class="btn btn-primary" id="save-button" type="submit">Salvar culto</button><button class="btn btn-secondary" type="button" data-action="reload">Recarregar dados</button>${saved?`<a class="btn btn-secondary" href="${esc(href('ao-vivo.html',draft.id))}">Abrir modo ao vivo</a>`:''}<a class="btn btn-ghost" href="programacoes.html">Voltar às programações</a></div></form>`;
    const sections=document.querySelector('.program-sections');
    sections.prepend(document.querySelector('.program-facts'));
    sections.append(document.querySelector('.program-general'),document.querySelector('.program-settings'));
    document.querySelectorAll('.program-section').forEach((section,index)=>{
      section.dataset.tone=index%2?'green':'blue';
      const number=document.createElement('span');number.className='section-number';number.textContent=index+1;
      section.querySelector('.program-section-heading > div').prepend(number);
      section.append(section.querySelector('.moment-add-controls'));
    });
    document.querySelectorAll('.program-facts > label').forEach((label,index)=>label.insertAdjacentHTML('afterbegin',icon(['calendar','clock','people','people','note'][index])));
    drawTeam();drawItems();
    $('#editor-form').addEventListener('invalid',e=>{for(let el=e.target.parentElement;el;el=el.parentElement)if(el.tagName==='DETAILS')el.open=true;},true);
    $('#editor-form').addEventListener('keydown',e=>{if(e.key==='Escape'&&selectedId&&!document.querySelector('dialog[open]')){selectedId=null;drawItems();}});
    $('#editor-form').addEventListener('input',handleInput);
    $('#editor-form').addEventListener('change',e=>{
      if(e.target.name==='timingMode'){draw();$('#timing-mode').focus();}
      else if(e.target.matches('[data-item-field="enabled"],[data-item-field="hasSongs"]'))drawItems();
    });
    $('#editor-form').addEventListener('click',handleClick);$('#editor-form').addEventListener('submit',save);
    bindDrag($('#editor-form'));
  }
  // Arrastar e soltar: momentos (inclusive entre seções) e músicas do momento aberto.
  let drag=null;
  function bindDrag(form){
    const clear=()=>form.querySelectorAll('.drop-before,.drop-after,.is-dragging').forEach(el=>el.classList.remove('drop-before','drop-after','is-dragging'));
    const target=e=>{
      if(drag?.kind==='row'){const row=e.target.closest('[data-row]');if(row)return row;return e.target.closest('.editor-items');}
      if(drag?.kind==='song')return e.target.closest('[data-song]');
    };
    form.addEventListener('dragstart',e=>{
      const row=e.target.closest?.('[data-row]'),song=e.target.closest?.('.drag-handle')&&e.target.closest('[data-song]');
      if(song){drag={kind:'song',pos:+song.dataset.song};e.dataTransfer.setDragImage(song,10,10);song.classList.add('is-dragging');}
      else if(row){drag={kind:'row',id:row.dataset.row};row.classList.add('is-dragging');}
      else return;
      e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain','');
    });
    form.addEventListener('dragover',e=>{
      const t=drag&&target(e);if(!t)return;e.preventDefault();
      form.querySelectorAll('.drop-before,.drop-after').forEach(el=>el.classList.remove('drop-before','drop-after'));
      if(t.classList.contains('editor-items'))return;
      const r=t.getBoundingClientRect();t.classList.add(e.clientY<r.top+r.height/2?'drop-before':'drop-after');
    });
    form.addEventListener('drop',e=>{
      const t=drag&&target(e);if(!t){clear();return;}e.preventDefault();
      const before=t.classList.contains('drop-before');
      if(drag.kind==='row'){
        const item=draft.items.find(i=>i.id===drag.id);
        if(t.dataset.row!==drag.id){
          draft.items.splice(draft.items.indexOf(item),1);
          if(t.dataset.row){const other=draft.items.find(i=>i.id===t.dataset.row);item.section=other.section;draft.items.splice(draft.items.indexOf(other)+(before?0:1),0,item);}
          else{item.section=t.id.slice('items-'.length);draft.items.push(item);}
          item.sectionId=(draft.sections||[]).find(s=>s.type===item.section)?.id;
          mark();
        }
      }else{
        const item=draft.items.find(i=>i.id===selectedId),to=+t.dataset.song,from=drag.pos;
        if(item&&to!==from){const [song]=item.songs.splice(from,1);let at=to+(before?0:1);if(from<at)at--;item.songs.splice(at,0,song);mark();}
      }
      drag=null;clear();drawItems();
    });
    form.addEventListener('dragend',()=>{drag=null;clear();});
  }
  function drawTeam(){
    $('#team-list').innerHTML=draft.soundTeam.map((person,index)=>`<div class="team-editor" data-team="${index}"><label>Função<input data-team-field="role" value="${esc(person.role||'')}" placeholder="Sonoplastia"></label><label>Responsável<input data-team-field="nome" value="${esc(person.nome||'')}"></label><button type="button" class="btn btn-danger" data-action="team-remove" data-index="${index}">Remover</button></div>`).join('')||'<p class="muted">Nenhum responsável adicionado.</p>';
  }
  function rowMarkup(i,index){
    return `<div class="moment-row ${i.enabled?'':'is-disabled'} ${i.id===selectedId?'is-selected':''}" data-row="${esc(i.id)}" draggable="true" title="Arraste para reordenar"><span class="moment-number">${index+1}</span><span class="moment-time" id="time-${esc(i.id)}">${esc(i.computedTime||'—')}</span><span>${i.duration==null?'—':i.duration+' min'}</span><button type="button" class="moment-name" aria-pressed="${i.id===selectedId}" data-action="select" data-select="${esc(i.id)}">${icon(i.hasSongs?'music':'list')}<span>${esc(i.label)}</span></button><span class="moment-responsible">${esc(i.responsible||'—')}</span><span class="moment-type type-${Object.hasOwn(TYPES,i.type)?i.type:'other'}">${esc(TYPES[i.type]||i.type)}</span><button type="button" class="btn btn-ghost moment-edit" data-action="select" data-select="${esc(i.id)}" aria-label="Editar ${esc(i.label)}">${icon('edit')}</button></div>`;
  }
  function drawRows(){
    computeTimes(draft);
    for(const {type:section} of getSections(draft)){
      const items=draft.items.filter(i=>i.section===section);
      document.querySelector(`[data-section-count="${section}"]`).textContent=items.length+' momentos';
      $('#items-'+section).innerHTML=items.map(rowMarkup).join('')||'<p class="muted empty-moments">Nenhum momento nesta seção.</p>';
    }
    recalc();
  }
  function drawItems(){
    drawRows();
    const i=draft.items.find(i=>i.id===selectedId), panel=$('#moment-panel');
    document.querySelector('.program-workspace').classList.toggle('panel-open',!!i);
    if(!i){panel.innerHTML='<div class="panel-placeholder">Selecione um momento para editar.</div>';return;}
    const items=draft.items.filter(item=>item.section===i.section),index=items.indexOf(i);
    panel.innerHTML=`<article class="editor-moment ${i.enabled?'':'is-disabled'}" data-item="${esc(i.id)}"><div class="section-heading"><h2 id="moment-panel-title">Editar momento</h2><button type="button" class="btn btn-ghost panel-close" data-action="close" aria-label="Fechar edição">×</button><span class="time-badge" data-panel-time>${esc(i.computedTime||(!i.enabled?'Desabilitado':'Aguardando duração anterior'))}</span><span class="muted">Momento ${index+1}</span><label class="check-control"><input data-item-field="enabled" type="checkbox" ${i.enabled?'checked':''}> Habilitado</label><div class="order-controls"><button type="button" class="btn btn-ghost" data-action="up" ${index===0?'disabled':''} aria-label="Subir momento">↑</button><button type="button" class="btn btn-ghost" data-action="down" ${index===items.length-1?'disabled':''} aria-label="Descer momento">↓</button><button type="button" class="btn btn-danger" data-action="remove">Excluir momento</button></div></div><div class="form-grid"><label class="v2-field">Nome do momento<input data-item-field="label" value="${esc(i.label)}" required></label><label class="v2-field">Tipo<select data-item-field="type">${Object.entries(TYPES).map(([type,label])=>`<option value="${type}" ${i.type===type?'selected':''}>${esc(label)}</option>`).join('')}${!Object.hasOwn(TYPES,i.type)?`<option selected value="${esc(i.type)}">${esc(i.type)}</option>`:''}</select></label><label class="v2-field">Responsável (opcional)<input data-item-field="responsible" value="${esc(i.responsible)}"></label><label class="v2-field">Duração em minutos (opcional)<input data-item-field="duration" type="number" min="0" max="999" step="1" value="${i.duration??''}" placeholder="Não definida"></label><label class="v2-field">Mídia<select data-item-field="mediaType">${Object.entries(MEDIA_TYPES).map(([type,label])=>`<option value="${type}" ${(i.mediaType||'none')===type?'selected':''}>${label}</option>`).join('')}</select></label><label class="v2-field" data-media-title-field ${(i.mediaType||'none')==='none'?'hidden':''}>Nome da mídia (opcional)<input data-item-field="mediaTitle" value="${esc(i.mediaTitle||'')}"></label></div><label class="v2-field">Observação<input data-item-field="note" value="${esc(i.note)}"></label><label class="check-control"><input data-item-field="hasSongs" type="checkbox" ${i.hasSongs?'checked':''}> Este momento possui músicas</label>${i.hasSongs?`<div class="editor-songs"><h3>Músicas selecionadas</h3>${i.songs.length?`<ol>${i.songs.map((song,index)=>`<li><div class="song-editor" data-song="${index}"><span class="drag-handle" draggable="true" title="Arraste para reordenar" aria-hidden="true">⠿</span><span data-song-label>${esc(songLabel(song))}</span><button type="button" class="btn btn-ghost" data-action="song-up" ${index===0?'disabled':''} aria-label="Subir música">↑</button><button type="button" class="btn btn-ghost" data-action="song-down" ${index===i.songs.length-1?'disabled':''} aria-label="Descer música">↓</button><button type="button" class="btn btn-danger" data-action="song-remove">Remover</button><label class="song-reference-field">Referência opcional<input data-song-field="reference" value="${esc(typeof song==='object'?song.reference||'':'')}" placeholder="Nº do hinário ou CD"></label></div></li>`).join('')}</ol>`:'<p class="muted">Nenhuma música selecionada.</p>'}<button type="button" class="btn btn-secondary" data-action="music">+ Adicionar música</button></div>`:''}<button type="submit" class="btn btn-primary panel-save">Salvar culto</button></article>`;
  }
  function handleInput(e){
    const input=e.target;
    if(input.name&&Object.hasOwn(draft,input.name))draft[input.name]=input.value;
    if(input.dataset.sectionField){
      const section=draft.sections.find(s=>s.type===input.closest('[data-section-editor]').dataset.sectionEditor),key=input.dataset.sectionField;
      section[key]=input.type==='checkbox'?input.checked:input.value;
      if(key==='startTime'&&section.type==='culto')draft.startTime=input.value;
      if(key==='startTime'&&section.type==='ss')draft.sabbathStartTime=input.value;
      if(key==='label')document.querySelector(`[data-section-heading="${section.type}"]`).textContent=input.value;
    }
    if(input.dataset.teamField)draft.soundTeam[+input.closest('[data-team]').dataset.team][input.dataset.teamField]=input.value;
    const row=input.closest('[data-item]'),key=input.dataset.itemField;
    if(row){
      const item=draft.items.find(i=>i.id===row.dataset.item);
      if(key){
        item[key]=input.type==='checkbox'?input.checked:key==='duration'?input.value===''||!input.validity.valid?null:+input.value:input.value;
        if(key==='mediaType')row.querySelector('[data-media-title-field]').hidden=input.value==='none';
      }
      if(input.dataset.songField){
        const songRow=input.closest('[data-song]'),index=+songRow.dataset.song;
        if(typeof item.songs[index]==='string')item.songs[index]={id:uid(),songId:null,title:songTitle(item.songs[index]),reference:''};
        item.songs[index][input.dataset.songField]=input.value;songRow.querySelector('[data-song-label]').textContent=songLabel(item.songs[index]);
      }
    }
    mark();drawRows();if(input.name==='date')updateCultoHeader(draft);
  }
  async function handleClick(e){
    const button=e.target.closest('[data-action]');if(!button||saving)return;const action=button.dataset.action;
    if(action==='select'){selectedId=button.dataset.select;drawItems();$('#moment-panel-title')?.scrollIntoView({block:'nearest'});$('#moment-panel [data-item-field=label]')?.focus({preventScroll:true});return;}
    if(action==='close'){const previous=selectedId;selectedId=null;drawItems();document.querySelector(`[data-select="${previous}"]`)?.focus({preventScroll:true});return;}
    if(action==='duplicate'){
      if(dirty){message('Salve as alterações antes de duplicar o culto.',true);return;}
      try{saving=true;$('#editor-form').inert=true;const result=await duplicateCulto(draft.id,revision);location.href=href('programacao.html',result.id);}catch(error){saving=false;$('#editor-form').inert=false;message(error.message,true);}return;
    }
    if(action==='reload'){
      if(dirty&&!confirm('Descartar as alterações não salvas e recarregar?'))return;
      try{db=await loadCollection();revision=db.revision;const c=db.cultos.find(c=>c.id===draft.id);if(!c&&saved)throw new Error('Este culto foi excluído em outra tela.');if(c?.status==='live'){location.href=href('ao-vivo.html',c.id);return;}if(c)draft=clone(c);materialize();dirty=false;draw();message('Dados recarregados.');}catch(error){message(error.message,true);}return;
    }
    if(action==='section-add'){draft.sections.push(newSection('Nova seção',draft.sections.length));mark();draw();return;}
    if(action.startsWith('section-')){
      const type=button.closest('[data-section-editor]').dataset.sectionEditor,index=draft.sections.findIndex(s=>s.type===type);
      if(action==='section-remove'){
        if(!confirm('Remover esta seção e todos os seus momentos?'))return;
        draft.sections.splice(index,1);draft.items=draft.items.filter(i=>i.section!==type);
      }else{const other=index+(action==='section-up'?-1:1);if(other<0||other>=draft.sections.length)return;[draft.sections[index],draft.sections[other]]=[draft.sections[other],draft.sections[index]];}
      draft.sections.forEach((s,index)=>s.position=index);mark();draw();return;
    }
    if(action==='team-add'){draft.soundTeam.push({role:'Sonoplastia',nome:''});mark();drawTeam();return;}
    if(action==='team-remove'){draft.soundTeam.splice(+button.dataset.index,1);mark();drawTeam();return;}
    if(action==='add'){
      const item=newItem(button.dataset.section),type=document.querySelector(`[data-preset-section="${button.dataset.section}"]`).value;
      item.sectionId=draft.sections.find(s=>s.type===item.section).id;item.type=type;item.label=type==='other'?'Novo momento':TYPES[type];
      const last=draft.items.findLastIndex(i=>i.section===item.section);draft.items.splice(last<0?draft.items.length:last+1,0,item);selectedId=item.id;mark();drawItems();return;
    }
    const row=button.closest('[data-item]');if(!row)return;
    const item=draft.items.find(i=>i.id===row.dataset.item),index=draft.items.indexOf(item);
    if(action==='remove'){if(!confirm('Remover este momento e suas músicas?'))return;draft.items.splice(index,1);selectedId=draft.items[index]?.id||draft.items[index-1]?.id||null;}
    else if(action==='up'||action==='down'){
      const section=draft.items.filter(i=>i.section===item.section),pos=section.indexOf(item),other=section[pos+(action==='up'?-1:1)];if(!other)return;
      const j=draft.items.indexOf(other);[draft.items[index],draft.items[j]]=[draft.items[j],draft.items[index]];
    }else if(action==='music'){await openPicker(song=>{item.songs.push(song);mark();drawItems();});return;}
    else if(action.startsWith('song-')){
      const pos=+button.closest('[data-song]').dataset.song;
      if(action==='song-remove')item.songs.splice(pos,1);
      else{const j=pos+(action==='song-up'?-1:1);if(j<0||j>=item.songs.length)return;[item.songs[pos],item.songs[j]]=[item.songs[j],item.songs[pos]];}
    }else return;
    mark();drawItems();
  }
  async function save(e){
    e.preventDefault();if(saving||!$('#editor-form').reportValidity())return;
    try{
      validateCulto(draft);computeTimes(draft);saving=true;$('#save-button').disabled=true;$('#editor-form').inert=true;
      db=await saveCulto(draft,revision);revision=db.revision;draft=clone(db.cultos.find(c=>c.id===draft.id));saved=true;dirty=false;materialize();
      history.replaceState(null,'',href('programacao.html',draft.id));draw();message('Culto salvo.');
    }catch(error){message(error.message+(error.status===409?' Suas alterações continuam no formulário. Use “Recarregar dados” para resolver o conflito.':''),true);}
    finally{saving=false;if($('#editor-form'))$('#editor-form').inert=false;if($('#save-button'))$('#save-button').disabled=false;}
  }
  window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
  document.addEventListener('click',e=>{const a=e.target.closest('a[href]');if(a&&dirty&&!confirm('Sair sem salvar as alterações?'))e.preventDefault();});
  draw();
}
function localDate(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
