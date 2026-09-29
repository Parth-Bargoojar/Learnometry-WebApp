import { sql, type SQL } from "drizzle-orm";
import { check, pgPolicy, timestamp, uuid, type AnyPgColumn } from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";

/*
  Schema conventions (BE-D15, BE-D70):
    · UUID primary keys, timestamptz in UTC, snake_case.
    · Closed value sets are `text` + CHECK (not Postgres enums), so adding a value is a
      one-line migration instead of an ALTER TYPE.
    · Row Level Security is enabled on every table. The app connects as the owner for
      `db.system` (bypasses RLS) and switches to `authenticated` for `db.asUser` (RLS applies).
      Policies read the caller through `private.*` helpers (migration 0 / 2) and default to deny.
*/

export const pk = () => uuid("id").primaryKey().defaultRandom();

export const createdAt = () => timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow();
export const updatedAt = () => timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow();
export const tstz = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

/** `column IN ('a','b',…)` as a named CHECK. */
export function oneOf(name: string, column: AnyPgColumn, values: readonly string[]) {
  const list = sql.join(
    values.map((v) => sql`${sql.raw(`'${v.replace(/'/g, "''")}'`)}`),
    sql`, `,
  );
  return check(name, sql`${column} in (${list})`);
}

/** Read-only policy for the signed-in learner's own rows. `learnerColumn` is the SQL name of the FK. */
export function ownRowsPolicy(table: string, learnerColumn = "learner_id", forCmd: "select" | "all" = "select") {
  return pgPolicy(`${table}_own_${forCmd}`, {
    for: forCmd,
    to: authenticatedRole,
    using: sql.raw(`${learnerColumn} = (select private.current_learner_id())`),
    ...(forCmd === "all" ? { withCheck: sql.raw(`${learnerColumn} = (select private.current_learner_id())`) } : {}),
  });
}

/** Policy on the signed-in user's own rows (`user_id`-keyed tables). */
export function ownUserPolicy(table: string, userColumn = "user_id", forCmd: "select" | "all" | "insert" | "update" | "delete" = "select") {
  const expr = sql.raw(`${userColumn} = (select auth.uid())`);
  return pgPolicy(`${table}_own_${forCmd}`, {
    for: forCmd,
    to: authenticatedRole,
    ...(forCmd === "insert" ? {} : { using: expr }),
    ...(forCmd === "select" || forCmd === "delete" ? {} : { withCheck: expr }),
  });
}

/** Reference data anyone signed in may read. */
export function readableByAuthenticated(table: string, using: SQL = sql.raw("true")) {
  return pgPolicy(`${table}_read`, { for: "select", to: authenticatedRole, using });
}
