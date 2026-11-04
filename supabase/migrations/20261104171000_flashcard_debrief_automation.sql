-- Automatisation des packs de flashcards à partir des debriefs Slack de Lilian.
-- 1. slack_student_channels : canal Slack élève -> compte de l'appli
-- 2. flashcard_debrief_runs : journal des debriefs traités (idempotence + suivi)
-- 3. phrases_import_pack / phrases_import_run : import d'un pack en une requête
-- 4. phrases_find_duplicates : doublons exacts (normalisés) chez un élève
-- (Appliquée en production le 2026-11-04 via le MCP Supabase ; les lignes de
-- seed des canaux et des runs manuels ne sont pas reproduites ici.)

create table if not exists public.slack_student_channels (
  slack_channel_id text primary key,
  channel_name     text not null,
  student_email    text,
  first_name       text,
  gender           text check (gender in ('f', 'm')),
  short_phrases    boolean not null default false,
  notes            text,
  updated_at       timestamptz not null default now()
);
alter table public.slack_student_channels enable row level security;

create table if not exists public.flashcard_debrief_runs (
  id                 uuid primary key default gen_random_uuid(),
  slack_channel_id   text not null,
  slack_message_ts   text not null,
  slack_permalink    text,
  debrief_posted_at  timestamptz,
  student_email      text,
  member_id          uuid,
  student_first_name text,
  pack_name          text,
  recall_count       integer not null default 0,
  recognition_count  integer not null default 0,
  status             text not null check (status in ('created', 'held_backlog', 'awaiting_validation', 'skipped', 'error')),
  created_by         text not null default 'job' check (created_by in ('job', 'manual')),
  due_cards_at_run   integer,
  cards              jsonb,
  fathom_urls        text[],
  slack_reply_ts     text,
  error              text,
  notes              text,
  created_at         timestamptz not null default now(),
  unique (slack_channel_id, slack_message_ts)
);
alter table public.flashcard_debrief_runs enable row level security;

create or replace function public.phrases_find_duplicates(p_member_email text, p_french text[])
returns table (candidate text, existing text)
language sql stable security definer set search_path = public
as $$
  with norm as (
    select regexp_replace(lower(trim(x)), '[^a-z0-9àâäéèêëîïôöùûüçœæ'' ]+', ' ', 'g') as n, x
    from unnest(p_french) as x
  )
  select norm.x, coalesce(ph.canonical_fr, ph.transcript_fr)
  from norm
  join member_phrase_cards c on c.member_id = (select id from profiles where lower(email) = lower(p_member_email) limit 1)
  join phrases ph on ph.id = c.phrase_id
  where regexp_replace(lower(trim(coalesce(ph.canonical_fr, ph.transcript_fr))), '[^a-z0-9àâäéèêëîïôöùûüçœæ'' ]+', ' ', 'g') = norm.n;
$$;

