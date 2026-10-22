/**
 * Tests unitaires de la logique pure de coda-flashcards-sync.
 * Aucun accès réseau, aucune dépendance Deno : s'exécute avec vitest.
 */
import { describe, expect, it } from 'vitest';
import {
  CARD_COLUMNS,
  STUDENT_COLUMNS,
  backoffMs,
  cardToRow,
  chunk,
  deletedCardToRow,
  displayTags,
  parseRetryAfterMs,
  resolveColumns,
  round,
  studentToRow,
  toCodaDate,
  toNumber,
  type CardExportRow,
  type CodaColumn,
  type StudentExportRow,
} from './transform';
import { CodaApiError, CodaClient } from './coda';

function apiColumnsFor(mapping: Record<string, string>): CodaColumn[] {
  return Object.values(mapping).map((name, i) => ({ id: `c-${i}`, name }));
}

const cardIds = resolveColumns(apiColumnsFor(CARD_COLUMNS), CARD_COLUMNS, 'Flashcards');
const studentIds = resolveColumns(apiColumnsFor(STUDENT_COLUMNS), STUDENT_COLUMNS, 'Étudiants');

function cellValue(row: { cells: { column: string; value: unknown }[] }, column: string): unknown {
  const found = row.cells.find((c) => c.column === column);
  if (!found) throw new Error(`cellule ${column} absente`);
  return found.value;
}

const baseCard: CardExportRow = {
  card_id: 'fa2f178f-44da-5827-8edd-000200000028',
  member_id: '440dcd5d-b44e-4888-bbe9-7f2bb3234354',
  member_email: 'student@example.org',
  mode: 'recall',
  french: 'Ils arrivent en train',
  english: 'They arrive by train',
  status: 'active',
  scheduler_state: 'review',
  category: 'Connue',
  mastery: 100,
  reviews: 4,
  lapses: 0,
  again_count_7d: 0,
  assist_level: 0,
  stability: '130.97560526',
  fsrs_difficulty: '1',
  interval_ms: '11318400000',
  due_at: '2027-03-02T08:18:50.612+00:00',
  last_reviewed_at: '2026-10-22T08:18:50.612+00:00',
  created_at: '2026-09-19T10:00:00+00:00',
  updated_at: '2026-10-22T08:18:50.612+00:00',
  pack: 'VOYAGES 2 RECALL',
  phrase_tags: ['imported', 'pack:VOYAGES 2 RECALL', 'transport'],
  log_count: '4',
  again_logs: '0',
  success_logs: '3',
  avg_response_ms: '2345',
  last_rating: 'good',
  last_rated_at: '2026-10-22T08:18:50.612+00:00',
  content_hash: 'abc',
};

describe('resolveColumns', () => {
  it('associe les clés internes aux IDs de colonnes par nom (insensible à la casse et aux espaces)', () => {
    const cols: CodaColumn[] = [
      { id: 'c-1', name: '  carte id ' },
      { id: 'c-2', name: 'Français' },
    ];
    const ids = resolveColumns(cols, { card_id: 'Carte ID', french: 'Français' }, 'T');
    expect(ids).toEqual({ card_id: 'c-1', french: 'c-2' });
  });

  it('liste toutes les colonnes manquantes dans une seule erreur', () => {
    expect(() =>
      resolveColumns([{ id: 'c-1', name: 'Carte ID' }], { card_id: 'Carte ID', french: 'Français', pack: 'Pack' }, 'Flashcards'),
    ).toThrow(/Flashcards.*Français, Pack/);
  });

  it('couvre toutes les colonnes attendues des deux tables', () => {
    expect(Object.keys(cardIds)).toHaveLength(Object.keys(CARD_COLUMNS).length);
    expect(Object.keys(studentIds)).toHaveLength(Object.keys(STUDENT_COLUMNS).length);
  });
});

