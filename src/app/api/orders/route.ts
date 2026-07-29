import { NextRequest, NextResponse } from 'next/server';
import { adminClient, serverClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * Turns a ticket into a priced order and issues the payment reference the
 * customer must quote in their transfer narration. That reference is the
 * strongest signal the payment matcher has, so this is the step that makes
 * automatic release possible later.
 */
export async function POST(req: NextRequest) {
    const auth = await serverClient();
    const {
        data: { user },
    } = await auth.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });

    const { ticket_id, items, discount } = (await req.json()) as {
        ticket_id?: string;
        items?: Array<{ part_id: string; qty: number }>;
        discount?: number;
    };
    if (!ticket_id || !items?.length) {
        return NextResponse.json({ error: 'Choose at least one part before raising the quotation.' }, { status: 400 });
    }

    const db = adminClient();
    const { data: ticket } = await db.from('sales_tickets').select('id, ticket_no, customer_id').eq('id', ticket_id).maybeSingle();
    if (!ticket) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    if (!ticket.customer_id) {
        return NextResponse.json({ error: 'This ticket has no customer attached, so an order cannot be raised against it.' }, { status: 422 });
    }

    const ids = items.map((i) => i.part_id);
    const { data: parts } = await db.from('parts').select('id, name, sku, unit_price').in('id', ids);
    if (!parts?.length) return NextResponse.json({ error: 'None of those parts exist.' }, { status: 400 });

    const lines = items
        .map((i) => {
            const part = parts.find((p) => p.id === i.part_id);
            if (!part) return null;
            const qty = Math.max(1, Number(i.qty) || 1);
            const unit = Number(part.unit_price);
            return { part_id: part.id, description: part.name + ' (' + part.sku + ')', qty, unit_price: unit, line_total: unit * qty };
        })
        .filter(Boolean) as Array<{ part_id: string; description: string; qty: number; unit_price: number; line_total: number }>;

    const subtotal = lines.reduce((s, l) => s + l.line_total, 0);
    const off = Math.max(0, Math.min(Number(discount) || 0, subtotal));

    const { data: order, error } = await db
        .from('orders')
        .insert({
            customer_id: ticket.customer_id,
            ticket_id: ticket.id,
            created_by: user.id,
            status: 'pending_payment',
            subtotal,
            discount: off,
            total: subtotal - off,
        })
        .select('id, order_no, total, payment_reference')
        .single();
    if (error || !order) return NextResponse.json({ error: error?.message || 'Could not raise the order' }, { status: 400 });

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

    const { data: profile } = await db.from('profiles').select('full_name').eq('id', user.id).maybeSingle();
    await db.from('ticket_events').insert({
        ticket_id: ticket.id,
        actor_id: user.id,
        actor_name: profile?.full_name || 'Staff',
        event_type: 'note',
        note:
            'Quotation raised as order ' + order.order_no + ' for ' +
            Number(order.total).toLocaleString('en-NG') + ' naira. The customer must quote ' +
            order.payment_reference + ' in the transfer narration so payment matches automatically.',
    });

    return NextResponse.json({ order });
}
