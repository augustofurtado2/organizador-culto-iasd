import { clone, computeTimes, getSections, uid, songTitle, timingMode } from './culto.js';
export const isUUID = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value || '');
// Identidade determinística para seções de registros V2 já existentes.
export function sectionUUID(cultoId, type) {
  const value = `iasd-section:${cultoId}:${type}`;
  let hex = '';
  for (const seed of [2166136261, 2246822519, 3266489917, 668265263]) {
    let h = seed; for (const ch of value) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    hex += (h >>> 0).toString(16).padStart(8, '0');
  }
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-8${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20)}`;
}
export function prepareSupabaseCulto(input) {
  const c = clone(input);
  if (!isUUID(c.id) || c.items.some(i=>!isUUID(i.id))) throw new Error('IDs legados precisam passar pelo script de migração antes de usar Supabase.');
  c.timingMode=timingMode(c);
  c.sections = getSections(c).map((s, position)=>({ ...s, id: s.id || sectionUUID(c.id,s.type), position }));
  if(c.sections.some(s=>!isUUID(s.id)))throw new Error('ID de seção inválido.');
  c.items.forEach(i=>{
    i.mediaType ||= 'none';i.mediaTitle ||= '';
    i.sectionId = c.sections.find(s=>s.type===i.section)?.id;
    i.songs = i.songs.filter(s=>songTitle(s).trim()).map(s=>({ id: typeof s === 'object' && s.id ? s.id : uid(), songId: typeof s === 'object' ? s.songId ?? null : null, title: songTitle(s),reference:typeof s==='object'?s.reference||'':'' }));
  });
  return computeTimes(c);
}
