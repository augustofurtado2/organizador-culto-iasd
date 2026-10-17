// Regras puras, compartilhadas entre navegador, testes e Cloudflare Function.
export const STATUS = { planned: 'Planejado', live: 'Ao vivo', finished: 'Finalizado' };
export const TYPES = { welcome:'Boas-vindas', worship:'Louvor', prayer:'Oração', offering:'Oferta', special_music:'Mensagem musical', children:'Adoração Infantil', sermon:'Sermão', video:'Vídeo', information:'Informativo', transition:'Transição', school:'Escola Sabatina', closing:'Encerramento', other:'Outro' };
export const MEDIA_TYPES = {none:'Nenhuma',video:'Vídeo',audio:'Áudio',image:'Imagem',other:'Outra mídia'};
export const SECTIONS = { culto: 'Culto', ss: 'Escola Sabatina' };
export const clone = value => JSON.parse(JSON.stringify(value));
export function uid() {
  return globalThis.crypto?.randomUUID?.() || `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}
export function emptyCollection() { return { schemaVersion: 2, revision: 0, cultos: [], liveState: null }; }
export function parseTime(value) {
  if (!/^\d{1,2}:\d{2}$/.test(value || '')) throw new Error('Informe um horário no formato HH:MM.');
  const [h, m] = value.split(':').map(Number);
  if (h > 23 || m > 59) throw new Error('Horário inválido.');
  return h * 60 + m;
}
export function formatTime(minutes) { const n = ((minutes % 1440) + 1440) % 1440; return `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`; }
export const songTitle = song => typeof song === 'string' ? song : song?.title || '';
export const songLabel = song => typeof song==='object' && song?.reference ? `${song.reference} — ${songTitle(song)}` : songTitle(song);
export const timingMode = culto => culto.timingMode || 'independent';
export function newSection(label='Nova seção',position=0) {const id=uid();return {id,type:'section_'+id.replace(/-/g,''),label,position,enabled:true,startTime:'09:30'};}
export function getSections(culto) {
  if (Array.isArray(culto.sections) && culto.sections.length) {
    return [...culto.sections].sort((a,b)=>a.position-b.position).map(s=>({ ...s, startTime: timingMode(culto)==='independent' && s.type==='culto' ? culto.startTime : timingMode(culto)==='independent' && s.type==='ss' ? culto.sabbathStartTime : s.startTime || culto.startTime }));
  }
  return Object.entries(SECTIONS).map(([type,label],position)=>({ type,label,position,enabled:true,startTime:type==='culto'?culto.startTime:culto.sabbathStartTime }));
}
export function computeTimes(culto) {
  const sections=getSections(culto),positions=Object.fromEntries(sections.map((s,index)=>[s.type,index]));
  if(culto.items.some(i=>!Object.hasOwn(positions,i.section)))throw new Error('Seção do momento não encontrada.');
  culto.items.sort((a,b)=>positions[a.section]-positions[b.section]);
  let cursor=parseTime(culto.startTime),order=0;
  for(const section of sections){
    if(timingMode(culto)==='independent')cursor=parseTime(section.startTime);
    for(const item of culto.items.filter(i=>i.section===section.type)){
      item.order=order++;
      if(!item.enabled || !section.enabled){item.computedTime='';continue;}
      item.computedTime=cursor===null?'':formatTime(cursor);
      cursor=cursor===null || item.duration==null ? null : cursor+item.duration;
    }
  }
  return culto;
}
// Apenas para importar/conferir horários explícitos; o editor calcula por duração.
export function inferDurationsFromTimes(culto) {
  const items=getSections(culto).filter(s=>s.enabled).flatMap(s=>culto.items.filter(i=>i.enabled&&i.section===s.type));
  items.forEach((item,index)=>{
    if(!item.referenceTime || !items[index+1]?.referenceTime)return;
    let difference=parseTime(items[index+1].referenceTime)-parseTime(item.referenceTime);
    if(difference<0)difference+=1440;
    if(difference>999)throw new Error('Intervalo de referência acima de 999 minutos.');
    if(item.duration!=null && item.duration!==difference)throw new Error('Duração diverge dos horários de referência: '+item.label);
    item.duration=difference;
  });
  return computeTimes(culto);
}
export function sectionSchedule(culto,type){
  const items=enabledItems(culto).filter(i=>i.section===type);
  if(!items.length)return {start:'',end:'',endIsMarker:false};
  const first=items[0],last=items.at(-1);
  return {start:first.computedTime,end:last.computedTime ? last.duration==null ? last.computedTime : formatTime(parseTime(last.computedTime)+last.duration) : '',endIsMarker:last.duration==null};
}
export function newItem(section = 'culto') {
  return { id: uid(), order: 0, section, type: 'other', label: 'Novo momento', responsible: '', duration: null, computedTime: '', enabled: true, note: '', hasSongs: false, songs: [], mediaType:'none',mediaTitle:'' };
}
export function newCulto(date = '') {
  return { id: uid(), title: 'Culto de Adoração', date, status: 'planned', timingMode:'continuous', startTime: '09:30', sabbathStartTime: '11:15', elder: '', ceremonyLead: '', soundTeam: [], notes: '', items: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
}
// Nomes sugeridos no editor (ainda dá pra digitar outro).
export const PEOPLE = { elder: [], ceremonyLead: ['Iza', 'Carol', 'Cássia'] };
// Modelo base do "Novo culto": liturgia de 17/10/2026 sem nomes nem músicas.
const BASE_ITEMS = [
  ['culto','welcome','Boas-vindas',2],
  ['culto','worship','Louvor inicial',10,{songs:['Louvor 1','Louvor 2','Louvor 3']}],
  ['culto','offering','Ofertório',5,{mediaType:'video',mediaTitle:'Provai e Vede',note:'Música instrumental branca após o vídeo'}],
  ['culto','special_music','Mensagem musical',3],
  ['culto','children','Adoração Infantil',5],
  ['culto','worship','Louvor',20,{songs:['Louvor 4','Louvor 5']}],
  ['culto','sermon','Sermão',35],
  ['culto','worship','Música final e momento de apelo',5,{mediaType:'video'}],
  ['culto','prayer','Oração final',1],
  ['culto','information','Informativo Mundial das Missões',4,{mediaType:'video',mediaTitle:'Informativo Mundial das Missões'}],
  ['culto','transition','Transição para a Escola Sabatina',5],
  ['ss','school','Início da Escola Sabatina / Divisão em classes',55],
  ['ss','closing','Encerramento da Escola Sabatina',null],
];
export function baseCulto(date = '') {
  const c = newCulto(date);
  c.sabbathStartTime = '11:05';
  c.items = BASE_ITEMS.map(([section,type,label,duration,extra={}]) => {
    const { songs = [], ...rest } = extra;
    return { ...newItem(section), type, label, duration, ...rest, hasSongs: songs.length > 0, songs: songs.map(title => ({ id: uid(), songId: null, title, reference: '' })) };
  });
  return c;
}
function hash(value) { let h = 2166136261; for (const c of value) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0).toString(36); }
export function normalizeLegacyData(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Formato de dados inválido.');
  if (data.schemaVersion === 2) {
    if (!Array.isArray(data.cultos) || !Number.isInteger(data.revision) || data.revision < 0) throw new Error('Coleção V2 inválida.');
    const result = clone(data);
    const ids = new Set();
    for (const culto of result.cultos) { validateCulto(culto); if (ids.has(culto.id)) throw new Error('Cultos com ID repetido.'); ids.add(culto.id); computeTimes(culto); }
    validateLive(result);
    return result;
  }
  if (data.schemaVersion != null) throw new Error('Versão de dados não suportada.');
  if (!('cultoItems' in data) && !('ssItems' in data)) {
    if (Object.keys(data).length) throw new Error('Formato desconhecido: nenhum dado foi substituído.');
    return emptyCollection();
  }
  const collection = emptyCollection();
  const legacyDate = typeof data.data === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.data) ? data.data : '1970-01-01';
  const c = newCulto(legacyDate);
  c.timingMode='independent';
  c.id = 'legacy-' + hash(JSON.stringify(data));
  c.startTime = validLegacyTime(data.horarioCulto, '09:30');
  c.sabbathStartTime = validLegacyTime(data.horarioSS, '11:15');
  c.elder = String(data.anciao || ''); c.ceremonyLead = String(data.liderCerimonial || '');
  c.soundTeam = Array.isArray(data.equipeSom) ? clone(data.equipeSom) : [];
  c.notes = String(data.notes || data.observacoes || '');
  c.createdAt = c.updatedAt = data.updatedAt || '1970-01-01T00:00:00.000Z';
  c.items = ['culto', 'ss'].flatMap(section => (Array.isArray(data[section === 'culto' ? 'cultoItems' : 'ssItems']) ? data[section === 'culto' ? 'cultoItems' : 'ssItems'] : []).map((i, index) => ({
    id: `${c.id}-${section}-${index}-${hash(String(i.id ?? index))}`, order: index, section, type: 'other',
    label: String(i.label || 'Momento'), responsible: String(i.resp || ''),
    duration: i.duration != null && i.duration !== '' && Number.isFinite(+i.duration) && +i.duration >= 0 ? Math.min(999, Math.round(+i.duration)) : 5,
    computedTime: '', enabled: i.enabled !== false, note: String(i.note || ''), hasSongs: !!i.hasSongs,
    songs: Array.isArray(i.songs) ? i.songs.filter(s => typeof s === 'string' && s.trim()) : [],
  })));
  computeTimes(c); collection.cultos.push(c);
  // Cópia integral para recuperar inclusive campos antigos não reconhecidos.
  collection.legacySnapshot = clone(data);
  return collection;
}
function validLegacyTime(value, fallback) { try { return formatTime(parseTime(value)); } catch { return fallback; } }
export function enabledItems(culto) { const enabled=new Set(getSections(culto).filter(s=>s.enabled).map(s=>s.type));return culto.items.filter(i=>i.enabled && enabled.has(i.section)); }
export function validateCulto(c) {
  if (!c || typeof c.id !== 'string' || !c.id || c.id.length > 200) throw new Error('ID de culto inválido.');
  if (typeof c.title !== 'string' || !c.title.trim() || c.title.length > 200) throw new Error('Informe o nome do culto (até 200 caracteres).');
  if (typeof c.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(c.date) || new Date(c.date + 'T12:00:00Z').toISOString().slice(0, 10) !== c.date) throw new Error('Informe uma data válida.');
  if (!Object.hasOwn(STATUS, c.status)) throw new Error('Status inválido.');
  parseTime(c.startTime); parseTime(c.sabbathStartTime);
  if(!['continuous','independent'].includes(timingMode(c)))throw new Error('Modo de horários inválido.');
  if (!Array.isArray(c.items) || c.items.length > 500 || !Array.isArray(c.soundTeam)) throw new Error('Lista de momentos ou equipe inválida.');
  for (const field of ['elder', 'ceremonyLead', 'notes']) if (typeof c[field] !== 'string') throw new Error('Informações gerais inválidas.');
  const sections=getSections(c);const sectionTypes=new Set(sections.map(s=>s.type));
  if(sections.length>50 || sectionTypes.size!==sections.length)throw new Error('Seções inválidas ou repetidas.');
  const sectionPositions=new Set();
  for(const section of sections) { if(!Number.isInteger(section.position)||section.position<0||sectionPositions.has(section.position)||!section.label?.trim())throw new Error('Posições e nomes das seções precisam ser válidos.');sectionPositions.add(section.position); if(!/^[a-z][a-z0-9_-]{0,63}$/.test(section.type) || typeof section.label!=='string' || typeof section.enabled!=='boolean')throw new Error('Seção inválida.');parseTime(section.startTime); }
  const ids = new Set();
  c.items.forEach(i => {
    if (typeof i.id !== 'string' || !i.id || ids.has(i.id)) throw new Error('ID de momento ausente ou repetido.'); ids.add(i.id);
    if(i.sectionId && sections.find(s=>s.type===i.section)?.id && i.sectionId!==sections.find(s=>s.type===i.section).id)throw new Error('Seção do momento inconsistente.');
    if (!sectionTypes.has(i.section) || typeof i.type !== 'string' || typeof i.label !== 'string' || !i.label.trim()) throw new Error('Informe nome e seção do momento.');
    if (typeof i.responsible !== 'string' || typeof i.note !== 'string' || typeof i.enabled !== 'boolean' || typeof i.hasSongs !== 'boolean') throw new Error('Momento inválido.');
    if (i.duration!=null && (!Number.isInteger(i.duration) || i.duration < 0 || i.duration > 999)) throw new Error('A duração deve ser vazia ou de 0 a 999 minutos.');
    if(!Object.hasOwn(MEDIA_TYPES,i.mediaType||'none') || i.mediaTitle!=null&&typeof i.mediaTitle!=='string')throw new Error('Mídia inválida.');
    if (!Array.isArray(i.songs) || i.songs.length > 100 || i.songs.some(s => typeof s !== 'string' && (!s || typeof s.title !== 'string' || !s.title.trim() || s.songId != null && typeof s.songId !== 'string'))) throw new Error('Músicas inválidas.');
  });
}
function validateLive(collection) {
  const liveCultos = collection.cultos.filter(c => c.status === 'live');
  const state = collection.liveState;
  if (!state) { if (liveCultos.length) throw new Error('Culto ao vivo sem estado operacional.'); return; }
  const c = collection.cultos.find(c => c.id === state.cultoId);
  if (!c || c.status !== 'live' || liveCultos.length !== 1 || !enabledItems(c).some(i => i.id === state.activeItemId) || !Array.isArray(state.completedItemIds) || !Number.isFinite(Date.parse(state.startedAt)) || !Number.isFinite(Date.parse(state.activeStartedAt))) throw new Error('Estado ao vivo inválido.');
}
export function applyOperation(input, op, now = new Date().toISOString()) {
  const db = normalizeLegacyData(input);
  if (!op || typeof op.type !== 'string') throw new Error('Operação inválida.');
  const c = db.cultos.find(c => c.id === op.id);
  if (op.type === 'save') {
    const value = clone(op.culto); validateCulto(value);
    const old = db.cultos.find(c => c.id === value.id);
    if (old?.status === 'live') throw new Error('Finalize o culto antes de editar sua programação.');
    value.checklistIds=clone(old?.checklistIds||[]);
    value.status = old?.status || 'planned'; value.updatedAt = now;
    if (old) db.cultos[db.cultos.indexOf(old)] = computeTimes(value); else db.cultos.push(computeTimes(value));
  } else if (op.type === 'delete') {
    if (!c) throw new Error('Culto não encontrado.');
    if (c.status === 'live') throw new Error('Finalize o culto antes de excluir.');
    db.cultos = db.cultos.filter(x => x.id !== c.id);
  } else if (op.type === 'duplicate') {
    if (!c) throw new Error('Culto não encontrado.');
    const copy = clone(c); copy.id = op.newId || uid(); copy.title += ' — cópia';const date=new Date(copy.date+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+7);copy.date=op.date||date.toISOString().slice(0,10); copy.status = 'planned';
    copy.sections=getSections(copy).map(section=>({...section,id:uid()}));copy.items.forEach(i => { i.id = uid();i.sectionId=copy.sections.find(s=>s.type===i.section).id;i.status='pending';delete i.realStartedAt;delete i.realFinishedAt;i.songs=i.songs.map(song=>typeof song==='string'?song:{...song,id:uid()}); });delete copy.checklistIds;delete copy.realStartedAt; delete copy.lastLiveState; delete copy.finishedAt; copy.createdAt = copy.updatedAt = now; validateCulto(copy);
    if (db.cultos.some(x => x.id === copy.id)) throw new Error('ID já existente.');
    db.cultos.push(copy);
  } else if (op.type === 'checklist') {
    if(!c || typeof op.completed!=='boolean' || !enabledItems(c).some(i=>i.id===op.itemId))throw new Error('Item de checklist inválido.');
    const ids=new Set((c.checklistIds||[]).filter(id=>enabledItems(c).some(i=>i.id===id)));
    if(op.completed)ids.add(op.itemId);else ids.delete(op.itemId);c.checklistIds=[...ids];
  } else if (op.type === 'start') {
    if (!c) throw new Error('Culto não encontrado.');
    if (db.liveState) throw new Error('Já existe um culto ao vivo. Finalize-o antes de iniciar outro.');
    const first = enabledItems(c)[0]; if (!first) throw new Error('Adicione pelo menos um momento habilitado.');
    c.status = 'live'; c.updatedAt = c.realStartedAt = now; delete c.finishedAt;
    c.items.forEach(i=>{i.status=i.id===first.id?'active':'pending';i.realStartedAt=i.id===first.id?now:null;i.realFinishedAt=null;});
    db.liveState = { cultoId: c.id, activeItemId: first.id, startedAt: now, activeStartedAt: now, updatedAt: now, completedItemIds: [] };
  } else if (['next', 'previous', 'finish'].includes(op.type)) {
    if (!c || db.liveState?.cultoId !== c.id || c.status !== 'live') throw new Error('Este culto não está ao vivo.');
    const live = db.liveState, list = enabledItems(c), index = list.findIndex(i => i.id === live.activeItemId);
    if (op.type === 'finish') {
      const current=list[index];current.status='completed';current.realFinishedAt=now;
      c.status = 'finished'; c.finishedAt = now;
      c.lastLiveState = { ...clone(live), completedItemIds: [...new Set([...live.completedItemIds, live.activeItemId])], updatedAt: now, finishedAt: now };
      db.liveState = null;
    } else {
      const target = list[index + (op.type === 'next' ? 1 : -1)];
      if (!target) throw new Error('Não há outro momento nessa direção.');
      const completed = new Set(live.completedItemIds);
      const current=list[index];
      current.status=op.type==='next'?'completed':'pending';current.realFinishedAt=op.type==='next'?now:null;
      if(op.type==='previous')current.realStartedAt=null;
      target.status='active';target.realStartedAt=now;target.realFinishedAt=null;
      if (op.type === 'next') completed.add(live.activeItemId);
      else { completed.delete(live.activeItemId); completed.delete(target.id); }
      live.activeItemId = target.id; live.activeStartedAt = live.updatedAt = now; live.completedItemIds = [...completed];
    }
    c.updatedAt = now;
  } else throw new Error('Operação não suportada.');
  if(op.type!=='checklist')db.revision += 1;
  db.cultos.forEach(validateCulto);
  validateLive(db);
  return db;
}
export function liveView(collection, culto, now = Date.now()) {
  const state = collection.liveState?.cultoId === culto?.id && culto?.status === 'live' ? collection.liveState : null;
  if (!state) return null;
  const items = enabledItems(culto), index = items.findIndex(i => i.id === state.activeItemId), active = items[index];
  if (!active) return null;
  const elapsed = Math.max(0, Math.floor((now - Date.parse(state.activeStartedAt)) / 1000));
  return { state, active, previous: items[index - 1] || null, next: items[index + 1] || null, elapsed, remaining: active.duration==null?null:Math.max(0, active.duration * 60 - elapsed), overtime: active.duration!=null&&elapsed > active.duration * 60 };
}
export function countdown(seconds) { if(seconds==null||!Number.isFinite(seconds))return '—:—';return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`; }
