import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Storage abstraction for private files (source files, export packages).
 * Public previews will be served through the CDN separately (Phase 2).
 *
 * Drivers:
 *  - "fs": local disk, for development and tests. Downloads use HMAC-signed URLs served by our app.
 *  - "s3": any S3-compatible store (Cloudflare R2, AWS S3, MinIO). Downloads use presigned URLs.
 */

export interface PutResult {
  key: string;
  bytes: number;
  sha256: string;
}

export interface DownloadUrlOptions {
  /** Clamped to 60–3600 seconds. */
  expiresInSeconds?: number;
  /** Suggested filename for the browser's save dialog. */
  filename?: string;
}

export interface StorageDriver {
  readonly kind: "fs" | "s3";
  put(key: string, body: Uint8Array | string, opts?: { contentType?: string }): Promise<PutResult>;
  get(key: string): Promise<Uint8Array | null>;
  exists(key: string): Promise<boolean>;
  delete(key: string): Promise<void>;
  createDownloadUrl(key: string, opts?: DownloadUrlOptions): Promise<string>;
}

const KEY_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

/** Keys look like `brands/brd_x/assets/ast_y/v3/package.zip`. Rejects traversal and odd characters. */
export function validateKey(key: string): string {
  if (typeof key !== "string" || key.length === 0 || key.length > 512) throw new Error("Invalid storage key length");
  const segments = key.split("/");
  for (const s of segments) {
    if (!KEY_SEGMENT.test(s) || s === "." || s === ".." || s.includes("..")) {
      throw new Error(`Invalid storage key segment: "${s}"`);
    }
  }
  return key;
}

export function clampExpiry(seconds: number | undefined): number {
  return Math.min(Math.max(Math.floor(seconds ?? 300), 60), 3600);
}

