-- ============================================================
-- Coda flashcards sync (LECTURE SEULE côté application)
-- ============================================================
-- Objectif : exposer les flashcards de chaque étudiant et leurs statistiques
-- à un doc Coda, sans jamais toucher aux tables de l'application.
--
-- Ce que cette migration crée (tout est nouveau, préfixé coda_) :
--   * 2 tables d'état privées : coda_sync_runs (journal des synchros),
--     coda_sync_cards (empreinte de la dernière version envoyée par carte).
--   * 2 vues de lecture : coda_export_cards_base, coda_export_students.
--   * 2 fonctions SQL de lecture : coda_export_cards_dirty, coda_export_cards_deleted.
-- Le déclenchement (trigger sur les imports + cron) est dans la migration
-- suivante : 20261022090001_coda_flashcards_schedule.sql.
--
-- Ce qu'elle ne fait PAS : aucune modification de phrases, member_phrase_cards,
-- phrase_review_logs, profiles ni de leurs policies.
--
-- Rollback complet : voir docs/CODA_FLASHCARDS_SYNC.md (section "Désinstaller").
-- ============================================================

-- ------------------------------------------------------------
-- 1. Tables d'état (privées : aucun accès anon / authenticated)
-- ------------------------------------------------------------
create table if not exists public.coda_sync_runs (
  id              uuid primary key default gen_random_uuid(),
  started_at      timestamptz not null default now(),
  finished_at     timestamptz,
  status          text not null default 'running'
                  check (status in ('running', 'success', 'error', 'skipped')),
  source          text not null default 'manual',      -- cron | import | manual | continuation
  mode            text not null default 'incremental', -- incremental | full | dry_run
  cards_scanned   integer not null default 0,
  cards_pushed    integer not null default 0,
  cards_deleted   integer not null default 0,
  students_pushed integer not null default 0,
  error           text,
  details         jsonb not null default '{}'::jsonb
);

create table if not exists public.coda_sync_cards (
  card_id      uuid primary key,
  content_hash text not null,
  synced_at    timestamptz not null default now()
);

create index if not exists idx_coda_sync_runs_started_at on public.coda_sync_runs (started_at desc);

alter table public.coda_sync_runs  enable row level security;
alter table public.coda_sync_cards enable row level security;
-- Pas de policy : seul le service role (qui ignore la RLS) lit/écrit ces tables.
revoke all on public.coda_sync_runs  from anon, authenticated;
revoke all on public.coda_sync_cards from anon, authenticated;
-- Le service role n'hérite pas forcément des privilèges par défaut selon le
-- rôle qui applique la migration : on les donne explicitement.
grant select, insert, update, delete on public.coda_sync_runs  to service_role;
grant select, insert, update, delete on public.coda_sync_cards to service_role;

-- ------------------------------------------------------------
-- 2. Vue de base : une ligne par carte, avec la catégorie pédagogique
-- ------------------------------------------------------------
-- security_invoker : la vue applique la RLS des tables sous-jacentes pour tout
-- rôle autre que service_role (un étudiant ne verrait que ses propres cartes).
create or replace view public.coda_export_cards_base
with (security_invoker = true) as
select
  c.id                              as card_id,
  c.member_id,
  pr.email                          as member_email,
  pr.role                           as member_role,
  p.mode::text                      as mode,
  coalesce(nullif(p.canonical_fr, ''), nullif(p.transcript_fr, ''), '')  as french,
  coalesce(nullif(p.prompt_en, ''),    nullif(p.translation_en, ''), '') as english,
  c.status::text                    as status,
  c.scheduler_state::text           as scheduler_state,
  c.reviews,
  c.lapses,
  c.again_count_7d,
  c.assist_level,
  c.stability,
  c.difficulty                      as fsrs_difficulty,
  c.interval_ms,
  c.due_at,
  c.last_reviewed_at,
  c.created_at,
  c.updated_at,
  p.tags                            as phrase_tags,
  (select substr(t, 6) from unnest(p.tags) t where t like 'pack:%' limit 1) as pack,
  -- Catégorie affichée dans Coda (seuils documentés dans docs/CODA_FLASHCARDS_SYNC.md)
  case
    when c.status <> 'active'                 then 'Suspendue'
    when c.scheduler_state = 'new'            then 'Nouvelle'
    when c.scheduler_state = 'relearning'
      or c.lapses >= 2
      or c.again_count_7d >= 2
      or c.assist_level >= 2
      or c.difficulty >= 8                    then 'Difficile'
    when c.scheduler_state = 'review'
      and c.stability >= 21                   then 'Connue'
    else                                           'En cours'
  end                               as category,
  -- Maîtrise 0..100 : stabilité FSRS plafonnée à 90 jours
  case
    when c.scheduler_state = 'new' or c.stability is null then 0
    else least(100, greatest(0, round(c.stability / 90.0 * 100)))::integer
  end                               as mastery
