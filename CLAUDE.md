# Notes for Claude (SOLV / French Fluency Forge)

## Team facts (do not get these wrong)

- **Lilian is a man.** He goes by Lilian or Lilu (lilufrenchteacher@gmail.com), coach and sales at SOLV. Use masculine agreements in French (« Lilian est prêt », « il ») and he/him in English. Never assume a gender from the first name.
- Tom Gauthier (tomgauthier0@gmail.com) is the founder. Inès (learn.a.langu@gmail.com) is a coach.

## Flashcards data

- Source of truth for flashcards is the Supabase project `solv-flashcards-v0` (`phrases`, `member_phrase_cards`, `member_phrase_imports`). The Coda doc « Flashcards étudiants (SOLV) » is a read-only sync of it.
- Card status `buried` is a student action and comes back the next day (see `src/features/phrases/utils/bury.ts`). `suspended` is indefinite; coaches put cards on hold with `paused_reason` starting with `coach_` so they can be reactivated by query.
