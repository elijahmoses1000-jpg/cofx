import type { SupabaseClient } from '@supabase/supabase-js';
import { adminClient } from './supabase';
import { respond, lookupParts, extractSignals } from './agent';
import { parseAlert, reconcileAlert } from './payments';
import { PLAYBOOKS, playbookById } from './playbooks';
import { generate, scrub } from './ai';

/**
 * COFX speaks Model Context Protocol in both directions.
 *
 * Inbound: any MCP client, an AI assistant, an internal tool or a partner
 * system, can connect to /api/mcp and operate the branch through the same
 * rules the console enforces.
 *
 * Outbound: an external MCP server registered in the integration hub is
 * handshaken, its tools listed, and its calls routed through COFX so results
 * land in the same audit trail as everything else.
 */

const PROTOCOL = '2025-06-18';

export interface McpTool {
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
}

const str = (description: string) => ({ type: 'string', description });
const num = (description: string) => ({ type: 'number', description });

export const COFX_TOOLS: McpTool[] = [
    {
        name: 'search_parts',
        description: 'Search the Wannerpart aftermarket catalogue by keyword, category, brand or vehicle. Returns part number, price, stock and warranty.',
        inputSchema: {
            type: 'object',
            properties: {
                query: str('Free text such as brake pad, filter or battery'),
                category: str('brakes, filters, battery, suspension, ignition, lubricants, electrical or body'),
                make: str('Vehicle make, to restrict results to parts that fit'),
                model: str('Vehicle model'),
                year: num('Vehicle year'),
            },
        },
    },
    {
        name: 'check_fitment',
        description: 'Given a vehicle, return every part in range that genuinely fits it according to the fitment matrix. This is the authoritative answer for whether a part fits.',
        inputSchema: {
            type: 'object',
            properties: { make: str('Vehicle make'), model: str('Vehicle model'), year: num('Vehicle year') },
            required: ['make'],
        },
    },
    {
        name: 'search_customers',
        description: 'Find customers by name, company or phone number.',
        inputSchema: { type: 'object', properties: { query: str('Name, company or phone') }, required: ['query'] },
    },
    {
        name: 'get_customer',
        description: 'Full customer record: contact details, loyalty standing, vehicles with service and battery dates, recent tickets and orders.',
        inputSchema: { type: 'object', properties: { phone: str('Phone number'), customer_id: str('Customer id') } },
    },
    {
        name: 'list_tickets',
        description: 'List sales tickets, optionally filtered by status. Shows owner, value, service level deadline and whether it has been escalated.',
        inputSchema: {
            type: 'object',
            properties: {
                status: str('open, wip, awaiting_payment, closed, lost, or overdue for anything past its target'),
                limit: num('How many to return, default 20'),
            },
        },
    },
    {
        name: 'create_ticket',
        description: 'Raise a sales ticket. Creates the customer record if the phone number is new, and assigns the representative with the lightest load.',
        inputSchema: {
            type: 'object',
            properties: {
                subject: str('Short summary of what the customer wants'),
                description: str('Full detail of the enquiry'),
                customer_phone: str('Customer phone number'),
                customer_name: str('Customer name'),
                intent: str('parts_enquiry, appointment, complaint, fleet_quote or payment'),
                priority: str('low, normal, high or urgent'),
                value_estimate: num('Estimated value in naira'),
            },
            required: ['subject'],
        },
    },
    {
        name: 'update_ticket',
        description: 'Move a ticket along. Closing requires an outcome, and an outcome of lost requires a reason, exactly as the console enforces.',
        inputSchema: {
            type: 'object',
            properties: {
                ticket_no: str('Ticket number such as WP-2026-0001'),
                status: str('open, wip, awaiting_payment, closed or lost'),
                note: str('What happened, required for any status change'),
                outcome: str('won, lost or no_response, required when closing'),
                lost_reason: str('Required when the outcome is lost'),
            },
            required: ['ticket_no'],
        },
    },
    {
        name: 'create_quote',
        description: 'Turn a ticket into a priced order and issue the payment reference the customer must quote in their transfer narration.',
        inputSchema: {
            type: 'object',
            properties: {
                ticket_no: str('Ticket to quote against'),
                items: {
                    type: 'array',
                    description: 'Line items, each a part number and quantity',
                    items: { type: 'object', properties: { sku: str('Part number'), qty: num('Quantity') }, required: ['sku'] },
                },
                discount: num('Discount in naira, optional'),
            },
            required: ['ticket_no', 'items'],
        },
    },
    {
        name: 'ingest_bank_alert',
        description: 'Submit a bank credit alert. COFX parses it, scores it against expected payments and releases the goods automatically when the evidence is strong enough.',
        inputSchema: {
            type: 'object',
            properties: { subject: str('Email subject'), body: str('Full email body') },
            required: ['body'],
        },
    },
    {
        name: 'payment_status',
        description: 'State of the payment queue: what is awaiting a credit alert, what needs a human decision and what was released automatically.',
        inputSchema: { type: 'object', properties: { order_no: str('Restrict to one order') } },
    },
    {
        name: 'stock_alerts',
        description: 'Parts at or below their reorder level, with the value of the gap.',
        inputSchema: { type: 'object', properties: {} },
    },
    {
        name: 'branch_snapshot',
        description: 'Live branch health: open and overdue tickets, pipeline value, payment queue, stock alerts, loyalty leaders and the after sales queue.',
        inputSchema: { type: 'object', properties: {} },
    },
    {
        name: 'ask_wanner',
        description: 'Ask the customer facing assistant a question as a customer would. It quotes only real parts from the fitment matrix and can capture a lead.',
        inputSchema: {
            type: 'object',
            properties: { question: str('What the customer is asking'), session_id: str('Conversation id to continue an existing thread') },
            required: ['question'],
        },
    },
    {
        name: 'list_playbooks',
        description: 'List the knowledge work playbooks available, optionally filtered by group.',
        inputSchema: { type: 'object', properties: { group: str('sales, support, finance, marketing, operations, insight, people, legal or knowledge') } },
    },
    {
        name: 'run_playbook',
        description: 'Run a playbook against live branch data and return the finished deliverable.',
        inputSchema: {
            type: 'object',
            properties: {
                playbook_id: str('Playbook id from list_playbooks, such as sales/pipeline-review'),
                objective: str('What the deliverable must achieve'),
                context: str('Extra background, figures or constraints'),
            },
            required: ['playbook_id', 'objective'],
        },
    },
];

