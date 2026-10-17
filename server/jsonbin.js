import { normalizeLegacyData, applyOperation } from '../shared/culto.js';

// Sem autenticação nesta etapa. Chave do JSONBin exclusivamente no servidor.
const BIN_ID = '6a076f2fadc21f119aa6cc4b';
const JB = 'https://api.jsonbin.io/v3';
function json(value, status = 200) { return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } }); }
async function read(env) {
  const res = await fetch(`${JB}/b/${env.JB_BIN_ID || BIN_ID}/latest`, { headers: env.JB_KEY ? { 'X-Master-Key': env.JB_KEY } : {}, cache: 'no-store' });
  if (!res.ok) throw new Error(`Não foi possível ler o JSONBin (${res.status}).`);
  const body = await res.json();
  if (!body || !Object.hasOwn(body, 'record')) throw new Error('Registro do JSONBin ausente.');
  return normalizeLegacyData(body.record);
}
export async function onRequestGet({ env }) {
  try { return json(await read(env)); } catch (e) { return json({ erro: e.message }, 502); }
}
export async function onRequestPut({ request, env }) {
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) return json({ erro: 'Origem inválida.' }, 403);
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) return json({ erro: 'Envie application/json.' }, 415);
  if (!env.JB_KEY) return json({ erro: 'Configure JB_KEY no servidor para salvar.' }, 503);
  let body;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > 2 * 1024 * 1024) return json({ erro: 'Requisição muito grande.' }, 413);
    body = JSON.parse(raw);
  } catch { return json({ erro: 'JSON inválido.' }, 400); }
  if (!Number.isInteger(body?.expectedRevision) || !body.operation) return json({ erro: 'Operação e revisão são obrigatórias.' }, 400);
  let db;
  try { db = await read(env); } catch (e) { return json({ erro: e.message }, 502); }
  if (db.revision !== body.expectedRevision) return json({ erro: 'Os dados mudaram em outra tela. Recarregue antes de tentar novamente.' }, 409);
  let next;
  try { next = applyOperation(db, body.operation); } catch (e) { return json({ erro: e.message }, 400); }
  if (new TextEncoder().encode(JSON.stringify(next)).length > 2 * 1024 * 1024) return json({ erro: 'A coleção excedeu o limite de 2 MB. Nada foi gravado.' }, 413);
  try {
    const res = await fetch(`${JB}/b/${env.JB_BIN_ID || BIN_ID}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Master-Key': env.JB_KEY }, body: JSON.stringify(next) });
    if (!res.ok) return json({ erro: `JSONBin recusou a gravação (${res.status}).` }, 502);
    return json(next);
  } catch { return json({ erro: 'Não foi possível confirmar a gravação. Recarregue os dados antes de tentar novamente.' }, 502); }
}
