import { TODAY } from "./data";

const DAY = 86_400_000;
const parse = (iso: string) => new Date(`${iso}T00:00:00+05:30`);

// Formatted by hand: ICU data differs between Node and browsers ("Sep" vs "Sept"),
// which would also cause hydration mismatches.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ist = (iso: string) => new Date(parse(iso).getTime() + 5.5 * 3_600_000);

/** "Sun 27 Sep" */
export const shortDate = (iso: string) => {
  const d = ist(iso);
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
};

/** "27 Sep" */
export const dayMonth = (iso: string) => {
  const d = ist(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
};

export const weekday = (iso: string) => DAYS[ist(iso).getUTCDay()];

export const daysBetween = (fromIso: string, toIso: string) => Math.round((parse(toIso).getTime() - parse(fromIso).getTime()) / DAY);

export const daysFromToday = (iso: string) => daysBetween(TODAY, iso);

/** "Today", "Tomorrow", "Fri 3 Oct" */
export function relativeDay(iso: string) {
  const d = daysFromToday(iso);
  if (d === 0) return "Today";
  if (d === 1) return "Tomorrow";
  if (d === -1) return "Yesterday";
  return shortDate(iso);
}

/** "2 days ago" style for last-practiced labels. */
export function ago(iso: string | null) {
  if (!iso) return "Not yet";
  const d = -daysFromToday(iso);
  if (d <= 0) return "Today";
  if (d === 1) return "Yesterday";
  return `${d} days ago`;
}

/** 1630 → "27:10" */
export const clock = (seconds: number) => {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** 160 → "2m 40s" */
export const duration = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (!m) return `${s}s`;
  return s ? `${m}m ${s}s` : `${m}m`;
};

export const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0");
