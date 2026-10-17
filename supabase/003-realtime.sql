-- Só dois sinais: cultos sinaliza cada transação completa (inclusive filhos/live);
-- checklist sinaliza marcações. Evita seis subscriptions por tela.
begin;
do $$ declare t text; begin
  if not exists (select 1 from pg_publication where pubname='supabase_realtime') then
    create publication supabase_realtime;
  end if;
  foreach t in array array['cultos','cerimonial_checklist'] loop
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
      execute format('alter publication supabase_realtime add table public.%I',t);
    end if;
  end loop;
end $$;
commit;
