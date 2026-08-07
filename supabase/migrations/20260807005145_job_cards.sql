-- COFX job cards - the missing service-tracking layer.
--
-- appointments.status is scheduled|confirmed|completed|no_show|cancelled. That
-- describes a BOOKING, not WORK. A technician cannot express "on the ramp",
-- "waiting for a part", or "ready for pickup" with it, so the brief's
-- "notify the customer when the car is ready" has nothing to fire from.
--
-- job_cards is the Service_Record the brief asks for. It also closes the
-- retention loop: completing a job sets vehicles.next_service_due, which is
-- what fn_queue_service_reminders reads 30 and 14 days out.

-- "Your car is ready" is not a service reminder, and mislabelling it would
-- corrupt any reporting that groups by type. Widen the constraint first.
alter table public.engagements drop constraint if exists engagements_type_check;
alter table public.engagements add constraint engagements_type_check
  check (type in ('birthday','battery_reminder','service_reminder','feedback',
                  'loyalty','winback','ready_for_pickup'));

create table if not exists public.job_cards (
  id                uuid primary key default gen_random_uuid(),
  job_no            text unique,
  customer_id       uuid not null references public.customers(id) on delete cascade,
  vehicle_id        uuid not null references public.vehicles(id)  on delete cascade,
  appointment_id    uuid references public.appointments(id) on delete set null,
  order_id          uuid references public.orders(id)       on delete set null,

  technician_id     uuid references public.profiles(id),
  bay               text,
  branch            text not null default 'Wannerpart Lagos',

  status            text not null default 'received'
                    check (status in ('received','diagnosing','awaiting_parts',
                                      'awaiting_approval','in_progress',
                                      'ready_for_pickup','delivered','cancelled')),

  complaint         text,
  diagnosis         text,
  work_performed    text,
  mileage_in_km     integer,

  -- Drives the next reminder cycle. Default 6 months is the common interval;
  -- override per job for fleet or severe-duty vehicles.
  service_interval_months integer not null default 6,

  labour_cost       numeric not null default 0,
  parts_cost        numeric not null default 0,
  total_cost        numeric generated always as (labour_cost + parts_cost) stored,

  promised_at       timestamptz,
  started_at        timestamptz,
  ready_at          timestamptz,
  delivered_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_job_cards_status   on public.job_cards(status)
  where status not in ('delivered','cancelled');
create index if not exists idx_job_cards_vehicle  on public.job_cards(vehicle_id);
create index if not exists idx_job_cards_customer on public.job_cards(customer_id);

-- Status transitions are the audit trail for the workshop floor.
create table if not exists public.job_card_events (
  id           uuid primary key default gen_random_uuid(),
  job_card_id  uuid not null references public.job_cards(id) on delete cascade,
  actor_id     uuid references public.profiles(id),
  actor_name   text not null default 'System',
  from_status  text,
  to_status    text,
  note         text,
  created_at   timestamptz not null default now()
);

create index if not exists idx_job_card_events_job on public.job_card_events(job_card_id);

-- ---------------------------------------------------------------------------
-- Human-readable job numbers, matching the existing ticket_no / order_no style.
-- ---------------------------------------------------------------------------
create sequence if not exists public.job_card_seq;

create or replace function public.fn_job_card_before_insert()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.job_no is null then
    new.job_no := 'JOB-' || to_char(now(), 'YYMM') || '-'
                  || lpad(nextval('public.job_card_seq')::text, 4, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_job_card_before_insert on public.job_cards;
create trigger trg_job_card_before_insert
  before insert on public.job_cards
  for each row execute function public.fn_job_card_before_insert();

-- ---------------------------------------------------------------------------
-- The retention loop.
--
-- ready_for_pickup -> queue a "your car is ready" message
-- delivered        -> stamp the vehicle's service dates and queue feedback
--
-- Setting next_service_due here is what makes the reminder engine self-
-- sustaining: every completed job schedules its own follow-up.
-- ---------------------------------------------------------------------------
create or replace function public.fn_job_card_after_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_channel text;
  v_customer customers%rowtype;
  v_vehicle  vehicles%rowtype;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  insert into job_card_events (job_card_id, from_status, to_status)
  values (new.id, old.status, new.status);

  select * into v_customer from customers where id = new.customer_id;
  select * into v_vehicle  from vehicles  where id = new.vehicle_id;

  v_channel := fn_preferred_channel(v_customer.whatsapp, v_customer.phone, v_customer.email);

  if new.status = 'ready_for_pickup' then
    new.ready_at := coalesce(new.ready_at, now());

    insert into engagements (
      customer_id, vehicle_id, type, channel, status,
      subject, body, dedupe_key, scheduled_for
    )
    values (
      new.customer_id, new.vehicle_id, 'ready_for_pickup', v_channel, 'queued',
      'Your vehicle is ready for pickup',
      'Hi ' || split_part(v_customer.full_name, ' ', 1) || ', your '
        || v_vehicle.make || ' ' || coalesce(v_vehicle.model, '')
        || ' (job ' || new.job_no || ') is ready for collection at ' || new.branch || '.',
      'ready:' || new.id::text,
      now()
    )
    on conflict (dedupe_key) do nothing;

  elsif new.status = 'delivered' then
    new.delivered_at := coalesce(new.delivered_at, now());

    -- This is the line that makes retention compound.
    update vehicles
       set last_service_at  = current_date,
           next_service_due = current_date + (new.service_interval_months || ' months')::interval,
           mileage_km       = coalesce(new.mileage_in_km, mileage_km)
     where id = new.vehicle_id;

    insert into engagements (
      customer_id, vehicle_id, type, channel, status,
      subject, body, dedupe_key, scheduled_for
    )
    values (
      new.customer_id, new.vehicle_id, 'feedback', v_channel, 'queued',
      'How did we do?',
      'Thanks for choosing Wannerpart. How would you rate your service on job '
        || new.job_no || '? Reply 1-5.',
      -- Namespaced: fn_order_after_update already uses 'feedback:{order_id}'.
      -- Distinct UUIDs would not collide, but the prefix would be ambiguous.
      'feedback:job:' || new.id::text,
      now() + interval '1 day'
    )
    on conflict (dedupe_key) do nothing;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_job_card_after_update on public.job_cards;
create trigger trg_job_card_after_update
  before update on public.job_cards
  for each row execute function public.fn_job_card_after_update();

-- ---------------------------------------------------------------------------
-- RLS, matching the 3-4 policy shape used across your existing tables.
-- ---------------------------------------------------------------------------
alter table public.job_cards       enable row level security;
alter table public.job_card_events enable row level security;

create policy "staff read job_cards"   on public.job_cards
  for select to authenticated using (true);
create policy "staff insert job_cards" on public.job_cards
  for insert to authenticated with check (true);
create policy "staff update job_cards" on public.job_cards
  for update to authenticated using (true);
create policy "admin delete job_cards" on public.job_cards
  for delete to authenticated
  using (exists (select 1 from profiles p
                  where p.id = auth.uid() and p.role in ('admin','manager')));

create policy "staff read job_card_events"   on public.job_card_events
  for select to authenticated using (true);
create policy "staff insert job_card_events" on public.job_card_events
  for insert to authenticated with check (true);
create policy "admin delete job_card_events" on public.job_card_events
  for delete to authenticated
  using (exists (select 1 from profiles p
                  where p.id = auth.uid() and p.role in ('admin','manager')));
