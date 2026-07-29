-- COFX operations platform
-- Migration 0004: the integration hub, where external MCP servers and other
-- systems are registered so COFX can route work through them.

create table if not exists mcp_servers (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    url text not null,
    headers text,
    server_name text,
    instructions text,
    tools jsonb not null default '[]'::jsonb,
    status text not null default 'connected' check (status in ('connected', 'unreachable', 'disabled')),
    last_checked_at timestamptz,
    added_by uuid references profiles (id) on delete set null,
    created_at timestamptz not null default now()
);

create index if not exists mcp_servers_status_idx on mcp_servers (status);

-- Every call routed to an external server is recorded, so an integration is as
-- auditable as anything done inside the branch.
create table if not exists integration_calls (
    id uuid primary key default gen_random_uuid(),
    server_id uuid references mcp_servers (id) on delete cascade,
    server_name text,
    tool text not null,
    arguments jsonb,
    output text,
    ok boolean not null default true,
    duration_ms integer,
    actor_id uuid references profiles (id) on delete set null,
    created_at timestamptz not null default now()
);

create index if not exists integration_calls_server_idx on integration_calls (server_id);
create index if not exists integration_calls_created_idx on integration_calls (created_at desc);

alter table mcp_servers enable row level security;
alter table integration_calls enable row level security;

do $$
declare
    t text;
begin
    foreach t in array array['mcp_servers', 'integration_calls'] loop
        execute format('drop policy if exists staff_read on %I', t);
        execute format('create policy staff_read on %I for select to authenticated using (true)', t);
        execute format('drop policy if exists staff_write on %I', t);
        execute format('create policy staff_write on %I for insert to authenticated with check (true)', t);
        execute format('drop policy if exists staff_update on %I', t);
        execute format('create policy staff_update on %I for update to authenticated using (true) with check (true)', t);
        execute format('drop policy if exists manager_delete on %I', t);
        execute format($f$create policy manager_delete on %I for delete to authenticated
            using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin','manager')))$f$, t);
    end loop;
end;
$$;
