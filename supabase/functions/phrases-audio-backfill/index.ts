/**
 * phrases-audio-backfill
 * ----------------------
 * Génère côté serveur les audios manquants des phrases d'un élève (4 variantes
 * de voix par phrase, fichiers `phrases/<phrase_id>_v0..3.mp3` dans le bucket
 * `phrases-audio`), en appelant la fonction `french-tts` avec la clé service
 * role. C'est l'équivalent du bouton « Generate missing audio » de la Library,
 * mais déclenchable par un job (SQL `public.phrases_audio_request(...)`, cron,
 * ou curl).
 *
 * Auth : `Authorization: Bearer <service role>` ou header `x-sync-secret`
 * (le même secret Vault que la synchro Coda, vérifié via
 * `public.coda_sync_secret_matches`).
 *
 * Paramètres (JSON body ou query string) :
 *   member_email | member_id : l'élève (obligatoire sauf si phrase_ids)
 *   pack        : tag `pack:...` exact, ou un fragment (sans le préfixe `pack:`)
 *   phrase_ids  : liste d'IDs de phrases (ignore member/pack)
 *   async       : true pour répondre tout de suite et travailler en tâche de fond
 *   max_seconds : budget temps avant continuation (défaut 100)
 *   dry_run     : true pour compter sans générer
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void } | undefined;

/** Même ordre que le pool de voix françaises de `french-tts`. */
const VOICES = ['5Qfm4RqcAer0xoyWtoHC', '70QakWcpr1EAWDdnypvd', 'ohItIVrXTBI80RrUECOD', 'txtf1EDouKke753vN8SL'];
const BUCKET = 'phrases-audio';
const DEFAULT_MAX_SECONDS = 100;
const MAX_CHAIN = 12;

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

function publicUrl(supabaseUrl: string, key: string): string {
  return `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${key}.mp3`;
}

async function exists(url: string): Promise<boolean> {
  try {
    const r = await fetch(url, { method: 'HEAD' });
    return r.ok;
  } catch {
    return false;
  }
}

async function generateVariant(
  supabaseUrl: string,
  serviceRoleKey: string,
  text: string,
  cacheKey: string,
  voiceId: string,
): Promise<void> {
  let lastError = '';
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 1500 * attempt));
    const res = await fetch(`${supabaseUrl}/functions/v1/french-tts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text, voiceId, cacheKey, speed: 0.9, stability: 0.6, outputFormat: 'mp3_44100_128' }),
    });
    if (res.ok) {
      // Réponse JSON { cachedUrl } quand le fichier est stocké, sinon audio brut.
      await res.arrayBuffer();
      return;
    }
    const body = await res.text().catch(() => '');
    lastError = `french-tts ${res.status}: ${body.slice(0, 200)}`;
    if (![429, 502, 503, 504].includes(res.status)) break;
  }
  throw new Error(lastError || 'french-tts failed');
}

async function run(supabase: SupabaseClient, env: { supabaseUrl: string; serviceRoleKey: string }, p: Params): Promise<Result> {
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

    for (const phrase of phrases) {
      const text = (phrase.canonical_fr || phrase.transcript_fr || '').trim();
      if (!text) continue;
      for (let v = 0; v < VOICES.length; v++) {
        const key = `phrases/${phrase.id}_v${v}`;
        if (await exists(publicUrl(env.supabaseUrl, key))) {
          result.variants_existing++;
          continue;
        }
        if (p.dry_run) {
          result.variants_generated++;
          continue;
        }
        if (outOfTime()) {
          result.has_more = true;
          break;
        }
        try {
          await generateVariant(env.supabaseUrl, env.serviceRoleKey, text, key, VOICES[v]);
          result.variants_generated++;
        } catch (err) {
          result.variants_failed++;
          result.failures!.push({ phrase_id: phrase.id, variant: v, error: err instanceof Error ? err.message : String(err) });
          if (result.failures!.length >= 20) {
            throw new Error('trop d\'échecs TTS, arrêt');
          }
        }
      }
      if (result.has_more) break;
    }

    if (result.has_more && !p.dry_run && (p.chain ?? 0) < MAX_CHAIN) {
      const continuation = fetch(`${env.supabaseUrl}/functions/v1/phrases-audio-backfill`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.serviceRoleKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...p, async: true, chain: (p.chain ?? 0) + 1, source: 'continuation' }),
      }).catch((err) => console.error('[phrases-audio-backfill] continuation failed:', err));
      if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime) EdgeRuntime.waitUntil(continuation);
      result.continuation_scheduled = true;
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
    const work = run(supabase, { supabaseUrl, serviceRoleKey }, params);
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime) EdgeRuntime.waitUntil(work);
    return json({ status: 'accepted', member_email: params.member_email, pack: params.pack }, 202);
  }
  const result = await run(supabase, { supabaseUrl, serviceRoleKey }, params);
  return json(result, result.status === 'error' ? 500 : 200);
});
