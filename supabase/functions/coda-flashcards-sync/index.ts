/**
 * coda-flashcards-sync
 * --------------------
 * Pousse les flashcards de chaque étudiant (et leurs statistiques) vers un doc
 * Coda. LECTURE SEULE côté application : cette fonction ne lit que des vues et
 * fonctions SQL dédiées (coda_export_*) et n'écrit que dans ses propres tables
 * d'état (coda_sync_runs, coda_sync_cards) et dans Coda.
 *
 * Déclencheurs :
 *   - cron pg_cron quotidien              -> public.coda_sync_request('cron')
 *   - trigger sur member_phrase_imports    -> public.coda_sync_request('import')
 *   - appel manuel (curl / dashboard)      -> header x-sync-secret ou Bearer service role
 *
 * Paramètres (JSON body ou query string) :
 *   source     : libellé libre (cron | import | manual | continuation)
 *   mode       : "incremental" (défaut, n'envoie que les cartes modifiées) | "full"
 *   dry_run    : true pour tout calculer sans écrire dans Coda ni mémoriser
 *   batch_size : cartes par requête Coda (défaut 200, max 500)
 *   max_seconds: budget temps avant de passer la main à une continuation (défaut 100)
 *
 * Variables d'environnement :
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   (fournies par Supabase)
 *   CODA_API_TOKEN                            (obligatoire, jeton API Coda)
 *   CODA_DOC_ID, CODA_TABLE_CARDS, CODA_TABLE_STUDENTS (optionnelles, valeurs par défaut ci-dessous)
 *   CODA_SYNC_SECRET                          (optionnelle, secret alternatif au Vault)
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { CodaClient } from './coda.ts';
import {
  CARD_COLUMNS,
  STUDENT_COLUMNS,
  cardToRow,
  chunk,
  deletedCardToRow,
  resolveColumns,
  studentToRow,
  type CardColumnKey,
  type CardExportRow,
  type StudentColumnKey,
  type StudentExportRow,
} from './transform.ts';

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void } | undefined;

const DEFAULTS = {
  docId: 'koy-KUdtK6',
  cardsTable: 'grid-lnVClPplJh',
  studentsTable: 'grid-Pnx0ec2a5B',
  batchSize: 200,
  maxBatchSize: 500,
  maxSeconds: 100,
  maxChain: 10,
  lockMinutes: 10,
  /** Marge de recouvrement pour la sélection incrémentale (le hash filtre le reste). */
  incrementalOverlapHours: 48,
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-sync-secret',
};

interface SyncOptions {
  source: string;
  mode: 'incremental' | 'full';
  dryRun: boolean;
  batchSize: number;
  maxSeconds: number;
  chain: number;
}

interface SyncResult {
  status: 'success' | 'error' | 'skipped';
  run_id?: string;
  mode: string;
  dry_run: boolean;
  students_pushed: number;
  cards_scanned: number;
  cards_pushed: number;
  cards_deleted: number;
  has_more: boolean;
  continuation_scheduled: boolean;
  duration_ms: number;
  error?: string;
}

interface Env {
  supabaseUrl: string;
  serviceRoleKey: string;
  codaToken: string | null;
  codaDocId: string;
  cardsTable: string;
  studentsTable: string;
  syncSecret: string | null;
}

