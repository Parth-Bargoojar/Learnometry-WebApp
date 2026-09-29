-- 0 · private helpers used by RLS policies (BE-1.3).
-- Runs before the tables exist, so function bodies are not validated at creation time.
-- Rollback: drop schema private cascade (after dropping the policies that use it).
set check_function_bodies = off;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

-- The signed-in user's learner id. SECURITY DEFINER so policies on other tables can call it
-- without recursing into the learners policy.
create or replace function private.current_learner_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select l.id from public.learners l where l.user_id = (select auth.uid())
$$;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.users u
    where u.id = (select auth.uid()) and u.role = 'admin' and u.status = 'active'
  )
$$;

-- Relationships where the signed-in user is a guardian whose consent is verified.
create or replace function private.guardian_relationship_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select g.id from public.guardian_relationships g
  where g.guardian_user_id = (select auth.uid()) and g.consent_status = 'verified'
$$;

-- Learners the signed-in user guards (verified consent only).
create or replace function private.guardian_learner_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select g.learner_id from public.guardian_relationships g
  where g.guardian_user_id = (select auth.uid()) and g.consent_status = 'verified'
$$;

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated, service_role;
