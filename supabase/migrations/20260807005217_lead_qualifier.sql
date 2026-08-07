-- COFX agentic lead qualifier (BANT)
--
-- NOT APPLIED. Review the BANT model against how your sales team actually
-- qualifies before this goes near production.
--
-- Deliberately transport-agnostic. A lead arriving over Baileys, the WhatsApp
-- Cloud API, or a web form lands in the same table with the same scoring. That
-- keeps this work valuable regardless of which transport you settle on, and
-- lets you switch without touching the qualification logic.

create table if not exists public.leads (
  id                uuid primary key default gen_random_uuid(),
  lead_no           text unique,

  -- Identity. wa_number is the join key for WhatsApp-originated leads and is
  -- normalised to 234XXXXXXXXXX so it matches customers.phone.
  full_name         text,
  wa_number         text,
  email             text,
  company           text,

  -- Attribution. customers.source already allows 'campaign' but there was
  -- nothing recording WHICH campaign, so spend could not be tied to revenue.
  source            text not null default 'whatsapp'
                    check (source in ('whatsapp','web_form','call','referral','walk_in','import')),
  campaign_id       text,
  utm_source        text,
  utm_medium        text,
  utm_campaign      text,
  ad_click_id       text,

  -- BANT. Null means "not yet established" - distinct from a scored zero.
  budget_min        numeric,
  budget_max        numeric,
  has_authority     boolean,
  need_summary      text,
  timeline_days     integer,

  bant_score        integer not null default 0 check (bant_score between 0 and 100),
  qualification     text not null default 'unqualified'
                    check (qualification in ('unqualified','partial','qualified','disqualified')),
  disqualify_reason text,

  status            text not null default 'new'
                    check (status in ('new','engaging','qualified','handed_off','converted','lost','dormant')),

  assigned_to       uuid references public.profiles(id) on delete set null,
  ticket_id         uuid references public.sales_tickets(id) on delete set null,
  customer_id       uuid references public.customers(id) on delete set null,
  conversation_id   uuid references public.conversations(id) on delete set null,

  first_contact_at  timestamptz default now(),
  last_contact_at   timestamptz default now(),
  qualified_at      timestamptz,
  converted_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_leads_status  on public.leads(status) where status not in ('converted','lost');
create index if not exists idx_leads_wa      on public.leads(wa_number);
create index if not exists idx_leads_score   on public.leads(bant_score desc);
create unique index if not exists idx_leads_wa_open on public.leads(wa_number)
  where status not in ('converted','lost','dormant');

-- Every qualification step, so a disputed score can be reconstructed.
create table if not exists public.lead_events (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid not null references public.leads(id) on delete cascade,
  event_type  text not null default 'note'
              check (event_type in ('created','message_in','message_out','bant_update',
                                    'scored','assigned','handed_off','converted','lost')),
  field       text,
  old_value   text,
  new_value   text,
  note        text,
  actor_name  text not null default 'Qualifier agent',
  created_at  timestamptz not null default now()
);

create index if not exists idx_lead_events_lead on public.lead_events(lead_id, created_at desc);

create sequence if not exists public.lead_seq;

create or replace function public.fn_lead_before_insert()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if new.lead_no is null then
    new.lead_no := 'LD-' || to_char(now(), 'YYMM') || '-'
                   || lpad(nextval('public.lead_seq')::text, 4, '0');
  end if;
  if new.wa_number is not null then
    new.wa_number := regexp_replace(new.wa_number, '\D', '', 'g');
    if left(new.wa_number, 1) = '0' then
      new.wa_number := '234' || substr(new.wa_number, 2);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_lead_before_insert on public.leads;
create trigger trg_lead_before_insert before insert on public.leads
  for each row execute function public.fn_lead_before_insert();

-- ---------------------------------------------------------------------------
-- BANT scoring. Kept in SQL, not in the model's head, so the score is
-- deterministic and auditable. An LLM extracts the FACTS; this assigns the
-- NUMBER. A model that both gathers and grades will talk itself into a sale.
-- ---------------------------------------------------------------------------
create or replace function public.fn_score_lead(p_lead_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  l public.leads%rowtype;
  s integer := 0;
  q text;
begin
  select * into l from public.leads where id = p_lead_id;
  if not found then
    raise exception 'lead % not found', p_lead_id;
  end if;

  -- Budget: 30
  if l.budget_min is not null or l.budget_max is not null then
    s := s + case when coalesce(l.budget_max, l.budget_min) >= 500000 then 30
                  when coalesce(l.budget_max, l.budget_min) >= 100000 then 20
                  else 10 end;
  end if;

  -- Authority: 25
  if l.has_authority is true  then s := s + 25;
  elsif l.has_authority is false then s := s + 5;
  end if;

  -- Need: 25
  if l.need_summary is not null and length(trim(l.need_summary)) >= 10 then
    s := s + 25;
  end if;

  -- Timeline: 20. Sooner is worth more.
  if l.timeline_days is not null then
    s := s + case when l.timeline_days <= 7  then 20
                  when l.timeline_days <= 30 then 15
                  when l.timeline_days <= 90 then 8
                  else 3 end;
  end if;

  q := case when s >= 70 then 'qualified'
            when s >= 40 then 'partial'
            else 'unqualified' end;

  update public.leads
     set bant_score    = s,
         qualification = case when qualification = 'disqualified' then 'disqualified' else q end,
         qualified_at  = case when q = 'qualified' and qualified_at is null then now() else qualified_at end,
         status        = case when q = 'qualified' and status in ('new','engaging') then 'qualified' else status end,
         updated_at    = now()
   where id = p_lead_id;

  insert into public.lead_events (lead_id, event_type, field, new_value, note)
  values (p_lead_id, 'scored', 'bant_score', s::text, 'Deterministic BANT scoring');

  return s;
end;
$$;

revoke execute on function public.fn_score_lead(uuid) from public, anon;

-- ---------------------------------------------------------------------------
-- Converting a qualified lead into a customer + ticket. One place, so the
-- agent cannot invent its own conversion path.
-- ---------------------------------------------------------------------------
create or replace function public.fn_convert_lead(p_lead_id uuid, p_owner uuid default null)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  l public.leads%rowtype;
  v_customer_id uuid;
  v_ticket_id uuid;
begin
  select * into l from public.leads where id = p_lead_id for update;
  if not found then raise exception 'lead % not found', p_lead_id; end if;
  if l.status = 'converted' then return l.customer_id; end if;

  -- customers.phone is unique, so an existing customer wins.
  select id into v_customer_id from public.customers where phone = l.wa_number;

  if v_customer_id is null then
    insert into public.customers (full_name, phone, whatsapp, email, company, source, owner_id)
    values (coalesce(l.full_name, 'Lead ' || l.lead_no), l.wa_number, l.wa_number,
            l.email, l.company, 'campaign', coalesce(p_owner, l.assigned_to))
    returning id into v_customer_id;
  end if;

  insert into public.sales_tickets (customer_id, assigned_to, channel, subject, description,
                                    intent, value_estimate, priority)
  values (v_customer_id, coalesce(p_owner, l.assigned_to), 'whatsapp',
          'Qualified lead ' || l.lead_no,
          coalesce(l.need_summary, 'Converted from lead ' || l.lead_no),
          'parts_enquiry', coalesce(l.budget_max, l.budget_min, 0),
          case when l.timeline_days <= 7 then 'high' else 'normal' end)
  returning id into v_ticket_id;

  update public.leads
     set status = 'converted', customer_id = v_customer_id, ticket_id = v_ticket_id,
         converted_at = now(), updated_at = now()
   where id = p_lead_id;

  insert into public.lead_events (lead_id, event_type, note)
  values (p_lead_id, 'converted', 'Customer ' || v_customer_id || ', ticket ' || v_ticket_id);

  return v_customer_id;
end;
$$;

revoke execute on function public.fn_convert_lead(uuid, uuid) from public, anon;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.leads       enable row level security;
alter table public.lead_events enable row level security;

create policy staff_read   on public.leads for select to authenticated using (true);
create policy staff_write  on public.leads for insert to authenticated with check (true);
create policy staff_update on public.leads for update to authenticated using (true) with check (true);
create policy manager_delete on public.leads for delete to authenticated
  using (exists (select 1 from public.profiles p
                  where p.id = auth.uid() and p.role in ('admin','manager')));

create policy staff_read  on public.lead_events for select to authenticated using (true);
create policy staff_write on public.lead_events for insert to authenticated with check (true);

-- ---------------------------------------------------------------------------
-- WhatsApp session credentials do NOT belong in a table.
--
-- Baileys persists auth state that is equivalent to a logged-in session for the
-- whole WhatsApp account. Anyone who reads it can send as your business number.
-- Put it in Supabase Vault (vault.create_secret) or the Edge Function secret
-- store, never a plain column, and never one covered by a
-- `using (true)` staff policy.
-- ---------------------------------------------------------------------------
