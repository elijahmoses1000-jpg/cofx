import { NextRequest, NextResponse } from 'next/server';
import { adminClient, serverClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const CLOSING = ['closed', 'lost'];

/**
 * Ticket updates. The system refuses to close a ticket without an outcome and,
 * for a lost deal, a reason. That is the loop that stops leads disappearing
 * into a black box with no feedback from the sales floor.
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
    const { id } = await ctx.params;
    const auth = await serverClient();
    const {
        data: { user },
    } = await auth.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });

    const body = (await req.json()) as {
        status?: string;
        note?: string;
        outcome?: string;
        lost_reason?: string;
        assigned_to?: string;
        value_estimate?: number;
    };

    const db = adminClient();
    const { data: ticket } = await db.from('sales_tickets').select('*').eq('id', id).single();
    if (!ticket) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });

    const { data: profile } = await db.from('profiles').select('full_name').eq('id', user.id).maybeSingle();
    const actorName = profile?.full_name || user.email || 'Staff';

    if (body.status && CLOSING.includes(body.status)) {
        if (!body.outcome) {
            return NextResponse.json(
                { error: 'Record the outcome before closing this ticket: won, lost or no response.' },
                { status: 422 }
            );
        }
        if (body.outcome === 'lost' && !body.lost_reason?.trim()) {
            return NextResponse.json({ error: 'A lost deal needs a reason so the branch can learn from it.' }, { status: 422 });
        }
    }

    if (body.status && body.status !== ticket.status && !body.note?.trim() && !CLOSING.includes(body.status)) {
        return NextResponse.json({ error: 'Add a short note describing what changed.' }, { status: 422 });
    }

    const patch: Record<string, unknown> = {};
    if (body.status) patch.status = body.status;
    if (body.outcome) patch.outcome = body.outcome;
    if (body.lost_reason) patch.lost_reason = body.lost_reason;
    if (body.assigned_to) patch.assigned_to = body.assigned_to;
    if (typeof body.value_estimate === 'number') patch.value_estimate = body.value_estimate;

    if (Object.keys(patch).length) {
        const { error } = await db.from('sales_tickets').update(patch).eq('id', id);
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (body.note?.trim()) {
        await db.from('ticket_events').insert({
            ticket_id: id,
            actor_id: user.id,
            actor_name: actorName,
            event_type: 'note',
            note: body.note.trim().slice(0, 2000),
        });
    } else if (Object.keys(patch).length) {
        await db.from('ticket_events').insert({
            ticket_id: id,
            actor_id: user.id,
            actor_name: actorName,
            event_type: 'note',
            note: 'Ticket updated by ' + actorName + '.',
        });
    }

    const { data: updated } = await db.from('sales_tickets').select('*').eq('id', id).single();
    return NextResponse.json({ ticket: updated });
}
