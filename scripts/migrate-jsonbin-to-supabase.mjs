#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { normalizeLegacyData, clone, getSections, songTitle } from '../shared/culto.js';
import { prepareSupabaseCulto, isUUID, sectionUUID } from '../shared/supabase-model.js';
import { supabaseRPC } from '../server/supabase.js';
const digest=value=>createHash('sha256').update(value).digest('hex');
function canonical(value){if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));return value;}
function stableUUID(value){const h=digest('iasd-migration-v1:'+value);return `${h.slice(0,8)}-${h.slice(8,12)}-8${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;}
export function buildMigration(source,catalog=[],checklists={}) {
  const raw=source?.record && typeof source.record==='object' ? source.record : source;
  const db=normalizeLegacyData(raw),sourceHash=digest(JSON.stringify(canonical(Object.keys(checklists).length?{source,checklists}:source))),mapping=[],warnings=[];
  const titleMatches=new Map(),idCounts=new Map();
  for(const song of catalog){titleMatches.set(song.nome,[...(titleMatches.get(song.nome)||[]),song]);idCounts.set(String(song.id),(idCounts.get(String(song.id))||0)+1);}
  const cultos=db.cultos.map(old=>{
    const c=clone(old),oldId=c.id;
    if(!isUUID(c.id)){c.id=stableUUID('culto:'+oldId);c.legacyId=oldId;}
    mapping.push({kind:'culto',legacyId:oldId,id:c.id});
    const itemMap=new Map(c.items.map(i=>[i.id,isUUID(i.id)?i.id:stableUUID(`item:${oldId}:${i.id}`)]));
    c.sections=getSections(c).map(s=>({...s,id:isUUID(s.id)?s.id:sectionUUID(c.id,s.type)}));
    const originalState=db.liveState?.cultoId===oldId?db.liveState:c.lastLiveState;
    c.items.forEach(i=>{
      const oldItemId=i.id;i.id=itemMap.get(oldItemId);i.sectionId=c.sections.find(s=>s.type===i.section).id;
      mapping.push({kind:'item',cultoLegacyId:oldId,legacyId:oldItemId,id:i.id});
      if(!i.status)i.status=originalState?.activeItemId===oldItemId&&c.status==='live'?'active':originalState?.completedItemIds?.includes(oldItemId)?'completed':'pending';
      if(originalState?.activeItemId===oldItemId){i.realStartedAt??=originalState.activeStartedAt;if(c.status==='finished')i.realFinishedAt??=c.finishedAt;}
      i.songs=i.songs.filter(song=>songTitle(song).trim()).map((song,index)=>{
        const title=songTitle(song),matches=titleMatches.get(title)||[];
        const songId=typeof song==='object'&&song.songId!=null?String(song.songId):matches.length===1&&idCounts.get(String(matches[0].id))===1?String(matches[0].id):null;
        return {id:typeof song==='object'&&isUUID(song.id)?song.id:stableUUID(`song:${c.id}:${i.id}:${index}:${title}`),songId,title,reference:typeof song==='object'?song.reference||'':''};
      });
    });
    const remapState=state=>state?{...state,cultoId:c.id,activeItemId:itemMap.get(state.activeItemId)||state.activeItemId,completedItemIds:(state.completedItemIds||[]).map(id=>itemMap.get(id)).filter(Boolean)}:null;
    if(c.lastLiveState)c.lastLiveState=remapState(c.lastLiveState);
    if(db.liveState?.cultoId===oldId)db.liveState=remapState(db.liveState);
    const requested=[...(c.checklistIds||[]),...(Array.isArray(checklists[oldId])?checklists[oldId]:[])];
    c.checklistIds=[...new Set(requested.map(id=>itemMap.get(id)).filter(id=>c.items.some(i=>i.id===id&&i.enabled&&getSections(c).find(s=>s.type===i.section)?.enabled)))];
    if(c.checklistIds.length<new Set(requested).size)warnings.push('Checklist com IDs ausentes/desabilitados ignorados em '+oldId);
    c.realStartedAt??=originalState?.startedAt||null;
    return prepareSupabaseCulto(c);
  });
  return {sourceHash,source:{original:source,checklists,mapping},collection:{schemaVersion:2,revision:0,cultos,liveState:db.liveState},mapping,warnings};
}
async function main(){
  const args=process.argv.slice(2),arg=name=>{const i=args.indexOf(name);return i<0?null:args[i+1];};
  const sourcePath=arg('--source');if(!sourcePath)throw new Error('Uso: node scripts/migrate-jsonbin-to-supabase.mjs --source export.json [--out plano.json] [--checklists checklists.json] [--apply]');
  const catalog=JSON.parse(await readFile(new URL('../data/musicas.json',import.meta.url),'utf8'));
  const checklists=arg('--checklists')?JSON.parse(await readFile(arg('--checklists'),'utf8')):{};
  const plan=buildMigration(JSON.parse(await readFile(sourcePath,'utf8')),catalog,checklists);
  if(arg('--out'))await writeFile(arg('--out'),JSON.stringify(plan,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({mode:args.includes('--apply')?'APPLY':'DRY RUN',sourceHash:plan.sourceHash,cultos:plan.collection.cultos.length,momentos:plan.collection.cultos.reduce((n,c)=>n+c.items.length,0),mapeamentos:plan.mapping.length,warnings:plan.warnings},null,2));
  if(args.includes('--apply')){
    if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SECRET_KEY)throw new Error('CONFIGURAÇÃO MANUAL NECESSÁRIA: SUPABASE_URL e SUPABASE_SECRET_KEY no ambiente do processo.');
    const current=await supabaseRPC(process.env,'read_culto_collection',{p_culto_id:null});
    if(current?.databaseVersion!==5)throw new Error('CONFIGURAÇÃO MANUAL NECESSÁRIA: aplique supabase/005-real-program.sql antes de importar.');
    const result=await supabaseRPC(process.env,'import_culto_snapshot',{p_source_hash:plan.sourceHash,p_source:plan.source,p_collection:plan.collection});
    console.log(JSON.stringify(result,null,2));
  } else console.log('Nenhuma gravação executada. Revise o plano e os mapas de IDs antes de usar --apply.');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(error=>{console.error(error.message);process.exitCode=1;});
