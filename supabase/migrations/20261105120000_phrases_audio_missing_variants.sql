-- Liste en une requête les variantes audio manquantes (phrases/<id>_v0..3.mp3)
-- pour un lot de phrases, en lisant storage.objects. Utilisé par la fonction
-- Edge phrases-audio-backfill à la place de milliers de requêtes HEAD.
create or replace function public.phrases_audio_missing_variants(p_phrase_ids uuid[])
returns table(phrase_id uuid, variant integer)
language sql
security definer
set search_path to 'public', 'storage'
as $function$
  select p.id, v.variant
  from unnest(p_phrase_ids) as p(id)
  cross join generate_series(0, 3) as v(variant)
  left join storage.objects o
    on o.bucket_id = 'phrases-audio'
   and o.name = 'phrases/' || p.id::text || '_v' || v.variant || '.mp3'
  where o.id is null
  order by p.id, v.variant;
$function$;

revoke all on function public.phrases_audio_missing_variants(uuid[]) from public, anon, authenticated;
grant execute on function public.phrases_audio_missing_variants(uuid[]) to service_role;
