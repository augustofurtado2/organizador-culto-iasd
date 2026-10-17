import { CONFIG } from './config.js';
import { loadCollection, onStorageChange, usesSupabase, isLocal } from './storage.js';
import { getSupabase } from './supabase.js';
import { isUUID } from './supabase-model.js';

// Uma assinatura por tela. Os eventos são invalidações: a recarga lê um
// snapshot SQL consistente, nunca combina linhas de transações diferentes.
export function subscribe(onData,onError,{cultoId=null,checklist=false,onConnection}={}) {
  let stopped=false,running=false,rerun=false,pollTimer,eventTimer;
  let realtimeConnected=false,readOK=false,channel=null,client=null,channelKey=null,generation=0;
  const signal=state=>{
    onConnection?.(state);
    globalThis.dispatchEvent?.(new CustomEvent('culto-connection',{detail:state}));
  };
  const schedule=()=>{
    clearTimeout(pollTimer);
    if(!stopped && !(usesSupabase && realtimeConnected && readOK))pollTimer=setTimeout(refresh,CONFIG.pollInterval);
  };
  function invalidate(){clearTimeout(eventTimer);eventTimer=setTimeout(refresh,CONFIG.realtimeDebounce);}
  async function bind(db) {
    if(!usesSupabase || stopped)return;
    const selected=cultoId ? db.cultos.find(c=>c.id===cultoId||c.legacyId===cultoId)?.id || (isUUID(cultoId)?cultoId:null) : null;
    const target=selected||db.liveState?.cultoId||null;
    const key=JSON.stringify([selected,checklist?target:null]);if(channelKey===key)return;
    channelKey=key;const token=++generation;realtimeConnected=false;
    try {
      client=await getSupabase();if(stopped||token!==generation)return;
      if(channel)await client.removeChannel(channel);
      if(stopped||token!==generation)return;
      channel=client.channel('culto-'+crypto.randomUUID());
      if(selected){
        for(const event of ['INSERT','UPDATE'])channel.on('postgres_changes',{event,schema:'public',table:'cultos',filter:'id=eq.'+selected},invalidate);
        // DELETE pode chegar sem colunas de filtro: o PK é conferido no cliente.
        channel.on('postgres_changes',{event:'DELETE',schema:'public',table:'cultos'},payload=>{if(payload.old?.id===selected)invalidate();});
      } else channel.on('postgres_changes',{event:'*',schema:'public',table:'cultos'},invalidate);
      if(checklist&&target)for(const event of ['INSERT','UPDATE'])channel.on('postgres_changes',{event,schema:'public',table:'cerimonial_checklist',filter:'culto_id=eq.'+target},invalidate);
      channel.subscribe(status=>{
        if(stopped||token!==generation)return;
        realtimeConnected=status==='SUBSCRIBED';
        if(status==='CLOSED')channelKey=null;
        signal(realtimeConnected&&readOK?'synced':'reconnecting');schedule();
        if(realtimeConnected)refresh();
      });
    } catch(error){if(!stopped&&token===generation){channelKey=null;signal('reconnecting');schedule();onError(error);}}
  }
  async function refresh(){
    if(stopped)return;
    if(running){rerun=true;return;}
    running=true;
    try {
      const db=await loadCollection({cultoId});
      if(stopped)return;
      readOK=true;onData(db);await bind(db);
      signal(usesSupabase?(realtimeConnected?'synced':'reconnecting'):isLocal?'local':'polling');
    } catch(error){if(!stopped){readOK=false;signal('reconnecting');onError(error);}}
    finally {
      running=false;schedule();
      if(rerun&&!stopped){rerun=false;clearTimeout(eventTimer);eventTimer=setTimeout(refresh,0);}
    }
  }
  const off=onStorageChange(invalidate);
  const visible=()=>{if(document.visibilityState==='visible')refresh();};
  document.addEventListener('visibilitychange',visible);globalThis.addEventListener('online',refresh);
  signal('reconnecting');refresh();
  return {refresh,stop(){stopped=true;++generation;clearTimeout(pollTimer);clearTimeout(eventTimer);off();document.removeEventListener('visibilitychange',visible);globalThis.removeEventListener('online',refresh);if(channel&&client)client.removeChannel(channel);}};
}
export const subscribeToCulto=(id,onData,onError,options={})=>subscribe(onData,onError,{...options,cultoId:id});
export const subscribeToLiveState=subscribeToCulto;
export const subscribeToChecklist=(id,onData,onError,options={})=>subscribe(onData,onError,{...options,cultoId:id,checklist:true});
export const unsubscribe=subscription=>subscription.stop();
