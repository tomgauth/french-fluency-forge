# Synchronisation des flashcards vers Coda

Doc Coda : **Flashcards étudiants (SOLV)** : https://coda.io/d/_dkoy-KUdtK6

Objectif : donner aux coachs (Lilian, Inès...) une vue en lecture seule de toutes les
flashcards de chaque étudiant, avec leurs statistiques, mise à jour à chaque upload
de flashcards et au moins une fois par jour.

## Principe : lecture pure, zéro clash

Rien dans ce module ne modifie les tables de l'application (`phrases`,
`member_phrase_cards`, `phrase_review_logs`, `profiles`, ...) ni leurs policies.
Tout ce qui est ajouté est nouveau et préfixé `coda_` :

| Objet | Type | Rôle |
| --- | --- | --- |
| `coda_export_cards_base` | vue | une ligne par carte, avec la catégorie pédagogique et la maîtrise |
| `coda_export_cards_dirty(...)` | fonction SQL | cartes dont le contenu a changé depuis le dernier envoi (empreinte md5) |
| `coda_export_cards_deleted()` | fonction SQL | cartes envoyées à Coda mais supprimées côté app |
| `coda_export_students` | vue | une ligne par étudiant avec compteurs, progression, dernière session, dernier import |
| `coda_sync_runs` | table privée | journal des synchros (statut, compteurs, erreur) |
| `coda_sync_cards` | table privée | empreinte de la dernière version envoyée, par carte |
| `coda_sync_secret_matches(text)` | fonction SQL | vérifie le secret partagé stocké dans Vault |
| `coda_sync_request(text)` | fonction SQL | envoie l'appel HTTP (pg_net, asynchrone, erreurs avalées) |
| `coda_sync_after_import` | trigger | AFTER INSERT ... FOR EACH STATEMENT sur `member_phrase_imports` |
| `coda-flashcards-sync-daily` | job pg_cron | tous les jours à 03:10 UTC |
| `coda-flashcards-sync` | fonction Edge | lit les vues, pousse vers l'API Coda |

Points de sûreté :

- Le trigger est posé sur `member_phrase_imports` (journal des uploads, une ligne par
  import), pas sur la table chaude des cartes. Il est au niveau instruction (un seul
  appel par import) et toute erreur y est avalée : un upload ne peut pas échouer à
  cause de Coda.
- L'appel HTTP passe par pg_net, donc il est asynchrone : il ne ralentit jamais
  l'insertion.
- Les vues sont en `security_invoker` et les objets `coda_*` sont révoqués pour
  `anon` et `authenticated` : seul le service role (la fonction Edge) les lit.
