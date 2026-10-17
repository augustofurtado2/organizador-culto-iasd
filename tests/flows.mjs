import assert from 'node:assert/strict';
import { newCulto, newItem, emptyCollection, applyOperation, normalizeLegacyData, computeTimes, liveView, clone } from '../shared/culto.js';
import { onRequestGet, onRequestPut } from '../functions/api/culto.js';
const at='2026-10-17T12:00:00.000Z';
const legacy={data:'2026-10-17',horarioCulto:'9:00',horarioSS:'11:15',anciao:'João',liderCerimonial:'Maria',equipeSom:[{role:'Computador',nome:'Ana'}],cultoItems:[{id:1,label:'Abertura',enabled:true,duration:5},{id:2,label:'Louvor',enabled:true,duration:15,hasSongs:true,songs:['Grande é o Senhor']}],ssItems:[{label:'Classes',duration:45}],extra:{preservar:true}};
const migrated=normalizeLegacyData(legacy);
assert.deepEqual(migrated.legacySnapshot,legacy);
assert.equal(migrated.cultos[0].id,normalizeLegacyData(legacy).cultos[0].id);
assert.deepEqual(migrated.cultos[0].items.map(i=>i.id),normalizeLegacyData(legacy).cultos[0].items.map(i=>i.id));
assert.equal(migrated.cultos[0].items[2].section,'ss');
assert.equal(migrated.cultos[0].items[2].computedTime,'11:15');
assert.equal(migrated.liveState,null);
assert.throws(()=>normalizeLegacyData({unrecognized:true}));
let db=emptyCollection(), c=newCulto('2026-10-17');c.startTime='09:00';c.timingMode='independent';
c.items=[{...newItem(),label:'Abertura',duration:5},{...newItem(),label:'Louvor',duration:15,hasSongs:true,songs:['Grande é o Senhor','Tu És Fiel']},{...newItem('ss'),label:'Classes',duration:45}];
computeTimes(c);assert.equal(c.items[1].computedTime,'09:05');
c.items[0].duration=10;computeTimes(c);assert.equal(c.items[1].computedTime,'09:10');
c.startTime='08:30';computeTimes(c);assert.equal(c.items[1].computedTime,'08:40');
c.items[0].enabled=false;computeTimes(c);assert.equal(c.items[1].computedTime,'08:30');assert.equal(c.items[2].computedTime,'11:15');c.items[0].enabled=true;
db=applyOperation(db,{type:'save',culto:c},at);db=normalizeLegacyData(JSON.parse(JSON.stringify(db)));
assert.deepEqual(db.cultos[0].items[1].songs,['Grande é o Senhor','Tu És Fiel']);
const second=newCulto('2026-10-24');second.items=[newItem()];db=applyOperation(db,{type:'save',culto:second},at);
const secondBefore=clone(db.cultos[1]);c=clone(db.cultos[0]);c.items.reverse();c.items.find(i=>i.hasSongs).songs.reverse();db=applyOperation(db,{type:'save',culto:c},at);
assert.deepEqual(db.cultos[1],secondBefore);assert.deepEqual(db.cultos[0].items.map(i=>i.order),[0,1,2]);
c=clone(db.cultos[0]);db=applyOperation(db,{type:'start',id:c.id},at);assert.equal(db.cultos[0].status,'live');assert.equal(db.liveState.activeItemId,db.cultos[0].items[0].id);
const firstState=liveView(db,db.cultos[0],Date.parse(at)+30000);assert.equal(firstState.elapsed,30);assert.equal(firstState.remaining,db.cultos[0].items[0].duration*60-30);
assert.throws(()=>applyOperation(db,{type:'start',id:second.id},at));assert.throws(()=>applyOperation(db,{type:'delete',id:c.id},at));assert.throws(()=>applyOperation(db,{type:'save',culto:c},at));
db=applyOperation(db,{type:'next',id:c.id},'2026-10-17T12:01:00Z');assert.equal(db.liveState.activeItemId,c.items[1].id);assert.ok(db.liveState.completedItemIds.includes(c.items[0].id));
db=applyOperation(db,{type:'previous',id:c.id},'2026-10-17T12:02:00Z');assert.equal(db.liveState.activeItemId,db.cultos[0].items[0].id);assert.equal(db.liveState.completedItemIds.length,0);
db=applyOperation(db,{type:'finish',id:c.id},'2026-10-17T12:03:00Z');assert.equal(db.liveState,null);assert.equal(db.cultos[0].status,'finished');assert.ok(db.cultos[0].lastLiveState);assert.equal(liveView(db,db.cultos[0]),null);assert.equal(db.cultos.length,2);
const dup=applyOperation(db,{type:'duplicate',id:c.id,newId:'copy'},at).cultos.at(-1);assert.equal(dup.status,'planned');assert.notEqual(dup.items[0].id,c.items[0].id);
// Function: legado só é persistido após operação válida; nenhuma rede real.
let record=legacy,writes=0;
globalThis.fetch=async(url,opts={})=>{
 if(opts.method==='PUT'){record=JSON.parse(opts.body);writes++;return new Response('{}');}
 return new Response(JSON.stringify({record}));
};
const env={JB_KEY:'mock-test-only'};
let response=await onRequestGet({env});assert.equal(response.status,200);const initial=await response.json();assert.equal(writes,0);
const request=(operation,expectedRevision,origin='https://example.test')=>new Request('https://example.test/api/culto',{method:'PUT',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify({operation,expectedRevision})});
response=await onRequestPut({env,request:request({type:'save',culto:second},initial.revision)});assert.equal(response.status,200);assert.equal(writes,1);assert.equal(record.cultos.length,2);assert.deepEqual(record.legacySnapshot,legacy);
response=await onRequestPut({env,request:request({type:'delete',id:second.id},0)});assert.equal(response.status,409);assert.equal(writes,1);
response=await onRequestPut({env,request:request({type:'delete',id:second.id},1,'https://another.test')});assert.equal(response.status,403);assert.equal(writes,1);
response=await onRequestPut({env:{},request:request({type:'delete',id:second.id},1)});assert.equal(response.status,503);
console.log('OK: cálculos, músicas, isolamento, IDs, migração, ao vivo, avanço/retorno, finalização, histórico, duplicação e contrato HTTP.');
// Rejeitar comando corrompido e formato futuro sem sobrescrever o registro.
response=await onRequestPut({env,request:request({type:'duplicate',id:record.cultos[0].id,newId:42},record.revision)});assert.equal(response.status,400);assert.equal(writes,1);
const savedRecord=record;record={schemaVersion:99,cultos:[]};response=await onRequestGet({env});assert.equal(response.status,502);assert.equal(writes,1);record=savedRecord;
const invalid=clone(second);invalid.items[0].duration=-1;response=await onRequestPut({env,request:request({type:'save',culto:invalid},record.revision)});assert.equal(response.status,400);assert.equal(writes,1);
// Habilitação e ordem são recalculadas sem perder a separação de seções.
const sections=newCulto('2026-10-17');sections.timingMode='independent';sections.items=[newItem('ss'),newItem('culto')];computeTimes(sections);assert.deepEqual(sections.items.map(i=>i.section),['culto','ss']);assert.equal(sections.items[1].computedTime,'11:15');
console.log('OK: formato futuro, IDs inválidos, duração negativa e ordem consistente de seções.');
