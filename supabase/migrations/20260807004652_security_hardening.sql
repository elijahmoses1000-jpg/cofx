-- COFX security hardening
--
-- Fixes found by auditing the live schema on 2026-08-07.
--
-- 1. PRIVILEGE ESCALATION (critical). `staff_update` on profiles was
--    `USING (true) WITH CHECK (true)` for every authenticated user, so any
--    signed-in member of staff could run
--        update profiles set role = 'admin' where id = auth.uid();
--    and then satisfy every manager_delete policy in the database.
--
-- 2. Two SECURITY DEFINER views bypassing RLS (linter ERROR).
--
-- 3. fn_handle_new_user() callable over REST by anon.
--
-- 4. Eight legacy functions with a mutable search_path.

-- ---------------------------------------------------------------------------
-- 1. Lock down profiles
-- ---------------------------------------------------------------------------

drop policy if exists staff_update on public.profiles;
drop policy if exists staff_write  on public.profiles;

-- Staff may edit their own row. The guard trigger below is what actually stops
-- them editing role/active - a WITH CHECK cannot compare against OLD.
drop policy if exists profile_self_update on public.profiles;
create policy profile_self_update on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Admins and managers may edit anyone.
create policy admin_update_profiles on public.profiles
  for update to authenticated
  using (exists (select 1 from public.profiles p
                  where p.id = auth.uid() and p.role in ('admin','manager')))
  with check (true);

-- New profiles come from fn_handle_new_user (SECURITY DEFINER, bypasses RLS)
-- or from an admin. Nobody else inserts staff records.
create policy admin_insert_profiles on public.profiles
  for insert to authenticated
  with check (exists (select 1 from public.profiles p
                       where p.id = auth.uid() and p.role in ('admin','manager')));

-- Belt and braces: even with a policy mistake, only an admin changes role or
-- active. auth.uid() is null for the service role and for trigger-driven
-- inserts, which must keep working.
create or replace function public.fn_profiles_guard()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_role text;
begin
  if auth.uid() is null then
    return new;  -- service role or internal trigger context
  end if;

  if new.role is distinct from old.role or new.active is distinct from old.active then
    select role into v_actor_role from public.profiles where id = auth.uid();
    if coalesce(v_actor_role, '') <> 'admin' then
      raise exception 'Only an admin may change role or active status'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_profiles_guard on public.profiles;
create trigger trg_profiles_guard
  before update on public.profiles
  for each row execute function public.fn_profiles_guard();

-- ---------------------------------------------------------------------------
-- 2. Views must respect the querying user's RLS, not the creator's.
-- ---------------------------------------------------------------------------

alter view public.v_customer_of_the_year set (security_invoker = true);
alter view public.v_sales_leaderboard    set (security_invoker = true);

-- ---------------------------------------------------------------------------
-- 3. fn_handle_new_user is an auth trigger, not an API endpoint.
-- ---------------------------------------------------------------------------

-- NOTE: Postgres grants EXECUTE to PUBLIC by default. Revoking only from
-- anon/authenticated leaves the function reachable via /rest/v1/rpc -- the
-- PUBLIC grant must be revoked explicitly or nothing changes.
revoke execute on function public.fn_handle_new_user() from public, anon, authenticated;

revoke execute on function public.fn_queue_touchpoints()         from public, anon, authenticated;
revoke execute on function public.fn_queue_after_sales()         from public, anon, authenticated;
revoke execute on function public.fn_queue_service_reminders()   from public, anon, authenticated;
revoke execute on function public.fn_queue_overdue_service()     from public, anon, authenticated;
revoke execute on function public.fn_queue_birthdays()           from public, anon, authenticated;
revoke execute on function public.fn_queue_battery_reminders()   from public, anon, authenticated;
revoke execute on function public.fn_queue_winback()             from public, anon, authenticated;
revoke execute on function public.fn_requeue_stuck_engagements() from public, anon, authenticated;
revoke execute on function public.fn_escalate_stale_tickets()    from public, anon, authenticated;
revoke execute on function public.fn_profiles_guard()            from public, anon, authenticated;
revoke execute on function public.fn_preferred_channel(text,text,text) from public, anon, authenticated;

-- pg_net rejects SET SCHEMA, so it must be dropped and recreated out of public.
drop extension if exists pg_net;
create extension pg_net with schema extensions;

-- ---------------------------------------------------------------------------
-- 4. Pin search_path on the legacy functions.
--
-- Without this a caller can prepend a schema they control and have the function
-- resolve `profiles` or `engagements` to their own table.
-- ---------------------------------------------------------------------------

alter function public.fn_ticket_before_insert()     set search_path = public, pg_temp;
alter function public.fn_ticket_after_insert()      set search_path = public, pg_temp;
alter function public.fn_ticket_before_update()     set search_path = public, pg_temp;
alter function public.fn_ticket_after_update()      set search_path = public, pg_temp;
alter function public.fn_touch_ticket_on_event()    set search_path = public, pg_temp;
alter function public.fn_order_before_insert()      set search_path = public, pg_temp;
alter function public.fn_order_after_update()       set search_path = public, pg_temp;
alter function public.fn_escalate_stale_tickets()   set search_path = public, pg_temp;
alter function public.fn_touch_customer_on_note()   set search_path = public, pg_temp;

-- ---------------------------------------------------------------------------
-- NOT CHANGED - these need a business decision, not a unilateral fix.
--
-- `staff_update` on payments lets any signed-in user set status='confirmed',
-- and on orders lets anyone set status='released'. That is a segregation-of-
-- duties gap: the person who records a payment should not be the person who
-- confirms it. Restricting it to role='finance' would be correct but would
-- change who can operate the console, so it is left for you to decide.
--
-- pg_trgm sits in the public schema (linter WARN). Moving it would invalidate
-- customers_name_trgm, parts_name_trgm and kb_body_trgm, so it is left alone.
--
-- Leaked-password protection and additional MFA options are dashboard toggles,
-- not SQL. Both are currently off.
-- ---------------------------------------------------------------------------