describe('cardToRow', () => {
  const synced = '2026-10-22T09:00:00.000Z';
  const row = cardToRow(baseCard, cardIds, synced);

  it('utilise Carte ID comme clé et le mail comme relation vers Étudiants', () => {
    expect(cellValue(row, cardIds.card_id)).toBe(baseCard.card_id);
    expect(cellValue(row, cardIds.student)).toBe('student@example.org');
    expect(cellValue(row, cardIds.member_email)).toBe('student@example.org');
  });

  it('convertit les chaînes numériques de PostgREST en nombres arrondis', () => {
    expect(cellValue(row, cardIds.stability)).toBe(131);
    expect(cellValue(row, cardIds.fsrs_difficulty)).toBe(1);
    expect(cellValue(row, cardIds.interval_days)).toBe(131);
    expect(cellValue(row, cardIds.avg_response_s)).toBe(2.3);
    expect(cellValue(row, cardIds.reviews)).toBe(4);
  });

  it('calcule le taux de réussite à partir des logs', () => {
    expect(cellValue(row, cardIds.success_rate)).toBe(0.75);
  });

  it('formate les dates en ISO 8601', () => {
    expect(cellValue(row, cardIds.due_at)).toBe('2027-03-02T08:18:50.612Z');
    expect(cellValue(row, cardIds.synced_at)).toBe(synced);
  });

  it('retire les tags techniques et garde le pack à part', () => {
    expect(cellValue(row, cardIds.tags)).toBe('transport');
    expect(cellValue(row, cardIds.pack)).toBe('VOYAGES 2 RECALL');
  });

  it('gère une carte neuve sans aucune statistique (valeurs nulles -> cellules vides)', () => {
    const fresh = cardToRow(
      {
        ...baseCard,
        scheduler_state: 'new',
        category: 'Nouvelle',
        mastery: 0,
        reviews: 0,
        stability: null,
        fsrs_difficulty: null,
        interval_ms: null,
        last_reviewed_at: null,
        log_count: 0,
        success_logs: 0,
        avg_response_ms: null,
        last_rating: null,
        pack: null,
        phrase_tags: null,
      },
      cardIds,
      synced,
    );
    expect(cellValue(fresh, cardIds.success_rate)).toBe('');
    expect(cellValue(fresh, cardIds.stability)).toBe('');
    expect(cellValue(fresh, cardIds.last_reviewed_at)).toBe('');
    expect(cellValue(fresh, cardIds.last_rating)).toBe('');
    expect(cellValue(fresh, cardIds.pack)).toBe('');
    expect(cellValue(fresh, cardIds.tags)).toBe('');
    expect(cellValue(fresh, cardIds.mastery)).toBe(0);
    // Jamais de null/undefined envoyé à Coda
    for (const c of fresh.cells) expect(c.value).not.toBeNull();
  });

  it('produit une ligne minimale pour une carte supprimée', () => {
    const removed = deletedCardToRow('id-1', cardIds, synced);
    expect(removed.cells).toHaveLength(4);
    expect(cellValue(removed, cardIds.status)).toBe('removed');
    expect(cellValue(removed, cardIds.category)).toBe('Suspendue');
  });
});

describe('studentToRow', () => {
  const student: StudentExportRow = {
    member_id: '440dcd5d-b44e-4888-bbe9-7f2bb3234354',
    member_email: 'student@example.org',
    member_role: 'student',
    member_since: '2026-08-22T10:00:00+00:00',
    total_cards: '1403',
    active_cards: '1403',
    known_cards: '900',
    learning_cards: '200',
    difficult_cards: '168',
    new_cards: '135',
    suspended_cards: '0',
    due_cards: '12',
    reviews_total: '4532',
    last_session_at: '2026-10-22T08:33:48.47+00:00',
    progress_pct: '64',
    reviews_7d: '300',
    reviews_30d: '1200',
    success_rate_30d: '0.812',
    last_import_at: '2026-10-21T13:03:27+00:00',
    import_count: '5',
  };
  const row = studentToRow(student, studentIds, '2026-10-22T09:00:00.000Z');

  it('utilise ID comme clé et ne touche jamais à la colonne Nom', () => {
    expect(cellValue(row, studentIds.member_id)).toBe(student.member_id);
    expect(Object.values(STUDENT_COLUMNS)).not.toContain('Nom');
  });

  it('remplit la barre de progression et les compteurs', () => {
    expect(cellValue(row, studentIds.progress)).toBe(64);
    expect(cellValue(row, studentIds.known)).toBe(900);
    expect(cellValue(row, studentIds.difficult)).toBe(168);
    expect(cellValue(row, studentIds.due)).toBe(12);
    expect(cellValue(row, studentIds.success_30d)).toBe(0.812);
    expect(cellValue(row, studentIds.member_since)).toBe('2026-08-22T10:00:00.000Z');
  });
});

