import { NextRequest, NextResponse } from 'next/server';
import { adminClient, serverClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/** Finance confirms or rejects a payment the matcher could not clear on its own. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
    const { id } = await ctx.params;
    const auth = await serverClient();
    const {
        data: { user },
    } = await auth.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });

    const { decision } = (await req.json()) as { decision?: 'confirm' | 'reject' };
    if (decision !== 'confirm' && decision !== 'reject') {
        return NextResponse.json({ error: 'decision must be confirm or reject' }, { status: 400 });
    }

    const db = adminClient();
    const { data: payment } = await db.from('payments').select('id, order_id, amount').eq('id', id).single();
    if (!payment) return NextResponse.json({ error: 'Payment not found' }, { status: 404 });

    if (decision === 'reject') {
        await db.from('payments').update({ status: 'rejected', confirmed_by: user.id }).eq('id', id);
        return NextResponse.json({ status: 'rejected' });
    }

    await db
        .from('payments')
        .update({
            status: 'confirmed',
            confirmed_at: new Date().toISOString(),
            confirmed_by: user.id,
            auto_approved: false,
        })
        .eq('id', id);

    if (payment.order_id) {
        await db.from('orders').update({ status: 'paid' }).eq('id', payment.order_id);
        await db
            .from('orders')
            .update({ status: 'released', released_at: new Date().toISOString(), released_by: user.id })
            .eq('id', payment.order_id);

        const { data: order } = await db.from('orders').select('ticket_id').eq('id', payment.order_id).single();
        if (order?.ticket_id) {
            await db.from('ticket_events').insert({
                ticket_id: order.ticket_id,
                event_type: 'payment',
                actor_id: user.id,
                actor_name: 'Finance',
                note: 'Payment confirmed manually and goods released.',
            });
            await db.from('sales_tickets').update({ status: 'closed', outcome: 'won' }).eq('id', order.ticket_id);
        }
    }

    return NextResponse.json({ status: 'confirmed' });
}
