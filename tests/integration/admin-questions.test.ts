import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getAdminQuestion, listAdminQuestions, transitionQuestions } from "@/domains/content/admin";
import { importContent } from "@/domains/content/import";
import { runLlmValidators } from "@/domains/content/llm-validation";
import { questionSchema, type ConceptFile } from "@/domains/content/schema";
import { cleanupUsers, createUser, db, pg } from "./helpers";

/* Admin question operations (BE-3.4, K2, K6): lifecycle, skipped reasons, audit. */

const SLUG = "zz-test-adm-01";
const file = (stem = "A $1\\,\\text{kg}$ mass is pulled with $10$ N. What is $a$?"): ConceptFile => ({
  path: "physics/laws-of-motion/fbd.yaml",
  concept: "fbd",
  items: [
    questionSchema.parse({
      id: SLUG,
      tracks: ["jee_main"],
      type: "mcq",
      difficulty: "easy",
      expected_seconds: 60,
      pool: "practice",
      stem,
      options: [{ key: "A", text: "$5$" }, { key: "B", text: "$10$" }],
      answer: "B",
      solution: ["$a = F/m = 10$."],
    }),
  ],
});

let admin: { userId: string; role: string };
let id: string;
const REASON = "Checked against the NCERT worked example.";
const act = (action: "review" | "publish" | "suspend", ids = [id], reason = REASON) => db.transaction((tx) => transitionQuestions(tx, admin, { action, ids, reason }));
const detail = () => db.transaction((tx) => getAdminQuestion(tx, id));
const audit = (action: string) => pg<{ reason: string; actor_user_id: string }[]>`select reason, actor_user_id from audit_logs where resource_type = 'question' and resource_id = ${id} and action = ${action}`;

beforeAll(async () => {
  const a = await createUser();
  await pg`update public.users set role = 'admin' where id = ${a.id}`;
  admin = { userId: a.id, role: "admin" };
  await pg`delete from questions where slug = ${SLUG}`;
  await importContent(db, [file()]);
  [{ id }] = await pg<{ id: string }[]>`select id from questions where slug = ${SLUG}`;
  await db.transaction((tx) => runLlmValidators(tx, id, 1));
});
afterAll(async () => {
  await pg`delete from audit_logs where resource_id = ${id}`;
  await pg`delete from questions where slug = ${SLUG}`;
  await cleanupUsers();
});

describe("question lifecycle", () => {
  it("starts validated, with semantic checks as pending warnings", async () => {
    const q = (await detail())!;
    expect(q.status).toBe("validated");
    expect(q.validations.schema.result).toBe("pass");
    expect(q.validations.semantic).toMatchObject({ result: "warning", note: expect.stringContaining("Not run") });
    expect(q.validations.human.result).toBe("pending");
  });

  it("cannot be published before a person reviews it", async () => {
    const r = await act("publish");
    expect(r.done).toEqual([]);
    expect(r.skipped).toEqual([{ id, reason: expect.stringContaining("Needs a human review") }]);
    expect((await detail())!.status).toBe("validated");
  });

  it("is reviewed, then published; each step is audited with the reason and the actor", async () => {
    expect((await act("review")).done).toEqual([id]);
    expect((await detail())!).toMatchObject({ status: "reviewed", validations: { human: { result: "pass" } } });
    expect((await act("publish")).done).toEqual([id]);
    expect((await detail())!.status).toBe("published");
    expect(await audit("question.reviewed")).toEqual([{ reason: REASON, actor_user_id: admin.userId }]);
    expect(await audit("question.published")).toHaveLength(1);
  });

  it("reviewing twice or publishing a published item is skipped, not an error", async () => {
    expect((await act("review")).skipped[0].reason).toMatch(/past review/);
    expect((await act("publish")).skipped[0].reason).toMatch(/Already published/);
  });

  it("is listed with filters and suspends only when published", async () => {
    const list = await db.transaction((tx) => listAdminQuestions(tx, { exam: "jee_main", status: "published" }));
    expect(list.map((q) => q.slug)).toContain(SLUG);
    expect((await db.transaction((tx) => listAdminQuestions(tx, { status: "draft" }))).map((q) => q.slug)).not.toContain(SLUG);

    expect((await act("suspend", [id], "Two learners reported the stem is ambiguous.")).done).toEqual([id]);
    const q = (await detail())!;
    expect(q.status).toBe("suspended");
    expect(q.statusNote).toBe("Two learners reported the stem is ambiguous.");
    expect((await act("suspend")).skipped[0].reason).toMatch(/Suspended, not published/);
  });

  it("goes back to review when the content changes, and a suspended item can be published again only after that", async () => {
    await importContent(db, [file("A $2\\,\\text{kg}$ mass is pulled with $10$ N. What is $a$?")]);
    const q = (await detail())!;
    expect(q.versionNumber).toBe(2);
    expect(q.status).toBe("validated");
    expect(q.validations.human.result).toBe("pending");
    expect((await act("publish")).skipped).toHaveLength(1);
  });
});

describe("guards", () => {
  it("requires a written reason and a sensible batch", async () => {
    await expect(act("review", [id], "too short")).rejects.toMatchObject({ code: "validation_failed" });
    await expect(act("review", [])).rejects.toMatchObject({ code: "validation_failed" });
  });

  it("reports ids that do not exist", async () => {
    const r = await act("review", ["00000000-0000-4000-8000-000000000000"]);
    expect(r).toEqual({ done: [], skipped: [{ id: "00000000-0000-4000-8000-000000000000", reason: "Not found." }] });
  });

  it("returns nothing for a malformed id", async () => {
    expect(await db.transaction((tx) => getAdminQuestion(tx, "not-a-uuid"))).toBeNull();
  });
});
