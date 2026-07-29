-- COFX operations platform
-- Migration 0002: numbering, lifecycle automation, loyalty, row level security

create sequence if not exists ticket_seq start 1;
create sequence if not exists order_seq start 1;

-- Ticket numbering plus service level target based on priority
create or replace function fn_ticket_before_insert() returns trigger as $$
begin
    if new.ticket_no is null then
        new.ticket_no := 'WP-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('ticket_seq')::text, 4, '0');
    end if;
    if new.due_at is null then
        new.due_at := now() + case new.priority
            when 'urgent' then interval '2 hours'
            when 'high' then interval '6 hours'
            when 'normal' then interval '24 hours'
            else interval '48 hours'
        end;
    end if;
    new.last_update_at := now();
    return new;
end;
$$ language plpgsql;

drop trigger if exists trg_ticket_before_insert on sales_tickets;
create trigger trg_ticket_before_insert before insert on sales_tickets
    for each row execute function fn_ticket_before_insert();

create or replace function fn_ticket_after_insert() returns trigger as $$
begin
    insert into ticket_events (ticket_id, event_type, to_status, note, actor_name)
    values (new.id, 'created', new.status, 'Ticket raised from ' || new.channel, 'System');
    return new;
end;
$$ language plpgsql;

drop trigger if exists trg_ticket_after_insert on sales_tickets;
create trigger trg_ticket_after_insert after insert on sales_tickets
    for each row execute function fn_ticket_after_insert();

-- Status changes stamp the clock and write an audit event, so no lead sits in a black box
create or replace function fn_ticket_before_update() returns trigger as $$
begin
    new.updated_at := now();
    if new.status is distinct from old.status then
        new.last_update_at := now();
        if new.status = 'closed' and new.closed_at is null then
            new.closed_at := now();
        end if;
        if new.status <> 'closed' then
            new.closed_at := null;
        end if;
    end if;
    return new;
end;
$$ language plpgsql;

drop trigger if exists trg_ticket_before_update on sales_tickets;
create trigger trg_ticket_before_update before update on sales_tickets
    for each row execute function fn_ticket_before_update();

create or replace function fn_ticket_after_update() returns trigger as $$
begin
    if new.status is distinct from old.status then
        insert into ticket_events (ticket_id, event_type, from_status, to_status, note, actor_name)
        values (new.id, 'status_change', old.status, new.status,
                'Status moved from ' || old.status || ' to ' || new.status, 'System');
    end if;
    if new.assigned_to is distinct from old.assigned_to and new.assigned_to is not null then
        insert into ticket_events (ticket_id, event_type, note, actor_name, actor_id)
        values (new.id, 'assigned', 'Ticket assigned to a sales representative', 'System', new.assigned_to);
    end if;
    return new;
end;
$$ language plpgsql;

drop trigger if exists trg_ticket_after_update on sales_tickets;
create trigger trg_ticket_after_update after update on sales_tickets
    for each row execute function fn_ticket_after_update();

-- Any ticket event refreshes the activity clock used by the escalation engine
create or replace function fn_touch_ticket_on_event() returns trigger as $$
begin
    update sales_tickets set last_update_at = now() where id = new.ticket_id;
    return new;
end;
$$ language plpgsql;

drop trigger if exists trg_touch_ticket_on_event on ticket_events;
create trigger trg_touch_ticket_on_event after insert on ticket_events
    for each row execute function fn_touch_ticket_on_event();

-- Order numbering and the unique transfer narration code used for payment matching
create or replace function fn_order_before_insert() returns trigger as $$
begin
    if new.order_no is null then
        new.order_no := 'ORD-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('order_seq')::text, 4, '0');
    end if;
    if new.payment_reference is null then
        new.payment_reference := 'WP' || upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6));
    end if;
    return new;
end;
$$ language plpgsql;

drop trigger if exists trg_order_before_insert on orders;
create trigger trg_order_before_insert before insert on orders
    for each row execute function fn_order_before_insert();

