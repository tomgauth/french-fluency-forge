/**
 * phrases-audio-backfill
 * ----------------------
 * Génère côté serveur les audios manquants des phrases d'un élève (4 variantes
 * de voix par phrase, fichiers `phrases/<phrase_id>_v0..3.mp3` dans le bucket
 * `phrases-audio`), en appelant ElevenLabs directement avec les mêmes réglages
 * que `french-tts` (clés ELEVENLABS_API_KEY*). C'est l'équivalent du bouton
 * « Generate missing audio » de la Library, mais déclenchable par un job
 * (SQL `public.phrases_audio_request(...)`, cron, ou curl).
 *
 * Auth : `Authorization: Bearer <service role>` ou header `x-sync-secret`
 * (le même secret Vault que la synchro Coda, vérifié via
 * `public.coda_sync_secret_matches`).
 *
 * Paramètres (JSON body ou query string) :
 *   member_email | member_id : l'élève (obligatoire sauf si phrase_ids)
 *   pack        : tag `pack:...` exact, ou un fragment (sans le préfixe `pack:`) ;
 *                 passer le nom du pack sans suffixe (`2026-11-03 THÈME`) traite
 *                 RECALL et RECOGNIZE en une seule chaîne. Lancer les packs
 *                 l'un après l'autre (ElevenLabs limite la concurrence).
 *   phrase_ids  : liste d'IDs de phrases (ignore member/pack)
 *   max_seconds : budget temps d'un appel (défaut 100) ; s'il reste du travail,
 *                 la fonction ré-enfile un appel via le RPC SQL
 *                 public.phrases_audio_request (pg_net), car le runtime Edge
 *                 coupe les tâches de fond ~20 s après la réponse
 *   chain       : numéro de continuation (interne, max 12)
 *   dry_run     : true pour compter sans générer
 *   async       : true pour répondre tout de suite (déconseillé, voir ci-dessus)
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void } | undefined;

/** Même ordre que le pool de voix françaises de `french-tts`. */
const VOICES = ['5Qfm4RqcAer0xoyWtoHC', '70QakWcpr1EAWDdnypvd', 'ohItIVrXTBI80RrUECOD', 'txtf1EDouKke753vN8SL'];
const BUCKET = 'phrases-audio';
const DEFAULT_MAX_SECONDS = 100;
const MAX_CHAIN = 12;
const MAX_ATTEMPTS = 6;
const MAX_RETRY_WAIT_MS = 45_000;
const MAX_CONSECUTIVE_FAILURES = 10;
const PACE_MS = 100;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-sync-secret',
};

interface Params {
  member_email?: string;
  member_id?: string;
  pack?: string;
  phrase_ids?: string[];
  async?: boolean;
  max_seconds?: number;
  dry_run?: boolean;
  chain?: number;
  source?: string;
}

interface PhraseRow {
  id: string;
  canonical_fr: string | null;
  transcript_fr: string | null;
  tags: string[] | null;
}

interface Result {
  status: 'success' | 'error' | 'accepted';
  member_id?: string;
  pack?: string;
  phrases: number;
  variants_existing: number;
  variants_generated: number;
  variants_failed: number;
  has_more: boolean;
  continuation_scheduled: boolean;
  duration_ms: number;
  error?: string;
  failures?: { phrase_id: string; variant: number; error: string }[];
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function toBool(v: unknown): boolean {
  return v === true || v === 'true' || v === '1' || v === 1;
}

async function parseParams(req: Request): Promise<Params> {
  const url = new URL(req.url);
  const params: Record<string, unknown> = {};
  url.searchParams.forEach((value, key) => (params[key] = value));
  if (req.method === 'POST') {
    try {
      const text = await req.text();
      if (text.trim()) Object.assign(params, JSON.parse(text));
    } catch {
      // body non JSON : les query params suffisent
    }
  }
  const ids = params.phrase_ids;
  return {
    member_email: typeof params.member_email === 'string' ? params.member_email.trim().toLowerCase() : undefined,
    member_id: typeof params.member_id === 'string' ? params.member_id : undefined,
    pack: typeof params.pack === 'string' ? params.pack : undefined,
    phrase_ids: Array.isArray(ids) ? ids.filter((x): x is string => typeof x === 'string') : undefined,
    async: toBool(params.async),
    max_seconds: Number(params.max_seconds) > 0 ? Number(params.max_seconds) : DEFAULT_MAX_SECONDS,
    dry_run: toBool(params.dry_run),
    chain: Number(params.chain) > 0 ? Number(params.chain) : 0,
    source: typeof params.source === 'string' ? params.source.slice(0, 40) : 'manual',
  };
}

async function isAuthorized(req: Request, params: URLSearchParams, serviceRoleKey: string, supabase: SupabaseClient): Promise<boolean> {
  const bearer = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (serviceRoleKey && bearer === serviceRoleKey) return true;
  const secret = req.headers.get('x-sync-secret') ?? params.get('secret') ?? '';
  if (!secret || secret.length < 16) return false;
  const { data, error } = await supabase.rpc('coda_sync_secret_matches', { p_secret: secret });
  if (error) {
    console.error('[phrases-audio-backfill] secret check failed:', error.message);
    return false;
  }
  return data === true;
}

async function memberEmail(supabase: SupabaseClient, memberId: string): Promise<string | null> {
  const { data } = await supabase.from('profiles').select('email').eq('id', memberId).limit(1);
  return data && data.length > 0 ? (data[0].email as string) : null;
}

async function resolveMember(supabase: SupabaseClient, p: Params): Promise<string | null> {
  if (p.member_id) return p.member_id;
  if (!p.member_email) return null;
  const { data } = await supabase.from('profiles').select('id').ilike('email', p.member_email).limit(1);
  return data && data.length > 0 ? (data[0].id as string) : null;
}

async function loadPhrases(supabase: SupabaseClient, p: Params, memberId: string | null): Promise<PhraseRow[]> {
  if (p.phrase_ids && p.phrase_ids.length > 0) {
    const { data, error } = await supabase.from('phrases').select('id, canonical_fr, transcript_fr, tags').in('id', p.phrase_ids);
    if (error) throw new Error(`phrases: ${error.message}`);
    return (data ?? []) as PhraseRow[];
  }
  if (!memberId) throw new Error('member_email, member_id ou phrase_ids requis');
  const out: PhraseRow[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('member_phrase_cards')
      .select('phrase:phrases(id, canonical_fr, transcript_fr, tags)')
      .eq('member_id', memberId)
      .neq('status', 'removed')
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`member_phrase_cards: ${error.message}`);
    for (const row of data ?? []) {
      const ph = (row as { phrase: PhraseRow | PhraseRow[] | null }).phrase;
      const phrase = Array.isArray(ph) ? ph[0] : ph;
      if (phrase) out.push(phrase);
    }
    if (!data || data.length < pageSize) break;
  }
  if (!p.pack) return out;
  const wanted = p.pack.startsWith('pack:') ? p.pack : null;
  const needle = p.pack.replace(/^pack:/, '').toLowerCase();
  return out.filter((ph) => {
    const tags = ph.tags ?? [];
    if (wanted) return tags.includes(wanted);
    return tags.some((t) => t.toLowerCase().startsWith('pack:') && t.toLowerCase().includes(needle));
  });
}

