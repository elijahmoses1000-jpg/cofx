-- COFX touchpoint engine
--
-- fn_queue_after_sales already queues birthday / battery / service / winback,
-- but nothing ever called it: pg_cron is not installed. This migration adds the
-- scheduler and supersedes that function.
--
-- DEDUPE KEYS ARE DELIBERATELY IDENTICAL TO THE EXISTING ONES.
--   birthday:{customer_id}:{YYYY}
--   battery:{vehicle_id}:{YYYYMM of battery_installed_on}
--   service:{vehicle_id}:{YYYYMMDD of next_service_due}
--   winback:{customer_id}:{YYYYMM}
-- Changing any of these formats would re-send every message already delivered,
-- because engagements.dedupe_key is what makes the queue idempotent.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- The dispatcher claims a batch by flipping rows to 'sending' before calling a
-- provider, so two overlapping runs cannot send the same message twice.
alter table public.engagements drop constraint if exists engagements_status_check;
alter table public.engagements add constraint engagements_status_check
  check (status in ('queued','sending','sent','failed','skipped'));

-- Rows stuck in 'sending' mean a dispatcher died mid-flight. Return them.
create or replace function public.fn_requeue_stuck_engagements()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare n integer;
begin
  update engagements
     set status = 'queued'
   where status = 'sending'
     and scheduled_for < now() - interval '30 minutes';
  get diagnostics n = row_count;
  return n;
end;
$$;

-- ---------------------------------------------------------------------------
-- Channel preference: whatsapp > sms > email.
-- The existing function hardcoded 'email'; every customer row carries a
-- whatsapp or phone value that was going unused.
-- ---------------------------------------------------------------------------
create or replace function public.fn_preferred_channel(
  p_whatsapp text, p_phone text, p_email text
) returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when coalesce(trim(p_whatsapp), '') <> '' then 'whatsapp'
    when coalesce(trim(p_phone),    '') <> '' then 'sms'
    else 'email'
  end;
$$;

-- ---------------------------------------------------------------------------
-- Service reminders at 30 and 14 days out.
--
-- The legacy function emitted ONE reminder for anything due inside 14 days,
-- keyed 'service:{vid}:{YYYYMMDD}'. The brief wants two windows, so the keys
-- gain a :t30 / :t14 suffix -- and the legacy key is excluded explicitly so the
-- four reminders already sent are not repeated under the new scheme.
-- ---------------------------------------------------------------------------
create or replace function public.fn_queue_service_reminders()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare n integer;
begin
  insert into engagements (
    customer_id, vehicle_id, type, channel, status,
    subject, body, dedupe_key, scheduled_for
  )
  select
    v.customer_id, v.id, 'service_reminder',
    fn_preferred_channel(c.whatsapp, c.phone, c.email),
    'queued',
    'Service due for your ' || v.make || ' ' || coalesce(v.model, ''),
    'Hi ' || split_part(c.full_name, ' ', 1) || ', your ' || v.make || ' '
      || coalesce(v.model, '') || coalesce(' (' || v.plate_number || ')', '')
      || ' is due for service on ' || to_char(v.next_service_due, 'DD Mon YYYY')
      || '. Reply to book a slot at Wannerpart.',
    'service:' || v.id::text || ':' || to_char(v.next_service_due, 'YYYYMMDD')
      || ':' || w.label,
    now()
  from vehicles v
  join customers c on c.id = v.customer_id
  cross join lateral (values (30, 't30'), (14, 't14')) as w(days_before, label)
  where v.next_service_due is not null
    and c.consent_marketing
    and v.next_service_due - w.days_before = current_date
    -- Do not re-contact anyone the legacy function already reached.
    and not exists (
      select 1 from engagements e
       where e.vehicle_id = v.id
         and e.dedupe_key = 'service:' || v.id::text
                            || ':' || to_char(v.next_service_due, 'YYYYMMDD')
    )
  on conflict (dedupe_key) do nothing;

  get diagnostics n = row_count;
  return n;
end;
$$;

-- ---------------------------------------------------------------------------
-- Overdue catch-up. Nothing in the existing schema handles a vehicle whose
-- due date has already passed, so the three currently overdue stay silent.
-- Fires once per vehicle per due date.
-- ---------------------------------------------------------------------------
create or replace function public.fn_queue_overdue_service()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare n integer;
begin
  insert into engagements (
    customer_id, vehicle_id, type, channel, status,
    subject, body, dedupe_key, scheduled_for
  )
  select
    v.customer_id, v.id, 'service_reminder',
    fn_preferred_channel(c.whatsapp, c.phone, c.email),
    'queued',
    'Your service is overdue',
    'Hi ' || split_part(c.full_name, ' ', 1) || ', our records show your '
      || v.make || ' ' || coalesce(v.model, '') || ' was due for service on '
      || to_char(v.next_service_due, 'DD Mon YYYY')
      || '. Reply and we will fit you in this week.',
    'overdue:' || v.id::text || ':' || to_char(v.next_service_due, 'YYYYMMDD'),
    now()
  from vehicles v
  join customers c on c.id = v.customer_id
  where v.next_service_due is not null
    and v.next_service_due < current_date
    and c.consent_marketing
  on conflict (dedupe_key) do nothing;

  get diagnostics n = row_count;
  return n;
end;
$$;

