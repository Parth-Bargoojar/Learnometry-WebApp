/*
  Pure helpers over ISO dates ("2026-09-27") read as IST calendar days. No clock and no
  sample data, so rules and the UI share them. Hand-formatted: ICU data differs between
  Node and browsers ("Sep" vs "Sept"), which would cause hydration mismatches.
*/
const DAY = 86_400_000;
const parse = (iso: string) => new Date(`${iso}T00:00:00+05:30`);

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

/** "14 Mar 2027" */
export const fullDate = (iso: string) => {
  const d = ist(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};

export const weekday = (iso: string) => DAYS[ist(iso).getUTCDay()];

export const daysBetween = (fromIso: string, toIso: string) => Math.round((parse(toIso).getTime() - parse(fromIso).getTime()) / DAY);
