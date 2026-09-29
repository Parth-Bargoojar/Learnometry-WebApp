import "server-only";
import { getDb, type Tx } from "./connection";

/*
  The owner connection: BYPASSES Row Level Security (BE-D16). Allowed only in Inngest functions,
  webhooks, the credit ledger, content import and admin services after `requireAdmin()`.
  ESLint restricts imports of this file; every use is one transaction.
*/
export const system = <T>(fn: (tx: Tx) => Promise<T>): Promise<T> => getDb().transaction(fn);
