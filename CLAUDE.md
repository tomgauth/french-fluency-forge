# Notes for Claude (SOLV / French Fluency Forge)

## Team facts (do not get these wrong)

- **Lilian is a man.** He goes by Lilian or Lilu (lilufrenchteacher@gmail.com), coach and sales at SOLV. Use masculine agreements in French (« Lilian est prêt », « il ») and he/him in English. Never assume a gender from the first name.
- Tom Gauthier (tomgauthier0@gmail.com) is the founder. Inès (learn.a.langu@gmail.com) is a coach.

## Flashcards data

- Source of truth for flashcards is the Supabase project `solv-flashcards-v0` (`phrases`, `member_phrase_cards`, `member_phrase_imports`). The Coda doc « Flashcards étudiants (SOLV) » is a read-only sync of it.
- Card status `buried` is a student action and comes back the next day (see `src/features/phrases/utils/bury.ts`). `suspended` is indefinite; coaches put cards on hold with `paused_reason` starting with `coach_` so they can be reactivated by query.

## Daily flashcards job (debriefs Slack de Lilian)

- Mapping canal Slack -> élève : table `slack_student_channels`. Journal : `flashcard_debrief_runs` (un debrief = une ligne, clé `slack_channel_id` + `slack_message_ts`).
- Import d'un pack : `select phrases_import_pack(email, 'YYYY-MM-DD THÈME', recall_json, recognition_json)`; cartes au format `[{"fr": "...", "en": "..."}]`. Un run en attente s'importe avec `phrases_import_run(run_id)`.
- Audios : `select phrases_audio_request(email, 'YYYY-MM-DD THÈME')` lance la fonction Edge `phrases-audio-backfill` (4 voix par phrase, fichiers `phrases/<id>_v0..3.mp3`, recall et recognize en une chaîne, appel direct à ElevenLabs). Un pack à la fois ; résultat dans `net._http_response`.
- Les liens de partage Fathom de Lilian sont publics : page `fathom.video/share/<token>`, puis `fathom.video/calls/<call_id>/copy_transcript?token=<token>` renvoie `{"html": ...}`.
