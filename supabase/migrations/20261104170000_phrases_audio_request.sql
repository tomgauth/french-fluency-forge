-- Déclenche la génération des audios manquants d'un pack (fonction Edge
-- phrases-audio-backfill) depuis SQL, via pg_net et le secret Vault de la
-- synchro Coda. Utilisé par le job flashcards quotidien. L'appel est
-- synchrone côté fonction (jusqu'à ~100 s) ; la fonction ré-enfile elle-même
-- une continuation via ce RPC tant qu'il reste des audios à produire
-- (p_chain = numéro de continuation, 12 max côté fonction).

-- Version complète (4 arguments, sans valeurs par défaut).
create or replace function public.phrases_audio_request(
  p_member_email text,
  p_pack text,
  p_source text,
  p_chain integer
) returns bigint
language plpgsql
security definer
set search_path to 'public', 'extensions', 'vault'
as $function$
declare
  v_secret text;
  v_req    bigint;
begin
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'coda_sync_secret' limit 1;
  if v_secret is null then
    raise notice 'phrases_audio_request: secret Vault coda_sync_secret manquant';
    return null;
  end if;
  select net.http_post(
    url     := 'https://affygdjsoukipdeuynwe.supabase.co/functions/v1/phrases-audio-backfill',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-sync-secret', v_secret),
    body    := jsonb_build_object('member_email', p_member_email, 'pack', p_pack, 'source', coalesce(p_source, 'manual'), 'chain', coalesce(p_chain, 0), 'max_seconds', 100),
    timeout_milliseconds := 150000
  ) into v_req;
  return v_req;
exception when others then
  raise notice 'phrases_audio_request failed: %', sqlerrm;
  return null;
end;
$function$;

-- Version courte (3 arguments, avec défauts) : délègue à la version complète.
-- Usage : select phrases_audio_request('eleve@example.com', 'pack:2026-11-03 THÈME - RECALL');
create or replace function public.phrases_audio_request(
  p_member_email text,
  p_pack text default null,
  p_source text default 'manual'
) returns bigint
language sql
security definer
set search_path to 'public'
as $function$
  select public.phrases_audio_request(p_member_email, p_pack, p_source, 0);
$function$;

revoke all on function public.phrases_audio_request(text, text, text, integer) from public, anon, authenticated;
revoke all on function public.phrases_audio_request(text, text, text) from public, anon, authenticated;
