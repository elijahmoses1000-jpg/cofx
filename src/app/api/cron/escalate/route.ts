import { NextRequest, NextResponse } from 'next/server';
import { adminClient } from '@/lib/supabase';
import { reconcileAll } from '@/lib/payments';

export const dynamic = 'force-dynamic';

function authorised(req: NextRequest): boolean {
    const secret = process.env.CRON_SECRET;
    if (!secret) return true;
    return req.headers.get('authorization') === 'Bearer ' + secret || req.headers.get('x-cofx-token') === secret;
}

/**
 * Accountability sweep.
 *
 * Any ticket past its service level target with no movement is escalated and
 * logged, so management sees the stall rather than discovering it at month end.
 * The same sweep retries payment matching for alerts that arrived out of order.
 */
export async function GET(req: NextRequest) {
    if (!authorised(req)) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    try {
        const db = adminClient();
        const { data: escalated } = await db.rpc('fn_escalate_stale_tickets');
        const payments = await reconcileAll(db);
        return NextResponse.json({
            escalated: (escalated || []).length,
            tickets: (escalated || []).map((t: { ticket_no: string; new_level: number }) => t.ticket_no),
            payments,
        });
    } catch (err) {
        console.error('escalation run failed', err);
        return NextResponse.json({ error: 'Escalation run failed' }, { status: 500 });
    }
}
