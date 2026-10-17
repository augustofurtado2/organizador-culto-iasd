import { CONFIG } from './config.js';
import { readSupabaseCollection } from './supabase.js';
import { isUUID } from './supabase-model.js';
import { emptyCollection, normalizeLegacyData, applyOperation, uid } from './culto.js';
export const isLocal = CONFIG.storageMode === 'local' || (CONFIG.storageMode === 'auto' && ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname));
export const usesSupabase = !isLocal && CONFIG.provider === 'supabase';
const listeners = new Set();
let current = null;
const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('iasd-cultos-v2') : null;
function notify() { listeners.forEach(fn => fn()); }
if (channel) channel.onmessage = notify;
globalThis.addEventListener?.('storage', e => { if (e.key === CONFIG.localKey) notify(); });
export function onStorageChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function readLocal() {
  const raw = localStorage.getItem(CONFIG.localKey);
  return raw ? normalizeLegacyData(JSON.parse(raw)) : emptyCollection();
}
async function responseJSON(response) {
  const body = await response.json().catch(() => { throw new Error('Resposta inválida do servidor. Confira se a Function está publicada.'); });
  if (!response.ok) { const error = new Error(body.erro || `Falha de conexão (${response.status}).`); error.status = response.status; throw error; }
  return body;
}
export async function loadCollection({cultoId=null}={}) {
  const value = isLocal ? readLocal() : usesSupabase ? await readSupabaseCollection(isUUID(cultoId)?cultoId:null) : await responseJSON(await fetch(CONFIG.endpoint, { cache: 'no-store', signal: AbortSignal.timeout(15000) }));
  current = normalizeLegacyData(value); return structuredClone(current);
}
let pending = false;
export async function mutate(operation, expectedRevision = current?.revision) {
  if (pending) throw new Error('Aguarde a gravação em andamento.');
  if (!Number.isInteger(expectedRevision)) throw new Error('Carregue os dados antes de salvar.');
  pending = true;
  try {
    let value;
    if (isLocal) {
      const write = () => {
        const db = readLocal();
        if (db.revision !== expectedRevision) { const e = new Error('Os dados mudaram em outra tela. Recarregue antes de tentar novamente.'); e.status = 409; throw e; }
        const next = applyOperation(db, operation);
        localStorage.setItem(CONFIG.localKey, JSON.stringify(next)); return next;
      };
      value = navigator.locks ? await navigator.locks.request('iasd-cultos-write', write) : write();
    } else {
      value = await responseJSON(await fetch(CONFIG.endpoint, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ operation, expectedRevision, provider:CONFIG.provider, projectUrl:usesSupabase?CONFIG.supabaseUrl:null }), signal: AbortSignal.timeout(20000) }));
    }
    current = normalizeLegacyData(value);
    channel?.postMessage({ revision: current.revision }); notify();
    return structuredClone(current);
  } finally { pending = false; }
}
export const getCultos = async () => (await loadCollection()).cultos;
export const getCulto = async id => (await loadCollection({cultoId:id})).cultos.find(c=>c.id===id || c.legacyId===id)||null;
export const saveCulto = (culto, revision) => mutate({ type: 'save', culto }, revision);
export const deleteCulto = (id, revision) => mutate({ type: 'delete', id }, revision);
export const duplicateCulto = (id, revision) => { const newId = uid(); return mutate({ type: 'duplicate', id, newId }, revision).then(db => ({ db, id: newId })); };
export const getLiveState = async (id=null) => (await loadCollection({cultoId:id})).liveState;
// Transições explícitas evitam estados impossíveis gravados por telas diferentes.
export const saveLiveState = (type, id, revision) => mutate({ type, id }, revision);

export const getLiveCulto = async () => {const db=await loadCollection();return db.cultos.find(c=>c.id===db.liveState?.cultoId)||null;};
export const startCulto = (id,revision) => saveLiveState('start',id,revision);
export const advanceCulto = (id,revision) => saveLiveState('next',id,revision);
export const previousCultoItem = (id,revision) => saveLiveState('previous',id,revision);
export const finishCulto = (id,revision) => saveLiveState('finish',id,revision);
export const createCulto = (culto,revision) => saveCulto(culto,revision);
export const updateCulto = (id,culto,revision) => saveCulto({...culto,id},revision);
export const setChecklist = (id,itemId,completed,revision) => mutate({type:'checklist',id,itemId,completed},revision);
export const getChecklist = async id => (await getCulto(id))?.checklistIds || [];
