-- Evolução do modelo a partir da liturgia real de 10/10/2026.
-- Valores antigos preservam horários independentes. Novos cultos usam continuous.
begin;
alter table public.cultos add column timing_mode text not null default 'independent' check (timing_mode in ('continuous','independent'));
alter table public.culto_items alter column duration_minutes drop not null;
alter table public.culto_items add column media_type text not null default 'none' check (media_type in ('none','video','audio','image','other'));
alter table public.culto_items add column media_title text not null default '';
alter table public.culto_item_songs add column song_reference text not null default '';
create or replace function public.read_culto_collection(p_culto_id uuid default null) returns jsonb
language sql stable security invoker set search_path = '' as $$
select jsonb_build_object(
 'schemaVersion',2,'databaseVersion',5,'revision',(select revision from public.culto_app_state where singleton),
 'cultos',coalesce((select jsonb_agg(jsonb_build_object(
  'id',c.id,'legacyId',c.legacy_id,'date',c.date,'title',c.title,'status',c.status,
  'startTime',to_char(c.start_time,'HH24:MI'),'sabbathStartTime',to_char(c.sabbath_start_time,'HH24:MI'),
  'elder',c.elder,'ceremonyLead',c.ceremony_lead,'soundTeam',c.sound_team,'notes',c.notes,
  'createdAt',c.created_at,'updatedAt',c.updated_at,'realStartedAt',c.real_started_at,'finishedAt',c.finished_at,
  'lastLiveState',c.last_live_state,'timingMode',c.timing_mode,
  'sections',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'type',s.type,'label',s.label,'position',s.position,'enabled',s.enabled,'startTime',to_char(s.start_time,'HH24:MI')) order by s.position) from public.culto_sections s where s.culto_id=c.id),'[]'::jsonb),
  'items',coalesce((select jsonb_agg(jsonb_build_object(
    'id',i.id,'sectionId',i.section_id,'section',s.type,'order',i.position,'type',i.type,'label',i.label,
    'responsible',i.responsible,'duration',i.duration_minutes,'enabled',i.enabled,'hasSongs',i.has_songs,
    'note',i.note,'mediaType',i.media_type,'mediaTitle',i.media_title,'status',i.status,'realStartedAt',i.real_started_at,'realFinishedAt',i.real_finished_at,
    'songs',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'songId',m.song_id,'title',m.song_title,'reference',m.song_reference) order by m.position) from public.culto_item_songs m where m.culto_item_id=i.id),'[]'::jsonb)
  ) order by i.position) from public.culto_items i join public.culto_sections s on s.id=i.section_id where i.culto_id=c.id),'[]'::jsonb),
  'checklistIds',coalesce((select jsonb_agg(k.item_id) from public.cerimonial_checklist k join public.culto_items i on i.id=k.item_id join public.culto_sections s on s.id=i.section_id where k.culto_id=c.id and k.completed and i.enabled and s.enabled),'[]'::jsonb)
 ) order by c.date desc,c.id) from public.cultos c where p_culto_id is null or c.id=p_culto_id),'[]'::jsonb),
 'liveState',(select jsonb_build_object('cultoId',l.culto_id,'activeItemId',l.active_item_id,'startedAt',l.started_at,'activeStartedAt',l.active_item_started_at,'updatedAt',l.updated_at,
 'completedItemIds',coalesce((select jsonb_agg(i.id) from public.culto_items i where i.culto_id=l.culto_id and i.status='completed'),'[]'::jsonb))
 from public.culto_live_state l join public.cultos c on c.id=l.culto_id where c.status='live' and (p_culto_id is null or l.culto_id=p_culto_id))
);
$$;