function naira(v: unknown): string {
    return Number(v || 0).toLocaleString('en-NG');
}

async function snapshotText(db: SupabaseClient): Promise<string> {
    const [tickets, payments, parts, customers, engagements] = await Promise.all([
        db.from('sales_tickets').select('ticket_no, subject, status, priority, value_estimate, due_at, last_update_at, escalation_level').order('created_at', { ascending: false }).limit(40),
        db.from('payments').select('amount, status, match_score, match_reason, auto_approved').limit(40),
        db.from('parts').select('sku, name, category, brand, unit_price, cost_price, stock_qty, reorder_level').limit(40),
        db.from('customers').select('full_name, company, customer_type, loyalty_tier, lifetime_value, total_orders, last_purchase_at').order('lifetime_value', { ascending: false }).limit(20),
        db.from('engagements').select('type, status').limit(200),
    ]);

    const t = tickets.data || [];
    const open = t.filter((x) => ['open', 'wip', 'awaiting_payment'].includes(x.status));
    const overdue = open.filter((x) => x.due_at && new Date(x.due_at) < new Date());
    const p = payments.data || [];
    const low = (parts.data || []).filter((x) => x.stock_qty <= x.reorder_level);

    const lines: string[] = [];
    lines.push('Branch position');
    lines.push('  open tickets: ' + open.length + ', of which past service level: ' + overdue.length);
    lines.push('  pipeline value: ' + naira(open.reduce((s, x) => s + Number(x.value_estimate || 0), 0)) + ' naira');
    lines.push('  payments awaiting a credit alert: ' + p.filter((x) => x.status === 'awaiting').length);
    lines.push('  payments needing a human decision: ' + p.filter((x) => x.status === 'matched').length);
    lines.push('  payments released automatically: ' + p.filter((x) => x.auto_approved).length);
    lines.push('  stock lines at or below reorder: ' + low.length);
    lines.push('  after sales messages queued: ' + (engagements.data || []).filter((e) => e.status === 'queued').length);
    lines.push('');
    lines.push('Tickets');
    t.forEach((x) =>
        lines.push('  ' + x.ticket_no + ' | ' + x.subject + ' | ' + x.status + ' | ' + x.priority + ' | ' + naira(x.value_estimate) + ' naira' + (x.escalation_level ? ' | escalated to level ' + x.escalation_level : ''))
    );
    lines.push('');
    lines.push('Payment queue');
    p.forEach((x) => lines.push('  ' + naira(x.amount) + ' naira | ' + x.status + ' | score ' + x.match_score + ' | ' + (x.match_reason || 'not matched yet')));
    lines.push('');
    lines.push('Stock');
    (parts.data || []).forEach((x) =>
        lines.push('  ' + x.sku + ' | ' + x.name + ' | ' + x.category + ' | sell ' + naira(x.unit_price) + ' | cost ' + naira(x.cost_price) + ' | stock ' + x.stock_qty + ' | reorder at ' + x.reorder_level)
    );
    lines.push('');
    lines.push('Customers by lifetime value');
    (customers.data || []).forEach((x) =>
        lines.push('  ' + (x.company || x.full_name) + ' | ' + x.customer_type + ' | ' + x.loyalty_tier + ' | ' + naira(x.lifetime_value) + ' naira | ' + x.total_orders + ' orders')
    );
    return lines.join('\n');
}

