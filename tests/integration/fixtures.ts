import { db, pg, createUser, type TestUser } from "./helpers";
import * as s from "@/lib/db/schema";

/*
  One complete "story" for a learner A: a row in every learner-owned table. The RLS matrix
  asserts that learner B and strangers see none of it. Built with the owner connection.
*/
export interface Story {
  a: TestUser;
  b: TestUser;
  guardian: TestUser;
  stranger: TestUser;
  ids: Record<string, string>;
}

const uniq = () => Math.random().toString(36).slice(2, 10);

export async function buildStory(): Promise<Story> {
  const [a, b, guardian, stranger] = await Promise.all([
    createUser("learner", "Ava A"),
    createUser("learner", "Ben B"),
    createUser("guardian", "Gia Guardian"),
    createUser("guardian", "Sam Stranger"),
  ]);
  const ids: Record<string, string> = { learnerA: a.learnerId!, learnerB: b.learnerId! };
  const tag = uniq();

  const [exam] = await db.insert(s.exams).values({ code: `t_${tag}`, name: "Test exam", version: "v1", active: true }).returning();
  const [subject] = await db.insert(s.subjects).values({ examId: exam.id, name: "Physics", orderIndex: 1 }).returning();
  const [chapter] = await db.insert(s.chapters).values({ subjectId: subject.id, name: "Laws of Motion", orderIndex: 1 }).returning();
  const [topic] = await db.insert(s.topics).values({ chapterId: chapter.id, name: "Friction", orderIndex: 1 }).returning();
  const [c1, c2] = await db
    .insert(s.concepts)
    .values([
      { examId: exam.id, topicId: topic.id, code: "c1", name: "Vectors", examImportance: 0.7, estimatedMinutes: 25 },
      { examId: exam.id, topicId: topic.id, code: "c2", name: "Friction", examImportance: 0.85, estimatedMinutes: 40 },
    ])
    .returning();
  await db.insert(s.conceptEdges).values({ fromConceptId: c1.id, toConceptId: c2.id });

  const [question] = await db
    .insert(s.questions)
    .values({
      slug: `q-${tag}`,
      examId: exam.id,
      subjectId: subject.id,
      chapterId: chapter.id,
      topicId: topic.id,
      conceptId: c2.id,
      questionType: "mcq",
      difficulty: 0.55,
      expectedTimeSeconds: 90,
      learningObjective: "Friction on an incline",
      stem: "What is $f$?",
      options: [{ key: "A", text: "1" }, { key: "B", text: "2" }],
      answer: { key: "B" },
      solution: { steps: ["because"] },
      contentHash: `h-${tag}`,
      validationStatus: "published",
    })
    .returning();
  await db.insert(s.questionVersions).values({ questionId: question.id, versionNumber: 1, content: {}, answer: { key: "B" }, solution: {}, difficulty: 0.55 });
  await db.insert(s.questionValidations).values({ questionId: question.id, validatorType: "schema", status: "pass" });
  ids.question = question.id;

  // Learner A: onboarded on the exam.
  await db.update(s.learners).set({ examId: exam.id, subjectId: subject.id, onboardingCompleted: true, onboardingStep: "done" }).where(eqId(s.learners.id, a.learnerId!));
  await db.update(s.learners).set({ examId: exam.id }).where(eqId(s.learners.id, b.learnerId!));

  const [assessment] = await db
    .insert(s.assessments)
    .values({ learnerId: a.learnerId!, assessmentType: "diagnostic", title: "Diagnostic", durationSeconds: 1800, questionCount: 1, scoringRules: { correct: 4, incorrect: -1 } })
    .returning();
  const [item] = await db
    .insert(s.assessmentItems)
    .values({ assessmentId: assessment.id, questionId: question.id, position: 0, conceptId: c2.id, difficultySnapshot: 0.55 })
    .returning();
  const [attempt] = await db.insert(s.attempts).values({ assessmentId: assessment.id, learnerId: a.learnerId!, status: "in_progress" }).returning();
  const [response] = await db.insert(s.responses).values({ attemptId: attempt.id, assessmentItemId: item.id, selectedAnswer: { key: "B" } }).returning();
  Object.assign(ids, { assessment: assessment.id, item: item.id, attempt: attempt.id, response: response.id });

  await db.insert(s.studentConceptState).values({ learnerId: a.learnerId!, conceptId: c2.id, masteryScore: 0.4, confidenceScore: 0.66 });
  const [diagnosis] = await db.insert(s.diagnoses).values({ learnerId: a.learnerId!, assessmentId: assessment.id, attemptId: attempt.id }).returning();
  const [intervention] = await db
    .insert(s.interventions)
    .values({ learnerId: a.learnerId!, conceptId: c2.id, interventionType: "practice", priority: 1, estimatedMinutes: 20, sourceDiagnosisId: diagnosis.id })
    .returning();
  const [plan] = await db
    .insert(s.studyPlans)
    .values({ learnerId: a.learnerId!, diagnosisId: diagnosis.id, startDate: "2026-09-28", endDate: "2026-10-04", availableMinutes: 60 })
    .returning();
  const [task] = await db
    .insert(s.planTasks)
    .values({ studyPlanId: plan.id, conceptId: c2.id, taskType: "practice", scheduledDate: "2026-09-29", estimatedMinutes: 10, priority: 1, orderIndex: 0 })
    .returning();
  const [retest] = await db
    .insert(s.retests)
    .values({ learnerId: a.learnerId!, sourceInterventionId: intervention.id, baselineAttemptId: attempt.id, targetConcepts: [c2.id], studyPlanId: plan.id })
    .returning();
  await db.insert(s.retestResults).values({ retestId: retest.id, baselineMastery: {}, retestMastery: {}, deltaMastery: {}, improvementStatus: "stable" });
  Object.assign(ids, { diagnosis: diagnosis.id, intervention: intervention.id, plan: plan.id, task: task.id, retest: retest.id });

  // Billing: A pays for Starter herself.
  const [starter] = await db
    .insert(s.plans)
    .values({ code: `starter_${tag}`, name: "Starter", priceInr: 199, passDays: 30, creditPeriod: "daily", periodCredits: 200, enginePolicy: "learner_choice", planAdaptation: "retest_only" })
    .returning();
  const [payment] = await db
    .insert(s.payments)
    .values({ learnerId: a.learnerId!, payerUserId: a.id, providerPaymentId: `pay_${tag}`, itemType: "plan_pass", itemCode: "starter", amountInr: 199, status: "captured" })
    .returning();
  const [sub] = await db
    .insert(s.subscriptions)
    .values({ learnerId: a.learnerId!, planId: starter.id, currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 30 * 864e5), firstPaymentAt: new Date(), payerUserId: a.id })
    .returning();
  await db.insert(s.refundRequests).values({ subscriptionId: sub.id, paymentId: payment.id, requestedBy: a.id, creditsUsedPct: 5 });
  const [account] = await db.select().from(s.creditAccounts).where(eqId(s.creditAccounts.learnerId, a.learnerId!));
  const [lot] = await db.insert(s.creditLots).values({ creditAccountId: account.id, bucket: "daily_plan", amount: 200, remaining: 200, grantKey: "daily:test" }).returning();
  await db.insert(s.creditTransactions).values({ creditAccountId: account.id, lotId: lot.id, bucket: "daily_plan", transactionType: "subscription_grant", amount: 200 });
  await db.insert(s.creditReservations).values({ creditAccountId: account.id, amount: 70, referenceType: "attempt", referenceId: attempt.id, idempotencyKey: `k-${tag}`, expiresAt: new Date(Date.now() + 9e5) });
  const [coupon] = await db.insert(s.coupons).values({ code: `C${tag}`.toUpperCase(), discountType: "percentage", discountValue: 20, startsAt: new Date(), endsAt: new Date(Date.now() + 864e5) }).returning();
  await db.insert(s.couponRedemptions).values({ couponId: coupon.id, learnerId: a.learnerId!, paymentId: payment.id, discountAmountInr: 40, bonusCredits: 100 });
  await db.insert(s.paymentEvents).values({ provider: "razorpay", eventId: `evt_${tag}`, eventType: "payment.captured", payloadHash: "x" });
  Object.assign(ids, { payment: payment.id, subscription: sub.id, account: account.id, lot: lot.id, coupon: coupon.id });

  // Guardian: verified for A.
  const [rel] = await db
    .insert(s.guardianRelationships)
    .values({
      guardianUserId: guardian.id,
      learnerId: a.learnerId!,
      guardianName: "Gia Guardian",
      guardianContact: "v1.encrypted.placeholder.value",
      contactType: "email",
      relationshipType: "parent",
      consentStatus: "verified",
      consentMethod: "otp_email",
      consentVerifiedAt: new Date(),
      pendingExpiresAt: new Date(Date.now() + 7 * 864e5),
    })
    .returning();
  await db.insert(s.consentTokens).values({ guardianRelationshipId: rel.id, tokenHash: `th_${tag}`, expiresAt: new Date(Date.now() + 864e5) });
  const [approval] = await db
    .insert(s.purchaseApprovals)
    .values({ learnerId: a.learnerId!, guardianRelationshipId: rel.id, itemType: "plan_pass", itemCode: "plus", amountInr: 299, expiresAt: new Date(Date.now() + 7 * 864e5) })
    .returning();
  Object.assign(ids, { relationship: rel.id, approval: approval.id });

  // Per-user tables.
  await db.insert(s.notifications).values({ userId: a.id, type: "plan", title: "Plan updated" });
  await db.insert(s.notificationPreferences).values({ userId: a.id });
  await db.insert(s.pushSubscriptions).values({ userId: a.id, endpoint: `https://push.example/${tag}`, p256dh: "k", auth: "a" });
  await db.insert(s.dataRequests).values({ userId: a.id, requestType: "export", dueBy: new Date(Date.now() + 7 * 864e5) });

  // Operations (no client access at all).
  await db.insert(s.aiRequests).values({ learnerId: a.learnerId!, operation: "diagnosis", provider: "mock", model: "mock", promptVersion: "v1", schemaVersion: "v1" });
  await db.insert(s.auditLogs).values({ action: "test", resourceType: "test" });
  await db.insert(s.featureFlags).values({ key: `flag_${tag}`, enabled: true });
  await db.insert(s.productEvents).values({ name: "test", userId: a.id });
  await db.insert(s.abuseFlags).values({ learnerId: a.learnerId!, kind: "utilisation" });
  await db.insert(s.devOutbox).values({ toEmail: a.email, subject: "hi", kind: "test", body: "hi" });
  await db.insert(s.curriculumVersions).values({ examId: exam.id, versionNumber: 1 });

  void pg;
  return { a, b, guardian, stranger, ids };
}

import { eq } from "drizzle-orm";
function eqId(column: Parameters<typeof eq>[0], value: string) {
  return eq(column, value);
}