/**
 * Variantes manquantes (phrase_id -> liste de v), en une requête SQL par lot
 * de 500 phrases (RPC phrases_audio_missing_variants, lit storage.objects).
 * Beaucoup plus rapide que des requêtes HEAD une par une (~200 ms chacune).
 */
async function missingVariants(supabase: SupabaseClient, phraseIds: string[]): Promise<Map<string, number[]>> {
  const out = new Map<string, number[]>();
  for (let i = 0; i < phraseIds.length; i += 500) {
    const batch = phraseIds.slice(i, i + 500);
    const { data, error } = await supabase.rpc('phrases_audio_missing_variants', { p_phrase_ids: batch });
    if (error) throw new Error(`phrases_audio_missing_variants: ${error.message}`);
    for (const row of (data ?? []) as { phrase_id: string; variant: number }[]) {
      const list = out.get(row.phrase_id) ?? [];
      list.push(row.variant);
      out.set(row.phrase_id, list);
    }
  }
  return out;
}

function retryHintMs(text: string): number | null {
  const m = /Retry after (\d+)\s*ms/i.exec(text);
  return m ? Number(m[1]) + 250 : null;
}

function elevenLabsKeys(): string[] {
  const keys: string[] = [];
  const primary = Deno.env.get('ELEVENLABS_API_KEY');
  if (primary) keys.push(primary);
  for (let i = 2; i <= 10; i++) {
    const k = Deno.env.get(`ELEVENLABS_API_KEY_${i}`);
    if (k) keys.push(k);
  }
  return keys;
}

/**
 * Appelle ElevenLabs directement (mêmes réglages que `french-tts`) puis écrit
 * le fichier final dans le bucket. On n'invoque pas `french-tts` : le runtime
 * Edge limite fortement les appels de fonction à fonction (« Rate limit
 * exceeded for trace ... Retry after N ms »).
 */
async function generateVariant(
  supabase: SupabaseClient,
  text: string,
  cacheKey: string,
  voiceId: string,
): Promise<void> {
  const keys = elevenLabsKeys();
  if (keys.length === 0) throw new Error('ELEVENLABS_API_KEY manquant');
  let lastError = '';
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    let audio: ArrayBuffer | null = null;
    let waitMs = 1500 * (attempt + 1);
    for (const key of keys) {
      let res: Response;
      try {
        res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
          method: 'POST',
          headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text,
            model_id: 'eleven_multilingual_v2',
            voice_settings: { stability: 0.6, similarity_boost: 0.75, style: 0.3, use_speaker_boost: true, speed: 0.9 },
          }),
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        lastError = `fetch: ${msg}`;
        waitMs = retryHintMs(msg) ?? waitMs;
        break;
      }
      if (res.ok) {
        audio = await res.arrayBuffer();
        break;
      }
      const body = await res.text().catch(() => '');
      lastError = `elevenlabs ${res.status}: ${body.slice(0, 200)}`;
      const retryAfter = Number(res.headers.get('Retry-After'));
      if (retryAfter > 0) waitMs = Math.max(waitMs, retryAfter * 1000);
      // Texte refusé (400) ou bloqué par la modération (403) : inutile de réessayer.
      if (res.status === 400 || res.status === 403) throw new Error(lastError);
      // Clé suivante seulement pour les échecs propres à la clé (quota, auth, débit).
      if (![401, 402, 404, 429].includes(res.status)) break;
    }
    if (audio) {
      const { error } = await supabase.storage.from(BUCKET).upload(`${cacheKey}.mp3`, new Uint8Array(audio), {
        contentType: 'audio/mpeg',
        upsert: true,
      });
      if (!error) return;
      lastError = `storage: ${error.message}`;
      waitMs = retryHintMs(error.message) ?? waitMs;
    }
    await new Promise((r) => setTimeout(r, Math.min(waitMs, MAX_RETRY_WAIT_MS)));
  }
  throw new Error(lastError || 'tts failed');
}