async function pickRep(db: SupabaseClient): Promise<string | null> {
    const { data: reps } = await db.from('profiles').select('id').eq('active', true).in('role', ['sales', 'manager']);
    if (!reps?.length) return null;
    const { data: load } = await db.from('sales_tickets').select('assigned_to').in('status', ['open', 'wip', 'awaiting_payment']);
    const counts = new Map<string, number>();
    reps.forEach((r) => counts.set(r.id, 0));
    (load || []).forEach((x) => {
        if (x.assigned_to && counts.has(x.assigned_to)) counts.set(x.assigned_to, (counts.get(x.assigned_to) || 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => a[1] - b[1])[0][0];
}

async function callCofxTool(name: string, args: Record<string, unknown>): Promise<string> {
    const db = adminClient();
    const s = (k: string) => (typeof args[k] === 'string' ? (args[k] as string).trim() : '');
    const n = (k: string) => (typeof args[k] === 'number' ? (args[k] as number) : undefined);

    if (name === 'search_parts' || name === 'check_fitment') {
        const signals = extractSignals(
            [s('query'), s('make'), s('model'), args.year ? String(args.year) : '', s('category')].filter(Boolean).join(' ')
        );
        if (s('make')) signals.make = s('make');
        if (s('model')) signals.model = s('model');
        if (n('year')) signals.year = n('year')!;
        if (s('category')) signals.categories = [s('category')];

        const hits = await lookupParts(db, signals);
        if (!hits.length) {
            if (name === 'check_fitment') return 'No part in the current range is listed as fitting that vehicle. Widen the search or check the model spelling.';
            const { data: any } = await db
                .from('parts')
                .select('sku, name, brand, category, unit_price, stock_qty, warranty_months')
                .ilike('name', '%' + (s('query') || s('category')) + '%')
                .limit(8);
            if (!any?.length) return 'Nothing in the catalogue matched that search.';
            return any.map((p) => p.sku + ' | ' + p.name + ' | ' + (p.brand || '') + ' | ' + naira(p.unit_price) + ' naira | stock ' + p.stock_qty).join('\n');
        }
        return hits
            .map((p) => p.sku + ' | ' + p.name + ' | ' + (p.brand || '') + ' | ' + naira(p.unit_price) + ' naira | stock ' + p.stock_qty + ' | ' + p.warranty_months + ' month warranty | fits ' + p.fits)
            .join('\n');
    }

    if (name === 'search_customers') {
        const q = s('query');
        const { data } = await db
            .from('customers')
            .select('id, full_name, company, phone, customer_type, loyalty_tier, lifetime_value, total_orders')
            .or('full_name.ilike.%' + q + '%,company.ilike.%' + q + '%,phone.ilike.%' + q + '%')
            .limit(15);
        if (!data?.length) return 'No customer matched that search.';
        return data.map((c) => (c.company || c.full_name) + ' | ' + (c.phone || 'no phone') + ' | ' + c.customer_type + ' | ' + c.loyalty_tier + ' | ' + naira(c.lifetime_value) + ' naira across ' + c.total_orders + ' orders | id ' + c.id).join('\n');
    }

    if (name === 'get_customer') {
        let q = db.from('customers').select('*').limit(1);
        q = s('customer_id') ? q.eq('id', s('customer_id')) : q.eq('phone', s('phone'));
        const { data: rows } = await q;
        const c = rows?.[0];
        if (!c) return 'No customer found with that identifier.';
        const [{ data: vehicles }, { data: tickets }, { data: orders }] = await Promise.all([
            db.from('vehicles').select('*').eq('customer_id', c.id),
            db.from('sales_tickets').select('ticket_no, subject, status, value_estimate').eq('customer_id', c.id).order('created_at', { ascending: false }).limit(10),
            db.from('orders').select('order_no, status, total, payment_reference').eq('customer_id', c.id).order('created_at', { ascending: false }).limit(10),
        ]);
        const out = [
            (c.company || c.full_name) + ', ' + c.customer_type + ', ' + c.loyalty_tier + ' tier',
            'phone ' + (c.phone || 'not recorded') + ', email ' + (c.email || 'not recorded'),
            'lifetime value ' + naira(c.lifetime_value) + ' naira across ' + c.total_orders + ' orders, ' + c.loyalty_points + ' loyalty points',
            'birthday ' + (c.birthday || 'not recorded') + ', marketing consent ' + (c.consent_marketing ? 'granted' : 'withheld'),
            '',
            'Vehicles',
            ...(vehicles || []).map((v) => '  ' + v.make + ' ' + (v.model || '') + ' ' + (v.year || '') + ' | plate ' + (v.plate_number || 'none') + ' | battery fitted ' + (v.battery_installed_on || 'unknown') + ' | next service ' + (v.next_service_due || 'unknown')),
            '',
            'Tickets',
            ...(tickets || []).map((t) => '  ' + t.ticket_no + ' | ' + t.subject + ' | ' + t.status + ' | ' + naira(t.value_estimate) + ' naira'),
            '',
            'Orders',
            ...(orders || []).map((o) => '  ' + o.order_no + ' | ' + o.status + ' | ' + naira(o.total) + ' naira | reference ' + o.payment_reference),
        ];
        return out.join('\n');
    }

    if (name === 'list_tickets') {
        const limit = n('limit') || 20;
        const { data } = await db
            .from('sales_tickets')
            .select('ticket_no, subject, status, priority, value_estimate, due_at, escalation_level, profiles(full_name), customers(full_name, company)')
            .order('created_at', { ascending: false })
            .limit(120);
        let rows = data || [];
        const status = s('status');
        if (status === 'overdue') rows = rows.filter((t) => ['open', 'wip'].includes(t.status) && t.due_at && new Date(t.due_at) < new Date());
        else if (status) rows = rows.filter((t) => t.status === status);
        rows = rows.slice(0, limit);
        if (!rows.length) return 'No tickets match that filter.';
        return rows
            .map((t) => {
                const owner = t.profiles as unknown as { full_name: string } | null;
                const cust = t.customers as unknown as { full_name: string; company: string | null } | null;
                return t.ticket_no + ' | ' + t.subject + ' | ' + t.status + ' | ' + t.priority + ' | ' + naira(t.value_estimate) + ' naira | ' + (cust?.company || cust?.full_name || 'no customer') + ' | owner ' + (owner?.full_name || 'unassigned') + (t.escalation_level ? ' | escalated L' + t.escalation_level : '');
            })
            .join('\n');
    }

    if (name === 'create_ticket') {
        const subject = s('subject');
        if (!subject) return 'subject is required.';
        let customerId: string | null = null;
        if (s('customer_phone')) {
            const { data: existing } = await db.from('customers').select('id').eq('phone', s('customer_phone')).maybeSingle();
            if (existing) customerId = existing.id;
            else {
                const { data: made } = await db
                    .from('customers')
                    .insert({ full_name: s('customer_name') || 'Enquiry via MCP', phone: s('customer_phone'), source: 'assistant', owner_id: await pickRep(db) })
                    .select('id')
                    .single();
                customerId = made?.id || null;
            }
        }
        const { data: ticket, error } = await db
            .from('sales_tickets')
            .insert({
                customer_id: customerId,
                assigned_to: await pickRep(db),
                channel: 'email',
                subject,
                description: s('description') || subject,
                intent: s('intent') || 'parts_enquiry',
                priority: s('priority') || 'normal',
                value_estimate: n('value_estimate') || 0,
            })
            .select('ticket_no, due_at')
            .single();
        if (error || !ticket) return 'Could not raise the ticket: ' + (error?.message || 'unknown error');
        return 'Ticket ' + ticket.ticket_no + ' raised and assigned. Response due by ' + new Date(ticket.due_at).toUTCString() + '.';
    }

    if (name === 'update_ticket') {
        const { data: ticket } = await db.from('sales_tickets').select('*').eq('ticket_no', s('ticket_no')).maybeSingle();
        if (!ticket) return 'No ticket with that number.';
        const status = s('status');
        const closing = status === 'closed' || status === 'lost';
        if (closing && !s('outcome')) return 'Refused: closing a ticket requires an outcome of won, lost or no_response.';
        if (s('outcome') === 'lost' && !s('lost_reason')) return 'Refused: a lost deal requires a reason so the branch can learn from it.';
        if (status && status !== ticket.status && !s('note') && !closing) return 'Refused: a status change requires a note describing what happened.';

        const patch: Record<string, unknown> = {};
        if (status) patch.status = status;
        if (s('outcome')) patch.outcome = s('outcome');
        if (s('lost_reason')) patch.lost_reason = s('lost_reason');
        if (Object.keys(patch).length) await db.from('sales_tickets').update(patch).eq('id', ticket.id);
        await db.from('ticket_events').insert({
            ticket_id: ticket.id,
            actor_name: 'MCP client',
            event_type: 'note',
            note: s('note') || 'Updated through the COFX MCP interface.',
        });
        return 'Ticket ' + ticket.ticket_no + ' updated' + (status ? ' to ' + status : '') + '.';
    }

    if (name === 'create_quote') {
        const { data: ticket } = await db.from('sales_tickets').select('id, ticket_no, customer_id').eq('ticket_no', s('ticket_no')).maybeSingle();
        if (!ticket) return 'No ticket with that number.';
        const items = Array.isArray(args.items) ? (args.items as Array<{ sku?: string; qty?: number }>) : [];
        if (!items.length) return 'items is required, each with a part number and quantity.';

        const lines: Array<{ part_id: string; description: string; qty: number; unit_price: number; line_total: number }> = [];
        for (const item of items) {
            if (!item.sku) continue;
            const { data: part } = await db.from('parts').select('id, name, unit_price').eq('sku', item.sku).maybeSingle();
            if (!part) return 'Unknown part number: ' + item.sku;
            const qty = Math.max(1, Number(item.qty) || 1);
            lines.push({ part_id: part.id, description: part.name, qty, unit_price: Number(part.unit_price), line_total: Number(part.unit_price) * qty });
        }
        if (!lines.length) return 'No valid line items supplied.';

        const subtotal = lines.reduce((sum, l) => sum + l.line_total, 0);
        const discount = n('discount') || 0;
        const { data: order, error } = await db
            .from('orders')
            .insert({ customer_id: ticket.customer_id, ticket_id: ticket.id, status: 'pending_payment', subtotal, discount, total: subtotal - discount })
            .select('id, order_no, total, payment_reference')
            .single();
        if (error || !order) return 'Could not create the order: ' + (error?.message || 'unknown error');

        await db.from('order_items').insert(lines.map((l) => ({ ...l, order_id: order.id })));
        await db.from('payments').insert({
            order_id: order.id,
            customer_id: ticket.customer_id,
            amount: order.total,
            method: 'transfer',
            declared_ref: order.payment_reference,
            status: 'awaiting',
        });
        await db.from('sales_tickets').update({ status: 'awaiting_payment', value_estimate: order.total }).eq('id', ticket.id);
        await db.from('ticket_events').insert({
            ticket_id: ticket.id,
            actor_name: 'Quotation builder',
            event_type: 'note',
            note: 'Order ' + order.order_no + ' raised for ' + naira(order.total) + ' naira. Payment reference ' + order.payment_reference + ' issued to the customer.',
        });

        return (
            'Order ' + order.order_no + ' created for ' + naira(order.total) + ' naira against ticket ' + ticket.ticket_no + '.\n' +
            'The customer must put ' + order.payment_reference + ' in the transfer narration so the payment matches automatically and the goods release without a manual finance check.'
        );
    }

    if (name === 'ingest_bank_alert') {
        const parsed = await parseAlert(s('subject'), s('body'));
        const { data: alert, error } = await db
            .from('bank_alerts')
            .insert({
                source: 'mcp',
                raw_subject: s('subject'),
                raw_body: s('body'),
                bank: parsed.bank,
                account_last4: parsed.account_last4,
                amount: parsed.amount,
                transaction_ref: parsed.transaction_ref,
                sender_name: parsed.sender_name,
                narration: parsed.narration,
                value_date: parsed.value_date,
                parse_confidence: parsed.parse_confidence,
                parse_method: parsed.parse_method,
            })
            .select('id')
            .single();
        if (error || !alert) return 'Could not store the alert: ' + (error?.message || 'unknown error');
        const outcome = await reconcileAlert(db, alert.id);
        if (outcome.auto_approved) return 'Matched with a score of ' + outcome.score + ' and the goods were released automatically. Reason: ' + outcome.reason + '.';
        if (outcome.payment_id) return 'Matched with a score of ' + outcome.score + ', which is below the automatic release threshold, so finance must confirm. Reason: ' + outcome.reason + '.';
        return 'Stored but not matched to any expected payment. Best score was ' + outcome.score + '. ' + outcome.reason + '.';
    }

    if (name === 'payment_status') {
        let q = db.from('payments').select('amount, status, match_score, match_reason, auto_approved, orders(order_no, payment_reference, status), customers(full_name, company)').order('created_at', { ascending: false }).limit(40);
        const { data } = await q;
        let rows = data || [];
        if (s('order_no')) rows = rows.filter((p) => (p.orders as unknown as { order_no: string } | null)?.order_no === s('order_no'));
        if (!rows.length) return 'No payments match.';
        return rows
            .map((p) => {
                const o = p.orders as unknown as { order_no: string; payment_reference: string } | null;
                const c = p.customers as unknown as { full_name: string; company: string | null } | null;
                return naira(p.amount) + ' naira | ' + p.status + (p.auto_approved ? ' (released automatically)' : '') + ' | ' + (o?.order_no || 'no order') + ' | reference ' + (o?.payment_reference || 'none') + ' | ' + (c?.company || c?.full_name || 'unknown') + ' | ' + (p.match_reason || 'not matched yet');
            })
            .join('\n');
    }

    if (name === 'stock_alerts') {
        const { data } = await db.from('parts').select('sku, name, category, stock_qty, reorder_level, cost_price').eq('active', true);
        const low = (data || []).filter((p) => p.stock_qty <= p.reorder_level);
        if (!low.length) return 'Every line is above its reorder level.';
        return low
            .map((p) => p.sku + ' | ' + p.name + ' | ' + p.category + ' | stock ' + p.stock_qty + ' against reorder level ' + p.reorder_level + ' | cost to refill ' + naira((p.reorder_level * 2 - p.stock_qty) * Number(p.cost_price)) + ' naira')
            .join('\n');
    }

    if (name === 'branch_snapshot') return await snapshotText(db);

    if (name === 'ask_wanner') {
        const session = s('session_id') || 'mcp-' + Math.random().toString(36).slice(2);
        const r = await respond(db, session, s('question'));
        let out = r.reply;
        if (r.ticket_no) out += '\n\nTicket raised: ' + r.ticket_no;
        out += '\n\nConversation id: ' + session;
        return out;
    }

    if (name === 'list_playbooks') {
        const group = s('group');
        const rows = PLAYBOOKS.filter((p) => !group || p.group === group);
        if (!rows.length) return 'No playbooks in that group.';
        return rows.map((p) => p.id + ' | ' + p.name + ' | ' + p.purpose).join('\n');
    }

    if (name === 'run_playbook') {
        const playbook = playbookById(s('playbook_id'));
        if (!playbook) return 'Unknown playbook. Call list_playbooks first.';
        if (!s('objective')) return 'objective is required.';
        const snapshot = await snapshotText(db);
        const output = await generate({
            system:
                'You are the operations engine of COFX, running the playbook named ' + playbook.name +
                ' for Wannerpart by COFX, an independent aftermarket auto parts branch in Nigeria selling parts that fit several vehicle brands. Playbook charter: ' + playbook.charter +
                ' Ground every statement in the live branch data supplied. Where the data does not support a claim, say so rather than inventing a figure. Amounts are in naira.',
            prompt: 'Objective: ' + s('objective') + (s('context') ? '\n\nAdditional context:\n' + s('context') : '') + '\n\nLive branch data:\n' + snapshot + '\n\nProduce the complete deliverable now.',
            maxTokens: 3000,
            temperature: 0.35,
        });
        const finalText = output || scrub([playbook.name, '', 'Objective: ' + s('objective'), '', 'No language model key is configured on this deployment, so the live branch snapshot is returned for manual review.', '', snapshot].join('\n'));
        await db.from('playbook_runs').insert({ playbook_id: playbook.id, playbook_name: playbook.name, objective: s('objective'), context: s('context') || null, output: finalText });
        return finalText;
    }

    throw new Error('Unknown tool: ' + name);
}

function ok(id: unknown, result: unknown) {
    return { jsonrpc: '2.0', id: id === undefined ? null : id, result };
}
function err(id: unknown, code: number, message: string) {
    return { jsonrpc: '2.0', id: id === undefined ? null : id, error: { code, message } };
}

export async function handleMcp(body: unknown): Promise<{ status: number; payload?: unknown }> {
    const req = (body || {}) as { id?: unknown; method?: string; params?: Record<string, unknown> };
    const params = req.params || {};
    const method = req.method;

    if (!method) return { status: 400, payload: err(req.id, -32600, 'Invalid request: method missing') };
    if (method.startsWith('notifications/')) return { status: 202 };

    if (method === 'initialize') {
        return {
            status: 200,
            payload: ok(req.id, {
                protocolVersion: typeof params.protocolVersion === 'string' ? params.protocolVersion : PROTOCOL,
                capabilities: { tools: { listChanged: false } },
                serverInfo: { name: 'cofx-wannerpart', version: '1.0.0' },
                instructions:
                    'COFX is the operations system of Wannerpart by COFX, an independent aftermarket auto parts branch in Nigeria. Use check_fitment before quoting any part, because the fitment matrix is the authoritative answer for whether a part fits a vehicle. Raise every customer request as a ticket so it is owned and tracked. Closing a ticket requires an outcome, and a lost deal requires a reason. Payments are matched from bank credit alerts against the payment reference printed on the order.',
            }),
        };
    }
    if (method === 'ping') return { status: 200, payload: ok(req.id, {}) };
    if (method === 'tools/list') return { status: 200, payload: ok(req.id, { tools: COFX_TOOLS }) };
    if (method === 'tools/call') {
        try {
            const text = await callCofxTool(String(params.name || ''), (params.arguments || {}) as Record<string, unknown>);
            return { status: 200, payload: ok(req.id, { content: [{ type: 'text', text }], isError: false }) };
        } catch (e) {
            const message = e instanceof Error ? e.message : 'tool call failed';
            return { status: 200, payload: ok(req.id, { content: [{ type: 'text', text: 'Error: ' + message }], isError: true }) };
        }
    }
    return { status: 200, payload: err(req.id, -32601, 'Method not found: ' + method) };
}

/* Outbound: talking to external MCP servers. */

type ExtResult = { result?: any; error?: { message?: string }; sessionId?: string };

async function externalRpc(url: string, headersJson: string | undefined, method: string, params: unknown, sessionId?: string): Promise<ExtResult> {
    const headers: Record<string, string> = { 'content-type': 'application/json', accept: 'application/json, text/event-stream' };
    if (headersJson) {
        try {
            Object.assign(headers, JSON.parse(headersJson));
        } catch {
            // A malformed header block is ignored rather than failing the call.
        }
    }
    if (sessionId) headers['mcp-session-id'] = sessionId;

    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }) });
    const newSession = res.headers.get('mcp-session-id') || sessionId;
    const ctype = res.headers.get('content-type') || '';
    const text = await res.text();

    let parsed: any = null;
    if (ctype.includes('event-stream')) {
        for (const line of text.split('\n')) {
            const l = line.trim();
            if (l.startsWith('data:')) {
                try {
                    const j = JSON.parse(l.slice(5).trim());
                    if (j && (j.result !== undefined || j.error !== undefined)) parsed = j;
                } catch {
                    // Non JSON keepalive frames are skipped.
                }
            }
        }
    } else if (text) {
        try {
            parsed = JSON.parse(text);
        } catch {
            // Fall through to the HTTP status check below.
        }
    }

    if (!res.ok && !parsed) return { error: { message: 'HTTP ' + res.status + ' from the external server' }, sessionId: newSession || undefined };
    return { result: parsed?.result, error: parsed?.error, sessionId: newSession || undefined };
}