from public.member_phrase_cards c
join public.phrases  p  on p.id  = c.phrase_id
join public.profiles pr on pr.id = c.member_id
where pr.email not like '%@example.com';   -- comptes de test automatisés

revoke all on public.coda_export_cards_base from anon, authenticated;
grant select on public.coda_export_cards_base to service_role;

-- ------------------------------------------------------------
-- 3. Cartes "sales" : celles dont le contenu diffère de la dernière version
--    envoyée à Coda. Pagination par keyset (updated_at, card_id).
-- ------------------------------------------------------------
create or replace function public.coda_export_cards_dirty(
  p_since            timestamptz default '-infinity',
  p_after_updated_at timestamptz default '-infinity',
  p_after_card_id    uuid        default '00000000-0000-0000-0000-000000000000',
  p_limit            integer     default 200,
  p_ignore_hash      boolean     default false
)
returns table (
  card_id          uuid,
  member_id        uuid,
  member_email     text,
  mode             text,
  french           text,
  english          text,
  status           text,
  scheduler_state  text,
  category         text,
  mastery          integer,
  reviews          integer,
  lapses           integer,
  again_count_7d   integer,
  assist_level     integer,
  stability        numeric,
  fsrs_difficulty  numeric,
  interval_ms      bigint,
  due_at           timestamptz,
  last_reviewed_at timestamptz,
  created_at       timestamptz,
  updated_at       timestamptz,
  pack             text,
  phrase_tags      text[],
  log_count        bigint,
  again_logs       bigint,
  success_logs     bigint,
  avg_response_ms  numeric,
  last_rating      text,
  last_rated_at    timestamptz,
  content_hash     text
)
language sql
stable
security invoker
set search_path = public
as $$
  with candidates as (
    select b.*
    from public.coda_export_cards_base b
    where b.updated_at > p_since
      and (b.updated_at, b.card_id) > (p_after_updated_at, p_after_card_id)
  ),
  logs as (
    -- Un seul GROUP BY sur les logs des cartes candidates : bien plus rapide
    -- qu'un sous-select par carte (15 000 cartes, 80 000 logs : ~0,3 s).
    select
      r.card_id,
      count(*)                                               as log_count,
      count(*) filter (where r.rating = 'again')             as again_logs,
      count(*) filter (where r.rating in ('good','easy'))    as success_logs,
      round(avg(r.response_time_ms))                         as avg_response_ms,
      (array_agg(r.rating::text order by r.rated_at desc))[1] as last_rating,
      max(r.rated_at)                                        as last_rated_at
    from public.phrase_review_logs r
    where r.card_id in (select card_id from candidates)
    group by r.card_id
  ),
  enriched as (
    select
      b.card_id, b.member_id, b.member_email, b.mode, b.french, b.english,
      b.status, b.scheduler_state, b.category, b.mastery,
      b.reviews, b.lapses, b.again_count_7d, b.assist_level,
      b.stability, b.fsrs_difficulty, b.interval_ms,
      b.due_at, b.last_reviewed_at, b.created_at, b.updated_at,
      b.pack, b.phrase_tags,
      coalesce(l.log_count, 0)    as log_count,
      coalesce(l.again_logs, 0)   as again_logs,
      coalesce(l.success_logs, 0) as success_logs,
      l.avg_response_ms,
      l.last_rating,
      l.last_rated_at
    from candidates b
    left join logs l on l.card_id = b.card_id
  ),
  hashed as (
    select e.*,
           md5((to_jsonb(e) - 'updated_at' - 'created_at')::text) as content_hash
    from enriched e
  )
  select h.*
  from hashed h
  left join public.coda_sync_cards s on s.card_id = h.card_id
  where p_ignore_hash or s.content_hash is distinct from h.content_hash
  order by h.updated_at, h.card_id
  limit greatest(1, least(p_limit, 1000));