create or replace function public.commit_culto_change(p_expected_revision bigint, p_culto jsonb, p_live_state jsonb default null, p_delete_id uuid default null) returns bigint
language plpgsql security definer set search_path = '' as $$
declare v_revision bigint; v_id uuid; s jsonb; i jsonb; m jsonb; v_owner uuid; v_index integer;
begin
 select revision into v_revision from public.culto_app_state where singleton for update;
 if v_revision <> p_expected_revision then raise exception 'Os dados mudaram em outra tela. Recarregue antes de salvar.' using errcode='40001'; end if;
 if p_delete_id is not null then
   if p_culto is not null then raise exception 'Operação ambígua'; end if;
   if exists(select 1 from public.cultos where id=p_delete_id and status='live') then raise exception 'Finalize o culto antes de excluir'; end if;
   delete from public.cultos where id=p_delete_id;
   if not found then raise exception 'Culto não encontrado'; end if;
 else
   v_id := (p_culto->>'id')::uuid;
   if v_id is null then raise exception 'Culto ausente'; end if;
   insert into public.cultos(id,legacy_id,date,title,start_time,sabbath_start_time,elder,ceremony_lead,sound_team,notes,status,real_started_at,finished_at,created_at,last_live_state,timing_mode)
   values(v_id,p_culto->>'legacyId',(p_culto->>'date')::date,p_culto->>'title',(p_culto->>'startTime')::time,(p_culto->>'sabbathStartTime')::time,
    p_culto->>'elder',p_culto->>'ceremonyLead',p_culto->'soundTeam',p_culto->>'notes',p_culto->>'status',(p_culto->>'realStartedAt')::timestamptz,(p_culto->>'finishedAt')::timestamptz,
    coalesce((p_culto->>'createdAt')::timestamptz,now()),nullif(p_culto->'lastLiveState','null'::jsonb),coalesce(p_culto->>'timingMode','independent'))
   on conflict(id) do update set date=excluded.date,title=excluded.title,start_time=excluded.start_time,sabbath_start_time=excluded.sabbath_start_time,
    elder=excluded.elder,ceremony_lead=excluded.ceremony_lead,sound_team=excluded.sound_team,notes=excluded.notes,status=excluded.status,
    real_started_at=excluded.real_started_at,finished_at=excluded.finished_at,last_live_state=excluded.last_live_state,timing_mode=excluded.timing_mode;
   for s in select value from jsonb_array_elements(p_culto->'sections') loop
     insert into public.culto_sections(id,culto_id,type,label,position,start_time,enabled)
     values((s->>'id')::uuid,v_id,s->>'type',s->>'label',(s->>'position')::integer,(s->>'startTime')::time,(s->>'enabled')::boolean)
     on conflict(id) do update set type=excluded.type,label=excluded.label,position=excluded.position,start_time=excluded.start_time,enabled=excluded.enabled where public.culto_sections.culto_id=v_id;
     if not found then raise exception 'Seção pertence a outro culto'; end if;
   end loop;
   -- Libera o índice de ativo antes de ativar o próximo, dentro da transação.
   update public.culto_items set status='pending' where culto_id=v_id and status='active';
   delete from public.culto_live_state where culto_id=v_id;
   for i in select value from jsonb_array_elements(p_culto->'items') loop
     insert into public.culto_items(id,culto_id,section_id,position,type,label,responsible,duration_minutes,enabled,has_songs,note,status,real_started_at,real_finished_at,media_type,media_title)
     values((i->>'id')::uuid,v_id,(i->>'sectionId')::uuid,(i->>'order')::integer,i->>'type',i->>'label',i->>'responsible',(i->>'duration')::integer,
      (i->>'enabled')::boolean,(i->>'hasSongs')::boolean,i->>'note',coalesce(i->>'status','pending'),(i->>'realStartedAt')::timestamptz,(i->>'realFinishedAt')::timestamptz,coalesce(i->>'mediaType','none'),coalesce(i->>'mediaTitle',''))
     on conflict(id) do update set section_id=excluded.section_id,position=excluded.position,type=excluded.type,label=excluded.label,responsible=excluded.responsible,
      duration_minutes=excluded.duration_minutes,enabled=excluded.enabled,has_songs=excluded.has_songs,note=excluded.note,status=excluded.status,
      real_started_at=excluded.real_started_at,real_finished_at=excluded.real_finished_at,media_type=excluded.media_type,media_title=excluded.media_title where public.culto_items.culto_id=v_id;
     if not found then raise exception 'Momento pertence a outro culto'; end if;
     delete from public.culto_item_songs where culto_item_id=(i->>'id')::uuid;
     v_index:=0;
     for m in select value from jsonb_array_elements(i->'songs') loop
       insert into public.culto_item_songs(id,culto_item_id,song_id,song_title,position,song_reference)
       values((m->>'id')::uuid,(i->>'id')::uuid,m->>'songId',m->>'title',v_index,coalesce(m->>'reference',''));
       v_index:=v_index+1;
     end loop;
   end loop;
   delete from public.culto_items where culto_id=v_id and id not in (select (value->>'id')::uuid from jsonb_array_elements(p_culto->'items'));
   delete from public.culto_sections where culto_id=v_id and id not in (select (value->>'id')::uuid from jsonb_array_elements(p_culto->'sections'));
   if p_culto->>'status'='live' then
     if p_live_state is null or (p_live_state->>'cultoId')::uuid<>v_id then raise exception 'Estado ao vivo ausente'; end if;
     if not exists(select 1 from public.culto_items i join public.culto_sections s on s.id=i.section_id where i.culto_id=v_id and i.id=(p_live_state->>'activeItemId')::uuid and i.enabled and s.enabled and i.status='active') then raise exception 'Momento ativo inválido'; end if;
     insert into public.culto_live_state(culto_id,active_item_id,started_at,active_item_started_at)
     values(v_id,(p_live_state->>'activeItemId')::uuid,(p_live_state->>'startedAt')::timestamptz,(p_live_state->>'activeStartedAt')::timestamptz);
   elsif exists(select 1 from public.culto_items where culto_id=v_id and status='active') then raise exception 'Momento ativo sem culto ao vivo';
   end if;
 end if;
 update public.culto_app_state set revision=revision+1 where singleton returning revision into v_revision;
 return v_revision;
end $$;

commit;
