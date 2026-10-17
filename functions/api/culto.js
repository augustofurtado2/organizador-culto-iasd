import * as legacy from '../../server/jsonbin.js';
import { readSupabase, writeSupabase } from '../../server/supabase.js';
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
function provider(env){const value=env.PERSISTENCE_PROVIDER||'jsonbin';if(!['jsonbin','supabase'].includes(value))throw new Error('PERSISTENCE_PROVIDER inválido.');return value;}
export async function onRequestGet(context) {
  try {return provider(context.env)==='jsonbin'?legacy.onRequestGet(context):json(await readSupabase(context.env));}
  catch(e){return json({erro:e.message},e.status||502);}
}
export async function onRequestPut(context) {
  const {request,env}=context;
  const origin=request.headers.get('Origin');
  if(origin&&origin!==new URL(request.url).origin)return json({erro:'Origem inválida.'},403);
  if(!request.headers.get('Content-Type')?.startsWith('application/json'))return json({erro:'Envie application/json.'},415);
  try {
    const raw=await request.text();if(new TextEncoder().encode(raw).length>2*1024*1024)return json({erro:'Requisição muito grande.'},413);
    let body;try{body=JSON.parse(raw);}catch{return json({erro:'JSON inválido.'},400);}
    const selected=provider(env);
    if((body?.provider||'jsonbin')!==selected)return json({erro:'Frontend e servidor usam provedores diferentes. Confira a configuração.'},409);
    if(selected==='jsonbin')return legacy.onRequestPut({...context,request:new Request(request.url,{method:'PUT',headers:request.headers,body:raw})});
    if(!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY)return json({erro:'CONFIGURAÇÃO MANUAL NECESSÁRIA: SUPABASE_URL e SUPABASE_SECRET_KEY no servidor.'},503);
    if(typeof body.projectUrl!=='string'||body.projectUrl.replace(/\/$/,'')!==env.SUPABASE_URL.replace(/\/$/,''))return json({erro:'Frontend e servidor apontam para projetos Supabase diferentes.'},409);
    if(!body?.operation)return json({erro:'Operação ausente.'},400);
    return json(await writeSupabase(env,body));
  } catch(e) {return json({erro:e.message},e.status||400);}
}
