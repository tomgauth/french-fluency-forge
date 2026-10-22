/**
 * Client minimal pour l'API REST Coda (https://coda.io/developers/apis/v1).
 * Injection de fetch/sleep pour les tests. Gère la limite de débit (429)
 * et les erreurs transitoires (5xx, réseau) avec reprise exponentielle.
 */
import { backoffMs, parseRetryAfterMs, type CodaColumn, type CodaRow } from './transform.ts';

export interface CodaClientOptions {
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  baseUrl?: string;
  /** Intervalle minimal entre deux écritures (Coda limite ~10 écritures / 6 s). */
  minWriteIntervalMs?: number;
  maxRetries?: number;
}

export class CodaApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly body: string) {
    super(message);
    this.name = 'CodaApiError';
  }
}

export class CodaClient {
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly baseUrl: string;
  private readonly minWriteIntervalMs: number;
  private readonly maxRetries: number;
  private lastWriteAt = 0;

  constructor(
    private readonly token: string,
    private readonly docId: string,
    options: CodaClientOptions = {},
  ) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.sleep = options.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.baseUrl = (options.baseUrl ?? 'https://coda.io/apis/v1').replace(/\/$/, '');
    this.minWriteIntervalMs = options.minWriteIntervalMs ?? 650;
    this.maxRetries = options.maxRetries ?? 5;
  }

  async listColumns(tableId: string): Promise<CodaColumn[]> {
    const columns: CodaColumn[] = [];
    let pageToken: string | undefined;
    do {
      const params = new URLSearchParams({ limit: '200' });
      if (pageToken) params.set('pageToken', pageToken);
      const json = await this.request<{ items: CodaColumn[]; nextPageToken?: string }>(
        'GET',
        `/docs/${this.docId}/tables/${encodeURIComponent(tableId)}/columns?${params}`,
      );
      for (const item of json.items ?? []) columns.push({ id: item.id, name: item.name });
      pageToken = json.nextPageToken;
    } while (pageToken);
    return columns;
  }

  /** Upsert : les lignes dont la/les colonne(s) clé(s) existent déjà sont mises à jour. */
  async upsertRows(tableId: string, rows: CodaRow[], keyColumns: string[]): Promise<void> {
    if (rows.length === 0) return;
    await this.throttleWrite();
    await this.request(
      'POST',
      `/docs/${this.docId}/tables/${encodeURIComponent(tableId)}/rows`,
      { rows, keyColumns },
    );
  }

  private async throttleWrite(): Promise<void> {
    const wait = this.lastWriteAt + this.minWriteIntervalMs - Date.now();
    if (wait > 0) await this.sleep(wait);
    this.lastWriteAt = Date.now();
  }

  private async request<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
    let attempt = 0;
    for (;;) {
      let response: Response;
      try {
        response = await this.fetchImpl(`${this.baseUrl}${path}`, {
          method,
          headers: {
            Authorization: `Bearer ${this.token}`,
            'Content-Type': 'application/json',
          },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
      } catch (err) {
        if (attempt >= this.maxRetries) throw err;
        await this.sleep(backoffMs(attempt));
        attempt += 1;
        continue;
      }

      if (response.ok) {
        const text = await response.text();
        return (text ? JSON.parse(text) : {}) as T;
      }

      const text = await response.text();
      const retryable = response.status === 429 || response.status >= 500;
      if (!retryable || attempt >= this.maxRetries) {
        throw new CodaApiError(
          `Coda API ${method} ${path} -> ${response.status}: ${text.slice(0, 500)}`,
          response.status,
          text,
        );
      }
      const delay = parseRetryAfterMs(response.headers.get('retry-after'), backoffMs(attempt));
      await this.sleep(delay);
      attempt += 1;
    }
  }
}
