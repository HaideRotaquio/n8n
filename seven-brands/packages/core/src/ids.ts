import { randomBytes } from "node:crypto";

/**
 * Prefixed, time-sortable identifiers (ULID layout: 48-bit ms timestamp + 80 bits of randomness,
 * Crockford base32). Example: `brd_01JD3K6Q9W8X2Y4Z6A8B0C2D4E`.
 */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export const ID_PREFIXES = {
  organization: "org",
  brand: "brd",
  user: "usr",
  role: "rol",
  customer: "cus",
  audit: "aud",
} as const;

export type IdPrefix = (typeof ID_PREFIXES)[keyof typeof ID_PREFIXES];

function encodeTime(ms: number): string {
  let out = "";
  let t = ms;
  for (let i = 0; i < 10; i++) {
    out = ALPHABET[t % 32] + out;
    t = Math.floor(t / 32);
  }
  return out;
}

function encodeRandom(): string {
  const bytes = randomBytes(16);
  let out = "";
  for (let i = 0; i < 16; i++) out += ALPHABET[bytes[i]! % 32];
  return out;
}

export function ulid(now: number = Date.now()): string {
  return encodeTime(now) + encodeRandom();
}

export function newId(prefix: IdPrefix | string, now?: number): string {
  if (!/^[a-z]{2,5}$/.test(prefix)) throw new Error(`Invalid id prefix: ${prefix}`);
  return `${prefix}_${ulid(now)}`;
}

export function isId(value: unknown, prefix?: string): value is string {
  if (typeof value !== "string") return false;
  const m = /^([a-z]{2,5})_([0-9A-HJKMNP-TV-Z]{26})$/.exec(value);
  return !!m && (prefix === undefined || m[1] === prefix);
}