describe('helpers', () => {
  it('toNumber / round', () => {
    expect(toNumber('12.5')).toBe(12.5);
    expect(toNumber('')).toBeNull();
    expect(toNumber(null)).toBeNull();
    expect(toNumber('abc')).toBeNull();
    expect(round(1.2345, 2)).toBe(1.23);
    expect(round(null, 2)).toBeNull();
  });

  it('toCodaDate', () => {
    expect(toCodaDate(null)).toBe('');
    expect(toCodaDate('pas une date')).toBe('');
    expect(toCodaDate('2026-01-01T00:00:00+02:00')).toBe('2025-12-31T22:00:00.000Z');
  });

  it('displayTags', () => {
    expect(displayTags(['imported', 'pack:X', 'a', 'b'])).toBe('a, b');
    expect(displayTags(undefined)).toBe('');
  });

  it('chunk', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 3)).toEqual([]);
    expect(() => chunk([1], 0)).toThrow();
  });

  it('parseRetryAfterMs / backoffMs', () => {
    expect(parseRetryAfterMs('2', 999)).toBe(2000);
    expect(parseRetryAfterMs(null, 999)).toBe(999);
    expect(parseRetryAfterMs('garbage', 999)).toBe(999);
    const now = Date.parse('2026-10-22T09:00:00Z');
    expect(parseRetryAfterMs('Thu, 22 Oct 2026 09:00:05 GMT', 999, now)).toBe(5000);
    expect(backoffMs(0)).toBe(1000);
    expect(backoffMs(3)).toBe(8000);
    expect(backoffMs(20)).toBe(30_000);
  });
});

describe('CodaClient', () => {
  function makeFetch(responses: Array<{ status: number; body?: unknown; headers?: Record<string, string> }>) {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      const next = responses.shift();
      if (!next) throw new Error('no more responses');
      return new Response(next.body === undefined ? '' : JSON.stringify(next.body), {
        status: next.status,
        headers: next.headers,
      });
    }) as unknown as typeof fetch;
    return { fetchImpl, calls };
  }
  const noSleep = async () => {};

  it('pagine la liste des colonnes', async () => {
    const { fetchImpl, calls } = makeFetch([
      { status: 200, body: { items: [{ id: 'c-1', name: 'A' }], nextPageToken: 'p2' } },
      { status: 200, body: { items: [{ id: 'c-2', name: 'B' }] } },
    ]);
    const client = new CodaClient('tok', 'doc', { fetchImpl, sleep: noSleep });
    const cols = await client.listColumns('grid-1');
    expect(cols).toEqual([
      { id: 'c-1', name: 'A' },
      { id: 'c-2', name: 'B' },
    ]);
    expect(calls[1].url).toContain('pageToken=p2');
    expect((calls[0].init?.headers as Record<string, string>).Authorization).toBe('Bearer tok');
  });

  it('envoie un upsert avec keyColumns et réessaie après un 429', async () => {
    const { fetchImpl, calls } = makeFetch([
      { status: 429, body: { message: 'slow down' }, headers: { 'retry-after': '1' } },
      { status: 202, body: { requestId: 'r1' } },
    ]);
    const slept: number[] = [];
    const client = new CodaClient('tok', 'doc', {
      fetchImpl,
      sleep: async (ms) => {
        slept.push(ms);
      },
      minWriteIntervalMs: 0,
    });
    await client.upsertRows('grid-1', [{ cells: [{ column: 'c-1', value: 'x' }] }], ['c-1']);
    expect(calls).toHaveLength(2);
    expect(slept).toContain(1000);
    const body = JSON.parse(String(calls[1].init?.body));
    expect(body.keyColumns).toEqual(['c-1']);
    expect(body.rows[0].cells[0]).toEqual({ column: 'c-1', value: 'x' });
  });

  it("n'écrit rien quand il n'y a pas de lignes", async () => {
    const { fetchImpl, calls } = makeFetch([]);
    const client = new CodaClient('tok', 'doc', { fetchImpl, sleep: noSleep });
    await client.upsertRows('grid-1', [], ['c-1']);
    expect(calls).toHaveLength(0);
  });

  it('remonte une erreur claire sur un 4xx non transitoire', async () => {
    const { fetchImpl } = makeFetch([{ status: 404, body: { message: 'Table not found' } }]);
    const client = new CodaClient('tok', 'doc', { fetchImpl, sleep: noSleep });
    await expect(client.listColumns('grid-x')).rejects.toBeInstanceOf(CodaApiError);
  });

  it('abandonne après maxRetries erreurs serveur', async () => {
    const { fetchImpl, calls } = makeFetch([
      { status: 503 },
      { status: 503 },
      { status: 503 },
    ]);
    const client = new CodaClient('tok', 'doc', { fetchImpl, sleep: noSleep, maxRetries: 2 });
    await expect(client.listColumns('grid-x')).rejects.toThrow(/503/);
    expect(calls).toHaveLength(3);
  });
});
