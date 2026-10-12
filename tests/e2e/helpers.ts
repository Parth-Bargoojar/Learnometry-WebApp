import { createHmac } from "node:crypto";
import { config } from "dotenv";
import postgres from "postgres";
import { expect, type Page } from "@playwright/test";

config({ path: ".env.local", quiet: true });

/** Remove the seed admin's authenticator so the enrolment journey can run again. */
export async function resetAdminMfa() {
  const sql = postgres(process.env.DIRECT_DATABASE_URL!, { max: 1, prepare: false });
  try {
    await sql`delete from auth.mfa_factors where user_id = (select id from auth.users where email = 'admin@seed.learnometry.test')`;
  } finally {
    await sql.end({ timeout: 2 });
  }
}

/* Helpers shared by the E2E journeys: mail from Mailpit, TOTP codes, and small form fillers. */

const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

export const uniqueEmail = (tag = "e2e") => `${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@test.learnometry.local`;
export const PASSWORD = "Correct-horse-9";

interface MailSummary {
  ID: string;
  Subject: string;
  Created: string;
}

/** The newest message to `email` whose subject matches, waiting for it to arrive. */
export async function waitForMail(email: string, subject: RegExp, timeoutMs = 20_000): Promise<{ html: string; text: string }> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`);
    if (res.ok) {
      const body = (await res.json()) as { messages: MailSummary[] };
      const hit = body.messages.find((m) => subject.test(m.Subject));
      if (hit) {
        const full = (await (await fetch(`${MAILPIT}/api/v1/message/${hit.ID}`)).json()) as { HTML: string; Text: string };
        return { html: full.HTML, text: full.Text };
      }
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`No mail to ${email} matching ${subject} within ${timeoutMs} ms`);
}

/** The first link in a mail that points at our /auth/confirm route. */
export function confirmLink(mail: { html: string; text: string }): string {
  const m = /https?:\/\/[^\s"'<>]+\/auth\/confirm\?[^\s"'<>]+/.exec(mail.html) ?? /https?:\/\/[^\s"'<>]+\/auth\/confirm\?[^\s"'<>]+/.exec(mail.text);
  if (!m) throw new Error("No /auth/confirm link in mail");
  return m[0].replace(/&amp;/g, "&");
}

/** RFC 6238 TOTP (SHA-1, 6 digits, 30 s) from a base32 secret. */
export function totp(secretBase32: string, at = Date.now()): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const ch of secretBase32.replace(/=+$/, "").toUpperCase()) bits += alphabet.indexOf(ch).toString(2).padStart(5, "0");
  const bytes = Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 1000 / 30)));
  const h = createHmac("sha1", bytes).update(counter).digest();
  const off = h[h.length - 1] & 0xf;
  const code = ((h[off] & 0x7f) << 24) | (h[off + 1] << 16) | (h[off + 2] << 8) | h[off + 3];
  return String(code % 1_000_000).padStart(6, "0");
}

/** Resolve once the 30 s TOTP window containing `usedAt` is over (codes are single-use per window). */
export async function waitForNextTotpWindow(usedAt: number) {
  const nextStart = (Math.floor(usedAt / 30_000) + 1) * 30_000;
  const wait = nextStart - Date.now() + 500;
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
}

export async function logIn(page: Page, email: string, password = PASSWORD) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
}

/** Sign up through the UI and open the emailed confirmation link. Lands wherever the link sends a new learner. */
export async function signUpAndConfirm(page: Page, name = "Test Student") {
  const email = uniqueEmail();
  await page.goto("/signup");
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByLabel(/I agree to the/).check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Check your inbox" })).toBeVisible();
  const mail = await waitForMail(email, /Confirm your Learnometry email/);
  await page.goto(confirmLink(mail));
  return email;
}

/** Fill the "About you" step. */
export async function fillAboutYou(page: Page, dob: { day: string; month: string; year: string }, cls?: string) {
  await page.getByLabel("Day").selectOption(dob.day);
  await page.getByLabel("Month").selectOption(dob.month);
  await page.getByLabel("Year").selectOption(dob.year);
  if (cls) await page.getByText(cls, { exact: true }).click();
  await page.getByRole("button", { name: /Continue/ }).click();
}
