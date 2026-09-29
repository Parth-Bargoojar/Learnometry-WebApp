import { describe, expect, it } from "vitest";
import { decrypt, encrypt, hmac, newOtp, newToken, safeEqual, sha256 } from "./crypto";

const key = Buffer.alloc(32, 7).toString("base64");

describe("crypto helpers", () => {
  it("round-trips and never repeats a ciphertext", () => {
    const a = encrypt("sunita@example.com", key);
    expect(a).not.toContain("sunita");
    expect(decrypt(a, key)).toBe("sunita@example.com");
    expect(encrypt("sunita@example.com", key)).not.toBe(a);
  });

  it("rejects a wrong key, a tampered payload and a short key", () => {
    const enc = encrypt("secret", key);
    expect(() => decrypt(enc, Buffer.alloc(32, 9).toString("base64"))).toThrow();
    const parts = enc.split(".");
    parts[3] = parts[3].slice(0, -2) + (parts[3].endsWith("AA") ? "BB" : "AA");
    expect(() => decrypt(parts.join("."), key)).toThrow();
    expect(() => decrypt("v2.a.b.c", key)).toThrow("Unrecognised");
    expect(() => encrypt("x", Buffer.alloc(8).toString("base64"))).toThrow("32 bytes");
  });

  it("makes url-safe unique tokens, stable hashes, 6-digit OTPs", () => {
    const t = newToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(newToken()).not.toBe(t);
    expect(sha256("a")).toBe(sha256("a"));
    expect(sha256("a")).toHaveLength(64);
    for (let i = 0; i < 50; i++) expect(newOtp()).toMatch(/^\d{6}$/);
  });

  it("hmacs with the secret and compares in constant time", () => {
    expect(hmac("123456", "s1")).not.toBe(hmac("123456", "s2"));
    expect(safeEqual(hmac("1", "s"), hmac("1", "s"))).toBe(true);
    expect(safeEqual("a", "ab")).toBe(false);
    expect(safeEqual("abc", "abd")).toBe(false);
  });
});