function readEnv(): Env {
  return {
    supabaseUrl: Deno.env.get('SUPABASE_URL') ?? '',
    serviceRoleKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    codaToken: Deno.env.get('CODA_API_TOKEN') || null,
    codaDocId: Deno.env.get('CODA_DOC_ID') || DEFAULTS.docId,
    cardsTable: Deno.env.get('CODA_TABLE_CARDS') || DEFAULTS.cardsTable,
    studentsTable: Deno.env.get('CODA_TABLE_STUDENTS') || DEFAULTS.studentsTable,
    syncSecret: Deno.env.get('CODA_SYNC_SECRET') || null,
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function parseParams(req: Request): Promise<Record<string, unknown>> {
  const url = new URL(req.url);
  const params: Record<string, unknown> = {};
  url.searchParams.forEach((value, key) => (params[key] = value));
  if (req.method === 'POST') {
    try {
      const text = await req.text();
      if (text.trim()) Object.assign(params, JSON.parse(text));
    } catch {
      // body non JSON : on ignore, les query params suffisent
    }
  }
  return params;
}

function toBool(value: unknown): boolean {
  return value === true || value === 'true' || value === '1' || value === 1;
}

function toInt(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : parseInt(String(value ?? ''), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

async function isAuthorized(
  req: Request,
  params: Record<string, unknown>,
  env: Env,
  supabase: SupabaseClient,
): Promise<boolean> {
  const bearer = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (env.serviceRoleKey && bearer === env.serviceRoleKey) return true;

  const secret = req.headers.get('x-sync-secret') ?? (params.secret as string | undefined) ?? '';
  if (!secret || secret.length < 16) return false;
  if (env.syncSecret && secret === env.syncSecret) return true;

  const { data, error } = await supabase.rpc('coda_sync_secret_matches', { p_secret: secret });
  if (error) {
    console.error('[coda-flashcards-sync] secret check failed:', error.message);
    return false;
  }
  return data === true;
}

async function acquireRun(
  supabase: SupabaseClient,
  opts: SyncOptions,
): Promise<{ runId: string } | { skipped: string }> {
  const lockSince = new Date(Date.now() - DEFAULTS.lockMinutes * 60_000).toISOString();

  // Une synchro abandonnée (timeout, crash) ne doit pas bloquer indéfiniment.
  await supabase
    .from('coda_sync_runs')
    .update({ status: 'error', finished_at: new Date().toISOString(), error: 'abandonnée (timeout)' })
    .eq('status', 'running')
    .lt('started_at', lockSince);

  const { data: running } = await supabase
    .from('coda_sync_runs')
    .select('id, started_at')
    .eq('status', 'running')
    .gte('started_at', lockSince)
    .limit(1);

  if (running && running.length > 0) {
    await supabase.from('coda_sync_runs').insert({
      status: 'skipped',
      finished_at: new Date().toISOString(),
      source: opts.source,
      mode: opts.dryRun ? 'dry_run' : opts.mode,
      details: { reason: 'une synchro est déjà en cours', running_run_id: running[0].id },
    });
    return { skipped: `synchro déjà en cours (${running[0].id})` };
  }

  const { data, error } = await supabase
    .from('coda_sync_runs')
    .insert({ source: opts.source, mode: opts.dryRun ? 'dry_run' : opts.mode, details: { chain: opts.chain } })
    .select('id')
    .single();
  if (error || !data) throw new Error(`impossible de créer le run: ${error?.message}`);
  return { runId: data.id as string };
}

async function lastSuccessfulRunStart(supabase: SupabaseClient): Promise<string | null> {
  const { data } = await supabase
    .from('coda_sync_runs')
    .select('started_at')
    .eq('status', 'success')
    .in('mode', ['incremental', 'full'])
    .order('started_at', { ascending: false })
    .limit(1);
  return data && data.length > 0 ? (data[0].started_at as string) : null;
}

async function runSync(supabase: SupabaseClient, env: Env, opts: SyncOptions): Promise<SyncResult> {
  const startedAt = Date.now();
  const syncedAtIso = new Date(startedAt).toISOString();
  const result: SyncResult = {
    status: 'success',
    mode: opts.mode,
    dry_run: opts.dryRun,
    students_pushed: 0,
    cards_scanned: 0,
    cards_pushed: 0,
    cards_deleted: 0,
    has_more: false,
    continuation_scheduled: false,
    duration_ms: 0,
  };

  let acquired: Awaited<ReturnType<typeof acquireRun>>;
  try {
    acquired = await acquireRun(supabase, opts);
  } catch (err) {
    // Typiquement : droits manquants sur coda_sync_runs. On répond en JSON
    // plutôt que de laisser l'exception produire un 500 opaque.
    const message = err instanceof Error ? err.message : String(err);
    console.error('[coda-flashcards-sync] acquireRun failed:', message);
    result.status = 'error';
    result.error = message;
    result.duration_ms = Date.now() - startedAt;
    return result;
  }
  if ('skipped' in acquired) {
    result.status = 'skipped';
    result.error = acquired.skipped;
    result.duration_ms = Date.now() - startedAt;
    return result;
  }
  const runId = acquired.runId;
  result.run_id = runId;

  const outOfTime = () => Date.now() - startedAt > opts.maxSeconds * 1000;

  try {
    // --- Coda : résolution des colonnes par nom -------------------------
    let coda: CodaClient | null = null;
    let cardIds: Record<CardColumnKey, string> | null = null;
    let studentIds: Record<StudentColumnKey, string> | null = null;
    if (!opts.dryRun) {
      if (!env.codaToken) throw new Error('CODA_API_TOKEN manquant (secret de la fonction Edge)');
      coda = new CodaClient(env.codaToken, env.codaDocId);
      const [cardCols, studentCols] = await Promise.all([
        coda.listColumns(env.cardsTable),
        coda.listColumns(env.studentsTable),
      ]);
      cardIds = resolveColumns(cardCols, CARD_COLUMNS, 'Flashcards');
      studentIds = resolveColumns(studentCols, STUDENT_COLUMNS, 'Étudiants');
    }

    // --- Étudiants (toujours complet, quelques dizaines de lignes) ------
    const { data: students, error: studentsError } = await supabase
      .from('coda_export_students')
      .select('*')
      .order('member_email');
    if (studentsError) throw new Error(`lecture coda_export_students: ${studentsError.message}`);
    const studentRows = (students ?? []) as StudentExportRow[];
    if (coda && studentIds) {
      for (const batch of chunk(studentRows, 100)) {
        await coda.upsertRows(
          env.studentsTable,
          batch.map((s) => studentToRow(s, studentIds!, syncedAtIso)),
          [studentIds.member_id],
        );
      }
    }
    result.students_pushed = studentRows.length;

    // --- Cartes modifiées (pagination keyset, arrêt sur budget temps) ----
    const lastSuccess = opts.mode === 'incremental' ? await lastSuccessfulRunStart(supabase) : null;
    const since = lastSuccess
      ? new Date(new Date(lastSuccess).getTime() - DEFAULTS.incrementalOverlapHours * 3_600_000).toISOString()
      : '-infinity';

    let afterUpdatedAt = '-infinity';
    let afterCardId = '00000000-0000-0000-0000-000000000000';
    for (;;) {
      const { data, error } = await supabase.rpc('coda_export_cards_dirty', {
        p_since: since,
        p_after_updated_at: afterUpdatedAt,
        p_after_card_id: afterCardId,
        p_limit: opts.batchSize,
        p_ignore_hash: opts.mode === 'full',
      });
      if (error) throw new Error(`coda_export_cards_dirty: ${error.message}`);
      const rows = (data ?? []) as CardExportRow[];
      if (rows.length === 0) break;
      result.cards_scanned += rows.length;

      if (coda && cardIds) {
        await coda.upsertRows(
          env.cardsTable,
          rows.map((r) => cardToRow(r, cardIds!, syncedAtIso)),
          [cardIds.card_id],
        );
        const { error: hashError } = await supabase.from('coda_sync_cards').upsert(
          rows.map((r) => ({ card_id: r.card_id, content_hash: r.content_hash, synced_at: syncedAtIso })),
          { onConflict: 'card_id' },
        );
        if (hashError) throw new Error(`coda_sync_cards upsert: ${hashError.message}`);
        result.cards_pushed += rows.length;
      }

      const last = rows[rows.length - 1];
      afterUpdatedAt = last.updated_at;
      afterCardId = last.card_id;

      if (rows.length < opts.batchSize) break;
      if (outOfTime()) {
        result.has_more = true;
        break;
      }
    }

    // --- Cartes supprimées côté application ------------------------------
    if (!result.has_more) {
      const { data: deleted, error: deletedError } = await supabase.rpc('coda_export_cards_deleted', {
        p_limit: 500,
      });
      if (deletedError) throw new Error(`coda_export_cards_deleted: ${deletedError.message}`);
      const deletedIds = ((deleted ?? []) as { card_id: string }[]).map((d) => d.card_id);
      if (deletedIds.length > 0 && coda && cardIds) {
        for (const batch of chunk(deletedIds, opts.batchSize)) {
          await coda.upsertRows(
            env.cardsTable,
            batch.map((id) => deletedCardToRow(id, cardIds!, syncedAtIso)),
            [cardIds.card_id],
          );
          const { error: delError } = await supabase.from('coda_sync_cards').delete().in('card_id', batch);
          if (delError) throw new Error(`coda_sync_cards delete: ${delError.message}`);
        }
      }
      result.cards_deleted = deletedIds.length;
    }

    // --- Continuation si le budget temps est épuisé ----------------------
    if (result.has_more && !opts.dryRun && opts.chain < DEFAULTS.maxChain) {
      const continuation = fetch(`${env.supabaseUrl}/functions/v1/coda-flashcards-sync`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.serviceRoleKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source: 'continuation',
          mode: opts.mode,
          batch_size: opts.batchSize,
          max_seconds: opts.maxSeconds,
          chain: opts.chain + 1,
        }),
      }).catch((err) => console.error('[coda-flashcards-sync] continuation failed:', err));
      if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime) EdgeRuntime.waitUntil(continuation);
      result.continuation_scheduled = true;
    }

    result.duration_ms = Date.now() - startedAt;
    await supabase
      .from('coda_sync_runs')
      .update({
        status: 'success',
        finished_at: new Date().toISOString(),
        cards_scanned: result.cards_scanned,
        cards_pushed: result.cards_pushed,
        cards_deleted: result.cards_deleted,
        students_pushed: result.students_pushed,
        details: {
          chain: opts.chain,
          has_more: result.has_more,
          continuation_scheduled: result.continuation_scheduled,
          since,
          duration_ms: result.duration_ms,
        },
      })
      .eq('id', runId);
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[coda-flashcards-sync] run failed:', message);
    result.status = 'error';
    result.error = message;
    result.duration_ms = Date.now() - startedAt;
    await supabase
      .from('coda_sync_runs')
      .update({
        status: 'error',
        finished_at: new Date().toISOString(),
        cards_scanned: result.cards_scanned,
        cards_pushed: result.cards_pushed,
        cards_deleted: result.cards_deleted,
        students_pushed: result.students_pushed,
        error: message.slice(0, 2000),
      })
      .eq('id', runId);
    return result;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST' && req.method !== 'GET') return json({ error: 'method not allowed' }, 405);

  const env = readEnv();
  if (!env.supabaseUrl || !env.serviceRoleKey) {
    return json({ error: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants' }, 500);
  }
  const supabase = createClient(env.supabaseUrl, env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const params = await parseParams(req);
  if (!(await isAuthorized(req, params, env, supabase))) {
    return json({ error: 'unauthorized' }, 401);
  }

  const opts: SyncOptions = {
    source: String(params.source ?? 'manual').slice(0, 40),
    mode: params.mode === 'full' ? 'full' : 'incremental',
    dryRun: toBool(params.dry_run),
    batchSize: Math.min(DEFAULTS.maxBatchSize, toInt(params.batch_size, DEFAULTS.batchSize)),
    maxSeconds: toInt(params.max_seconds, DEFAULTS.maxSeconds),
    chain: toInt(params.chain, 0),
  };

  const result = await runSync(supabase, env, opts);
  return json(result, result.status === 'error' ? 500 : 200);
});