- La fonction Edge n'écrit que dans Coda et dans `coda_sync_runs` / `coda_sync_cards`.
- Si la fonction Edge ou Coda tombe, l'application ne voit rien : la synchro suivante
  rattrape tout (comparaison d'empreintes, pas de curseur fragile).

## Ce que voit Lilian dans Coda

Page **Étudiants** : une ligne par étudiant ayant au moins une carte.
Barre de progression (% de cartes connues parmi les cartes actives), compteurs par
catégorie, cartes à réviser aujourd'hui, reviews sur 7 et 30 jours, taux de réussite
30 jours, dernière session, dernier import. La colonne **Nom** n'est jamais écrasée
par la synchro : les coachs peuvent y saisir le prénom.

Page **Flashcards** : une ligne par carte et par étudiant, avec toutes les stats
(vues, échecs, again sur 7 jours, taux de réussite, dernière note, stabilité et
difficulté FSRS, prochaine et dernière révision, intervalle, état, statut, pack,
tags, niveau d'aide, temps de réponse moyen). Boutons raccourcis **Difficiles / En
cours / Connues / Nouvelles / Toutes** et un sélecteur d'étudiant pour filtrer.

### Catégories (seuils)

Calculées dans la vue `coda_export_cards_base`, une seule source de vérité :

| Catégorie | Règle |
| --- | --- |
| Suspendue | `status` différent de `active` (suspended, buried, removed) |
| Nouvelle | `scheduler_state = 'new'` (jamais vue) |
| Difficile | `relearning`, ou `lapses >= 2`, ou `again_count_7d >= 2`, ou `assist_level >= 2`, ou difficulté FSRS `>= 8` |
| Connue | `review` et stabilité FSRS `>= 21` jours |
| En cours | tout le reste |

Maîtrise (barre par carte) : stabilité FSRS ramenée sur 0 à 100 (100 = 90 jours ou plus).

Pour changer un seuil : modifier la vue dans une nouvelle migration, puis lancer une
synchro en mode `full` (voir plus bas).

## État au 23 octobre 2026

- Migrations appliquées sur `solv-flashcards-v0`, fonction Edge déployée (v2),
  secrets Vault créés, trigger et job cron en place.
- Test à blanc (`dry_run=true`) réussi sur la base live : 26 étudiants,
  15 141 cartes parcourues en 27 s, aucune écriture.
- Reste à faire : ajouter le secret `CODA_API_TOKEN` (étape 4 ci-dessous), puis
  lancer la première synchro (étape 5). Les lignes de la table Étudiants ont été
  pré-remplies une fois à la main ; la synchro les écrasera avec les mêmes clés.

## Mise en route (une fois)

1. **Migrations** (déjà appliquées sur le projet `solv-flashcards-v0`) :
   `20261022090000_coda_flashcards_export.sql` puis
   `20261022090001_coda_flashcards_schedule.sql`.
2. **Secrets Vault** (déjà créés) : `coda_sync_url` (URL de la fonction Edge) et
   `coda_sync_secret` (secret aléatoire partagé). Pour les (re)créer :
   ```sql
   select vault.create_secret('https://<ref>.supabase.co/functions/v1/coda-flashcards-sync', 'coda_sync_url');
   select vault.create_secret('<secret aléatoire d au moins 32 caractères>', 'coda_sync_secret');
   ```
3. **Fonction Edge** : `supabase functions deploy coda-flashcards-sync --no-verify-jwt`
   (déjà déployée). Elle fait sa propre authentification (secret Vault ou clé service
   role).
4. **Jeton Coda** (seule étape manuelle restante) : créer un jeton API sur
   https://coda.io/account (section API settings) avec accès au doc, puis l'ajouter
   dans Supabase > Edge Functions > Secrets sous le nom `CODA_API_TOKEN`.
   Optionnel : `CODA_DOC_ID`, `CODA_TABLE_CARDS`, `CODA_TABLE_STUDENTS` pour pointer
   vers un autre doc (valeurs par défaut dans `index.ts`).
5. **Première synchro complète** (environ 15 000 cartes, quelques minutes, la fonction
   s'enchaîne toute seule par tranches de 100 s) :
   ```sql
   select public.coda_sync_request('manual');
   ```
   ou, pour forcer un recalcul intégral :
   ```bash
   curl -X POST "https://<ref>.supabase.co/functions/v1/coda-flashcards-sync" \
     -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
     -H "Content-Type: application/json" \
     -d '{"source":"manual","mode":"full"}'
   ```
6. Partager le doc Coda avec Lilian et Inès (lecture seule suffit).

## Fonctionnement au quotidien

- **À chaque upload** : l'application insère une ligne dans `member_phrase_imports`,
  le trigger appelle la fonction, qui envoie les cartes nouvelles ou modifiées.
- **Tous les jours à 03:10 UTC** : même chose via pg_cron.
- Une synchro ne renvoie que les cartes dont l'empreinte a changé. Les reviews
  mettent à jour `updated_at` sur toutes les cartes d'un étudiant (upsert en bloc côté
  client), mais seules celles dont une statistique a réellement bougé partent vers Coda.
- Les cartes supprimées côté app passent en `Statut = removed` dans Coda.
- Verrou : si une synchro tourne déjà (moins de 10 minutes), la nouvelle est marquée
  `skipped`. Une synchro bloquée depuis plus de 10 minutes est marquée en erreur et
  le verrou se libère.

Paramètres de la fonction (body JSON ou query string) : `mode` (`incremental` par
défaut, `full`), `dry_run` (`true` : calcule tout, n'écrit rien), `batch_size`
(200 par défaut, max 500), `max_seconds` (100 par défaut).

## Vérifier que ça tourne

```sql
-- Dernières synchros
select started_at, finished_at, status, source, mode, cards_scanned, cards_pushed,
       cards_deleted, students_pushed, error
from public.coda_sync_runs order by started_at desc limit 20;

-- Cartes en attente d'envoi (devrait être proche de 0 après une synchro)
select count(*) from public.coda_export_cards_dirty('-infinity', '-infinity',
  '00000000-0000-0000-0000-000000000000', 1000, false);

-- Jobs cron
select jobid, schedule, command, active from cron.job;
select * from cron.job_run_details order by start_time desc limit 10;
```

Logs de la fonction : Supabase > Edge Functions > `coda-flashcards-sync` > Logs.

## Tests

- Logique pure (mapping des colonnes, conversion des valeurs, client API avec reprise
  sur 429/5xx) : `supabase/functions/coda-flashcards-sync/transform.test.ts`,
  exécutée par `npm run test:run` avec le reste de la suite.
- Lecture seule vérifiée sur la base live avec `dry_run=true` (aucune écriture Coda,
  aucune empreinte mémorisée).

## Désinstaller

```sql
select cron.unschedule('coda-flashcards-sync-daily');
drop trigger if exists coda_sync_after_import on public.member_phrase_imports;
drop function if exists public.coda_sync_on_import();
drop function if exists public.coda_sync_request(text);
drop function if exists public.coda_sync_secret_matches(text);
drop function if exists public.coda_export_cards_deleted(integer);
drop function if exists public.coda_export_cards_dirty(timestamptz, timestamptz, uuid, integer, boolean);
drop view if exists public.coda_export_students;
drop view if exists public.coda_export_cards_base;
drop table if exists public.coda_sync_cards;
drop table if exists public.coda_sync_runs;
delete from vault.secrets where name in ('coda_sync_url', 'coda_sync_secret');
```

Puis supprimer la fonction Edge `coda-flashcards-sync` dans le dashboard. Aucune
donnée de l'application n'est touchée.

## Limites connues

- Le repo `supabase/config.toml` pointe vers le projet `mjqykgcvfteihqmgeufb`, mais
  la base vivante (15 000 cartes, 80 000 reviews) est `solv-flashcards-v0`
  (`affygdjsoukipdeuynwe`). Les migrations ci-dessus visent le schéma live (colonnes
  `profiles.role`, `member_phrase_imports`), absent des migrations du repo.
- Les comptes de test (`@example.com`) sont exclus de l'export.
- Si une colonne est renommée dans Coda, la synchro échoue avec un message listant
  les colonnes manquantes : mettre à jour `CARD_COLUMNS` / `STUDENT_COLUMNS` dans
  `transform.ts`.
