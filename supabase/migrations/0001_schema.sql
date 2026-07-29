-- COFX operations platform, Wannerpart by COFX
-- Migration 0001: core relational schema

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

-- Staff profiles, linked to Supabase auth users
create table if not exists profiles (
    id uuid primary key,
    full_name text not null,
    email text unique not null,
    role text not null default 'sales' check (role in ('admin', 'manager', 'sales', 'finance', 'support')),
    phone text,
    branch text default 'Wannerpart Lagos',
    active boolean not null default true,
    created_at timestamptz not null default now()
);

-- Customers, the centralized CRM record
create table if not exists customers (
    id uuid primary key default gen_random_uuid(),
    full_name text not null,
    phone text unique,
    email text,
    whatsapp text,
    company text,
    customer_type text not null default 'individual' check (customer_type in ('individual', 'fleet', 'dealer', 'workshop')),
    address text,
    city text default 'Lagos',
    state text default 'Lagos',
    birthday date,
    source text not null default 'walk_in' check (source in ('walk_in', 'assistant', 'call', 'whatsapp', 'referral', 'campaign', 'import')),
    owner_id uuid references profiles (id) on delete set null,
    loyalty_tier text not null default 'bronze' check (loyalty_tier in ('bronze', 'silver', 'gold', 'platinum')),
    loyalty_points integer not null default 0,
    lifetime_value numeric(14, 2) not null default 0,
    total_orders integer not null default 0,
    last_purchase_at timestamptz,
    consent_marketing boolean not null default true,
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists customers_phone_idx on customers (phone);
create index if not exists customers_name_trgm on customers using gin (full_name gin_trgm_ops);

-- Vehicles owned by customers, drives service and battery reminders
create table if not exists vehicles (
    id uuid primary key default gen_random_uuid(),
    customer_id uuid not null references customers (id) on delete cascade,
    make text not null,
    model text,
    year integer,
    plate_number text,
    vin text,
    engine text,
    mileage_km integer,
    battery_installed_on date,
    battery_warranty_months integer not null default 18,
    last_service_at date,
    next_service_due date,
    created_at timestamptz not null default now()
);

create index if not exists vehicles_customer_idx on vehicles (customer_id);

-- Aftermarket parts catalogue
create table if not exists parts (
    id uuid primary key default gen_random_uuid(),
    sku text unique not null,
    name text not null,
    category text not null default 'general',
    brand text,
    description text,
    unit_price numeric(12, 2) not null default 0,
    cost_price numeric(12, 2) not null default 0,
    stock_qty integer not null default 0,
    reorder_level integer not null default 5,
    warranty_months integer not null default 6,
    active boolean not null default true,
    created_at timestamptz not null default now()
);

create index if not exists parts_name_trgm on parts using gin (name gin_trgm_ops);

-- Fitment matrix: one aftermarket part fits many vehicle makes and models
create table if not exists part_fitments (
    id uuid primary key default gen_random_uuid(),
    part_id uuid not null references parts (id) on delete cascade,
    make text not null,
    model text,
    year_from integer,
    year_to integer,
    note text
);

create index if not exists fitments_part_idx on part_fitments (part_id);
create index if not exists fitments_make_idx on part_fitments (lower(make));

-- Sales tickets: every inquiry becomes a tracked ticket
create table if not exists sales_tickets (
    id uuid primary key default gen_random_uuid(),
    ticket_no text unique,
    customer_id uuid references customers (id) on delete set null,
    assigned_to uuid references profiles (id) on delete set null,
    channel text not null default 'assistant' check (channel in ('assistant', 'call', 'whatsapp', 'walk_in', 'email', 'referral')),
    subject text not null,
    description text,
    intent text not null default 'parts_enquiry',
    status text not null default 'open' check (status in ('open', 'wip', 'awaiting_payment', 'closed', 'lost')),
    priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
    value_estimate numeric(12, 2) not null default 0,
    outcome text check (outcome in ('won', 'lost', 'no_response')),
    lost_reason text,
    due_at timestamptz,
    last_update_at timestamptz not null default now(),
    escalation_level integer not null default 0,
    closed_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists tickets_status_idx on sales_tickets (status);
create index if not exists tickets_assigned_idx on sales_tickets (assigned_to);

-- Immutable trail of everything that happens to a ticket
create table if not exists ticket_events (
    id uuid primary key default gen_random_uuid(),
    ticket_id uuid not null references sales_tickets (id) on delete cascade,
    actor_id uuid references profiles (id) on delete set null,
    actor_name text not null default 'System',
    event_type text not null default 'note' check (event_type in ('created', 'assigned', 'status_change', 'note', 'escalation', 'reminder', 'payment', 'closed')),
    from_status text,
    to_status text,
    note text,
    created_at timestamptz not null default now()
);

create index if not exists ticket_events_ticket_idx on ticket_events (ticket_id);

-- Orders raised against a ticket
create table if not exists orders (
    id uuid primary key default gen_random_uuid(),
    order_no text unique,
    customer_id uuid references customers (id) on delete set null,
    ticket_id uuid references sales_tickets (id) on delete set null,
    created_by uuid references profiles (id) on delete set null,
    status text not null default 'pending_payment' check (status in ('pending_payment', 'paid', 'released', 'cancelled')),
    subtotal numeric(12, 2) not null default 0,
    discount numeric(12, 2) not null default 0,
    total numeric(12, 2) not null default 0,
    payment_reference text unique,
    released_at timestamptz,
    released_by uuid references profiles (id) on delete set null,
    created_at timestamptz not null default now()
);

create table if not exists order_items (
    id uuid primary key default gen_random_uuid(),
    order_id uuid not null references orders (id) on delete cascade,
    part_id uuid references parts (id) on delete set null,
    description text not null,
    qty integer not null default 1,
    unit_price numeric(12, 2) not null default 0,
    line_total numeric(12, 2) not null default 0
);

-- Raw bank alert emails ingested by n8n or the webhook
create table if not exists bank_alerts (
    id uuid primary key default gen_random_uuid(),
    source text not null default 'email',
    raw_subject text,
    raw_body text,
    bank text,
    account_last4 text,
    amount numeric(14, 2),
    currency text not null default 'NGN',
    transaction_ref text,
    sender_name text,
    narration text,
    value_date timestamptz,
    received_at timestamptz not null default now(),
    parse_confidence numeric(5, 2) not null default 0,
    parse_method text not null default 'regex' check (parse_method in ('regex', 'llm', 'manual')),
    status text not null default 'unmatched' check (status in ('unmatched', 'matched', 'ignored', 'duplicate')),
    created_at timestamptz not null default now()
);

create index if not exists bank_alerts_ref_idx on bank_alerts (transaction_ref);
create index if not exists bank_alerts_status_idx on bank_alerts (status);

-- Payments expected against orders, matched to bank alerts
create table if not exists payments (
    id uuid primary key default gen_random_uuid(),
    order_id uuid references orders (id) on delete cascade,
    customer_id uuid references customers (id) on delete set null,
    amount numeric(14, 2) not null,
    method text not null default 'transfer' check (method in ('transfer', 'cash', 'pos', 'cheque')),
    declared_ref text,
    bank_alert_id uuid references bank_alerts (id) on delete set null,
    status text not null default 'awaiting' check (status in ('awaiting', 'matched', 'confirmed', 'mismatch', 'rejected')),
    match_score numeric(5, 2) not null default 0,
    match_reason text,
    auto_approved boolean not null default false,
    confirmed_at timestamptz,
    confirmed_by uuid references profiles (id) on delete set null,
    created_at timestamptz not null default now()
);

create index if not exists payments_status_idx on payments (status);

-- Workshop appointments booked by the assistant or staff
create table if not exists appointments (
    id uuid primary key default gen_random_uuid(),
    customer_id uuid references customers (id) on delete cascade,
    vehicle_id uuid references vehicles (id) on delete set null,
    ticket_id uuid references sales_tickets (id) on delete set null,
    service_type text not null default 'general_service',
    scheduled_for timestamptz not null,
    duration_minutes integer not null default 60,
    bay text,
    estimated_wait_minutes integer,
    status text not null default 'scheduled' check (status in ('scheduled', 'confirmed', 'completed', 'no_show', 'cancelled')),
    notes text,
    created_at timestamptz not null default now()
);

-- Assistant conversations and transcripts
create table if not exists conversations (
    id uuid primary key default gen_random_uuid(),
    customer_id uuid references customers (id) on delete set null,
    session_id text not null,
    channel text not null default 'web',
    status text not null default 'active' check (status in ('active', 'handed_off', 'closed')),
    intent text,
    ticket_id uuid references sales_tickets (id) on delete set null,
    started_at timestamptz not null default now(),
    last_message_at timestamptz not null default now()
);

create index if not exists conversations_session_idx on conversations (session_id);

create table if not exists messages (
    id uuid primary key default gen_random_uuid(),
    conversation_id uuid not null references conversations (id) on delete cascade,
    role text not null check (role in ('user', 'assistant', 'system', 'agent')),
    content text not null,
    meta jsonb,
    created_at timestamptz not null default now()
);

create index if not exists messages_conversation_idx on messages (conversation_id);

-- After sales and marketing engagements queued by the automation engine
create table if not exists engagements (
    id uuid primary key default gen_random_uuid(),
    customer_id uuid not null references customers (id) on delete cascade,
    vehicle_id uuid references vehicles (id) on delete set null,
    order_id uuid references orders (id) on delete set null,
    type text not null check (type in ('birthday', 'battery_reminder', 'service_reminder', 'feedback', 'loyalty', 'winback')),
    channel text not null default 'email' check (channel in ('email', 'sms', 'whatsapp')),
    status text not null default 'queued' check (status in ('queued', 'sent', 'failed', 'skipped')),
    subject text,
    body text,
    dedupe_key text unique,
    scheduled_for timestamptz not null default now(),
    sent_at timestamptz,
    rating integer,
    response text,
    created_at timestamptz not null default now()
);

create index if not exists engagements_status_idx on engagements (status);

-- Loyalty ledger feeding the customer of the year tracker
create table if not exists loyalty_events (
    id uuid primary key default gen_random_uuid(),
    customer_id uuid not null references customers (id) on delete cascade,
    order_id uuid references orders (id) on delete set null,
    points integer not null default 0,
    reason text,
    created_at timestamptz not null default now()
);

-- Knowledge base used by the assistant for grounded answers
create table if not exists kb_articles (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    body text not null,
    tags text[] default '{}',
    created_at timestamptz not null default now()
);

create index if not exists kb_body_trgm on kb_articles using gin (body gin_trgm_ops);

-- Playbook runs, the knowledge work skills executed inside COFX
create table if not exists playbook_runs (
    id uuid primary key default gen_random_uuid(),
    playbook_id text not null,
    playbook_name text not null,
    actor_id uuid references profiles (id) on delete set null,
    objective text not null,
    context text,
    output text,
    created_at timestamptz not null default now()
);

-- Reporting views
create or replace view v_customer_of_the_year as
select
    c.id as customer_id,
    c.full_name,
    c.company,
    c.loyalty_tier,
    date_part('year', o.created_at)::int as year,
    count(o.id)::int as orders_count,
    coalesce(sum(o.total), 0)::numeric(14, 2) as total_spend
from customers c
join orders o on o.customer_id = c.id and o.status in ('paid', 'released')
group by c.id, c.full_name, c.company, c.loyalty_tier, date_part('year', o.created_at);

create or replace view v_sales_leaderboard as
select
    p.id as profile_id,
    p.full_name,
    count(t.id) filter (where t.status = 'closed')::int as closed_tickets,
    count(t.id) filter (where t.status in ('open', 'wip', 'awaiting_payment'))::int as open_tickets,
    count(t.id) filter (where t.status in ('open', 'wip') and t.due_at < now())::int as overdue_tickets,
    coalesce(sum(t.value_estimate) filter (where t.status = 'closed'), 0)::numeric(14, 2) as closed_value
from profiles p
left join sales_tickets t on t.assigned_to = p.id
where p.active
group by p.id, p.full_name;