create or replace function public.phrases_import_pack(
  p_member_email text,
  p_pack_name    text,
  p_recall       jsonb default '[]'::jsonb,
  p_recognition  jsonb default '[]'::jsonb,
  p_status       text  default 'active',
  p_admin_email  text  default 'tom@solvlanguages.com'
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_member  uuid;
  v_admin   uuid;
  v_result  jsonb := '{}'::jsonb;
  v_deck    record;
  v_card    record;
  v_key     text;
  v_prefix  text;
  v_tag     text;
  v_content text;
  v_count   integer;
  v_pid     uuid;
  v_cid     uuid;
  v_fr      text;
  v_en      text;
begin
  if p_status not in ('active', 'suspended') then
    raise exception 'p_status doit être active ou suspended';
  end if;
  select id into v_member from profiles where lower(email) = lower(p_member_email) limit 1;
  if v_member is null then
    raise exception 'élève introuvable : %', p_member_email;
  end if;
  select id into v_admin from profiles where lower(email) = lower(p_admin_email) limit 1;

  for v_deck in
    select * from (values ('RECALL', 'recall', p_recall), ('RECOGNIZE', 'recognition', p_recognition)) as d(deck, mode, cards)
  loop
    if v_deck.cards is null or jsonb_typeof(v_deck.cards) <> 'array' or jsonb_array_length(v_deck.cards) = 0 then
      continue;
    end if;
    v_tag := 'pack:' || p_pack_name || ' - ' || v_deck.deck;
    select string_agg((c->>'fr') || E'\t' || (c->>'en'), E'\n' order by ord)
      into v_content
      from jsonb_array_elements(v_deck.cards) with ordinality as x(c, ord);
    v_key := encode(sha256(convert_to(v_member::text || '|' || v_tag || '|' || v_content, 'UTF8')), 'hex');
    if exists (select 1 from member_phrase_imports where member_id = v_member and import_key = v_key) then
      v_result := v_result || jsonb_build_object(v_deck.mode, 'already_imported');
      continue;
    end if;
    v_prefix := substr(v_key, 1, 8) || '-' || substr(v_key, 9, 4) || '-5' || substr(v_key, 14, 3) || '-8' || substr(v_key, 18, 3);
    v_count := 0;

    for v_card in
      select c, ord from jsonb_array_elements(v_deck.cards) with ordinality as x(c, ord)
    loop
      v_fr := trim(v_card.c->>'fr');
      v_en := trim(v_card.c->>'en');
      if v_fr is null or v_fr = '' or v_en is null or v_en = '' then
        continue;
      end if;
      v_pid := (v_prefix || '-0001' || lpad(to_hex(v_card.ord::int), 8, '0'))::uuid;
      v_cid := (v_prefix || '-0002' || lpad(to_hex(v_card.ord::int), 8, '0'))::uuid;

      insert into phrases (id, mode, prompt_en, canonical_fr, answers_fr, transcript_fr, translation_en, tags, difficulty, created_by_admin_id, acting_as_user_id)
      values (
        v_pid, v_deck.mode::phrase_mode,
        case when v_deck.mode = 'recall' then v_en end,
        v_fr,
        case when v_deck.mode = 'recall' then array[v_fr] end,
        case when v_deck.mode = 'recognition' then v_fr end,
        case when v_deck.mode = 'recognition' then v_en end,
        array['imported', v_tag], 3, v_admin, v_member
      );
      insert into member_phrase_cards (id, member_id, phrase_id, created_by_admin_id, acting_as_user_id, status, priority, scheduler_algorithm, scheduler_state, due_at, repetitions, interval_days, ease_factor, scheduler_state_jsonb, assist_level, consecutive_again, again_count_24h, again_count_7d, lapses, reviews, tags, paused_reason, paused_at)
      values (
        v_cid, v_member, v_pid, v_admin, v_member, p_status::phrase_status, 0, 'fsrs', 'new', now(), 0, 0, 2.5, '{}'::jsonb, 0, 0, 0, 0, 0, 0, '{}'::text[],
        case when p_status = 'suspended' then 'coach_hold_backlog' end,
        case when p_status = 'suspended' then now() end
      );
      v_count := v_count + 1;
    end loop;

    insert into member_phrase_imports (member_id, import_key, phrase_count, card_count)
    values (v_member, v_key, v_count, v_count);
    v_result := v_result || jsonb_build_object(v_deck.mode, v_count, v_deck.mode || '_tag', v_tag);
  end loop;

  return v_result || jsonb_build_object('member_id', v_member, 'pack', p_pack_name, 'status', p_status);
end;
$$;

create or replace function public.phrases_import_run(p_run_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_run    flashcard_debrief_runs%rowtype;
  v_result jsonb;
begin
  select * into v_run from flashcard_debrief_runs where id = p_run_id;
  if v_run.id is null then raise exception 'run introuvable'; end if;
  if v_run.status not in ('awaiting_validation', 'held_backlog') then
    raise exception 'run déjà traité (statut %)', v_run.status;
  end if;
  v_result := phrases_import_pack(v_run.student_email, v_run.pack_name, v_run.cards->'recall', v_run.cards->'recognition', 'active');
  update flashcard_debrief_runs
     set status = 'created',
         recall_count = coalesce((v_result->>'recall')::int, 0),
         recognition_count = coalesce((v_result->>'recognition')::int, 0),
         member_id = (v_result->>'member_id')::uuid,
         notes = coalesce(notes || ' | ', '') || 'importé le ' || to_char(now(), 'YYYY-MM-DD HH24:MI')
   where id = p_run_id;
  return v_result;
end;
$$;

revoke all on function public.phrases_import_pack(text, text, jsonb, jsonb, text, text) from public, anon, authenticated;
revoke all on function public.phrases_import_run(uuid) from public, anon, authenticated;
revoke all on function public.phrases_find_duplicates(text, text[]) from public, anon, authenticated;