-- ---------------------------------------------------------------------------
-- Birthdays. Key matches the legacy format exactly: birthday:{cid}:{YYYY}
-- ---------------------------------------------------------------------------
create or replace function public.fn_queue_birthdays()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare n integer;
begin
  insert into engagements (
    customer_id, type, channel, status, subject, body, dedupe_key, scheduled_for
  )
  select
    c.id, 'birthday',
    fn_preferred_channel(c.whatsapp, c.phone, c.email),
    'queued',
    'Happy birthday from Wannerpart by COFX',
    'Happy birthday, ' || split_part(c.full_name, ' ', 1)
      || '. Enjoy five percent off any part or lubricant this month.',
    'birthday:' || c.id::text || ':' || to_char(now(), 'YYYY'),
    now()
  from customers c
  where c.consent_marketing
    and c.birthday is not null
    and to_char(c.birthday, 'MM-DD') = to_char(now(), 'MM-DD')
  on conflict (dedupe_key) do nothing;

  get diagnostics n = row_count;
  return n;
end;
$$;

-- ---------------------------------------------------------------------------
-- Battery warranty. Key matches legacy: battery:{vid}:{YYYYMM installed}
-- ---------------------------------------------------------------------------
create or replace function public.fn_queue_battery_reminders()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare n integer;
begin
  insert into engagements (
    customer_id, vehicle_id, type, channel, status,
    subject, body, dedupe_key, scheduled_for
  )
  select
    c.id, v.id, 'battery_reminder',
    fn_preferred_channel(c.whatsapp, c.phone, c.email),
    'queued',
    'Battery check due for your ' || v.make || ' ' || coalesce(v.model, ''),
    'The battery fitted on ' || to_char(v.battery_installed_on, 'DD Mon YYYY')
      || ' is close to the end of its expected life. Book a free battery test '
      || 'at Wannerpart.',
    'battery:' || v.id::text || ':' || to_char(v.battery_installed_on, 'YYYYMM'),
    now()
  from vehicles v
  join customers c on c.id = v.customer_id
  where c.consent_marketing
    and v.battery_installed_on is not null
    and current_date >= (v.battery_installed_on
        + (v.battery_warranty_months || ' months')::interval
        - interval '30 days')
  on conflict (dedupe_key) do nothing;

  get diagnostics n = row_count;
  return n;
end;
$$;

-- ---------------------------------------------------------------------------
-- Win-back. Key matches legacy monthly bucket: winback:{cid}:{YYYYMM}
-- ---------------------------------------------------------------------------
create or replace function public.fn_queue_winback()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare n integer;
begin
  insert into engagements (
    customer_id, type, channel, status, subject, body, dedupe_key, scheduled_for
  )
  select
    c.id, 'winback',
    fn_preferred_channel(c.whatsapp, c.phone, c.email),
    'queued',
    'We have not seen you in a while',
    'Hi ' || split_part(c.full_name, ' ', 1)
      || ', it has been a while since your last visit. Here is 15% off your '
      || 'next service at Wannerpart.',
    'winback:' || c.id::text || ':' || to_char(now(), 'YYYYMM'),
    now()
  from customers c
  where c.consent_marketing
    and c.last_purchase_at is not null
    and c.last_purchase_at < now() - interval '6 months'
  on conflict (dedupe_key) do nothing;

  get diagnostics n = row_count;
  return n;
end;
$$;

-- ---------------------------------------------------------------------------
-- Single entry point. Returns per-type counts so a bad night is visible.
-- ---------------------------------------------------------------------------
create or replace function public.fn_queue_touchpoints()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return jsonb_build_object(
    'ran_at',           now(),
    'service_reminder', fn_queue_service_reminders(),
    'service_overdue',  fn_queue_overdue_service(),
    'birthday',         fn_queue_birthdays(),
    'battery',          fn_queue_battery_reminders(),
    'winback',          fn_queue_winback()
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Supersede the legacy function.
--
-- It is left callable but delegates, so any existing caller in the app or a
-- console keeps working and CANNOT produce a second copy of every message.
-- ---------------------------------------------------------------------------
create or replace function public.fn_queue_after_sales()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  result jsonb;
begin
  -- Superseded by fn_queue_touchpoints. Retained so old call sites still work.
  result := fn_queue_touchpoints();
  return coalesce((result->>'service_reminder')::int, 0)
       + coalesce((result->>'service_overdue')::int, 0)
       + coalesce((result->>'birthday')::int, 0)
       + coalesce((result->>'battery')::int, 0)
       + coalesce((result->>'winback')::int, 0);
end;
$$;

-- ---------------------------------------------------------------------------
-- Schedule. 07:00 UTC = 08:00 Lagos (WAT, no DST).
-- fn_escalate_stale_tickets already existed but nothing ever called it.
-- ---------------------------------------------------------------------------
select cron.schedule('cofx-queue-touchpoints', '0 7 * * *',
  $$select public.fn_queue_touchpoints()$$);

select cron.schedule('cofx-escalate-stale-tickets', '*/30 * * * *',
  $$select public.fn_escalate_stale_tickets()$$);

select cron.schedule('cofx-requeue-stuck', '*/20 * * * *',
  $$select public.fn_requeue_stuck_engagements()$$);

-- ---------------------------------------------------------------------------
-- These are scheduler entry points, not REST endpoints.
-- ---------------------------------------------------------------------------
revoke execute on function public.fn_queue_touchpoints()          from anon, authenticated;
revoke execute on function public.fn_queue_after_sales()          from anon, authenticated;
revoke execute on function public.fn_queue_service_reminders()    from anon, authenticated;
revoke execute on function public.fn_queue_overdue_service()      from anon, authenticated;
revoke execute on function public.fn_queue_birthdays()            from anon, authenticated;
revoke execute on function public.fn_queue_battery_reminders()    from anon, authenticated;
revoke execute on function public.fn_queue_winback()              from anon, authenticated;
revoke execute on function public.fn_requeue_stuck_engagements()  from anon, authenticated;
revoke execute on function public.fn_escalate_stale_tickets()     from anon, authenticated;
