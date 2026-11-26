/**
 * Talks to a store's developer API (/api/v1/icons…). Searching is public; files need a license code that covers the icon.
 * A customer can own several licenses (one per purchase), so `files` tries each code until one covers the icon.
 */

export const SOURCE_FORMATS = ["react", "web-component", "svg-animated", "svg", "lottie", "json"] as const;
export type SourceFormat = (typeof SOURCE_FORMATS)[number];

export interface ProductRef {
  slug: string;
  title: string;
  free: boolean;
  url: string;
}

export interface IconCard {
  slug: string;
  name: string;
  description: string;
  tags: string[];
  category: string | null;
  hasSound: boolean;
  durationMs: number;
  previewUrl: string;
  products: ProductRef[];
}

export interface IconFiles {
  icon: { slug: string; name: string; version: number };
  format: SourceFormat;
  files: { path: string; content: string }[];
  needsPlayer: boolean;
  usage: string;
  license: { code: string; licenseType: string; productSlug: string; productTitle: string; notice: string; termsUrl: string };
}

export class StoreError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
    readonly products?: ProductRef[],
  ) {
    super(message);
  }
}

export class StoreClient {
  readonly origin: string;
  constructor(
    storeUrl: string,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly userAgent = "sevenbrands-cli",
  ) {
    const u = new URL(storeUrl);
    if (u.protocol !== "https:" && !/^(localhost|127\.0\.0\.1|.*\.localhost)$/.test(u.hostname)) throw new Error(`The store address must use https: ${storeUrl}`);
    this.origin = u.origin;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.origin}${path}`, { ...init, headers: { "user-agent": this.userAgent, accept: "application/json", ...(init.headers ?? {}) } });
    } catch (e) {
      throw new StoreError(`Couldn't reach ${this.origin} (${(e as Error).message}).`, "network", 0);
    }
    const body = (await res.json().catch(() => ({}))) as T & { error?: string; message?: string; products?: ProductRef[] };
    if (!res.ok) throw new StoreError(body.message ?? `Request failed (${res.status}).`, body.error ?? "http_error", res.status, body.products);
    return body;
  }

  async search(q: string, limit = 20): Promise<IconCard[]> {
    const r = await this.request<{ icons: IconCard[] }>(`/api/v1/icons?q=${encodeURIComponent(q)}&limit=${limit}`);
    return r.icons;
  }

  async get(slug: string): Promise<{ icon: IconCard; formats: SourceFormat[]; colors: Record<string, string> }> {
    return this.request(`/api/v1/icons/${encodeURIComponent(slug)}`);
  }

  async verify(code: string): Promise<{ valid: boolean; status: string; brand?: string; product?: string; licenseType?: string }> {
    return this.request(`/api/v1/licenses/verify?code=${encodeURIComponent(code)}`);
  }

  /** Tries each license code in turn; the first that covers the icon wins. */
  async files(slug: string, format: SourceFormat, codes: string[]): Promise<IconFiles> {
    if (!codes.length) throw new StoreError(`Adding icons needs a license code. Buy or claim the icon at ${this.origin}, then run "login <code>".`, "license_required", 401);
    let last: StoreError | undefined;
    for (const code of codes) {
      try {
        return await this.request<IconFiles>(`/api/v1/icons/${encodeURIComponent(slug)}/files`, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${code}` },
          body: JSON.stringify({ format }),
        });
      } catch (e) {
        if (!(e instanceof StoreError)) throw e;
        last = e;
        // Another license may cover it; anything else (rate limit, unknown icon, network) stops here.
        if (!["not_in_license", "invalid_license", "license_revoked"].includes(e.code)) throw e;
      }
    }
    throw last!;
  }
}
