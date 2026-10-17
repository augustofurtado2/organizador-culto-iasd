import { CONFIG } from './config.js';
let pending;
export function validatePublicConfig() {
  if (!CONFIG.supabaseUrl || !CONFIG.supabasePublishableKey) throw new Error('CONFIGURAÇÃO MANUAL NECESSÁRIA: informe a URL e a publishable key do Supabase em shared/config.js.');
  const url = new URL(CONFIG.supabaseUrl);
  if (url.protocol !== 'https:' && !['localhost','127.0.0.1'].includes(url.hostname)) throw new Error('Use HTTPS para conectar ao Supabase.');
  const key = CONFIG.supabasePublishableKey;
  if (key.startsWith('sb_publishable_')) return;
  if (key.startsWith('eyJ')) {
    try { const token=JSON.parse(atob(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))); if(token.role==='anon')return; } catch { /* recusar credencial inválida */ }
  }
  throw new Error('Use somente publishable key pública ou anon legada. Chaves privilegiadas são proibidas no frontend.');
}
export function getSupabase() {
  if(!pending)pending=(async()=>{
    validatePublicConfig();
    if(!globalThis.supabase?.createClient)await new Promise((resolve,reject)=>{
      const script=document.createElement('script');script.src=new URL('../vendor/supabase/supabase.js',import.meta.url).href;
      script.onload=resolve;script.onerror=()=>{script.remove();reject(new Error('Não foi possível carregar o SDK local do Supabase.'));};document.head.append(script);
    });
    return globalThis.supabase.createClient(CONFIG.supabaseUrl,CONFIG.supabasePublishableKey,{
      auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
      global:{fetch:(url,options={})=>fetch(url,{...options,signal:options.signal || AbortSignal.timeout(15000)})},
    });
  })().catch(error=>{pending=null;throw error;});
  return pending;
}
export async function readSupabaseCollection(cultoId=null) {
  const client=await getSupabase();
  const {data,error}=await client.rpc('read_culto_collection',{p_culto_id:cultoId});
  if(error)throw new Error('Falha ao ler Supabase: '+error.message);
  if(data?.databaseVersion!==5)throw new Error('CONFIGURAÇÃO MANUAL NECESSÁRIA: aplique supabase/005-real-program.sql antes de usar esta versão.');
  return data;
}