export async function connectExternal(url: string, headersJson?: string) {
    const init = await externalRpc(url, headersJson, 'initialize', {
        protocolVersion: PROTOCOL,
        capabilities: {},
        clientInfo: { name: 'cofx', version: '1.0.0' },
    });
    if (init.error) throw new Error(init.error.message || 'initialize failed');
    try {
        await externalRpc(url, headersJson, 'notifications/initialized', {}, init.sessionId);
    } catch {
        // Servers that do not accept the notification still work.
    }
    const tools = await externalRpc(url, headersJson, 'tools/list', {}, init.sessionId);
    if (tools.error) throw new Error(tools.error.message || 'tools/list failed');

    return {
        serverName: String(init.result?.serverInfo?.name || 'external server'),
        instructions: String(init.result?.instructions || '').slice(0, 800),
        tools: (tools.result?.tools || []).map((t: any) => ({
            name: String(t.name || ''),
            description: String(t.description || '').slice(0, 400),
            inputSchema: t.inputSchema || { type: 'object', properties: {} },
        })),
    };
}

export async function callExternal(url: string, headersJson: string | undefined, tool: string, args: unknown): Promise<string> {
    const init = await externalRpc(url, headersJson, 'initialize', {
        protocolVersion: PROTOCOL,
        capabilities: {},
        clientInfo: { name: 'cofx', version: '1.0.0' },
    });
    if (init.error) throw new Error(init.error.message || 'initialize failed');
    try {
        await externalRpc(url, headersJson, 'notifications/initialized', {}, init.sessionId);
    } catch {
        // Optional notification.
    }
    const r = await externalRpc(url, headersJson, 'tools/call', { name: tool, arguments: args || {} }, init.sessionId);
    if (r.error) throw new Error(r.error.message || 'tools/call failed');
    const content = r.result?.content || [];
    const text = content.filter((c: any) => c?.type === 'text').map((c: any) => String(c.text || '')).join('\n');
    return text || JSON.stringify(r.result || {});
}
