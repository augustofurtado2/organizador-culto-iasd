import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {getSections,newCulto,newItem,applyOperation,normalizeLegacyData,uid} from '../shared/culto.js';
import {prepareSupabaseCulto} from '../shared/supabase-model.js';
import {onRequestGet,onRequestPut} from '../functions/api/culto.js';
import {buildMigration} from '../scripts/migrate-jsonbin-to-supabase.mjs';
// Ferramenta opcional de teste; não faz parte da aplicação nem exige npm/build.
if(!process.env.PGLITE_MODULE)throw new Error('Informe PGLITE_MODULE com o caminho do dist/index.js de @electric-sql/pglite. Veja docs/SUPABASE.md.');
const {PGlite}=await import(pathToFileURL(process.env.PGLITE_MODULE));
const pg=new PGlite();
try {
 await pg.exec('create role anon;create role authenticated;create role service_role bypassrls;');
 for(const file of ['001-schema.sql','002-policies.sql','003-realtime.sql','004-functions.sql','005-real-program.sql'])await pg.exec(await readFile(new URL('../supabase/'+file,import.meta.url),'utf8'));
 const read=async()=>normalizeLegacyData((await pg.query('select public.read_culto_collection(null) as value')).rows[0].value);
 const commit=async(db,op)=>{
  const next=applyOperation(db,op,'2026-10-17T12:00:00.000Z');
  const id=op.type==='save'?op.culto.id:op.type==='duplicate'?op.newId:op.id;
  const c=op.type==='delete'?null:prepareSupabaseCulto(next.cultos.find(c=>c.id===id));
  await pg.query('select public.commit_culto_change($1,$2::jsonb,$3::jsonb,$4::uuid)',[db.revision,c,next.liveState?.cultoId===id?next.liveState:null,op.type==='delete'?id:null]);
  return read();
 };
 let db=await read();assert.equal(db.cultos.length,0);
 let c=newCulto('2026-10-17');c.timingMode='independent';c.items=[{...newItem(),label:'Abertura',duration:5},{...newItem(),label:'Louvor',hasSongs:true,songs:[{id:uid(),songId:'1850',title:"Tu És Fiel"}]},newItem('ss')];
 db=await commit(db,{type:'save',culto:c});c=db.cultos[0];assert.equal(c.sections.length,2);assert.equal(c.items[1].songs[0].songId,'1850');assert.equal(c.items[1].computedTime,'09:35');
 const b=newCulto('2026-10-24');b.items=[newItem()];db=await commit(db,{type:'save',culto:b});const bBefore=JSON.stringify(db.cultos.find(c=>c.id===b.id));
 c=db.cultos.find(x=>x.id===c.id);c.items.reverse();c.items[0].duration=12;db=await commit(db,{type:'save',culto:c});assert.equal(JSON.stringify(db.cultos.find(c=>c.id===b.id)),bBefore);
 db=await commit(db,{type:'start',id:c.id});const active=db.liveState.activeItemId;assert.equal(db.cultos.find(x=>x.id===c.id).items.find(i=>i.id===active).status,'active');
 const beforeAdvance=db;db=await commit(db,{type:'next',id:c.id});assert.notEqual(db.liveState.activeItemId,active);assert.equal(db.cultos.find(x=>x.id===c.id).items.find(i=>i.id===active).status,'completed');assert.ok(db.cultos.find(x=>x.id===c.id).items.find(i=>i.id===active).realFinishedAt);
 await assert.rejects(commit(beforeAdvance,{type:'next',id:c.id}),e=>e.code==='40001');
 assert.equal((await read()).liveState.activeItemId,db.liveState.activeItemId);
 // Marcação compartilhada sem alterar revisão/cronômetro ou apagar em save.
 await pg.query('select public.set_culto_checklist($1,$2,true)',[c.id,active]);db=await read();assert.deepEqual(db.cultos.find(x=>x.id===c.id).checklistIds,[active]);
 await pg.query('select public.set_culto_checklist($1,$2,true)',[c.id,active]);assert.equal((await pg.query('select count(*)::int as n from public.cerimonial_checklist')).rows[0].n,1);
 await assert.rejects(pg.query('select public.set_culto_checklist($1,$2,true)',[b.id,active]));
 db=await commit(db,{type:'previous',id:c.id});assert.equal(db.liveState.activeItemId,active);
 db=await commit(db,{type:'finish',id:c.id});assert.equal(db.liveState,null);assert.equal(db.cultos.find(x=>x.id===c.id).status,'finished');
 const newId=uid();db=await commit(db,{type:'duplicate',id:c.id,newId});const copy=db.cultos.find(x=>x.id===newId);assert.equal(copy.status,'planned');assert.deepEqual(copy.checklistIds,[]);assert.ok(copy.items.every(i=>!i.realStartedAt&&!i.realFinishedAt&&i.status==='pending'));assert.ok(!copy.lastLiveState);
 const oldItems=new Set(db.cultos.find(x=>x.id===c.id).items.map(i=>i.id));assert.ok(copy.items.every(i=>!oldItems.has(i.id)));
 db=await commit(db,{type:'delete',id:newId});assert.equal((await pg.query('select count(*)::int as n from public.culto_items where culto_id=$1',[newId])).rows[0].n,0);
 const savedRevision=db.revision;
 // FK cruzada: nada da escrita parcial pode sobreviver à falha da transação.
 const broken=prepareSupabaseCulto(db.cultos.find(x=>x.id===b.id));broken.items[0].sectionId=c.sections[0].id;
 await assert.rejects(pg.query('select public.commit_culto_change($1,$2::jsonb,null,null)',[db.revision,broken]));assert.equal((await read()).revision,savedRevision);
 // RLS e grants exercitados com o papel anônimo, inclusive RPCs.
 await pg.exec('set role anon;');assert.equal((await pg.query('select public.read_culto_collection(null) as value')).rows[0].value.cultos.length,2);
 await assert.rejects(pg.query('update public.cultos set title=$1 where id=$2',['Invasão',c.id]));
 await assert.rejects(pg.query('select public.commit_culto_change(0,null,null,$1)',[c.id]));
 await assert.rejects(pg.query('select public.set_culto_checklist($1,$2,true)',[c.id,active]));
 await assert.rejects(pg.query('select * from culto_private.migration_imports'));
 await pg.exec('reset role;');
 // Migração idempotente, IDs legados UUID e músicas com título histórico.
 const legacy={data:'2026-10-31',anciao:'João',cultoItems:[{label:'Louvor',enabled:true,duration:10,hasSongs:true,songs:['Título duplicado']}],ssItems:[{label:'Classes',duration:45}],extra:'preservar'};
 const plan=buildMigration(legacy,[{id:1,nome:'Título duplicado'},{id:2,nome:'Título duplicado'}]);assert.equal(plan.collection.cultos[0].items[0].songs[0].songId,null);
 assert.deepEqual(plan.mapping,buildMigration(legacy).mapping);
 let result=(await pg.query('select public.import_culto_snapshot($1,$2::jsonb,$3::jsonb) as value',[plan.sourceHash,plan.source,plan.collection])).rows[0].value;assert.equal(result.imported,1);
 result=(await pg.query('select public.import_culto_snapshot($1,$2::jsonb,$3::jsonb) as value',[plan.sourceHash,plan.source,plan.collection])).rows[0].value;assert.equal(result.skipped,true);
 assert.deepEqual((await pg.query('select source_snapshot from culto_private.migration_imports')).rows[0].source_snapshot.original,legacy);
 const publications=(await pg.query("select tablename from pg_publication_tables where pubname='supabase_realtime' order by tablename")).rows.map(x=>x.tablename);assert.deepEqual(publications,['cerimonial_checklist','cultos']);
 // Seções futuras não ficam limitadas aos dois tipos atuais.
 const custom=newCulto('2026-11-07');custom.timingMode='independent';custom.sections=[...getSections(custom),{id:uid(),type:'preparacao',label:'Preparação',position:2,startTime:'08:00',enabled:true}];custom.items=[newItem('preparacao')];
 db=await read();db=await commit(db,{type:'save',culto:custom});assert.equal(db.cultos.find(x=>x.id===custom.id).items[0].computedTime,'08:00');db=await commit(db,{type:'delete',id:custom.id});
 const withChecklist=buildMigration(legacy,[],{[normalizeLegacyData(legacy).cultos[0].id]:[normalizeLegacyData(legacy).cultos[0].items[0].id,'orfao']});assert.equal(withChecklist.collection.cultos[0].checklistIds.length,1);assert.equal(withChecklist.warnings.length,1);
 // Contrato Cloudflare → RPC exercitado contra o mesmo PostgreSQL local.
 const env={PERSISTENCE_PROVIDER:'supabase',SUPABASE_URL:'https://test.supabase.co',SUPABASE_SECRET_KEY:'sb_secret_test_only'};
 const rpcNames={read_culto_collection:['p_culto_id'],commit_culto_change:['p_expected_revision','p_culto','p_live_state','p_delete_id'],set_culto_checklist:['p_culto_id','p_item_id','p_completed']};
 globalThis.fetch=async(url,options)=>{
  assert.equal(options.headers.apikey,env.SUPABASE_SECRET_KEY);assert.equal(options.headers.Authorization,undefined);
  const name=new URL(url).pathname.split('/').at(-1),args=JSON.parse(options.body),keys=rpcNames[name];assert.ok(keys,name);
  try {const result=await pg.query(`select public.${name}(${keys.map((_,i)=>'$'+(i+1)).join(',')}) as value`,keys.map(key=>args[key]));return new Response(JSON.stringify(result.rows[0].value));}
  catch(error){return new Response(JSON.stringify({message:error.message,code:error.code}),{status:400});}
 };
 const request=operation=>new Request('https://app.test/api/culto',{method:'PUT',headers:{'Content-Type':'application/json',Origin:'https://app.test'},body:JSON.stringify({...operation,projectUrl:env.SUPABASE_URL})});
 let response=await onRequestGet({env});assert.equal(response.status,200);db=await response.json();
 response=await onRequestPut({env,request:request({provider:'supabase',expectedRevision:db.revision,operation:{type:'start',id:c.id}})});assert.equal(response.status,200);db=await response.json();
 const simultaneous={provider:'supabase',expectedRevision:db.revision,operation:{type:'next',id:c.id}};
 const outcomes=await Promise.all([onRequestPut({env,request:request(simultaneous)}),onRequestPut({env,request:request(simultaneous)})]);
 assert.deepEqual(outcomes.map(r=>r.status).sort(),[200,409]);
 response=await onRequestPut({env,request:request({provider:'jsonbin',operation:{type:'finish',id:c.id},expectedRevision:db.revision})});assert.equal(response.status,409);
 response=await onRequestPut({env,request:request({provider:'supabase',operation:{type:'checklist',id:c.id,itemId:active,completed:false}})});assert.equal(response.status,200);assert.deepEqual((await response.json()).cultos.find(x=>x.id===c.id).checklistIds,[]);
 response=await onRequestPut({env,request:new Request('https://app.test/api/culto',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({provider:'supabase',projectUrl:'https://other.supabase.co',operation:{type:'finish',id:c.id},expectedRevision:db.revision})})});assert.equal(response.status,409);
 response=await onRequestGet({env:{PERSISTENCE_PROVIDER:'supabase'}});assert.equal(response.status,503);
 console.log('OK Cloudflare/Supabase: leitura, secret só no servidor, próximo concorrente 200/409, checklist e configuração ausente.');
 // Caso real, também persistido e relido do schema normalizado.
 db=await read();if(db.liveState)db=await commit(db,{type:'finish',id:db.liveState.cultoId});
 const real=JSON.parse(await readFile(new URL('../fixtures/exemplo-sabado-2026-10-10.json',import.meta.url),'utf8'));
 db=await commit(db,{type:'save',culto:real});let saturday=db.cultos.find(x=>x.id===real.id);
 assert.equal(saturday.timingMode,'continuous');assert.deepEqual(saturday.items.map(i=>i.computedTime),real.items.map(i=>i.referenceTime));assert.equal(saturday.items.at(-1).duration,null);assert.equal(saturday.items[3].mediaTitle,'Provai e Vede');assert.equal(saturday.items[1].songs[0].reference,'564');
 saturday.items.find(i=>i.type==='sermon').duration=45;db=await commit(db,{type:'save',culto:saturday});saturday=db.cultos.find(x=>x.id===real.id);assert.equal(saturday.items.find(i=>i.type==='school').computedTime,'11:10');
 db=await commit(db,{type:'start',id:real.id});for(let n=0;n<10;n++)db=await commit(db,{type:'next',id:real.id});assert.equal(db.liveState.activeItemId,real.items[10].id);
 db=await commit(db,{type:'next',id:real.id});db=await commit(db,{type:'next',id:real.id});assert.equal(db.liveState.activeItemId,real.items[12].id);db=await commit(db,{type:'finish',id:real.id});
 console.log('OK PostgreSQL sábado real: horários entre seções, duração nula, referências musicais, mídia e transição/encerramento ao vivo.');
 const transport=globalThis.fetch;globalThis.fetch=async()=>new Response(JSON.stringify({schemaVersion:2,revision:0,cultos:[],liveState:null}));response=await onRequestGet({env});assert.equal(response.status,503);globalThis.fetch=transport;
 console.log('OK PostgreSQL: migrations, snapshot, CAS, transições, timestamps, FKs/cascades, rollback atômico, checklist, duplicação, RLS/grants, importação idempotente e publicação seletiva.');
} finally {await pg.close();}
