import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/*
  Small, boring crypto helpers (BE-D21). AES-256-GCM for guardian contact at rest, SHA-256 for
  token storage, HMAC for OTPs. Keys come from the environment, never from code.
*/

const b64url = (b: Buffer) => b.toString("base64url");

/** 32 random bytes as base64url: consent and invite tokens. Only the hash is stored. */
export const newToken = () => b64url(randomBytes(32));

export const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

/** HMAC-SHA256 hex, e.g. of a 6-digit OTP with CONSENT_TOKEN_SECRET. */
export const hmac = (value: string, secret: string) => createHmac("sha256", secret).update(value).digest("hex");

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** A 6-digit numeric OTP, uniformly random. */
export function newOtp(): string {
  const n = randomBytes(4).readUInt32BE(0) % 1_000_000;
  return String(n).padStart(6, "0");
}

function keyFrom(base64Key: string): Buffer {
  const key = Buffer.from(base64Key, "base64");
  if (key.length !== 32) throw new Error("PII_ENCRYPTION_KEY must be 32 bytes, base64-encoded");
  return key;
}

/** `v1.<iv>.<tag>.<ciphertext>`, all base64url. */
export function encrypt(plain: string, base64Key: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFrom(base64Key), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", b64url(iv), b64url(cipher.getAuthTag()), b64url(ct)].join(".");
}

export function decrypt(payload: string, base64Key: string): string {
  const [version, iv, tag, ct] = payload.split(".");
  if (version !== "v1" || !iv || !tag || !ct) throw new Error("Unrecognised ciphertext");
  const decipher = createDecipheriv("aes-256-gcm", keyFrom(base64Key), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ct, "base64url")), decipher.final()]).toString("utf8");
}
