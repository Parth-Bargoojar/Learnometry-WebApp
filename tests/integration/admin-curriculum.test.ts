import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { discardDraft, getCurriculum, publishDraft, saveDraft } from "@/domains/curriculum/admin";
import { findCycle } from "@/domains/curriculum/rules";
import { cleanupUsers, createUser, db, pg } from "./helpers";

/* Curriculum draft and publish (BE-3.5, K7): live cycle check, reason, version bump, audit. */

const EXAM = "cbse_11"; // the test edits a track the other suites do not read
let actor: { userId: string; role: string };
const tx = <T>(fn: Parameters<typeof db.transaction<T>>[0]) => db.transaction(fn);
const view = () => tx((t) => getCurriculum(t, EXAM));
const edgeCount = async () => (await pg<{ n: number }[]>`select count(*)::int as n from concept_edges e join concepts c on c.id = e.from_concept_id join exams x on x.id = c.exam_id where x.code = ${EXAM}`)[0].n;

beforeAll(async () => {
  const a = await createUser();
  await pg`update public.users set role = 'admin' where id = ${a.id}`;
  actor = { userId: a.id, role: "admin" };
  await tx((t) => discardDraft(t, EXAM));
});
afterAll(async () => {
  await tx((t) => discardDraft(t, EXAM));
  // Put the track's graph and versions back exactly as seeded.
  await pg`delete from concept_edges where from_concept_id in (select id from concepts where exam_id = (select id from exams where code = ${EXAM}))
    and (select code from concepts where id = from_concept_id) = 'power' and (select code from concepts where id = to_concept_id) = 'fbd'`;
  await pg`delete from curriculum_versions where exam_id = (select id from exams where code = ${EXAM}) and version_number > 1`;
  await pg`update curriculum_versions set status = 'published', reason = 'Initial seed', published_by = null, snapshot = null
    where exam_id = (select id from exams where code = ${EXAM}) and version_number = 1`;
  await pg`delete from audit_logs where action = 'curriculum.published' and actor_user_id = ${actor.userId}`;
  await cleanupUsers();
});

describe("curriculum view", () => {
  it("shows the seeded tree, weights, counts and an acyclic published graph", async () => {
    const v = await view();
    expect(v).toMatchObject({ examCode: EXAM, publishedVersion: 1, draft: null });
    const codes = v.chapters.flatMap((c) => c.topics.flatMap((t) => t.concepts.map((x) => x.code)));
    expect(codes).toEqual(expect.arrayContaining(["resolution", "friction", "work-energy", "power"]));
    expect(findCycle(v.edges)).toBeNull();
    expect(v.edges).toContainEqual({ from: "resolution", to: "friction" });
  });
});

describe("draft", () => {
  it("refuses a loop, a self edge and an unknown concept, with the reason", async () => {
    const { edges } = await view();
    await expect(tx((t) => saveDraft(t, actor, EXAM, [...edges, { from: "friction", to: "resolution" }]))).rejects.toMatchObject({ code: "validation_failed", message: expect.stringContaining("loop") });
    await expect(tx((t) => saveDraft(t, actor, EXAM, [...edges, { from: "fbd", to: "fbd" }]))).rejects.toMatchObject({ message: expect.stringContaining("own prerequisite") });
    await expect(tx((t) => saveDraft(t, actor, EXAM, [...edges, { from: "fbd", to: "nope" }]))).rejects.toMatchObject({ message: expect.stringContaining("Unknown concept") });
    expect((await view()).draft).toBeNull();
  });

  it("stores the change as a draft without touching the published graph", async () => {
    const { edges } = await view();
    const before = await edgeCount();
    expect(await tx((t) => saveDraft(t, actor, EXAM, [...edges, { from: "power", to: "fbd" }]))).toEqual({ changes: 1 });
    expect(await edgeCount()).toBe(before);
    const v = await view();
    expect(v.draft).toContainEqual({ from: "power", to: "fbd" });
    expect(v.edges).not.toContainEqual({ from: "power", to: "fbd" });
  });

  it("clears the draft when the edits come back to the published graph", async () => {
    const { edges } = await view();
    expect(await tx((t) => saveDraft(t, actor, EXAM, edges))).toEqual({ changes: 0 });
    expect((await view()).draft).toBeNull();
  });
});

describe("publish", () => {
  it("needs a draft and a written reason", async () => {
    await expect(tx((t) => publishDraft(t, actor, EXAM, "A long enough reason."))).rejects.toMatchObject({ code: "conflict" });
    const { edges } = await view();
    await tx((t) => saveDraft(t, actor, EXAM, [...edges, { from: "power", to: "fbd" }]));
    await expect(tx((t) => publishDraft(t, actor, EXAM, "short"))).rejects.toMatchObject({ code: "validation_failed" });
  });

  it("applies the edges as the next version, supersedes the old one and writes the audit row", async () => {
    const before = await edgeCount();
    const result = await tx((t) => publishDraft(t, actor, EXAM, "Power now depends on free-body diagrams."));
    expect(result).toEqual({ version: 2, added: 1, removed: 0 });
    expect(await edgeCount()).toBe(before + 1);

    const v = await view();
    expect(v).toMatchObject({ publishedVersion: 2, draft: null });
    expect(v.edges).toContainEqual({ from: "power", to: "fbd" });
    const versions = await pg<{ version_number: number; status: string }[]>`
      select version_number, status from curriculum_versions where exam_id = (select id from exams where code = ${EXAM}) order by 1`;
    expect(versions).toEqual([{ version_number: 1, status: "superseded" }, { version_number: 2, status: "published" }]);
    const [audit] = await pg<{ reason: string; metadata: { exam: string; version: string } }[]>`
      select reason, metadata from audit_logs where action = 'curriculum.published' and actor_user_id = ${actor.userId}`;
    expect(audit.reason).toBe("Power now depends on free-body diagrams.");
    expect(audit.metadata).toMatchObject({ exam: EXAM, version: "v2" });
  });

  it("can remove an edge in the next version, and the graph stays acyclic", async () => {
    const { edges } = await view();
    await tx((t) => saveDraft(t, actor, EXAM, edges.filter((e) => !(e.from === "power" && e.to === "fbd"))));
    expect(await tx((t) => publishDraft(t, actor, EXAM, "Reverting the dependency."))).toEqual({ version: 3, added: 0, removed: 1 });
    expect(findCycle((await view()).edges)).toBeNull();
  });
});
