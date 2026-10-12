import { afterAll, describe, expect, it } from "vitest";
import { cleanupUnverifiedAccounts, accountsDueForErasure, eraseAccount, requestAccountDeletion, resolveDeletionAtSignIn } from "@/domains/identity/service";
import { cleanupUsers, createUser, pg, supabaseAdmin } from "./helpers";

/*
  Account lifecycle (BE-2.5, BE-D58): request deletion → cancel by signing in within 48 h →
  erase on the due date, keeping payments minimised; and the 7-day unverified clean-up.
  Times are injected, so nothing here waits.
*/

afterAll(async () => {
  await cleanupUsers();
});

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

describe("account deletion", () => {
  it("deactivates, records the request, and a sign-in inside 48 h cancels it", async () => {
    const u = await createUser();
    const at = new Date();
    const req = await requestAccountDeletion(u.id, at);
    expect(req.cancellableUntil.getTime() - at.getTime()).toBe(48 * HOUR);
    expect(req.eraseBy.getTime()).toBeGreaterThan(req.cancellableUntil.getTime());

    const [row] = await pg<{ status: string }[]>`select status from public.users where id = ${u.id}`;
    expect(row.status).toBe("deletion_pending");
    const [dr] = await pg<{ n: number }[]>`select count(*)::int as n from public.data_requests where user_id = ${u.id} and request_type = 'erasure' and status = 'requested'`;
    expect(dr.n).toBe(1);

    // Asking twice does not create a second request.
    await requestAccountDeletion(u.id, at);
    const [again] = await pg<{ n: number }[]>`select count(*)::int as n from public.data_requests where user_id = ${u.id} and request_type = 'erasure'`;
    expect(again.n).toBe(1);

    expect(await resolveDeletionAtSignIn(u.id, new Date(at.getTime() + 47 * HOUR))).toBe("cancelled");
    const [after] = await pg<{ status: string; deactivated_at: Date | null }[]>`select status, deactivated_at from public.users where id = ${u.id}`;
    expect(after).toEqual({ status: "active", deactivated_at: null });
    const [cancelled] = await pg<{ status: string }[]>`select status from public.data_requests where user_id = ${u.id} and request_type = 'erasure'`;
    expect(cancelled.status).toBe("cancelled");
    expect(await eraseAccount(u.id, new Date(at.getTime() + 30 * DAY))).toBe("not_pending");
  });

  it("blocks sign-in after 48 h and refuses to erase before the due date", async () => {
    const u = await createUser();
    const at = new Date();
    const req = await requestAccountDeletion(u.id, at);

    expect(await resolveDeletionAtSignIn(u.id, new Date(at.getTime() + 49 * HOUR))).toBe("blocked");
    expect(await eraseAccount(u.id, new Date(req.eraseBy.getTime() - 1000))).toBe("not_due");
    expect(await accountsDueForErasure(new Date(req.eraseBy.getTime() - 1000))).not.toContain(u.id);
    expect(await accountsDueForErasure(req.eraseBy)).toContain(u.id);
  });

  it("erases everything of the learner, keeps a minimised payment, and is safe to repeat", async () => {
    const u = await createUser();
    const at = new Date();
    const req = await requestAccountDeletion(u.id, at);
    await pg`
      insert into public.payments (learner_id, payer_user_id, provider_payment_id, item_type, item_code, amount_inr, status, metadata)
      values (${u.learnerId}, ${u.id}, ${`pay_${u.id}`}, 'credit_pack', 'pack_small', 199, 'captured', ${JSON.stringify({ name: "Ava", phone: "9999999999" })}::jsonb)`;

    expect(await eraseAccount(u.id, req.eraseBy)).toBe("erased");

    const [gone] = await pg<{ n: number }[]>`select (select count(*) from auth.users where id = ${u.id})::int + (select count(*) from public.users where id = ${u.id})::int + (select count(*) from public.learners where id = ${u.learnerId}) ::int as n`;
    expect(gone.n).toBe(0);
    const [credit] = await pg<{ n: number }[]>`select count(*)::int as n from public.credit_accounts where learner_id = ${u.learnerId}`;
    expect(credit.n).toBe(0);

    const [pay] = await pg<{ learner_id: string | null; payer_user_id: string | null; amount_inr: number; metadata: unknown }[]>`
      select learner_id, payer_user_id, amount_inr, metadata from public.payments where provider_payment_id = ${`pay_${u.id}`}`;
    expect(pay).toEqual({ learner_id: null, payer_user_id: null, amount_inr: 199, metadata: { erased: true } });

    const [audit] = await pg<{ n: number }[]>`select count(*)::int as n from public.audit_logs where action = 'account.erased' and resource_id = ${u.id}`;
    expect(audit.n).toBe(1);

    expect(await eraseAccount(u.id, req.eraseBy)).toBe("not_pending");
    await pg`delete from public.payments where provider_payment_id = ${`pay_${u.id}`}`;
  });

  it("never lets an admin request deletion", async () => {
    const admin = await createUser();
    await pg`update public.users set role = 'admin' where id = ${admin.id}`;
    await expect(requestAccountDeletion(admin.id)).rejects.toMatchObject({ code: "forbidden" });
  });
});

describe("unverified sign-up clean-up", () => {
  it("removes sign-ups unconfirmed for over seven days and leaves recent and confirmed ones", async () => {
    const mk = async () => {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: `unv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@test.learnometry.local`,
        password: "Passw0rd-test-only",
        email_confirm: false,
      });
      if (error || !data.user) throw new Error(error?.message);
      return data.user.id;
    };
    const old = await mk();
    const recent = await mk();
    const confirmedOld = (await createUser()).id;
    await pg`update auth.users set created_at = now() - interval '8 days' where id in (${old}, ${confirmedOld})`;

    const removed = await cleanupUnverifiedAccounts();
    expect(removed).toBeGreaterThanOrEqual(1);

    const rows = await pg<{ id: string }[]>`select id from auth.users where id in (${old}, ${recent}, ${confirmedOld})`;
    const ids = rows.map((r) => r.id);
    expect(ids).not.toContain(old);
    expect(ids).toContain(recent);
    expect(ids).toContain(confirmedOld);
    await supabaseAdmin.auth.admin.deleteUser(recent);
  });
});