-- When an order is paid: update customer value, award loyalty, queue the feedback request
create or replace function fn_order_after_update() returns trigger as $$
declare
    v_points integer;
    v_tier text;
    v_ltv numeric;
begin
    if new.status = 'paid' and old.status is distinct from 'paid' and new.customer_id is not null then
        v_points := greatest(floor(new.total / 1000)::int, 0);

        update customers
        set total_orders = total_orders + 1,
            lifetime_value = lifetime_value + new.total,
            loyalty_points = loyalty_points + v_points,
            last_purchase_at = now(),
            updated_at = now()
        where id = new.customer_id
        returning lifetime_value into v_ltv;

        v_tier := case
            when v_ltv >= 5000000 then 'platinum'
            when v_ltv >= 2000000 then 'gold'
            when v_ltv >= 500000 then 'silver'
            else 'bronze'
        end;
        update customers set loyalty_tier = v_tier where id = new.customer_id;

        insert into loyalty_events (customer_id, order_id, points, reason)
        values (new.customer_id, new.id, v_points, 'Purchase ' || new.order_no);

        insert into engagements (customer_id, order_id, type, channel, status, subject, body, dedupe_key, scheduled_for)
        values (
            new.customer_id, new.id, 'feedback', 'email', 'queued',
            'How did we do on order ' || new.order_no || '?',
            'Thank you for your purchase from Wannerpart by COFX. Please tell us how the experience was and whether the part fitted correctly.',
            'feedback:' || new.id::text,
            now() + interval '2 days'
        ) on conflict (dedupe_key) do nothing;
    end if;
    return new;
end;
$$ language plpgsql;

drop trigger if exists trg_order_after_update on orders;
create trigger trg_order_after_update after update on orders
    for each row execute function fn_order_after_update();

-- Escalation engine: tickets with no movement inside the service level are raised to management
create or replace function fn_escalate_stale_tickets() returns table (
    ticket_id uuid, ticket_no text, new_level integer
) as $$
begin
    return query
    with stale as (
        select t.id, t.ticket_no, t.escalation_level
        from sales_tickets t
        where t.status in ('open', 'wip')
          and t.due_at < now()
          and t.last_update_at < now() - interval '4 hours'
          and t.escalation_level < 3
    ),
    bumped as (
        update sales_tickets t
        set escalation_level = t.escalation_level + 1,
            priority = case when t.priority = 'urgent' then 'urgent'
                            when t.priority = 'high' then 'urgent'
                            else 'high' end
        from stale s
        where t.id = s.id
        returning t.id, t.ticket_no, t.escalation_level
    ),
    logged as (
        insert into ticket_events (ticket_id, event_type, note, actor_name)
        select b.id, 'escalation',
               'No update inside the service level target. Escalated to level ' || b.escalation_level || ' and management notified.',
               'Escalation engine'
        from bumped b
        returning 1
    )
    select b.id, b.ticket_no, b.escalation_level from bumped b;
end;
$$ language plpgsql;

-- After sales engine: queue birthday, battery and service reminders without duplicates
create or replace function fn_queue_after_sales() returns integer as $$
declare
    v_count integer := 0;
    v_year text := to_char(now(), 'YYYY');
