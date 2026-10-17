import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs/promises';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const id='10000000-0000-4000-8000-000000000001';
let reads=0,fail=false,changed=0;const channels=[],connections=[],data=[],errors=[];
let db={cultos:[{id}],liveState:{cultoId:id},revision:0};
const client={channel(name){const c={name,handlers:[],on(type,filter,fn){this.handlers.push({type,filter,fn});return this;},subscribe(fn){this.status=fn;return this;}};channels.push(c);return c;},async removeChannel(c){c.removed=true;c.status('CLOSED');}};
const events=new EventTarget(),documentEvents=new EventTarget();
const context=vm.createContext({console,setTimeout,clearTimeout,crypto,CustomEvent,document:Object.assign(documentEvents,{visibilityState:'visible'}),addEventListener:events.addEventListener.bind(events),removeEventListener:events.removeEventListener.bind(events),dispatchEvent:events.dispatchEvent.bind(events)});
const mocks={
 './config.js':{CONFIG:{pollInterval:40,realtimeDebounce:2}},
 './storage.js':{usesSupabase:true,isLocal:false,loadCollection:async()=>{reads++;if(fail)throw new Error('offline');return structuredClone(db);},onStorageChange:fn=>{changed=fn;return()=>{changed=null;};}},
 './supabase.js':{getSupabase:async()=>client},
 './supabase-model.js':{isUUID:value=>value===id},
};
const source=await fs.readFile(new URL('../shared/live-sync.js',import.meta.url),'utf8');
const module=new vm.SourceTextModule(source,{context});
await module.link(specifier=>{const exports=mocks[specifier];return new vm.SyntheticModule(Object.keys(exports),function(){for(const [key,value] of Object.entries(exports))this.setExport(key,value);},{context});});
await module.evaluate();
const subscription=module.namespace.subscribe(value=>data.push(value),e=>errors.push(e),{cultoId:id,checklist:true,onConnection:state=>connections.push(state)});
await sleep(10);assert.equal(channels.length,1);
assert.ok(channels[0].handlers.some(h=>h.filter.table==='cultos'&&h.filter.filter==='id=eq.'+id));
assert.ok(channels[0].handlers.some(h=>h.filter.table==='cerimonial_checklist'&&h.filter.filter==='culto_id=eq.'+id));
channels[0].status('SUBSCRIBED');await sleep(10);const afterJoin=reads;await sleep(95);assert.equal(reads,afterJoin,'Não pode manter polling com Realtime saudável');
db.revision=1;channels[0].handlers.find(h=>h.filter.table==='cultos'&&h.filter.event==='UPDATE').fn({new:{id}});await sleep(15);assert.equal(data.at(-1).revision,1);
channels[0].handlers.find(h=>h.filter.table==='cerimonial_checklist').fn({new:{culto_id:id}});await sleep(15);assert.ok(reads>afterJoin+1);
const beforeUnrelatedDelete=reads;channels[0].handlers.find(h=>h.filter.event==='DELETE').fn({old:{id:'outro'}});await sleep(10);assert.equal(reads,beforeUnrelatedDelete);
channels[0].status('CHANNEL_ERROR');const beforeFallback=reads;await sleep(95);assert.ok(reads>=beforeFallback+2);assert.equal(connections.at(-1),'reconnecting');
channels[0].status('SUBSCRIBED');await sleep(10);const recovered=reads;await sleep(80);assert.equal(reads,recovered);
fail=true;changed();await sleep(15);assert.ok(errors.length);assert.equal(connections.at(-1),'reconnecting');const lastData=data.at(-1);await sleep(45);assert.equal(data.at(-1),lastData);
fail=false;await sleep(50);assert.equal(connections.at(-1),'synced');
subscription.stop();const stopped=reads;await sleep(90);assert.equal(reads,stopped);assert.ok(channels[0].removed);
console.log('OK Realtime: escopo de culto/checklist, invalidação, ausência de polling saudável, fallback, recuperação, último snapshot e unsubscribe.');
