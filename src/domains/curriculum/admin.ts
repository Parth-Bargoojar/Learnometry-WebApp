import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { Tx } from "@/lib/db/connection";
import * as s from "@/lib/db/schema";
import { AppError } from "@/lib/errors/app-error";
import { reasonError, type Edge } from "@/domains/admin/rules";
import { applyDiff, diffEdges, edgeKey, graphProblems, versionLabel } from "./rules";
import type { CurriculumChapter, CurriculumView } from "./types";

/*
  Curriculum draft and publish (BE-3.5, K7). A draft stores only the difference from the published
  graph, so it cannot drift. Publishing applies it to `concept_edges`, snapshots the result and
  supersedes the previous version, in one transaction with the audit row. Plans keep the version
  they were built on (BE-8); nothing here rewrites a plan.
*/

type Actor = { userId: string; role: string };
type Stored = { added?: Edge[]; removed?: Edge[] };

async function examBy(tx: Tx, code: string) {
  const [exam] = await tx.select().from(s.exams).where(eq(s.exams.code, code));
  if (!exam) throw new AppError("not_found", { message: "Unknown exam track." });
  return exam;
}

async function publishedEdges(tx: Tx, examId: string): Promise<Edge[]> {
  const rows = (await tx.execute(sql`
    select f.code as "from", t.code as "to"
    from public.concept_edges e
    join public.concepts f on f.id = e.from_concept_id
    join public.concepts t on t.id = e.to_concept_id
    where f.exam_id = ${examId} and t.exam_id = ${examId} and e.edge_type = 'prerequisite'
    order by 1, 2`)) as unknown as Edge[];
  return rows.map((r) => ({ from: r.from, to: r.to }));
}

export async function getCurriculum(tx: Tx, examCode: string): Promise<CurriculumView> {
  const exam = await examBy(tx, examCode);
  const [published] = await tx
    .select()
    .from(s.curriculumVersions)
    .where(and(eq(s.curriculumVersions.examId, exam.id), eq(s.curriculumVersions.status, "published")))
    .orderBy(desc(s.curriculumVersions.versionNumber))
    .limit(1);
  const [draft] = await tx.select().from(s.curriculumVersions).where(and(eq(s.curriculumVersions.examId, exam.id), eq(s.curriculumVersions.status, "draft")));
  const edges = await publishedEdges(tx, exam.id);

  const counts = (await tx.execute(sql`
    select concept_id as id, count(*)::int as n from public.questions
    where exam_id = ${exam.id} and validation_status = 'published' group by 1`)) as unknown as { id: string; n: number }[];
  const published_ = new Map(counts.map((c) => [c.id, c.n]));

  const rows = await tx
    .select({ chapter: s.chapters, topic: s.topics, concept: s.concepts })
    .from(s.concepts)
    .innerJoin(s.topics, eq(s.topics.id, s.concepts.topicId))
    .innerJoin(s.chapters, eq(s.chapters.id, s.topics.chapterId))
    .where(eq(s.concepts.examId, exam.id))
    .orderBy(asc(s.chapters.orderIndex), asc(s.topics.orderIndex), asc(s.concepts.orderIndex));
  const chapters: CurriculumChapter[] = [];
  for (const r of rows) {
    let ch = chapters.find((c) => c.id === r.chapter.id);
    if (!ch) chapters.push((ch = { id: r.chapter.id, name: r.chapter.name, ncert: r.chapter.ncert, topics: [] }));
    let tp = ch.topics.find((t) => t.name === r.topic.name);
    if (!tp) ch.topics.push((tp = { name: r.topic.name, concepts: [] }));
    tp.concepts.push({ code: r.concept.code, name: r.concept.name, weight: r.concept.examImportance, minutes: r.concept.estimatedMinutes, active: r.concept.active, published: published_.get(r.concept.id) ?? 0 });
  }

  let publishedBy: string | null = null;
  if (published?.publishedBy) {
    const [u] = await tx.select({ name: s.users.displayName, email: s.users.email }).from(s.users).where(eq(s.users.id, published.publishedBy));
    publishedBy = u?.name || u?.email || null;
  }
  return {
    examCode: exam.code,
    examName: exam.name,
    publishedVersion: published?.versionNumber ?? 1,
    publishedAt: published?.publishedAt?.toISOString() ?? null,
    publishedBy,
    chapters,
    edges,
    draft: draft ? applyDiff(edges, draft.edits as Stored as { added: Edge[]; removed: Edge[] }) : null,
  };
}

async function knownCodes(tx: Tx, examId: string) {
  const rows = await tx.select({ code: s.concepts.code, name: s.concepts.name }).from(s.concepts).where(eq(s.concepts.examId, examId));
  return { codes: new Set(rows.map((r) => r.code)), name: (code: string) => rows.find((r) => r.code === code)?.name ?? code };
}

