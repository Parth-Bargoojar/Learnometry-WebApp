import "server-only";
import { adminUser } from "./admin-data";

/**
 * Admin gate (K1). Production: read the Supabase session on the server, require
 * `users.role = 'admin'` and a 2FA-verified session (AAL2), and call `notFound()`
 * otherwise, so the console's existence isn't revealed to learners. Every admin
 * API route repeats the check (TRD §7.3); this layout gate is only the first line.
 * The sample build has no auth yet, so it returns the sample operator.
 */
export async function requireAdmin() {
  return adminUser;
}