$$;

revoke all on function public.coda_export_cards_dirty(timestamptz, timestamptz, uuid, integer, boolean) from public, anon, authenticated;
grant execute on function public.coda_export_cards_dirty(timestamptz, timestamptz, uuid, integer, boolean) to service_role;

-- Cartes déjà envoyées à Coda mais supprimées (ou devenues invisibles) côté app.
create or replace function public.coda_export_cards_deleted(p_limit integer default 500)
returns table (card_id uuid)
language sql
stable
security invoker
set search_path = public
as $$
  select s.card_id
  from public.coda_sync_cards s
  left join public.coda_export_cards_base b on b.card_id = s.card_id
  where b.card_id is null
  limit greatest(1, least(p_limit, 1000));
$$;

revoke all on function public.coda_export_cards_deleted(integer) from public, anon, authenticated;
grant execute on function public.coda_export_cards_deleted(integer) to service_role;

-- ------------------------------------------------------------
-- 4. Vue étudiants : une ligne par membre ayant au moins une carte
-- ------------------------------------------------------------
create or replace view public.coda_export_students
with (security_invoker = true) as
with agg as (
  select
    b.member_id,
    count(*)                                                    as total_cards,
    count(*) filter (where b.status = 'active')                 as active_cards,
    count(*) filter (where b.category = 'Connue')               as known_cards,
    count(*) filter (where b.category = 'En cours')             as learning_cards,
    count(*) filter (where b.category = 'Difficile')            as difficult_cards,
    count(*) filter (where b.category = 'Nouvelle')             as new_cards,
    count(*) filter (where b.category = 'Suspendue')            as suspended_cards,
    count(*) filter (where b.status = 'active' and b.due_at <= now()) as due_cards,
    coalesce(sum(b.reviews), 0)                                 as reviews_total,
    max(b.last_reviewed_at)                                     as last_session_at
  from public.coda_export_cards_base b
  group by b.member_id
),
logs as (
  select
    r.member_id,
    count(*) filter (where r.rated_at > now() - interval '7 days')  as reviews_7d,
    count(*)                                                        as reviews_30d,
    count(*) filter (where r.rating in ('good','easy'))             as success_30d
  from public.phrase_review_logs r
  where r.rated_at > now() - interval '30 days'
  group by r.member_id
),
imports as (
  select i.member_id, max(i.created_at) as last_import_at, count(*) as import_count
  from public.member_phrase_imports i
  group by i.member_id
)
select
  pr.id                                   as member_id,
  pr.email                                as member_email,
  pr.role                                 as member_role,
  pr.created_at                           as member_since,
  agg.total_cards,
  agg.active_cards,
  agg.known_cards,
  agg.learning_cards,
  agg.difficult_cards,
  agg.new_cards,
  agg.suspended_cards,
  agg.due_cards,
  agg.reviews_total,
  agg.last_session_at,
  case when agg.active_cards > 0
       then round(agg.known_cards * 100.0 / agg.active_cards)::integer
       else 0 end                         as progress_pct,
  coalesce(logs.reviews_7d, 0)            as reviews_7d,
  coalesce(logs.reviews_30d, 0)           as reviews_30d,
  case when coalesce(logs.reviews_30d, 0) > 0
       then round(logs.success_30d::numeric / logs.reviews_30d, 3)
       else null end                      as success_rate_30d,
  imports.last_import_at,
  coalesce(imports.import_count, 0)       as import_count
from public.profiles pr
join agg on agg.member_id = pr.id
left join logs    on logs.member_id    = pr.id
left join imports on imports.member_id = pr.id;

revoke all on public.coda_export_students from anon, authenticated;
grant select on public.coda_export_students to service_role;
