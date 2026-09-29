CREATE TABLE "consent_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guardian_relationship_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"otp_hash" text,
	"otp_expires_at" timestamp with time zone,
	"otp_attempts" integer DEFAULT 0 NOT NULL,
	"sends_today" integer DEFAULT 0 NOT NULL,
	"last_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "consent_tokens_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "consent_tokens_attempts_check" CHECK ("consent_tokens"."otp_attempts" between 0 and 5),
	CONSTRAINT "consent_tokens_sends_check" CHECK ("consent_tokens"."sends_today" between 0 and 5)
);
--> statement-breakpoint
CREATE TABLE "guardian_relationships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guardian_user_id" uuid,
	"learner_id" uuid NOT NULL,
	"guardian_name" text NOT NULL,
	"guardian_contact" text NOT NULL,
	"contact_type" text NOT NULL,
	"relationship_type" text NOT NULL,
	"consent_status" text DEFAULT 'pending' NOT NULL,
	"consent_method" text,
	"consent_policy_version" text,
	"consent_ip_hash" text,
	"consent_verified_at" timestamp with time zone,
	"pending_expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "guardian_contact_type_check" CHECK ("guardian_relationships"."contact_type" in ('email', 'phone')),
	CONSTRAINT "guardian_consent_status_check" CHECK ("guardian_relationships"."consent_status" in ('pending', 'verified', 'declined', 'withdrawn', 'expired')),
	CONSTRAINT "guardian_consent_method_check" CHECK ("guardian_relationships"."consent_method" in ('otp_email', 'otp_sms', 'inline_guardian_signup', 'digilocker'))
);
--> statement-breakpoint
ALTER TABLE "guardian_relationships" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "learners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"exam_id" uuid,
	"subject_id" uuid,
	"unit" text,
	"target_date" date,
	"available_study_minutes_per_day" integer DEFAULT 60 NOT NULL,
	"timezone" text DEFAULT 'Asia/Kolkata' NOT NULL,
	"onboarding_completed" boolean DEFAULT false NOT NULL,
	"onboarding_step" text,
	"class_level" text,
	"engine_preference" text DEFAULT 'fast' NOT NULL,
	"timer_multiplier" numeric(3, 2) DEFAULT 1 NOT NULL,
	"theme" text DEFAULT 'system' NOT NULL,
	"activated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "learners_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "learners_minutes_check" CHECK ("learners"."available_study_minutes_per_day" >= 0),
	CONSTRAINT "learners_timer_check" CHECK ("learners"."timer_multiplier" in (1.00, 1.25, 1.50)),
	CONSTRAINT "learners_onboarded_needs_exam" CHECK ("learners"."onboarding_completed" = false or "learners"."exam_id" is not null),
	CONSTRAINT "learners_class_level_check" CHECK ("learners"."class_level" in ('class_11', 'class_12', 'dropper', 'other')),
	CONSTRAINT "learners_engine_check" CHECK ("learners"."engine_preference" in ('fast', 'standard')),
	CONSTRAINT "learners_theme_check" CHECK ("learners"."theme" in ('system', 'light', 'dark'))
);
--> statement-breakpoint
ALTER TABLE "learners" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"email_retest_ready" boolean DEFAULT true NOT NULL,
	"email_plan_updated" boolean DEFAULT true NOT NULL,
	"email_weekly_summary" boolean DEFAULT false NOT NULL,
	"push_retest_ready" boolean DEFAULT true NOT NULL,
	"push_daily_reminder" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notification_preferences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"link" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "purchase_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"learner_id" uuid NOT NULL,
	"guardian_relationship_id" uuid NOT NULL,
	"item_type" text NOT NULL,
	"item_code" text NOT NULL,
	"amount_inr" integer NOT NULL,
	"status" text DEFAULT 'requested' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"payment_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_approvals_amount_check" CHECK ("purchase_approvals"."amount_inr" >= 0),
	CONSTRAINT "purchase_approvals_item_type_check" CHECK ("purchase_approvals"."item_type" in ('plan_pass', 'credit_pack')),
	CONSTRAINT "purchase_approvals_status_check" CHECK ("purchase_approvals"."status" in ('requested', 'approved', 'declined', 'expired', 'paid', 'cancelled'))
);
--> statement-breakpoint
ALTER TABLE "purchase_approvals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
ALTER TABLE "push_subscriptions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text,
	"display_name" text,
	"role" text DEFAULT 'learner' NOT NULL,
	"date_of_birth" date,
	"status" text DEFAULT 'active' NOT NULL,
	"deactivated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_role_check" CHECK ("users"."role" in ('learner', 'guardian', 'admin')),
	CONSTRAINT "users_status_check" CHECK ("users"."status" in ('active', 'consent_pending', 'suspended', 'deletion_pending'))
);
--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "chapters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject_id" uuid NOT NULL,
	"name" text NOT NULL,
	"ncert" text,
	"order_index" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chapters_subject_name_key" UNIQUE("subject_id","name")
);
--> statement-breakpoint
ALTER TABLE "chapters" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "concept_edges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_concept_id" uuid NOT NULL,
	"to_concept_id" uuid NOT NULL,
	"edge_type" text DEFAULT 'prerequisite' NOT NULL,
	"weight" numeric(4, 3) DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "concept_edges_pair_key" UNIQUE("from_concept_id","to_concept_id","edge_type"),
	CONSTRAINT "concept_edges_no_self_check" CHECK ("concept_edges"."from_concept_id" <> "concept_edges"."to_concept_id"),
	CONSTRAINT "concept_edges_weight_check" CHECK ("concept_edges"."weight" between 0 and 1),
	CONSTRAINT "concept_edges_type_check" CHECK ("concept_edges"."edge_type" in ('prerequisite', 'related'))
);
--> statement-breakpoint
ALTER TABLE "concept_edges" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "concepts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exam_id" uuid NOT NULL,
	"topic_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"exam_importance" numeric(4, 3) NOT NULL,
	"estimated_minutes" integer NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"clone_source_concept_id" uuid,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "concepts_exam_code_key" UNIQUE("exam_id","code"),
	CONSTRAINT "concepts_importance_check" CHECK ("concepts"."exam_importance" between 0 and 1),
	CONSTRAINT "concepts_minutes_check" CHECK ("concepts"."estimated_minutes" >= 0)
);
--> statement-breakpoint
ALTER TABLE "concepts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "curriculum_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exam_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"edits" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"snapshot" jsonb,
	"reason" text,
	"created_by" uuid,
	"published_by" uuid,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "curriculum_versions_exam_number_key" UNIQUE("exam_id","version_number"),
	CONSTRAINT "curriculum_versions_number_check" CHECK ("curriculum_versions"."version_number" > 0),
	CONSTRAINT "curriculum_versions_status_check" CHECK ("curriculum_versions"."status" in ('draft', 'published', 'superseded'))
);
--> statement-breakpoint
CREATE TABLE "exams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"version" text NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exams_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "exams" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "subjects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exam_id" uuid NOT NULL,
	"name" text NOT NULL,
	"order_index" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subjects_exam_name_key" UNIQUE("exam_id","name")
);
--> statement-breakpoint
ALTER TABLE "subjects" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "topics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chapter_id" uuid NOT NULL,
	"name" text NOT NULL,
	"order_index" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "topics_chapter_name_key" UNIQUE("chapter_id","name")
);
--> statement-breakpoint
ALTER TABLE "topics" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "question_validations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid NOT NULL,
	"version_number" integer DEFAULT 1 NOT NULL,
	"validator_type" text NOT NULL,
	"status" text NOT NULL,
	"score" numeric(4, 3),
	"details" jsonb,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "question_validations_type_check" CHECK ("question_validations"."validator_type" in ('schema', 'math', 'semantic', 'difficulty', 'duplicate', 'exam_style', 'safety', 'human')),
	CONSTRAINT "question_validations_status_check" CHECK ("question_validations"."status" in ('pass', 'fail', 'warning', 'pending'))
);
--> statement-breakpoint
CREATE TABLE "question_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"content" jsonb NOT NULL,
	"answer" jsonb NOT NULL,
	"solution" jsonb NOT NULL,
	"difficulty" numeric(4, 3) NOT NULL,
	"change_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "question_versions_number_key" UNIQUE("question_id","version_number"),
	CONSTRAINT "question_versions_number_check" CHECK ("question_versions"."version_number" > 0),
	CONSTRAINT "question_versions_difficulty_check" CHECK ("question_versions"."difficulty" between 0 and 1)
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"exam_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"chapter_id" uuid NOT NULL,
	"topic_id" uuid NOT NULL,
	"concept_id" uuid NOT NULL,
	"question_type" text NOT NULL,
	"difficulty" numeric(4, 3) NOT NULL,
	"expected_time_seconds" integer NOT NULL,
	"learning_objective" text NOT NULL,
	"stem" text NOT NULL,
	"options" jsonb,
	"answer" jsonb NOT NULL,
	"solution" jsonb NOT NULL,
	"hint" text,
	"wrong_answers" jsonb,
	"misread_risk" boolean DEFAULT false NOT NULL,
	"pool" text DEFAULT 'practice' NOT NULL,
	"parallel_group" text,
	"format" text,
	"source_type" text DEFAULT 'original' NOT NULL,
	"source_reference" text,
	"validation_status" text DEFAULT 'draft' NOT NULL,
	"quality_score" numeric(4, 3),
	"content_hash" text NOT NULL,
	"version_number" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "questions_exam_slug_key" UNIQUE("exam_id","slug"),
	CONSTRAINT "questions_difficulty_check" CHECK ("questions"."difficulty" between 0 and 1),
	CONSTRAINT "questions_time_check" CHECK ("questions"."expected_time_seconds" > 0),
	CONSTRAINT "questions_quality_check" CHECK ("questions"."quality_score" is null or "questions"."quality_score" between 0 and 1),
	CONSTRAINT "questions_version_check" CHECK ("questions"."version_number" > 0),
	CONSTRAINT "questions_type_check" CHECK ("questions"."question_type" in ('mcq', 'numeric', 'true_false', 'short_answer')),
	CONSTRAINT "questions_status_check" CHECK ("questions"."validation_status" in ('draft', 'validated', 'reviewed', 'published', 'suspended')),
	CONSTRAINT "questions_pool_check" CHECK ("questions"."pool" in ('diagnostic', 'retest', 'practice')),
	CONSTRAINT "questions_source_check" CHECK ("questions"."source_type" in ('original', 'licensed', 'public_domain', 'user_generated'))
);
--> statement-breakpoint
CREATE TABLE "assessment_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"question_version" integer DEFAULT 1 NOT NULL,
	"position" integer NOT NULL,
	"concept_id" uuid NOT NULL,
	"difficulty_snapshot" numeric(4, 3) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assessment_items_position_key" UNIQUE("assessment_id","position"),
	CONSTRAINT "assessment_items_question_key" UNIQUE("assessment_id","question_id"),
	CONSTRAINT "assessment_items_position_check" CHECK ("assessment_items"."position" >= 0)
);
--> statement-breakpoint
ALTER TABLE "assessment_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"learner_id" uuid NOT NULL,
	"assessment_type" text NOT NULL,
	"title" text NOT NULL,
	"duration_seconds" integer,
	"question_count" integer NOT NULL,
	"scoring_rules" jsonb NOT NULL,
	"scope" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"alg_version" text DEFAULT 'alg-v1' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assessments_duration_check" CHECK ("assessments"."duration_seconds" is null or "assessments"."duration_seconds" > 0),
	CONSTRAINT "assessments_count_check" CHECK ("assessments"."question_count" > 0),
	CONSTRAINT "assessments_type_check" CHECK ("assessments"."assessment_type" in ('diagnostic', 'practice', 'retest')),
	CONSTRAINT "assessments_status_check" CHECK ("assessments"."status" in ('draft', 'active', 'completed', 'archived'))
);
--> statement-breakpoint
ALTER TABLE "assessments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid NOT NULL,
	"learner_id" uuid NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deadline_at" timestamp with time zone,
	"timer_multiplier" numeric(3, 2) DEFAULT 1 NOT NULL,
	"submitted_at" timestamp with time zone,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"score" numeric(8, 3),
	"max_score" numeric(8, 3),
	"percentage" numeric(6, 3),
	"correct_count" integer,
	"incorrect_count" integer,
	"unanswered_count" integer,
	"accuracy" integer,
	"time_spent_seconds" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attempts_status_check" CHECK ("attempts"."status" in ('in_progress', 'submitted', 'abandoned', 'invalidated')),
	CONSTRAINT "attempts_percentage_check" CHECK ("attempts"."percentage" is null or "attempts"."percentage" between 0 and 100),
	CONSTRAINT "attempts_submitted_check" CHECK ("attempts"."status" <> 'submitted' or "attempts"."submitted_at" is not null)
);
--> statement-breakpoint
ALTER TABLE "attempts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"assessment_item_id" uuid NOT NULL,
	"selected_answer" jsonb,
	"is_correct" boolean,
	"time_spent_seconds" integer DEFAULT 0 NOT NULL,
	"confidence" numeric(4, 3),
	"marked_for_review" boolean DEFAULT false NOT NULL,
	"assisted" boolean DEFAULT false NOT NULL,
	"client_seq" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "responses_item_key" UNIQUE("attempt_id","assessment_item_id"),
	CONSTRAINT "responses_time_check" CHECK ("responses"."time_spent_seconds" >= 0),
	CONSTRAINT "responses_confidence_check" CHECK ("responses"."confidence" is null or "responses"."confidence" between 0 and 1)
);
--> statement-breakpoint
ALTER TABLE "responses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "diagnoses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"learner_id" uuid NOT NULL,
	"assessment_id" uuid NOT NULL,
	"attempt_id" uuid NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"weak_concepts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"root_causes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"confidence" numeric(5, 4),
	"evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"alg_version" text DEFAULT 'alg-v1' NOT NULL,
	"prompt_version" text DEFAULT 'none' NOT NULL,
	"model" text,
	"fallback" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "diagnoses_attempt_id_unique" UNIQUE("attempt_id"),
	CONSTRAINT "diagnoses_status_check" CHECK ("diagnoses"."status" in ('queued', 'processing', 'completed', 'failed', 'superseded')),
	CONSTRAINT "diagnoses_confidence_check" CHECK ("diagnoses"."confidence" is null or "diagnoses"."confidence" between 0 and 1)
);
--> statement-breakpoint
ALTER TABLE "diagnoses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "interventions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"learner_id" uuid NOT NULL,
	"concept_id" uuid NOT NULL,
	"intervention_type" text NOT NULL,
	"priority" integer NOT NULL,
	"estimated_minutes" integer NOT NULL,
	"status" text DEFAULT 'recommended' NOT NULL,
	"source_diagnosis_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "interventions_priority_check" CHECK ("interventions"."priority" > 0),
	CONSTRAINT "interventions_minutes_check" CHECK ("interventions"."estimated_minutes" > 0),
	CONSTRAINT "interventions_type_check" CHECK ("interventions"."intervention_type" in ('revision', 'practice', 'explanation', 'resource', 'retest')),
	CONSTRAINT "interventions_status_check" CHECK ("interventions"."status" in ('recommended', 'active', 'completed', 'skipped', 'expired'))
);
--> statement-breakpoint
ALTER TABLE "interventions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "plan_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"study_plan_id" uuid NOT NULL,
	"concept_id" uuid NOT NULL,
	"task_type" text NOT NULL,
	"scheduled_date" date NOT NULL,
	"estimated_minutes" integer NOT NULL,
	"priority" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"order_index" integer NOT NULL,
	"action" text,
	"practice_questions" integer,
	"part_index" integer,
	"part_of" integer,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plan_tasks_minutes_check" CHECK ("plan_tasks"."estimated_minutes" > 0),
	CONSTRAINT "plan_tasks_priority_check" CHECK ("plan_tasks"."priority" > 0),
	CONSTRAINT "plan_tasks_type_check" CHECK ("plan_tasks"."task_type" in ('learn', 'revise', 'practice', 'retest', 'review')),
	CONSTRAINT "plan_tasks_status_check" CHECK ("plan_tasks"."status" in ('pending', 'completed', 'skipped', 'overdue'))
);
--> statement-breakpoint
ALTER TABLE "plan_tasks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "retest_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"retest_id" uuid NOT NULL,
	"baseline_mastery" jsonb NOT NULL,
	"retest_mastery" jsonb NOT NULL,
	"delta_mastery" jsonb NOT NULL,
	"outcomes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"improvement_status" text NOT NULL,
	"alg_version" text DEFAULT 'alg-v1' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "retest_results_retest_id_unique" UNIQUE("retest_id"),
	CONSTRAINT "retest_results_status_check" CHECK ("retest_results"."improvement_status" in ('improved', 'stable', 'declined', 'insufficient_evidence'))
);
--> statement-breakpoint
ALTER TABLE "retest_results" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "retests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"learner_id" uuid NOT NULL,
	"source_intervention_id" uuid,
	"baseline_attempt_id" uuid NOT NULL,
	"retest_attempt_id" uuid,
	"study_plan_id" uuid,
	"target_concepts" jsonb NOT NULL,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"scheduled_for" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "retests_status_check" CHECK ("retests"."status" in ('scheduled', 'available', 'completed', 'evaluated'))
);
--> statement-breakpoint
ALTER TABLE "retests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "student_concept_state" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"learner_id" uuid NOT NULL,
	"concept_id" uuid NOT NULL,
	"mastery_score" numeric(5, 4) NOT NULL,
	"confidence_score" numeric(5, 4) NOT NULL,
	"evidence_count" integer DEFAULT 0 NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"accuracy" numeric(5, 4) DEFAULT 0 NOT NULL,
	"recent_accuracy" numeric(5, 4) DEFAULT 0 NOT NULL,
	"avg_time_seconds" numeric(10, 2),
	"error_profile" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"difficulty_profile" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_seen_at" timestamp with time zone,
	"last_reviewed_at" timestamp with time zone,
	"forgetting_score" numeric(5, 4) DEFAULT 0 NOT NULL,
	"priority_score" numeric(5, 4) DEFAULT 0 NOT NULL,
	"alg_version" text DEFAULT 'alg-v1' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "student_concept_state_key" UNIQUE("learner_id","concept_id"),
	CONSTRAINT "scs_mastery_check" CHECK ("student_concept_state"."mastery_score" between 0 and 1),
	CONSTRAINT "scs_confidence_check" CHECK ("student_concept_state"."confidence_score" between 0 and 1),
	CONSTRAINT "scs_accuracy_check" CHECK ("student_concept_state"."accuracy" between 0 and 1 and "student_concept_state"."recent_accuracy" between 0 and 1),
	CONSTRAINT "scs_scores_check" CHECK ("student_concept_state"."forgetting_score" between 0 and 1 and "student_concept_state"."priority_score" between 0 and 1)
);
--> statement-breakpoint
ALTER TABLE "student_concept_state" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "study_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"learner_id" uuid NOT NULL,
	"diagnosis_id" uuid,
	"version_number" integer DEFAULT 1 NOT NULL,
	"trigger" text DEFAULT 'diagnostic' NOT NULL,
	"supersedes_plan_id" uuid,
	"status" text DEFAULT 'active' NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"available_minutes" integer NOT NULL,
	"summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"rationale" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"outline" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"alg_version" text DEFAULT 'alg-v1' NOT NULL,
	"prompt_version" text,
	"model" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "study_plans_version_key" UNIQUE("learner_id","version_number"),
	CONSTRAINT "study_plans_version_check" CHECK ("study_plans"."version_number" > 0),
	CONSTRAINT "study_plans_dates_check" CHECK ("study_plans"."end_date" >= "study_plans"."start_date"),
	CONSTRAINT "study_plans_minutes_check" CHECK ("study_plans"."available_minutes" > 0),
	CONSTRAINT "study_plans_trigger_check" CHECK ("study_plans"."trigger" in ('diagnostic', 'retest', 'paid_rebuild')),
	CONSTRAINT "study_plans_status_check" CHECK ("study_plans"."status" in ('draft', 'active', 'completed', 'superseded'))
);
--> statement-breakpoint
ALTER TABLE "study_plans" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "coupon_redemptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"coupon_id" uuid NOT NULL,
	"learner_id" uuid NOT NULL,
	"payment_id" uuid,
	"discount_amount_inr" integer NOT NULL,
	"bonus_credits" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coupon_redemptions_amount_check" CHECK ("coupon_redemptions"."discount_amount_inr" >= 0 and "coupon_redemptions"."bonus_credits" >= 0)
);
--> statement-breakpoint
ALTER TABLE "coupon_redemptions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "coupons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"discount_type" text NOT NULL,
	"discount_value" integer NOT NULL,
	"bonus_credits" integer DEFAULT 0 NOT NULL,
	"max_redemptions" integer,
	"per_user_limit" integer DEFAULT 1 NOT NULL,
	"first_pass_only" boolean DEFAULT true NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coupons_code_unique" UNIQUE("code"),
	CONSTRAINT "coupons_value_check" CHECK ("coupons"."discount_value" >= 0 and "coupons"."bonus_credits" >= 0 and "coupons"."per_user_limit" >= 1),
	CONSTRAINT "coupons_percentage_check" CHECK ("coupons"."discount_type" <> 'percentage' or "coupons"."discount_value" <= 100),
	CONSTRAINT "coupons_dates_check" CHECK ("coupons"."ends_at" > "coupons"."starts_at"),
	CONSTRAINT "coupons_type_check" CHECK ("coupons"."discount_type" in ('percentage', 'fixed'))
);
--> statement-breakpoint
CREATE TABLE "credit_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"learner_id" uuid NOT NULL,
	"balance" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_accounts_learner_id_unique" UNIQUE("learner_id"),
	CONSTRAINT "credit_accounts_balance_check" CHECK ("credit_accounts"."balance" >= 0)
);
--> statement-breakpoint
ALTER TABLE "credit_accounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "credit_lots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"credit_account_id" uuid NOT NULL,
	"bucket" text NOT NULL,
	"amount" integer NOT NULL,
	"remaining" integer NOT NULL,
	"expires_at" timestamp with time zone,
	"grant_key" text,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_lots_grant_key" UNIQUE("credit_account_id","grant_key"),
	CONSTRAINT "credit_lots_amount_check" CHECK ("credit_lots"."amount" > 0),
	CONSTRAINT "credit_lots_remaining_check" CHECK ("credit_lots"."remaining" >= 0 and "credit_lots"."remaining" <= "credit_lots"."amount"),
	CONSTRAINT "credit_lots_bucket_check" CHECK ("credit_lots"."bucket" in ('daily_plan', 'free_monthly', 'promotional', 'purchased'))
);
--> statement-breakpoint
ALTER TABLE "credit_lots" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "credit_reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"credit_account_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"status" text DEFAULT 'reserved' NOT NULL,
	"reference_type" text NOT NULL,
	"reference_id" uuid NOT NULL,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"settled_at" timestamp with time zone,
	"released_at" timestamp with time zone,
	CONSTRAINT "credit_reservations_idem_key" UNIQUE("credit_account_id","idempotency_key"),
	CONSTRAINT "credit_reservations_amount_check" CHECK ("credit_reservations"."amount" > 0),
	CONSTRAINT "credit_reservations_status_check" CHECK ("credit_reservations"."status" in ('reserved', 'settled', 'released', 'expired'))
);
--> statement-breakpoint
ALTER TABLE "credit_reservations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "credit_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"credit_account_id" uuid NOT NULL,
	"lot_id" uuid,
	"reservation_id" uuid,
	"bucket" text NOT NULL,
	"transaction_type" text NOT NULL,
	"amount" integer NOT NULL,
	"reference_type" text,
	"reference_id" uuid,
	"description" text,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_transactions_amount_check" CHECK ("credit_transactions"."amount" <> 0),
	CONSTRAINT "credit_transactions_bucket_check" CHECK ("credit_transactions"."bucket" in ('daily_plan', 'free_monthly', 'promotional', 'purchased')),
	CONSTRAINT "credit_transactions_type_check" CHECK ("credit_transactions"."transaction_type" in ('subscription_grant', 'promotion_grant', 'purchase', 'consumption', 'refund', 'expiration', 'adjustment', 'reversal'))
);
--> statement-breakpoint
ALTER TABLE "credit_transactions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "payment_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"payload_hash" text NOT NULL,
	"payload" jsonb,
	"attempts" integer DEFAULT 0 NOT NULL,
	"processed_at" timestamp with time zone,
	"processing_status" text DEFAULT 'received' NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_events_event_id_unique" UNIQUE("event_id"),
	CONSTRAINT "payment_events_status_check" CHECK ("payment_events"."processing_status" in ('received', 'processed', 'failed', 'ignored'))
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"learner_id" uuid,
	"payer_user_id" uuid,
	"provider" text DEFAULT 'razorpay' NOT NULL,
	"provider_payment_id" text,
	"provider_order_id" text,
	"item_type" text NOT NULL,
	"item_code" text NOT NULL,
	"amount_inr" integer NOT NULL,
	"refunded_inr" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"status" text DEFAULT 'created' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_provider_payment_id_unique" UNIQUE("provider_payment_id"),
	CONSTRAINT "payments_amount_check" CHECK ("payments"."amount_inr" >= 0 and "payments"."refunded_inr" >= 0 and "payments"."refunded_inr" <= "payments"."amount_inr"),
	CONSTRAINT "payments_item_type_check" CHECK ("payments"."item_type" in ('plan_pass', 'credit_pack')),
	CONSTRAINT "payments_status_check" CHECK ("payments"."status" in ('created', 'authorized', 'captured', 'failed', 'refunded'))
);
--> statement-breakpoint
ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"price_inr" integer NOT NULL,
	"pass_days" integer,
	"credit_period" text NOT NULL,
	"period_credits" integer NOT NULL,
	"welcome_credits" integer DEFAULT 0 NOT NULL,
	"engine_policy" text NOT NULL,
	"queue_priority" integer DEFAULT 0 NOT NULL,
	"plan_adaptation" text NOT NULL,
	"deep_diagnostic" boolean DEFAULT false NOT NULL,
	"recommended" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plans_code_unique" UNIQUE("code"),
	CONSTRAINT "plans_price_check" CHECK ("plans"."price_inr" >= 0),
	CONSTRAINT "plans_credits_check" CHECK ("plans"."period_credits" >= 0 and "plans"."welcome_credits" >= 0),
	CONSTRAINT "plans_period_check" CHECK ("plans"."credit_period" in ('monthly', 'daily')),
	CONSTRAINT "plans_engine_check" CHECK ("plans"."engine_policy" in ('fast_only', 'learner_choice', 'auto', 'auto_extended')),
	CONSTRAINT "plans_adaptation_check" CHECK ("plans"."plan_adaptation" in ('retest_only', 'after_practice', 'daily'))
);
--> statement-breakpoint
ALTER TABLE "plans" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "refund_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_id" uuid,
	"payment_id" uuid NOT NULL,
	"requested_by" uuid,
	"reason" text,
	"credits_used_pct" numeric(5, 2) NOT NULL,
	"status" text DEFAULT 'requested' NOT NULL,
	"exception" boolean DEFAULT false NOT NULL,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"provider_refund_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refund_requests_status_check" CHECK ("refund_requests"."status" in ('requested', 'approved', 'rejected', 'processed'))
);
--> statement-breakpoint
ALTER TABLE "refund_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"learner_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"provider" text DEFAULT 'razorpay' NOT NULL,
	"provider_subscription_id" text,
	"auto_renew" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"current_period_start" timestamp with time zone NOT NULL,
	"current_period_end" timestamp with time zone NOT NULL,
	"scheduled_plan_id" uuid,
	"first_payment_at" timestamp with time zone NOT NULL,
	"payer_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_provider_subscription_id_unique" UNIQUE("provider_subscription_id"),
	CONSTRAINT "subscriptions_status_check" CHECK ("subscriptions"."status" in ('active', 'renewal_failed', 'cancelled', 'expired', 'refunded')),
	CONSTRAINT "subscriptions_period_check" CHECK ("subscriptions"."current_period_end" > "subscriptions"."current_period_start")
);
--> statement-breakpoint
ALTER TABLE "subscriptions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "abuse_flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"learner_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "abuse_flags_status_check" CHECK ("abuse_flags"."status" in ('open', 'reviewed', 'dismissed'))
);
--> statement-breakpoint
CREATE TABLE "ai_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"learner_id" uuid,
	"operation" text NOT NULL,
	"tier" text,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"prompt_version" text NOT NULL,
	"schema_version" text NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cached_tokens" integer DEFAULT 0 NOT NULL,
	"estimated_cost_inr" numeric(12, 6) DEFAULT 0 NOT NULL,
	"credits_charged" integer DEFAULT 0 NOT NULL,
	"latency_ms" integer,
	"status" text DEFAULT 'queued' NOT NULL,
	"error_code" text,
	"reference_type" text,
	"reference_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_requests_status_check" CHECK ("ai_requests"."status" in ('queued', 'running', 'succeeded', 'failed', 'fallback')),
	CONSTRAINT "ai_requests_counts_check" CHECK ("ai_requests"."input_tokens" >= 0 and "ai_requests"."output_tokens" >= 0 and "ai_requests"."cached_tokens" >= 0)
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid,
	"actor_role" text,
	"action" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" uuid,
	"reason" text,
	"metadata" jsonb,
	"ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"request_type" text NOT NULL,
	"status" text DEFAULT 'requested' NOT NULL,
	"due_by" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"file_path" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "data_requests_type_check" CHECK ("data_requests"."request_type" in ('export', 'erasure')),
	CONSTRAINT "data_requests_status_check" CHECK ("data_requests"."status" in ('requested', 'processing', 'completed', 'failed', 'cancelled'))
);
--> statement-breakpoint
ALTER TABLE "data_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "dev_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"to_email" text NOT NULL,
	"subject" text NOT NULL,
	"kind" text NOT NULL,
	"body" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feature_flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"enabled" boolean NOT NULL,
	"config" jsonb,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feature_flags_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "product_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"user_id" uuid,
	"learner_id" uuid,
	"is_minor" boolean DEFAULT false NOT NULL,
	"properties" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"mirrored_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limit_counters" (
	"key" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "rate_limit_counters_key_window_start_pk" PRIMARY KEY("key","window_start")
);
--> statement-breakpoint
ALTER TABLE "consent_tokens" ADD CONSTRAINT "consent_tokens_guardian_relationship_id_guardian_relationships_id_fk" FOREIGN KEY ("guardian_relationship_id") REFERENCES "public"."guardian_relationships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guardian_relationships" ADD CONSTRAINT "guardian_relationships_guardian_user_id_users_id_fk" FOREIGN KEY ("guardian_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guardian_relationships" ADD CONSTRAINT "guardian_relationships_learner_id_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learners" ADD CONSTRAINT "learners_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learners" ADD CONSTRAINT "learners_exam_id_exams_id_fk" FOREIGN KEY ("exam_id") REFERENCES "public"."exams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learners" ADD CONSTRAINT "learners_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_approvals" ADD CONSTRAINT "purchase_approvals_learner_id_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_approvals" ADD CONSTRAINT "purchase_approvals_guardian_relationship_id_guardian_relationships_id_fk" FOREIGN KEY ("guardian_relationship_id") REFERENCES "public"."guardian_relationships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_approvals" ADD CONSTRAINT "purchase_approvals_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chapters" ADD CONSTRAINT "chapters_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concept_edges" ADD CONSTRAINT "concept_edges_from_concept_id_concepts_id_fk" FOREIGN KEY ("from_concept_id") REFERENCES "public"."concepts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concept_edges" ADD CONSTRAINT "concept_edges_to_concept_id_concepts_id_fk" FOREIGN KEY ("to_concept_id") REFERENCES "public"."concepts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concepts" ADD CONSTRAINT "concepts_exam_id_exams_id_fk" FOREIGN KEY ("exam_id") REFERENCES "public"."exams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concepts" ADD CONSTRAINT "concepts_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curriculum_versions" ADD CONSTRAINT "curriculum_versions_exam_id_exams_id_fk" FOREIGN KEY ("exam_id") REFERENCES "public"."exams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_exam_id_exams_id_fk" FOREIGN KEY ("exam_id") REFERENCES "public"."exams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topics" ADD CONSTRAINT "topics_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_validations" ADD CONSTRAINT "question_validations_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_versions" ADD CONSTRAINT "question_versions_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_exam_id_exams_id_fk" FOREIGN KEY ("exam_id") REFERENCES "public"."exams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_concept_id_concepts_id_fk" FOREIGN KEY ("concept_id") REFERENCES "public"."concepts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_items" ADD CONSTRAINT "assessment_items_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_items" ADD CONSTRAINT "assessment_items_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_items" ADD CONSTRAINT "assessment_items_concept_id_concepts_id_fk" FOREIGN KEY ("concept_id") REFERENCES "public"."concepts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_learner_id_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_learner_id_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "responses" ADD CONSTRAINT "responses_attempt_id_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "responses" ADD CONSTRAINT "responses_assessment_item_id_assessment_items_id_fk" FOREIGN KEY ("assessment_item_id") REFERENCES "public"."assessment_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagnoses" ADD CONSTRAINT "diagnoses_learner_id_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagnoses" ADD CONSTRAINT "diagnoses_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagnoses" ADD CONSTRAINT "diagnoses_attempt_id_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interventions" ADD CONSTRAINT "interventions_learner_id_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interventions" ADD CONSTRAINT "interventions_concept_id_concepts_id_fk" FOREIGN KEY ("concept_id") REFERENCES "public"."concepts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interventions" ADD CONSTRAINT "interventions_source_diagnosis_id_diagnoses_id_fk" FOREIGN KEY ("source_diagnosis_id") REFERENCES "public"."diagnoses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_tasks" ADD CONSTRAINT "plan_tasks_study_plan_id_study_plans_id_fk" FOREIGN KEY ("study_plan_id") REFERENCES "public"."study_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_tasks" ADD CONSTRAINT "plan_tasks_concept_id_concepts_id_fk" FOREIGN KEY ("concept_id") REFERENCES "public"."concepts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retest_results" ADD CONSTRAINT "retest_results_retest_id_retests_id_fk" FOREIGN KEY ("retest_id") REFERENCES "public"."retests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retests" ADD CONSTRAINT "retests_learner_id_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retests" ADD CONSTRAINT "retests_source_intervention_id_interventions_id_fk" FOREIGN KEY ("source_intervention_id") REFERENCES "public"."interventions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retests" ADD CONSTRAINT "retests_baseline_attempt_id_attempts_id_fk" FOREIGN KEY ("baseline_attempt_id") REFERENCES "public"."attempts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retests" ADD CONSTRAINT "retests_retest_attempt_id_attempts_id_fk" FOREIGN KEY ("retest_attempt_id") REFERENCES "public"."attempts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retests" ADD CONSTRAINT "retests_study_plan_id_study_plans_id_fk" FOREIGN KEY ("study_plan_id") REFERENCES "public"."study_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_concept_state" ADD CONSTRAINT "student_concept_state_learner_id_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_concept_state" ADD CONSTRAINT "student_concept_state_concept_id_concepts_id_fk" FOREIGN KEY ("concept_id") REFERENCES "public"."concepts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_plans" ADD CONSTRAINT "study_plans_learner_id_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_plans" ADD CONSTRAINT "study_plans_diagnosis_id_diagnoses_id_fk" FOREIGN KEY ("diagnosis_id") REFERENCES "public"."diagnoses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_plans" ADD CONSTRAINT "study_plans_supersedes_plan_id_study_plans_id_fk" FOREIGN KEY ("supersedes_plan_id") REFERENCES "public"."study_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_learner_id_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_accounts" ADD CONSTRAINT "credit_accounts_learner_id_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_lots" ADD CONSTRAINT "credit_lots_credit_account_id_credit_accounts_id_fk" FOREIGN KEY ("credit_account_id") REFERENCES "public"."credit_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_reservations" ADD CONSTRAINT "credit_reservations_credit_account_id_credit_accounts_id_fk" FOREIGN KEY ("credit_account_id") REFERENCES "public"."credit_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_credit_account_id_credit_accounts_id_fk" FOREIGN KEY ("credit_account_id") REFERENCES "public"."credit_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_lot_id_credit_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."credit_lots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_reservation_id_credit_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."credit_reservations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_learner_id_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learners"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_payer_user_id_users_id_fk" FOREIGN KEY ("payer_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_learner_id_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_scheduled_plan_id_plans_id_fk" FOREIGN KEY ("scheduled_plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_payer_user_id_users_id_fk" FOREIGN KEY ("payer_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "abuse_flags" ADD CONSTRAINT "abuse_flags_learner_id_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "abuse_flags" ADD CONSTRAINT "abuse_flags_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_requests" ADD CONSTRAINT "ai_requests_learner_id_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learners"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_requests" ADD CONSTRAINT "data_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_events" ADD CONSTRAINT "product_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_events" ADD CONSTRAINT "product_events_learner_id_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learners"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "consent_tokens_relationship_idx" ON "consent_tokens" USING btree ("guardian_relationship_id");--> statement-breakpoint
CREATE INDEX "guardian_relationships_guardian_user_id_idx" ON "guardian_relationships" USING btree ("guardian_user_id");--> statement-breakpoint
CREATE INDEX "guardian_relationships_learner_id_idx" ON "guardian_relationships" USING btree ("learner_id");--> statement-breakpoint
CREATE INDEX "learners_user_id_idx" ON "learners" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "learners_exam_id_idx" ON "learners" USING btree ("exam_id");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "purchase_approvals_learner_idx" ON "purchase_approvals" USING btree ("learner_id","status");--> statement-breakpoint
CREATE INDEX "purchase_approvals_relationship_idx" ON "purchase_approvals" USING btree ("guardian_relationship_id");--> statement-breakpoint
CREATE INDEX "push_subscriptions_user_idx" ON "push_subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "chapters_subject_id_idx" ON "chapters" USING btree ("subject_id");--> statement-breakpoint
CREATE INDEX "concept_edges_from_idx" ON "concept_edges" USING btree ("from_concept_id");--> statement-breakpoint
CREATE INDEX "concept_edges_to_idx" ON "concept_edges" USING btree ("to_concept_id");--> statement-breakpoint
CREATE INDEX "concepts_topic_id_idx" ON "concepts" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX "concepts_exam_id_idx" ON "concepts" USING btree ("exam_id");--> statement-breakpoint
CREATE INDEX "curriculum_versions_exam_idx" ON "curriculum_versions" USING btree ("exam_id","status");--> statement-breakpoint
CREATE INDEX "subjects_exam_id_idx" ON "subjects" USING btree ("exam_id");--> statement-breakpoint
CREATE INDEX "topics_chapter_id_idx" ON "topics" USING btree ("chapter_id");--> statement-breakpoint
CREATE INDEX "question_validations_question_idx" ON "question_validations" USING btree ("question_id","created_at");--> statement-breakpoint
CREATE INDEX "questions_concept_id_idx" ON "questions" USING btree ("concept_id");--> statement-breakpoint
CREATE INDEX "questions_validation_status_idx" ON "questions" USING btree ("validation_status");--> statement-breakpoint
CREATE INDEX "questions_selection_idx" ON "questions" USING btree ("concept_id","pool","validation_status");--> statement-breakpoint
CREATE INDEX "questions_content_hash_idx" ON "questions" USING btree ("content_hash");--> statement-breakpoint
CREATE INDEX "assessment_items_assessment_idx" ON "assessment_items" USING btree ("assessment_id");--> statement-breakpoint
CREATE INDEX "assessment_items_question_idx" ON "assessment_items" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "assessment_items_concept_idx" ON "assessment_items" USING btree ("concept_id");--> statement-breakpoint
CREATE INDEX "assessments_learner_idx" ON "assessments" USING btree ("learner_id","created_at");--> statement-breakpoint
CREATE INDEX "attempts_learner_idx" ON "attempts" USING btree ("learner_id","created_at");--> statement-breakpoint
CREATE INDEX "attempts_assessment_idx" ON "attempts" USING btree ("assessment_id");--> statement-breakpoint
CREATE INDEX "attempts_open_idx" ON "attempts" USING btree ("status","deadline_at");--> statement-breakpoint
CREATE INDEX "responses_attempt_idx" ON "responses" USING btree ("attempt_id");--> statement-breakpoint
CREATE INDEX "responses_item_idx" ON "responses" USING btree ("assessment_item_id");--> statement-breakpoint
CREATE INDEX "diagnoses_learner_idx" ON "diagnoses" USING btree ("learner_id","created_at");--> statement-breakpoint
CREATE INDEX "diagnoses_assessment_idx" ON "diagnoses" USING btree ("assessment_id");--> statement-breakpoint
CREATE INDEX "interventions_learner_idx" ON "interventions" USING btree ("learner_id","status");--> statement-breakpoint
CREATE INDEX "interventions_diagnosis_idx" ON "interventions" USING btree ("source_diagnosis_id");--> statement-breakpoint
CREATE INDEX "plan_tasks_plan_date_idx" ON "plan_tasks" USING btree ("study_plan_id","scheduled_date");--> statement-breakpoint
CREATE INDEX "plan_tasks_concept_idx" ON "plan_tasks" USING btree ("concept_id");--> statement-breakpoint
CREATE INDEX "retests_learner_idx" ON "retests" USING btree ("learner_id","status");--> statement-breakpoint
CREATE INDEX "retests_baseline_idx" ON "retests" USING btree ("baseline_attempt_id");--> statement-breakpoint
CREATE INDEX "retests_result_idx" ON "retests" USING btree ("retest_attempt_id");--> statement-breakpoint
CREATE INDEX "student_concept_state_learner_idx" ON "student_concept_state" USING btree ("learner_id","concept_id");--> statement-breakpoint
CREATE INDEX "study_plans_learner_status_idx" ON "study_plans" USING btree ("learner_id","status");--> statement-breakpoint
CREATE INDEX "study_plans_diagnosis_idx" ON "study_plans" USING btree ("diagnosis_id");--> statement-breakpoint
CREATE INDEX "coupon_redemptions_coupon_idx" ON "coupon_redemptions" USING btree ("coupon_id");--> statement-breakpoint
CREATE INDEX "coupon_redemptions_learner_idx" ON "coupon_redemptions" USING btree ("learner_id");--> statement-breakpoint
CREATE INDEX "credit_lots_spend_idx" ON "credit_lots" USING btree ("credit_account_id","expires_at");--> statement-breakpoint
CREATE INDEX "credit_reservations_sweep_idx" ON "credit_reservations" USING btree ("status","expires_at");--> statement-breakpoint
CREATE INDEX "credit_reservations_reference_idx" ON "credit_reservations" USING btree ("reference_type","reference_id");--> statement-breakpoint
CREATE INDEX "credit_transactions_account_idx" ON "credit_transactions" USING btree ("credit_account_id","created_at");--> statement-breakpoint
CREATE INDEX "credit_transactions_lot_idx" ON "credit_transactions" USING btree ("lot_id");--> statement-breakpoint
CREATE INDEX "credit_transactions_reference_idx" ON "credit_transactions" USING btree ("reference_type","reference_id");--> statement-breakpoint
CREATE INDEX "payment_events_status_idx" ON "payment_events" USING btree ("processing_status","created_at");--> statement-breakpoint
CREATE INDEX "payments_learner_idx" ON "payments" USING btree ("learner_id","created_at");--> statement-breakpoint
CREATE INDEX "payments_order_idx" ON "payments" USING btree ("provider_order_id");--> statement-breakpoint
CREATE INDEX "payments_payer_idx" ON "payments" USING btree ("payer_user_id");--> statement-breakpoint
CREATE INDEX "refund_requests_status_idx" ON "refund_requests" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "refund_requests_payment_idx" ON "refund_requests" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "refund_requests_subscription_idx" ON "refund_requests" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "subscriptions_learner_idx" ON "subscriptions" USING btree ("learner_id","status");--> statement-breakpoint
CREATE INDEX "subscriptions_period_end_idx" ON "subscriptions" USING btree ("status","current_period_end");--> statement-breakpoint
CREATE INDEX "subscriptions_payer_idx" ON "subscriptions" USING btree ("payer_user_id");--> statement-breakpoint
CREATE INDEX "abuse_flags_status_idx" ON "abuse_flags" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "abuse_flags_learner_idx" ON "abuse_flags" USING btree ("learner_id");--> statement-breakpoint
CREATE INDEX "ai_requests_learner_idx" ON "ai_requests" USING btree ("learner_id","created_at");--> statement-breakpoint
CREATE INDEX "ai_requests_operation_idx" ON "ai_requests" USING btree ("operation","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_resource_idx" ON "audit_logs" USING btree ("resource_type","resource_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_actor_idx" ON "audit_logs" USING btree ("actor_user_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_created_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "data_requests_user_idx" ON "data_requests" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "data_requests_due_idx" ON "data_requests" USING btree ("status","due_by");--> statement-breakpoint
CREATE INDEX "dev_outbox_to_idx" ON "dev_outbox" USING btree ("to_email","created_at");--> statement-breakpoint
CREATE INDEX "product_events_name_idx" ON "product_events" USING btree ("name","created_at");--> statement-breakpoint
CREATE INDEX "product_events_mirror_idx" ON "product_events" USING btree ("mirrored_at","created_at");--> statement-breakpoint
CREATE INDEX "product_events_learner_idx" ON "product_events" USING btree ("learner_id","created_at");--> statement-breakpoint
CREATE INDEX "product_events_user_idx" ON "product_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "rate_limit_counters_window_idx" ON "rate_limit_counters" USING btree ("window_start");--> statement-breakpoint
CREATE POLICY "guardian_relationships_own_select" ON "guardian_relationships" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("guardian_relationships"."guardian_user_id" = (select auth.uid()) or "guardian_relationships"."learner_id" = (select private.current_learner_id()));--> statement-breakpoint
CREATE POLICY "learners_own_select" ON "learners" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("learners"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "learners_own_update" ON "learners" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("learners"."user_id" = (select auth.uid())) WITH CHECK ("learners"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "notification_preferences_own_all" ON "notification_preferences" AS PERMISSIVE FOR ALL TO "authenticated" USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "notifications_own_select" ON "notifications" AS PERMISSIVE FOR SELECT TO "authenticated" USING (user_id = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "notifications_own_update" ON "notifications" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "purchase_approvals_read" ON "purchase_approvals" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("purchase_approvals"."learner_id" = (select private.current_learner_id()) or "purchase_approvals"."guardian_relationship_id" in (select private.guardian_relationship_ids()));--> statement-breakpoint
CREATE POLICY "push_subscriptions_own_all" ON "push_subscriptions" AS PERMISSIVE FOR ALL TO "authenticated" USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "users_own_select" ON "users" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("users"."id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "users_own_update" ON "users" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("users"."id" = (select auth.uid())) WITH CHECK ("users"."id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "chapters_read" ON "chapters" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("chapters"."active");--> statement-breakpoint
CREATE POLICY "concept_edges_read" ON "concept_edges" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "concepts_read" ON "concepts" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("concepts"."active");--> statement-breakpoint
CREATE POLICY "exams_read" ON "exams" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "subjects_read" ON "subjects" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("subjects"."active");--> statement-breakpoint
CREATE POLICY "topics_read" ON "topics" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("topics"."active");--> statement-breakpoint
CREATE POLICY "assessment_items_own_select" ON "assessment_items" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("assessment_items"."assessment_id" in (select id from public.assessments where learner_id = (select private.current_learner_id())));--> statement-breakpoint
CREATE POLICY "assessments_own_select" ON "assessments" AS PERMISSIVE FOR SELECT TO "authenticated" USING (learner_id = (select private.current_learner_id()));--> statement-breakpoint
CREATE POLICY "attempts_own_select" ON "attempts" AS PERMISSIVE FOR SELECT TO "authenticated" USING (learner_id = (select private.current_learner_id()));--> statement-breakpoint
CREATE POLICY "responses_own_select" ON "responses" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("responses"."attempt_id" in (select id from public.attempts where learner_id = (select private.current_learner_id())));--> statement-breakpoint
CREATE POLICY "responses_own_insert" ON "responses" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("responses"."attempt_id" in (select id from public.attempts where learner_id = (select private.current_learner_id()) and status = 'in_progress'));--> statement-breakpoint
CREATE POLICY "responses_own_update" ON "responses" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("responses"."attempt_id" in (select id from public.attempts where learner_id = (select private.current_learner_id()) and status = 'in_progress')) WITH CHECK ("responses"."attempt_id" in (select id from public.attempts where learner_id = (select private.current_learner_id()) and status = 'in_progress'));--> statement-breakpoint
CREATE POLICY "diagnoses_own_select" ON "diagnoses" AS PERMISSIVE FOR SELECT TO "authenticated" USING (learner_id = (select private.current_learner_id()));--> statement-breakpoint
CREATE POLICY "interventions_own_select" ON "interventions" AS PERMISSIVE FOR SELECT TO "authenticated" USING (learner_id = (select private.current_learner_id()));--> statement-breakpoint
CREATE POLICY "plan_tasks_own_select" ON "plan_tasks" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("plan_tasks"."study_plan_id" in (select id from public.study_plans where learner_id = (select private.current_learner_id())));--> statement-breakpoint
CREATE POLICY "plan_tasks_own_update" ON "plan_tasks" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("plan_tasks"."study_plan_id" in (select id from public.study_plans where learner_id = (select private.current_learner_id()))) WITH CHECK ("plan_tasks"."study_plan_id" in (select id from public.study_plans where learner_id = (select private.current_learner_id())));--> statement-breakpoint
CREATE POLICY "retest_results_own_select" ON "retest_results" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("retest_results"."retest_id" in (select id from public.retests where learner_id = (select private.current_learner_id())));--> statement-breakpoint
CREATE POLICY "retests_own_select" ON "retests" AS PERMISSIVE FOR SELECT TO "authenticated" USING (learner_id = (select private.current_learner_id()));--> statement-breakpoint
CREATE POLICY "student_concept_state_own_select" ON "student_concept_state" AS PERMISSIVE FOR SELECT TO "authenticated" USING (learner_id = (select private.current_learner_id()));--> statement-breakpoint
CREATE POLICY "study_plans_own_select" ON "study_plans" AS PERMISSIVE FOR SELECT TO "authenticated" USING (learner_id = (select private.current_learner_id()));--> statement-breakpoint
CREATE POLICY "coupon_redemptions_own_select" ON "coupon_redemptions" AS PERMISSIVE FOR SELECT TO "authenticated" USING (learner_id = (select private.current_learner_id()));--> statement-breakpoint
CREATE POLICY "credit_accounts_own_select" ON "credit_accounts" AS PERMISSIVE FOR SELECT TO "authenticated" USING (learner_id = (select private.current_learner_id()));--> statement-breakpoint
CREATE POLICY "credit_lots_own_select" ON "credit_lots" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("credit_lots"."credit_account_id" in (select id from public.credit_accounts where learner_id = (select private.current_learner_id())));--> statement-breakpoint
CREATE POLICY "credit_reservations_own_select" ON "credit_reservations" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("credit_reservations"."credit_account_id" in (select id from public.credit_accounts where learner_id = (select private.current_learner_id())));--> statement-breakpoint
CREATE POLICY "credit_transactions_own_select" ON "credit_transactions" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("credit_transactions"."credit_account_id" in (select id from public.credit_accounts where learner_id = (select private.current_learner_id())));--> statement-breakpoint
CREATE POLICY "payments_own_select" ON "payments" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("payments"."learner_id" = (select private.current_learner_id()) or "payments"."payer_user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "plans_read" ON "plans" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("plans"."active");--> statement-breakpoint
CREATE POLICY "refund_requests_own_select" ON "refund_requests" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("refund_requests"."requested_by" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "subscriptions_own_select" ON "subscriptions" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("subscriptions"."learner_id" = (select private.current_learner_id()) or "subscriptions"."payer_user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "data_requests_own_select" ON "data_requests" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("data_requests"."user_id" = (select auth.uid()));