/** Save the whole proposed edge list as this track's draft (or clear the draft when it matches the published graph). */
export async function saveDraft(tx: Tx, actor: Actor, examCode: string, proposed: Edge[]): Promise<{ changes: number }> {
  const exam = await examBy(tx, examCode);
  const { codes, name } = await knownCodes(tx, exam.id);
  const problems = graphProblems(proposed, codes, name);
  if (problems.length) throw new AppError("validation_failed", { message: problems[0].message });

  const baseline = await publishedEdges(tx, exam.id);
  const diff = diffEdges(baseline, proposed);
  const changes = diff.added.length + diff.removed.length;

  // One draft per track: serialise concurrent edits.
  const [current] = await tx.select().from(s.curriculumVersions).where(and(eq(s.curriculumVersions.examId, exam.id), eq(s.curriculumVersions.status, "draft"))).for("update");
  if (changes === 0) {
    if (current) await tx.delete(s.curriculumVersions).where(eq(s.curriculumVersions.id, current.id));
    return { changes: 0 };
  }
  if (current) {
    await tx.update(s.curriculumVersions).set({ edits: { ...diff } }).where(eq(s.curriculumVersions.id, current.id));
  } else {
    const [latest] = await tx.select({ n: sql<number>`coalesce(max(${s.curriculumVersions.versionNumber}), 0)::int` }).from(s.curriculumVersions).where(eq(s.curriculumVersions.examId, exam.id));
    await tx.insert(s.curriculumVersions).values({ examId: exam.id, versionNumber: latest.n + 1, status: "draft", edits: { ...diff }, createdBy: actor.userId });
  }
  return { changes };
}

export async function discardDraft(tx: Tx, examCode: string): Promise<void> {
  const exam = await examBy(tx, examCode);
  await tx.delete(s.curriculumVersions).where(and(eq(s.curriculumVersions.examId, exam.id), eq(s.curriculumVersions.status, "draft")));
}

/** Publish the track's draft as the next version. Needs a written reason (K2). */
export async function publishDraft(tx: Tx, actor: Actor, examCode: string, reason: string): Promise<{ version: number; added: number; removed: number }> {
  const why = reasonError(reason);
  if (why) throw new AppError("validation_failed", { message: why });
  const exam = await examBy(tx, examCode);
  const [draft] = await tx.select().from(s.curriculumVersions).where(and(eq(s.curriculumVersions.examId, exam.id), eq(s.curriculumVersions.status, "draft"))).for("update");
  if (!draft) throw new AppError("conflict", { message: "There is no draft to publish." });

  const stored = draft.edits as { added: Edge[]; removed: Edge[] };
  const baseline = await publishedEdges(tx, exam.id);
  const next = applyDiff(baseline, stored);
  const { codes, name } = await knownCodes(tx, exam.id);
  const problems = graphProblems(next, codes, name);
  if (problems.length) throw new AppError("validation_failed", { message: problems[0].message });

  const idByCode = new Map((await tx.select({ id: s.concepts.id, code: s.concepts.code }).from(s.concepts).where(eq(s.concepts.examId, exam.id))).map((c) => [c.code, c.id]));
  const gone = stored.removed.filter((e) => baseline.some((b) => edgeKey(b) === edgeKey(e)));
  for (const e of gone) {
    await tx.delete(s.conceptEdges).where(and(eq(s.conceptEdges.fromConceptId, idByCode.get(e.from)!), eq(s.conceptEdges.toConceptId, idByCode.get(e.to)!), eq(s.conceptEdges.edgeType, "prerequisite")));
  }
  if (stored.added.length) {
    await tx
      .insert(s.conceptEdges)
      .values(stored.added.map((e) => ({ fromConceptId: idByCode.get(e.from)!, toConceptId: idByCode.get(e.to)!, edgeType: "prerequisite" as const })))
      .onConflictDoNothing();
  }

  const old = await tx.select({ id: s.curriculumVersions.id }).from(s.curriculumVersions).where(and(eq(s.curriculumVersions.examId, exam.id), eq(s.curriculumVersions.status, "published")));
  if (old.length) await tx.update(s.curriculumVersions).set({ status: "superseded" }).where(inArray(s.curriculumVersions.id, old.map((o) => o.id)));
  await tx
    .update(s.curriculumVersions)
    .set({ status: "published", snapshot: { edges: next }, reason: reason.trim(), publishedBy: actor.userId, publishedAt: new Date() })
    .where(eq(s.curriculumVersions.id, draft.id));
  await tx.insert(s.auditLogs).values({
    actorUserId: actor.userId,
    actorRole: actor.role,
    action: "curriculum.published",
    resourceType: "curriculum",
    resourceId: draft.id,
    reason: reason.trim(),
    metadata: { exam: exam.code, version: versionLabel(draft.versionNumber), added: stored.added, removed: stored.removed },
  });
  return { version: draft.versionNumber, added: stored.added.length, removed: gone.length };
}
