import { NextRequest, NextResponse } from 'next/server';
import { adminClient, serverClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * Job card updates.
 *
 * Two transitions here reach the customer, so both are gated. A job cannot be
 * delivered without a record of what was done, for the same reason a ticket
 * cannot be closed without an outcome: the feedback request that goes out a day
 * later is worthless if nobody can say what the customer is being asked about.
 *
 * Note on authorisation. The write below uses the admin client, which bypasses
 * row level security and therefore also bypasses the database guard triggers,
 * because those deliberately stand down when auth.uid() is null. The role check
 * in this handler is the only thing enforcing who may cancel a job.
 */

const CANCEL_ROLES = ['admin', 'manager'];

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
    const { id } = await ctx.params;
    const auth = await serverClient();
    const {
        data: { user },
    } = await auth.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });

    const body = (await req.json()) as {
        status?: string;
        technician_id?: string;
        labour_cost?: number;
        parts_cost?: number;
        service_interval_months?: number;
        diagnosis?: string;
        work_performed?: string;
        mileage_in_km?: number;
        note?: string;
    };

    const db = adminClient();
    const { data: job } = await db.from('job_cards').select('*').eq('id', id).single();
    if (!job) return NextResponse.json({ error: 'Job card not found' }, { status: 404 });

    const { data: profile } = await db.from('profiles').select('full_name, role').eq('id', user.id).maybeSingle();
    const actorName = profile?.full_name || user.email || 'Staff';

    const moving = body.status && body.status !== job.status;

    if (moving && body.status === 'cancelled' && !CANCEL_ROLES.includes(profile?.role || '')) {
        return NextResponse.json({ error: 'Only a manager or admin may cancel a job card.' }, { status: 403 });
    }

    if (moving && body.status === 'delivered') {
        const work = body.work_performed?.trim() || job.work_performed;
        if (!work) {
            return NextResponse.json(
                { error: 'Record the work performed before delivering. The feedback request quotes this job back to the customer.' },
                { status: 422 }
            );
        }
    }

    if (moving && body.status === 'ready_for_pickup' && !job.diagnosis && !body.diagnosis?.trim()) {
        return NextResponse.json(
            { error: 'Add the diagnosis before telling the customer the vehicle is ready.' },
            { status: 422 }
        );
    }

    const patch: Record<string, unknown> = {};
    if (body.status) patch.status = body.status;
    if (body.technician_id) patch.technician_id = body.technician_id;
    if (typeof body.labour_cost === 'number') patch.labour_cost = body.labour_cost;
    if (typeof body.parts_cost === 'number') patch.parts_cost = body.parts_cost;
    if (typeof body.service_interval_months === 'number') patch.service_interval_months = body.service_interval_months;
    if (typeof body.mileage_in_km === 'number') patch.mileage_in_km = body.mileage_in_km;
    if (body.diagnosis?.trim()) patch.diagnosis = body.diagnosis.trim();
    if (body.work_performed?.trim()) patch.work_performed = body.work_performed.trim();

    if (!Object.keys(patch).length && !body.note?.trim()) {
        return NextResponse.json({ error: 'Nothing to save.' }, { status: 422 });
    }

    if (Object.keys(patch).length) {
        const { error } = await db.from('job_cards').update(patch).eq('id', id);
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // The status trigger writes its own event with no actor. Attribute it, and
    // record the note against the same move.
    if (moving || body.note?.trim()) {
        await db.from('job_card_events').insert({
            job_card_id: id,
            actor_id: user.id,
            actor_name: actorName,
            from_status: moving ? job.status : null,
            to_status: moving ? body.status : null,
            note: body.note?.trim() || null,
        });
    }

    let message = 'Job card updated.';
    if (moving && body.status === 'ready_for_pickup') {
        message = 'Job card updated. The customer has been queued a pickup message.';
    }
    if (moving && body.status === 'delivered') {
        message = 'Job card delivered. Next service date stamped and a feedback request queued.';
    }

    return NextResponse.json({ ok: true, message });
}
