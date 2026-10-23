-- ============================================================
-- Coda flashcards sync : déclenchement (trigger sur les uploads + cron)
-- ============================================================
-- Dépend de 20261022090000_coda_flashcards_export.sql.
-- Rien ici ne touche aux tables de l'application. Le seul objet posé sur une
-- table existante est un trigger AFTER INSERT ... FOR EACH STATEMENT sur
-- member_phrase_imports (journal des uploads, pas la table chaude des cartes),
-- dont toute erreur est avalée : un upload ne peut jamais échouer à cause de Coda.
-- ============================================================

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

-- ------------------------------------------------------------
-- 5. Secret partagé (stocké dans Vault, jamais exposé)
-- ------------------------------------------------------------
-- La fonction Edge vérifie le secret reçu en appelant ceci (service role).
create or replace function public.coda_sync_secret_matches(p_secret text)
returns boolean
language sql
stable
security definer
set search_path = public, vault
as $$
  select exists (
    select 1 from vault.decrypted_secrets
    where name = 'coda_sync_secret'
      and decrypted_secret = p_secret
      and length(p_secret) >= 16
  );
$$;

revoke all on function public.coda_sync_secret_matches(text) from public, anon, authenticated;
grant execute on function public.coda_sync_secret_matches(text) to service_role;

-- Jeton API Coda : stocké dans Vault (vault.create_secret('<jeton>', 'coda_api_token'))
-- et lu par la fonction Edge via ce RPC réservé au service role. Alternative :
-- le secret CODA_API_TOKEN de la fonction Edge, qui a priorité s'il existe.
create or replace function public.coda_sync_coda_token()
returns text
language sql
stable
security definer
set search_path = public, vault
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'coda_api_token' limit 1;
$$;

revoke all on function public.coda_sync_coda_token() from public, anon, authenticated;
grant execute on function public.coda_sync_coda_token() to service_role;

-- ------------------------------------------------------------
-- 6. Déclenchement HTTP (pg_net, asynchrone, jamais bloquant)
-- ------------------------------------------------------------
-- Lit l'URL de la fonction Edge et le secret dans Vault :
--   vault.create_secret('https://<ref>.supabase.co/functions/v1/coda-flashcards-sync', 'coda_sync_url');
--   vault.create_secret('<secret aléatoire>', 'coda_sync_secret');
create or replace function public.coda_sync_request(p_source text default 'manual')
returns bigint
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  v_url    text;
  v_secret text;
  v_req    bigint;
begin
  select decrypted_secret into v_url    from vault.decrypted_secrets where name = 'coda_sync_url'    limit 1;
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'coda_sync_secret' limit 1;
  if v_url is null or v_secret is null then
    raise notice 'coda_sync_request: vault secrets coda_sync_url / coda_sync_secret manquants';
    return null;
  end if;

  select net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'x-sync-secret', v_secret
    ),
    body    := jsonb_build_object('source', p_source),
    timeout_milliseconds := 5000
  ) into v_req;
  return v_req;
exception when others then
  -- Ne jamais faire échouer l'appelant (trigger ou cron) à cause de Coda.
  raise notice 'coda_sync_request failed: %', sqlerrm;
  return null;
end;
$$;

revoke all on function public.coda_sync_request(text) from public, anon, authenticated;

-- Trigger : un upload de flashcards (= une ligne dans member_phrase_imports)
-- déclenche une synchro. Statement-level : un seul appel par import.
create or replace function public.coda_sync_on_import()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    perform public.coda_sync_request('import');
  exception when others then
    raise notice 'coda_sync_on_import ignored: %', sqlerrm;
  end;
  return null;
end;
$$;

drop trigger if exists coda_sync_after_import on public.member_phrase_imports;
create trigger coda_sync_after_import
  after insert on public.member_phrase_imports
  for each statement
  execute function public.coda_sync_on_import();

-- ------------------------------------------------------------
-- 7. Cron quotidien (03:10 UTC = 05:10 Paris en été, 04:10 en hiver)
-- ------------------------------------------------------------
do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'coda-flashcards-sync-daily';
exception when others then null;
end $$;

select cron.schedule(
  'coda-flashcards-sync-daily',
  '10 3 * * *',
  $$ select public.coda_sync_request('cron'); $$
);