async function run(supabase: SupabaseClient, p: Params): Promise<Result> {
  const startedAt = Date.now();
  const result: Result = {
    status: 'success',
    pack: p.pack,
    phrases: 0,
    variants_existing: 0,
    variants_generated: 0,
    variants_failed: 0,
    has_more: false,
    continuation_scheduled: false,
    duration_ms: 0,
    failures: [],
  };
  try {
    const memberId = await resolveMember(supabase, p);
    if (!memberId && !(p.phrase_ids && p.phrase_ids.length > 0)) {
      throw new Error(`élève introuvable (${p.member_email ?? p.member_id ?? 'aucun identifiant'})`);
    }
    result.member_id = memberId ?? undefined;
    const phrases = await loadPhrases(supabase, p, memberId);
    result.phrases = phrases.length;

    const outOfTime = () => Date.now() - startedAt > (p.max_seconds ?? DEFAULT_MAX_SECONDS) * 1000;
    let consecutiveFailures = 0;

    const missing = await missingVariants(supabase, phrases.map((ph) => ph.id));
    result.variants_existing = phrases.length * VOICES.length - [...missing.values()].reduce((n, l) => n + l.length, 0);

    for (const phrase of phrases) {
      const todo = missing.get(phrase.id);
      if (!todo || todo.length === 0) continue;
      const text = (phrase.canonical_fr || phrase.transcript_fr || '').trim();
      if (!text) continue;
      for (const v of todo) {
        const key = `phrases/${phrase.id}_v${v}`;
        if (p.dry_run) {
          result.variants_generated++;
          continue;
        }
        if (outOfTime()) {
          result.has_more = true;
          break;
        }
        try {
          await generateVariant(supabase, text, key, VOICES[v]);
          result.variants_generated++;
          consecutiveFailures = 0;
        } catch (err) {
          result.variants_failed++;
          consecutiveFailures++;
          if (result.failures!.length < 20) {
            result.failures!.push({ phrase_id: phrase.id, variant: v, error: err instanceof Error ? err.message : String(err) });
          }
          if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
            throw new Error(`${MAX_CONSECUTIVE_FAILURES} échecs TTS consécutifs, arrêt`);
          }
        }
        // Petite pause entre deux générations pour ménager ElevenLabs et le storage.
        await new Promise((r) => setTimeout(r, PACE_MS));
      }
      if (result.has_more) break;
    }

    if (result.has_more && !p.dry_run && (p.chain ?? 0) < MAX_CHAIN) {
      // Continuation via pg_net (RPC SQL) : indépendante du cycle de vie de cet isolate.
      const email = p.member_email ?? (memberId ? await memberEmail(supabase, memberId) : null);
      if (email) {
        const { error } = await supabase.rpc('phrases_audio_request', {
          p_member_email: email,
          p_pack: p.pack ?? null,
          p_source: 'continuation',
          p_chain: (p.chain ?? 0) + 1,
        });
        if (error) console.error('[phrases-audio-backfill] continuation failed:', error.message);
        else result.continuation_scheduled = true;
      }
    }
  } catch (err) {
    result.status = 'error';
    result.error = err instanceof Error ? err.message : String(err);
  }
  result.duration_ms = Date.now() - startedAt;
  if (result.failures && result.failures.length === 0) delete result.failures;
  console.log('[phrases-audio-backfill]', JSON.stringify({ ...result, failures: undefined }));
  return result;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST' && req.method !== 'GET') return json({ error: 'method not allowed' }, 405);

  const supabaseUrl = (Deno.env.get('SUPABASE_URL') ?? '').replace(/\/$/, '');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !serviceRoleKey) return json({ error: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants' }, 500);
  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const url = new URL(req.url);
  if (!(await isAuthorized(req, url.searchParams, serviceRoleKey, supabase))) return json({ error: 'unauthorized' }, 401);

  const params = await parseParams(req);
  if (params.async) {
    const work = run(supabase, params);
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime) EdgeRuntime.waitUntil(work);
    return json({ status: 'accepted', member_email: params.member_email, pack: params.pack }, 202);
  }
  const result = await run(supabase, params);
  return json(result, result.status === 'error' ? 500 : 200);
});
