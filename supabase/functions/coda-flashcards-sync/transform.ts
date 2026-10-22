/**
 * Coda flashcards sync : logique pure (sans Deno, sans réseau) pour qu'elle
 * soit testable avec vitest. Voir transform.test.ts.
 */

export interface CodaColumn {
  id: string;
  name: string;
}

export interface CodaCell {
  column: string;
  value: string | number | boolean;
}

export interface CodaRow {
  cells: CodaCell[];
}

/** Ligne renvoyée par la fonction SQL public.coda_export_cards_dirty */
export interface CardExportRow {
  card_id: string;
  member_id: string;
  member_email: string;
  mode: string;
  french: string;
  english: string;
  status: string;
  scheduler_state: string;
  category: string;
  mastery: number;
  reviews: number;
  lapses: number;
  again_count_7d: number;
  assist_level: number;
  stability: number | string | null;
  fsrs_difficulty: number | string | null;
  interval_ms: number | string | null;
  due_at: string | null;
  last_reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  pack: string | null;
  phrase_tags: string[] | null;
  log_count: number | string;
  again_logs: number | string;
  success_logs: number | string;
  avg_response_ms: number | string | null;
  last_rating: string | null;
  last_rated_at: string | null;
  content_hash: string;
}

/** Ligne renvoyée par la vue public.coda_export_students */
export interface StudentExportRow {
  member_id: string;
  member_email: string;
  member_role: string | null;
  member_since: string | null;
  total_cards: number | string;
  active_cards: number | string;
  known_cards: number | string;
  learning_cards: number | string;
  difficult_cards: number | string;
  new_cards: number | string;
  suspended_cards: number | string;
  due_cards: number | string;
  reviews_total: number | string;
  last_session_at: string | null;
  progress_pct: number | string;
  reviews_7d: number | string;
  reviews_30d: number | string;
  success_rate_30d: number | string | null;
  last_import_at: string | null;
  import_count: number | string;
}

/**
 * Noms des colonnes Coda (table "Flashcards"). La fonction résout les IDs de
 * colonnes à partir de ces noms au démarrage et échoue clairement si une
 * colonne manque. Renommer une colonne dans Coda = mettre à jour ici.
 */
export const CARD_COLUMNS = {
  card_id: 'Carte ID',
  french: 'Français',
  english: 'Anglais',
  student: 'Étudiant',
  member_email: 'Email étudiant',
  category: 'Catégorie',
  mastery: 'Maîtrise',
  mode: 'Mode',
  reviews: 'Vues',
  lapses: 'Échecs',
  again_7d: 'Again 7 jours',
  success_rate: 'Taux de réussite',
  last_rating: 'Dernière note',
  stability: 'Stabilité (jours)',
  fsrs_difficulty: 'Difficulté FSRS',
  due_at: 'Prochaine révision',
  last_reviewed_at: 'Dernière révision',
  interval_days: 'Intervalle (jours)',
  scheduler_state: 'État',
  status: 'Statut',
  pack: 'Pack',
  tags: 'Tags',
  assist_level: "Niveau d'aide",
  avg_response_s: 'Temps de réponse moyen (s)',
  created_at: 'Créée le',
  synced_at: 'Synchronisé le',
} as const;

/**
 * Noms des colonnes Coda (table "Étudiants"). La colonne "Nom" n'est
 * volontairement PAS synchronisée : les coachs peuvent y saisir le vrai nom.
 */
export const STUDENT_COLUMNS = {
  member_id: 'ID',
  email: 'Email',
  role: 'Rôle',
  progress: 'Progression',
  total: 'Total cartes',
  known: 'Connues',
  learning: 'En cours',
  difficult: 'Difficiles',
  new: 'Nouvelles',
  suspended: 'Suspendues',
  due: 'À réviser',
  reviews_total: 'Reviews total',
  reviews_7d: 'Reviews 7 jours',
  reviews_30d: 'Reviews 30 jours',
  success_30d: 'Taux de réussite 30j',
  last_session: 'Dernière session',
  last_import: 'Dernier import',
  member_since: 'Membre depuis',
  synced_at: 'Synchronisé le',
} as const;

export type CardColumnKey = keyof typeof CARD_COLUMNS;
export type StudentColumnKey = keyof typeof STUDENT_COLUMNS;

/**
 * Associe chaque clé interne à l'ID de colonne Coda correspondant, en se
 * basant sur le nom. Lève une erreur listant toutes les colonnes manquantes.
 */
export function resolveColumns<K extends string>(
  apiColumns: CodaColumn[],
  mapping: Record<K, string>,
  tableLabel: string,
): Record<K, string> {
  const byName = new Map<string, string>();
  for (const col of apiColumns) byName.set(normalizeName(col.name), col.id);

  const resolved = {} as Record<K, string>;
  const missing: string[] = [];
  for (const key of Object.keys(mapping) as K[]) {
    const id = byName.get(normalizeName(mapping[key]));
    if (id) resolved[key] = id;
    else missing.push(mapping[key]);
  }
  if (missing.length > 0) {
    throw new Error(
      `Colonnes manquantes dans la table Coda "${tableLabel}" : ${missing.join(', ')}`,
    );
  }
  return resolved;
}

function normalizeName(name: string): string {
  return name.normalize('NFC').trim().toLowerCase();
}

