import { applyOperation, normalizeLegacyData, validateCulto } from '../shared/culto.js';
import { prepareSupabaseCulto, isUUID } from '../shared/supabase-model.js';
export async function supabaseRPC(env,name,args) {
  if(!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY)throw Object.assign(new Error('CONFIGURAÇÃO MANUAL NECESSÁRIA: SUPABASE_URL e SUPABASE_SECRET_KEY no servidor.'),{status:503});
  const headers={'Content-Type':'application/json',apikey:env.SUPABASE_SECRET_KEY};
  if(env.SUPABASE_SECRET_KEY.startsWith('eyJ'))headers.Authorization='Bearer '+env.SUPABASE_SECRET_KEY;
  const response=await fetch(`${env.SUPABASE_URL.replace(/\/$/,'')}/rest/v1/rpc/${name}`,{method:'POST',headers,body:JSON.stringify(args),signal:AbortSignal.timeout(15000)});
  const value=await response.json().catch(()=>({}));
  if(!response.ok){const status=value.code==='40001'?409:value.code==='23505'?409:response.status>=500?502:400;throw Object.assign(new Error(status===409?'Os dados mudaram ou já existe um culto ao vivo. Recarregue antes de tentar novamente.':'Supabase recusou a operação: '+(value.message||response.status)),{status});}
  return value;
}
export async function readSupabase(env) {const value=await supabaseRPC(env,'read_culto_collection',{p_culto_id:null});if(value?.databaseVersion!==5)throw Object.assign(new Error('CONFIGURAÇÃO MANUAL NECESSÁRIA: aplique supabase/005-real-program.sql.'),{status:503});return normalizeLegacyData(value);}
export async function writeSupabase(env,body) {
  const op=body.operation;
  if(!op || typeof op.type!=='string')throw Object.assign(new Error('Operação ausente.'),{status:400});
  if(op.type==='checklist'){
    if(!isUUID(op.id)||!isUUID(op.itemId)||typeof op.completed!=='boolean')throw Object.assign(new Error('Checklist inválido.'),{status:400});
    await supabaseRPC(env,'set_culto_checklist',{p_culto_id:op.id,p_item_id:op.itemId,p_completed:op.completed});
  } else {
    if(!Number.isInteger(body.expectedRevision))throw Object.assign(new Error('Revisão obrigatória.'),{status:400});
    const before=await readSupabase(env);
    if(before.revision!==body.expectedRevision)throw Object.assign(new Error('Os dados mudaram em outra tela. Recarregue antes de salvar.'),{status:409});
    if(op.type==='save')validateCulto(op.culto);
    const next=applyOperation(before,op);
    const id=op.type==='save'?op.culto.id:op.type==='duplicate'?op.newId:op.id;
    if(!isUUID(id))throw Object.assign(new Error('ID inválido para Supabase.'),{status:400});
    const c=op.type==='delete'?null:prepareSupabaseCulto(next.cultos.find(c=>c.id===id));
    await supabaseRPC(env,'commit_culto_change',{
      p_expected_revision:body.expectedRevision,p_culto:c,
      p_live_state:next.liveState?.cultoId===id?next.liveState:null,
      p_delete_id:op.type==='delete'?id:null,
    });
  }
  return readSupabase(env);
}