/** RFC 6266 content-disposition with a safe ASCII fallback. */
export function contentDisposition(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

function toBuffer(body: Uint8Array | string): Buffer {
  return typeof body === "string" ? Buffer.from(body, "utf8") : Buffer.from(body);
}

// ─── Filesystem driver ───────────────────────────────────────────────────────

export interface FsDriverOptions {
  root: string;
  /** Absolute URL of the app route that serves signed downloads, e.g. http://localhost:3100/api/storage/download */
  downloadBaseUrl: string;
  signingSecret: string;
  now?: () => number;
}

function sign(secret: string, key: string, exp: number, filename: string): string {
  return createHmac("sha256", secret).update(`${key}\n${exp}\n${filename}`).digest("base64url");
}

export function createFsDriver(opts: FsDriverOptions): StorageDriver {
  if (!opts.signingSecret || opts.signingSecret.length < 32) {
    throw new Error("STORAGE_SIGNING_SECRET must be at least 32 characters");
  }
  const root = path.resolve(opts.root);
  const now = opts.now ?? Date.now;
  const fileFor = (key: string) => {
    const p = path.resolve(root, validateKey(key));
    if (!p.startsWith(root + path.sep)) throw new Error("Key escapes storage root");
    return p;
  };
  return {
    kind: "fs",
    async put(key, body, _o) {
      const buf = toBuffer(body);
      const p = fileFor(key);
      await mkdir(path.dirname(p), { recursive: true });
      await writeFile(p, buf);
      return { key, bytes: buf.length, sha256: createHash("sha256").update(buf).digest("hex") };
    },
    async get(key) {
      try {
        return new Uint8Array(await readFile(fileFor(key)));
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw e;
      }
    },
    async exists(key) {
      try {
        return (await stat(fileFor(key))).isFile();
      } catch {
        return false;
      }
    },
    async delete(key) {
      await rm(fileFor(key), { force: true });
    },
    async createDownloadUrl(key, o = {}) {
      validateKey(key);
      const exp = Math.floor(now() / 1000) + clampExpiry(o.expiresInSeconds);
      const filename = o.filename ?? path.basename(key);
      const url = new URL(opts.downloadBaseUrl);
      url.searchParams.set("key", key);
      url.searchParams.set("exp", String(exp));
      url.searchParams.set("fn", filename);
      url.searchParams.set("sig", sign(opts.signingSecret, key, exp, filename));
      return url.toString();
    },
  };
}

/** Verifies a URL created by the fs driver. Returns the key and filename if valid and unexpired. */
export function verifyFsDownload(
  params: URLSearchParams,
  signingSecret: string,
  now: () => number = Date.now,
): { key: string; filename: string } | null {
  const key = params.get("key");
  const exp = Number(params.get("exp"));
  const filename = params.get("fn") ?? "";
  const sig = params.get("sig") ?? "";
  if (!key || !Number.isFinite(exp)) return null;
  if (exp < Math.floor(now() / 1000)) return null;
  try {
    validateKey(key);
  } catch {
    return null;
  }
  const expected = Buffer.from(sign(signingSecret, key, exp, filename));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  return { key, filename };
}

// ─── S3-compatible driver ────────────────────────────────────────────────────

export interface S3DriverOptions {
  endpoint?: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Needed for MinIO and most S3-compatible stores; R2 works either way. */
  forcePathStyle?: boolean;
}

export function createS3Driver(opts: S3DriverOptions): StorageDriver {
  const client = new S3Client({
    endpoint: opts.endpoint,
    region: opts.region,
    forcePathStyle: opts.forcePathStyle ?? true,
    credentials: { accessKeyId: opts.accessKeyId, secretAccessKey: opts.secretAccessKey },
  });
  const Bucket = opts.bucket;
  const isNotFound = (e: unknown) => {
    const err = e as { name?: string; $metadata?: { httpStatusCode?: number } };
    return err.name === "NoSuchKey" || err.name === "NotFound" || err.$metadata?.httpStatusCode === 404;
  };
  return {
    kind: "s3",
    async put(key, body, o = {}) {
      const buf = toBuffer(body);
      const sha256 = createHash("sha256").update(buf).digest("hex");
      await client.send(
        new PutObjectCommand({
          Bucket,
          Key: validateKey(key),
          Body: buf,
          ContentType: o.contentType ?? "application/octet-stream",
          Metadata: { sha256 },
        }),
      );
      return { key, bytes: buf.length, sha256 };
    },
    async get(key) {
      try {
        const res = await client.send(new GetObjectCommand({ Bucket, Key: validateKey(key) }));
        return res.Body ? await res.Body.transformToByteArray() : new Uint8Array();
      } catch (e) {
        if (isNotFound(e)) return null;
        throw e;
      }
    },
    async exists(key) {
      try {
        await client.send(new HeadObjectCommand({ Bucket, Key: validateKey(key) }));
        return true;
      } catch (e) {
        if (isNotFound(e)) return false;
        throw e;
      }
    },
    async delete(key) {
      await client.send(new DeleteObjectCommand({ Bucket, Key: validateKey(key) }));
    },
    async createDownloadUrl(key, o = {}) {
      return getSignedUrl(
        client,
        new GetObjectCommand({
          Bucket,
          Key: validateKey(key),
          ResponseContentDisposition: contentDisposition(o.filename ?? path.basename(key)),
        }),
        { expiresIn: clampExpiry(o.expiresInSeconds) },
      );
    },
  };
}

// ─── Factory from environment ────────────────────────────────────────────────

export function createStorageFromEnv(env: NodeJS.ProcessEnv = process.env, downloadBaseUrl?: string): StorageDriver {
  const driver = env.STORAGE_DRIVER ?? "fs";
  if (driver === "s3") {
    const required = ["S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"] as const;
    for (const k of required) if (!env[k]) throw new Error(`${k} is required when STORAGE_DRIVER=s3`);
    return createS3Driver({
      endpoint: env.S3_ENDPOINT || undefined,
      region: env.S3_REGION ?? "auto",
      bucket: env.S3_BUCKET!,
      accessKeyId: env.S3_ACCESS_KEY_ID!,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
    });
  }
  if (driver === "fs") {
    return createFsDriver({
      root: env.STORAGE_FS_ROOT ?? ".data/storage",
      downloadBaseUrl: downloadBaseUrl ?? `${env.ADMIN_BASE_URL ?? "http://localhost:3100"}/api/storage/download`,
      signingSecret: env.STORAGE_SIGNING_SECRET ?? "",
    });
  }
  throw new Error(`Unknown STORAGE_DRIVER: ${driver}`);
}
