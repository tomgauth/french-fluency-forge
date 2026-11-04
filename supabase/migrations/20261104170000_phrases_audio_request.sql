-- Déclenche la génération des audios manquants d'un pack (fonction Edge
-- phrases-audio-backfill) depuis SQL, via pg_net et le secret Vault de la
-- synchro Coda. Utilisé par le job flashcards quotidien. L'appel est
-- synchrone côté fonction (jusqu'à ~100 s) ; la fonction ré-enfile elle-même
-- une continuation via ce RPC tant qu'il reste des audios à produire.
drop function if exists public.phrases_audio_request(text, text, text);
create or replace function public.phrases_audio_request(
  p_member_email text,
  p_pack text default null,
  p_source text default 'manual',
  p_chain integer default 0
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
    body    := jsonb_build_object('member_email', p_member_email, 'pack', p_pack, 'source', p_source, 'chain', p_chain, 'max_seconds', 100),
    timeout_milliseconds := 150000
  ) into v_req;
  return v_req;
exception when others then
  raise notice 'phrases_audio_request failed: %', sqlerrm;
  return null;
end;
$function$;

revoke all on function public.phrases_audio_request(text, text, text, integer) from public, anon, authenticated;
