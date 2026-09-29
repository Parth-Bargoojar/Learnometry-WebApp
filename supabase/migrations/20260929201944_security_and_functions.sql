-- 2 · RLS on every table, privileges, triggers and guardian summary functions (BE-1.3).
-- Rollback: this migration is additive on top of 0/1; to undo, drop the triggers/functions created
-- here and re-grant as needed. Do not run against a database with learner data.

-- ---------------------------------------------------------------------------------------------
-- 1. RLS on every public table (default deny) and updated_at maintenance.
--    New tables MUST be added to the RLS denial test matrix (tests/integration/rls.test.ts).
-- ---------------------------------------------------------------------------------------------
do $$
declare r record;
begin
  for r in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', r.tablename);
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = r.tablename and column_name = 'updated_at'
    ) then
      execute format('drop trigger if exists touch_updated_at on public.%I', r.tablename);
      execute format(
        'create trigger touch_updated_at before update on public.%I for each row execute function private.touch_updated_at()',
        r.tablename
      );
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------------------------
-- 2. Privileges: nothing by default. Supabase grants ALL on new public tables to anon and
--    authenticated; revoke it and grant only what the policies need (defense in depth: RLS
--    decides which rows, grants decide which columns and commands).
-- ---------------------------------------------------------------------------------------------
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon;

-- Whole-table SELECT where a policy scopes the rows.
grant select on
  public.users, public.learners, public.purchase_approvals, public.notifications,
  public.notification_preferences, public.push_subscriptions,
  public.exams, public.subjects, public.chapters, public.topics, public.concepts, public.concept_edges,
  public.assessments, public.assessment_items, public.attempts, public.responses,
  public.student_concept_state, public.diagnoses, public.interventions, public.study_plans, public.plan_tasks,
  public.retests, public.retest_results,
  public.plans, public.payments, public.subscriptions, public.refund_requests,
  public.credit_accounts, public.credit_lots, public.credit_reservations, public.credit_transactions,
  public.coupon_redemptions, public.data_requests
to authenticated;

-- The guardian's encrypted contact and the consent IP hash are never client-readable.
grant select (
  id, guardian_user_id, learner_id, guardian_name, contact_type, relationship_type, consent_status,
  consent_method, consent_policy_version, consent_verified_at, pending_expires_at, created_at, updated_at
) on public.guardian_relationships to authenticated;

-- Client writes: only fields that are the learner's own preference or their own answer.
grant update (display_name) on public.users to authenticated;
grant update (
  target_date, available_study_minutes_per_day, timezone, engine_preference, theme, class_level, subject_id, unit
) on public.learners to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant insert, update on public.notification_preferences to authenticated;
grant insert, delete on public.push_subscriptions to authenticated;
grant update (status, scheduled_date, order_index, completed_at) on public.plan_tasks to authenticated;
grant insert (attempt_id, assessment_item_id, selected_answer, time_spent_seconds, confidence, marked_for_review, client_seq)
  on public.responses to authenticated;
grant update (selected_answer, time_spent_seconds, confidence, marked_for_review, client_seq)
  on public.responses to authenticated;

-- ---------------------------------------------------------------------------------------------
-- 3. Auth → application profile.
--    The role in sign-up metadata is user-controlled, so only `learner` and `guardian` are honoured;
--    an admin is promoted by an operator through db.system.
-- ---------------------------------------------------------------------------------------------
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := coalesce(new.raw_user_meta_data ->> 'role', 'learner');
  v_name text := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'name', '')), '');
begin
  if v_role not in ('learner', 'guardian') then
    v_role := 'learner';
  end if;

  insert into public.users (id, email, display_name, role)
  values (new.id, new.email, v_name, v_role)
  on conflict (id) do nothing;

  if v_role = 'learner' then
    insert into public.learners (user_id) values (new.id) on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create or replace function private.sync_user_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.users set email = new.email where id = new.id and email is distinct from new.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function private.sync_user_email();