begin
    -- Birthdays today
    insert into engagements (customer_id, type, channel, status, subject, body, dedupe_key, scheduled_for)
    select c.id, 'birthday', 'email', 'queued',
           'Happy birthday from Wannerpart by COFX',
           'Wishing you a great day. Enjoy five percent off any part or lubricant at Wannerpart this month.',
           'birthday:' || c.id::text || ':' || v_year,
           now()
    from customers c
    where c.consent_marketing
      and c.birthday is not null
      and to_char(c.birthday, 'MM-DD') = to_char(now(), 'MM-DD')
    on conflict (dedupe_key) do nothing;
    get diagnostics v_count = row_count;

    -- Battery approaching end of warranty life
    insert into engagements (customer_id, vehicle_id, type, channel, status, subject, body, dedupe_key, scheduled_for)
    select c.id, v.id, 'battery_reminder', 'email', 'queued',
           'Battery check due for your ' || v.make || ' ' || coalesce(v.model, ''),
           'Our records show the battery fitted on ' || to_char(v.battery_installed_on, 'DD Mon YYYY') ||
           ' is close to the end of its expected life. Book a free battery test at Wannerpart.',
           'battery:' || v.id::text || ':' || to_char(v.battery_installed_on, 'YYYYMM'),
           now()
    from vehicles v
    join customers c on c.id = v.customer_id
    where c.consent_marketing
      and v.battery_installed_on is not null
      and current_date >= (v.battery_installed_on + (v.battery_warranty_months || ' months')::interval - interval '30 days')
    on conflict (dedupe_key) do nothing;

    -- Service due inside the next fourteen days
    insert into engagements (customer_id, vehicle_id, type, channel, status, subject, body, dedupe_key, scheduled_for)
    select c.id, v.id, 'service_reminder', 'email', 'queued',
           'Service due for your ' || v.make || ' ' || coalesce(v.model, ''),
           'Your next service falls due on ' || to_char(v.next_service_due, 'DD Mon YYYY') ||
           '. Reply to this message or use the Wannerpart assistant to book a slot.',
           'service:' || v.id::text || ':' || to_char(v.next_service_due, 'YYYYMMDD'),
           now()
    from vehicles v
    join customers c on c.id = v.customer_id
    where c.consent_marketing
      and v.next_service_due is not null
      and v.next_service_due between current_date and current_date + interval '14 days'
    on conflict (dedupe_key) do nothing;

    -- Win back customers quiet for six months
    insert into engagements (customer_id, type, channel, status, subject, body, dedupe_key, scheduled_for)
    select c.id, 'winback', 'email', 'queued',
           'We have not seen you in a while',
           'It has been six months since your last purchase. Here is what is new in the Wannerpart range for your vehicle.',
           'winback:' || c.id::text || ':' || to_char(now(), 'YYYYMM'),
           now()
    from customers c
    where c.consent_marketing
      and c.last_purchase_at is not null
      and c.last_purchase_at < now() - interval '6 months'
    on conflict (dedupe_key) do nothing;

    return v_count;
end;
$$ language plpgsql;

-- Row level security. The service role used by server routes bypasses these policies.
alter table profiles enable row level security;
alter table customers enable row level security;
alter table vehicles enable row level security;
alter table parts enable row level security;
alter table part_fitments enable row level security;
alter table sales_tickets enable row level security;
alter table ticket_events enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table bank_alerts enable row level security;
alter table payments enable row level security;
alter table appointments enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;
alter table engagements enable row level security;
alter table loyalty_events enable row level security;
alter table kb_articles enable row level security;
alter table playbook_runs enable row level security;

do $$
declare
    t text;
    staff_tables text[] := array[
        'profiles', 'customers', 'vehicles', 'parts', 'part_fitments', 'sales_tickets',
        'ticket_events', 'orders', 'order_items', 'bank_alerts', 'payments', 'appointments',
        'conversations', 'messages', 'engagements', 'loyalty_events', 'kb_articles', 'playbook_runs'
    ];
begin
    foreach t in array staff_tables loop
        execute format('drop policy if exists staff_read on %I', t);
        execute format('create policy staff_read on %I for select to authenticated using (true)', t);

        execute format('drop policy if exists staff_write on %I', t);
        execute format('create policy staff_write on %I for insert to authenticated with check (true)', t);

        execute format('drop policy if exists staff_update on %I', t);
        execute format('create policy staff_update on %I for update to authenticated using (true) with check (true)', t);
    end loop;
end;
$$;

-- Only administrators and managers may delete records
do $$
declare
    t text;
    staff_tables text[] := array['customers', 'vehicles', 'parts', 'part_fitments', 'sales_tickets', 'orders', 'order_items'];
begin
    foreach t in array staff_tables loop
        execute format('drop policy if exists manager_delete on %I', t);
        execute format($f$create policy manager_delete on %I for delete to authenticated
            using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin','manager')))$f$, t);
    end loop;
end;
$$;
