/*
  One clock, one timezone (BE-D22). All "day" logic — daily credits, plan dates, reminders,
  business days — is Asia/Kolkata (UTC+05:30, no DST). Rules receive `now`; services call
  `now()`. Tests replace the clock with `setClock`.
*/
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

let clock: () => Date = () => new Date();

export const now = (): Date => clock();

/** Test hook. Pass nothing to restore the real clock. */
export function setClock(fn?: () => Date) {
  clock = fn ?? (() => new Date());
}

/** A date whose UTC fields read as the IST wall clock of `d`. Internal shifting trick. */
const shifted = (d: Date) => new Date(d.getTime() + IST_OFFSET_MS);

const pad = (n: number) => String(n).padStart(2, "0");

/** IST calendar date as `YYYY-MM-DD`. */
export function istDate(d: Date = now()): string {
  const s = shifted(d);
  return `${s.getUTCFullYear()}-${pad(s.getUTCMonth() + 1)}-${pad(s.getUTCDate())}`;
}

/** Instant of 00:00:00 IST on the IST date of `d`. */
export function startOfIstDay(d: Date = now()): Date {
  const s = shifted(d);
  return new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate()) - IST_OFFSET_MS);
}

/** Instant of 23:59:59 IST on the IST date of `d` (credit expiry, BE-D36). */
export function endOfIstDay(d: Date = now()): Date {
  return new Date(startOfIstDay(d).getTime() + DAY_MS - 1000);
}

/** Instant of 23:59:59 IST on the last day of the IST month of `d`. */
export function endOfIstMonth(d: Date = now()): Date {
  const s = shifted(d);
  const firstOfNext = Date.UTC(s.getUTCFullYear(), s.getUTCMonth() + 1, 1) - IST_OFFSET_MS;
  return new Date(firstOfNext - 1000);
}

/** Instant of 00:00:00 IST on the first day of the IST month of `d`. */
export function startOfIstMonth(d: Date = now()): Date {
  const s = shifted(d);
  return new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), 1) - IST_OFFSET_MS);
}

/** `YYYY-MM` in IST — the idempotency key of monthly grants. */
export const istMonth = (d: Date = now()) => istDate(d).slice(0, 7);

/** Whole IST calendar days from `from` to `to`. */
export function istDaysBetween(from: Date, to: Date): number {
  return Math.round((startOfIstDay(to).getTime() - startOfIstDay(from).getTime()) / DAY_MS);
}

/** Add calendar days (India has no DST, so a day is always 24 h). */
export function addIstDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * DAY_MS);
}

/** Mon–Fri. Public holidays are not excluded in MVP (BE-D22). */
export function isBusinessDay(d: Date): boolean {
  const dow = shifted(d).getUTCDay();
  return dow !== 0 && dow !== 6;
}

/** Add `n` business days (Mon–Fri) to `d`, keeping the time of day. */
export function addBusinessDays(d: Date, n: number): Date {
  let out = d;
  let left = n;
  while (left > 0) {
    out = addIstDays(out, 1);
    if (isBusinessDay(out)) left -= 1;
  }
  return out;
}

/** Whole years between a date of birth (`YYYY-MM-DD`) and `at`, by IST calendar date. */
export function ageOn(dob: string, at: Date = now()): number {
  const [y, m, d] = dob.split("-").map(Number);
  const today = shifted(at);
  const month = today.getUTCMonth() + 1;
  const before = month < m || (month === m && today.getUTCDate() < d);
  return today.getUTCFullYear() - y - (before ? 1 : 0);
}
