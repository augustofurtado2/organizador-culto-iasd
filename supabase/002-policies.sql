-- Temporário: leitura pública; nenhuma escrita direta de anon/authenticated.
-- A Function é pública, mas somente ela possui a secret key e chama as RPCs de escrita.
begin;
do $$ declare t text; begin
  foreach t in array array['culto_app_state','cultos','culto_sections','culto_items','culto_item_songs','culto_live_state','cerimonial_checklist'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public, anon, authenticated',t);
    execute format('grant select on public.%I to anon, authenticated',t);
    execute format('grant all on public.%I to service_role',t);
    execute format('create policy temporary_public_read on public.%I for select to anon, authenticated using (true)',t);
  end loop;
end $$;
alter table culto_private.migration_imports enable row level security;
revoke all on culto_private.migration_imports from public, anon, authenticated;
grant usage on schema public to anon, authenticated, service_role;
revoke execute on function public.culto_set_updated_at() from public, anon, authenticated;
commit;
