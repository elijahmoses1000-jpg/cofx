-- WhatsApp gateway support tables.

-- Baileys session state.
--
-- The most sensitive table here: the blob is equivalent to a logged-in session
-- for the whole WhatsApp account. Anyone who reads it can send as Wannerpart.
--
-- Two defences. The gateway encrypts with AES-256-GCM before insert, so
-- Postgres only ever holds ciphertext. And RLS is enabled with NO policies,
-- which denies anon and authenticated outright - service role only.
create table if not exists public.wa_auth_state (
  id          text primary key,          -- 'creds' or 'key-<type>-<id>'
  ciphertext  text not null,
  iv          text not null,
  auth_tag    text not null,
  updated_at  timestamptz not null default now()
);

alter table public.wa_auth_state enable row level security;
-- Intentionally no policies. RLS with zero policies denies all API roles.

revoke all on public.wa_auth_state from anon, authenticated;

-- Opt-out register. Honouring STOP is both the law in most markets and the
-- single biggest driver of the spam reports that get a number banned.
create table if not exists public.wa_optouts (
  wa_number    text primary key,
  reason       text,
  opted_out_at timestamptz not null default now()
);

alter table public.wa_optouts enable row level security;
create policy staff_read  on public.wa_optouts for select to authenticated using (true);
create policy staff_write on public.wa_optouts for insert to authenticated with check (true);

-- Outbound send log. Rate limiting reads it, and a ban post-mortem needs to
-- know what the number was actually doing.
create table if not exists public.wa_send_log (
  id            uuid primary key default gen_random_uuid(),
  wa_number     text not null,
  engagement_id uuid references public.engagements(id) on delete set null,
  direction     text not null default 'out' check (direction in ('in','out')),
  ok            boolean not null default true,
  error         text,
  sent_at       timestamptz not null default now()
);

create index if not exists idx_wa_send_log_number on public.wa_send_log(wa_number, sent_at desc);
create index if not exists idx_wa_send_log_sent   on public.wa_send_log(sent_at desc);

alter table public.wa_send_log enable row level security;
create policy staff_read on public.wa_send_log for select to authenticated using (true);

-- Suppress engagements for opted-out numbers at insert time, so a queued
-- message can never reach someone who asked to stop even if a dispatcher
-- misbehaves.
create or replace function public.fn_suppress_optout()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_num text;
begin
  select regexp_replace(coalesce(c.whatsapp, c.phone, ''), '\D', '', 'g')
    into v_num from public.customers c where c.id = new.customer_id;

  if v_num <> '' and exists (select 1 from public.wa_optouts o where o.wa_number = v_num) then
    new.status := 'skipped';
    new.response := 'Recipient opted out';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_suppress_optout on public.engagements;
create trigger trg_suppress_optout before insert on public.engagements
  for each row execute function public.fn_suppress_optout();

revoke execute on function public.fn_suppress_optout() from public, anon, authenticated;