-- Every learner has a credit account from the start (balance 0 until the welcome grant, BE-D36).
create or replace function private.create_credit_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.credit_accounts (learner_id) values (new.id) on conflict (learner_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_learner_created on public.learners;
create trigger on_learner_created
  after insert on public.learners
  for each row execute function private.create_credit_account();

-- ---------------------------------------------------------------------------------------------
-- 4. Integrity triggers.
-- ---------------------------------------------------------------------------------------------

-- The prerequisite graph stays acyclic (K7): a new edge from → to is refused when `to` already reaches `from`.
create or replace function private.forbid_prerequisite_cycle()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.edge_type = 'prerequisite' and exists (
    with recursive reach(id) as (
      select e.to_concept_id from public.concept_edges e
        where e.from_concept_id = new.to_concept_id and e.edge_type = 'prerequisite'
      union
      select e.to_concept_id from public.concept_edges e
        join reach r on e.from_concept_id = r.id where e.edge_type = 'prerequisite'
    )
    select 1 from reach where id = new.from_concept_id
  ) then
    raise exception 'prerequisite cycle: % -> %', new.from_concept_id, new.to_concept_id using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists concept_edges_no_cycle on public.concept_edges;
create trigger concept_edges_no_cycle
  before insert or update on public.concept_edges
  for each row execute function private.forbid_prerequisite_cycle();

-- The credit ledger is append-only. Deleting rows is allowed only when the erasure job sets
-- `app.allow_ledger_delete = 'on'` for its transaction (BE-D58); the audit log is never updated.
create or replace function private.forbid_ledger_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    raise exception '% is append-only', tg_table_name using errcode = '55000';
  end if;
  if tg_op = 'DELETE' and tg_table_name = 'credit_transactions'
     and coalesce(current_setting('app.allow_ledger_delete', true), '') <> 'on' then
    raise exception 'credit_transactions rows cannot be deleted' using errcode = '55000';
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists credit_transactions_append_only on public.credit_transactions;
create trigger credit_transactions_append_only
  before update or delete on public.credit_transactions
  for each row execute function private.forbid_ledger_change();

drop trigger if exists audit_logs_no_update on public.audit_logs;
create trigger audit_logs_no_update
  before update on public.audit_logs
  for each row execute function private.forbid_ledger_change();

-- ---------------------------------------------------------------------------------------------
-- 5. Guardian read access: summaries only, never raw tables (D5). SECURITY DEFINER with an
--    explicit ownership check; a non-guardian gets NULL / no rows and learns nothing.
-- ---------------------------------------------------------------------------------------------
create or replace function public.guardian_children()
returns table (
  learner_id uuid,
  display_name text,
  relationship_id uuid,
  relationship_type text,
  consent_verified_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select l.id, u.display_name, g.id, g.relationship_type, g.consent_verified_at
  from public.guardian_relationships g
  join public.learners l on l.id = g.learner_id
  join public.users u on u.id = l.user_id
  where g.guardian_user_id = (select auth.uid()) and g.consent_status = 'verified'
  order by g.created_at
$$;

create or replace function public.guardian_child_summary(p_learner_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if p_learner_id is null or p_learner_id not in (select private.guardian_learner_ids()) then
    return null;
  end if;

  select jsonb_build_object(
    'learner', (
      select jsonb_build_object('id', l.id, 'name', u.display_name, 'exam', e.code)
      from public.learners l
      join public.users u on u.id = l.user_id
      left join public.exams e on e.id = l.exam_id
      where l.id = p_learner_id
    ),
    'latest_diagnostic', (
      select jsonb_build_object(
        'attempt_id', a.id, 'score', a.score, 'max', a.max_score, 'percentage', a.percentage, 'date', a.submitted_at
      )
      from public.attempts a
      join public.assessments s on s.id = a.assessment_id
      where a.learner_id = p_learner_id and s.assessment_type = 'diagnostic' and a.status = 'submitted'
      order by a.submitted_at desc
      limit 1
    ),
    -- Names and severity only; the mastery number is never shown below Medium confidence (DS §39).
    'weakest', (
      select coalesce(jsonb_agg(jsonb_build_object('concept', w.name, 'severity', w.severity) order by w.mastery_score), '[]'::jsonb)
      from (
        select c.name, st.mastery_score,
          case
            when st.mastery_score >= 0.80 then 'strong'
            when st.mastery_score >= 0.65 then 'stable'
            when st.mastery_score >= 0.50 then 'needs_work'
            when st.mastery_score >= 0.35 then 'weak'
            else 'critical'
          end as severity
        from public.student_concept_state st
        join public.concepts c on c.id = st.concept_id
        where st.learner_id = p_learner_id and st.confidence_score >= 0.66 and st.mastery_score < 0.65
        order by st.mastery_score asc
        limit 5
      ) w
    ),
    'plan', (
      select jsonb_build_object('total', count(*), 'done', count(*) filter (where t.status = 'completed'))
      from public.plan_tasks t
      join public.study_plans p on p.id = t.study_plan_id
      where p.learner_id = p_learner_id and p.status = 'active' and t.scheduled_date < p.start_date + 7
    ),
    'next_retest', (
      select r.scheduled_for from public.retests r
      where r.learner_id = p_learner_id and r.status in ('scheduled', 'available')
      order by r.scheduled_for asc nulls last
      limit 1
    ),
    'retest_outcomes', (
      select coalesce(jsonb_agg(jsonb_build_object('date', o.updated_at, 'status', o.improvement_status) order by o.updated_at desc), '[]'::jsonb)
      from (
        select r.updated_at, rr.improvement_status
        from public.retests r join public.retest_results rr on rr.retest_id = r.id
        where r.learner_id = p_learner_id
        order by r.updated_at desc
        limit 5
      ) o
    ),
    'purchases', (
      select coalesce(jsonb_agg(jsonb_build_object('date', p.created_at, 'item', p.item_code, 'amount_inr', p.amount_inr, 'status', p.status) order by p.created_at desc), '[]'::jsonb)
      from (select * from public.payments where learner_id = p_learner_id order by created_at desc limit 10) p
    ),
    'pending_approvals', (
      select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'item', a.item_code, 'amount_inr', a.amount_inr, 'expires_at', a.expires_at) order by a.created_at), '[]'::jsonb)
      from public.purchase_approvals a
      where a.learner_id = p_learner_id and a.status = 'requested'
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.guardian_children() from public, anon;
revoke all on function public.guardian_child_summary(uuid) from public, anon;
grant execute on function public.guardian_children() to authenticated;
grant execute on function public.guardian_child_summary(uuid) to authenticated;