export function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function round(value: number | null, decimals: number): number | null {
  if (value === null) return null;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Coda accepte les dates ISO 8601 ; une chaîne vide efface la cellule. */
export function toCodaDate(value: string | null | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}

function cell(column: string, value: string | number | boolean | null): CodaCell {
  return { column, value: value === null || value === undefined ? '' : value };
}

/** Tags visibles : on retire les tags techniques (imported, pack:...). */
export function displayTags(tags: string[] | null | undefined): string {
  if (!tags) return '';
  return tags
    .filter((t) => t && t !== 'imported' && !t.startsWith('pack:'))
    .join(', ');
}

export function cardToRow(
  row: CardExportRow,
  ids: Record<CardColumnKey, string>,
  syncedAtIso: string,
): CodaRow {
  const logCount = toNumber(row.log_count) ?? 0;
  const successLogs = toNumber(row.success_logs) ?? 0;
  const successRate = logCount > 0 ? round(successLogs / logCount, 3) : null;
  const intervalMs = toNumber(row.interval_ms);
  const intervalDays = intervalMs === null ? null : round(intervalMs / 86_400_000, 1);
  const avgResponseMs = toNumber(row.avg_response_ms);
  const avgResponseS = avgResponseMs === null ? null : round(avgResponseMs / 1000, 1);

  return {
    cells: [
      cell(ids.card_id, row.card_id),
      cell(ids.french, row.french ?? ''),
      cell(ids.english, row.english ?? ''),
      // Colonne relation : Coda associe la ligne "Étudiants" dont la colonne
      // d'affichage (Email) correspond à cette valeur.
      cell(ids.student, row.member_email),
      cell(ids.member_email, row.member_email),
      cell(ids.category, row.category),
      cell(ids.mastery, toNumber(row.mastery) ?? 0),
      cell(ids.mode, row.mode),
      cell(ids.reviews, toNumber(row.reviews) ?? 0),
      cell(ids.lapses, toNumber(row.lapses) ?? 0),
      cell(ids.again_7d, toNumber(row.again_count_7d) ?? 0),
      cell(ids.success_rate, successRate),
      cell(ids.last_rating, row.last_rating ?? ''),
      cell(ids.stability, round(toNumber(row.stability), 1)),
      cell(ids.fsrs_difficulty, round(toNumber(row.fsrs_difficulty), 1)),
      cell(ids.due_at, toCodaDate(row.due_at)),
      cell(ids.last_reviewed_at, toCodaDate(row.last_reviewed_at)),
      cell(ids.interval_days, intervalDays),
      cell(ids.scheduler_state, row.scheduler_state),
      cell(ids.status, row.status),
      cell(ids.pack, row.pack ?? ''),
      cell(ids.tags, displayTags(row.phrase_tags)),
      cell(ids.assist_level, toNumber(row.assist_level) ?? 0),
      cell(ids.avg_response_s, avgResponseS),
      cell(ids.created_at, toCodaDate(row.created_at)),
      cell(ids.synced_at, syncedAtIso),
    ],
  };
}

/** Ligne minimale pour une carte supprimée côté application. */
export function deletedCardToRow(
  cardId: string,
  ids: Record<CardColumnKey, string>,
  syncedAtIso: string,
): CodaRow {
  return {
    cells: [
      cell(ids.card_id, cardId),
      cell(ids.status, 'removed'),
      cell(ids.category, 'Suspendue'),
      cell(ids.synced_at, syncedAtIso),
    ],
  };
}

export function studentToRow(
  row: StudentExportRow,
  ids: Record<StudentColumnKey, string>,
  syncedAtIso: string,
): CodaRow {
  return {
    cells: [
      cell(ids.member_id, row.member_id),
      cell(ids.email, row.member_email),
      cell(ids.role, row.member_role ?? 'student'),
      cell(ids.progress, toNumber(row.progress_pct) ?? 0),
      cell(ids.total, toNumber(row.total_cards) ?? 0),
      cell(ids.known, toNumber(row.known_cards) ?? 0),
      cell(ids.learning, toNumber(row.learning_cards) ?? 0),
      cell(ids.difficult, toNumber(row.difficult_cards) ?? 0),
      cell(ids.new, toNumber(row.new_cards) ?? 0),
      cell(ids.suspended, toNumber(row.suspended_cards) ?? 0),
      cell(ids.due, toNumber(row.due_cards) ?? 0),
      cell(ids.reviews_total, toNumber(row.reviews_total) ?? 0),
      cell(ids.reviews_7d, toNumber(row.reviews_7d) ?? 0),
      cell(ids.reviews_30d, toNumber(row.reviews_30d) ?? 0),
      cell(ids.success_30d, round(toNumber(row.success_rate_30d), 3)),
      cell(ids.last_session, toCodaDate(row.last_session_at)),
      cell(ids.last_import, toCodaDate(row.last_import_at)),
      cell(ids.member_since, toCodaDate(row.member_since)),
      cell(ids.synced_at, syncedAtIso),
    ],
  };
}

export function chunk<T>(items: T[], size: number): T[][] {
  if (size <= 0) throw new Error('chunk size must be > 0');
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Interprète un en-tête Retry-After (secondes ou date HTTP) en millisecondes. */
export function parseRetryAfterMs(header: string | null, fallbackMs: number, now = Date.now()): number {
  if (!header) return fallbackMs;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.round(seconds * 1000);
  const date = Date.parse(header);
  if (!Number.isNaN(date)) return Math.max(0, date - now);
  return fallbackMs;
}

/** Délai de reprise exponentiel borné (1s, 2s, 4s, ... max 30s). */
export function backoffMs(attempt: number, baseMs = 1000, maxMs = 30_000): number {
  return Math.min(maxMs, baseMs * 2 ** Math.max(0, attempt));
}
