import { NextRequest, NextResponse } from 'next/server';
import { adminClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

function authorised(req: NextRequest): boolean {
    const secret = process.env.CRON_SECRET;
    if (!secret) return true;
    return req.headers.get('authorization') === 'Bearer ' + secret || req.headers.get('x-cofx-token') === secret;
}

/**
 * After sales engine.
 *
 * Queues birthday greetings, battery and service reminders, feedback requests
 * and win back messages, then marks the due ones as sent. Delivery itself is
 * handed to n8n or any mail provider that reads the queued rows.
 */
export async function GET(req: NextRequest) {
    if (!authorised(req)) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    try {
        const db = adminClient();
        await db.rpc('fn_queue_after_sales');

        const { data: due } = await db
            .from('engagements')
            .select('id, customer_id, type, subject')
            .eq('status', 'queued')
            .lte('scheduled_for', new Date().toISOString())
            .limit(200);

        const ids = (due || []).map((e) => e.id);
        if (ids.length) {
            await db.from('engagements').update({ status: 'sent', sent_at: new Date().toISOString() }).in('id', ids);
        }

        const byType: Record<string, number> = {};
        (due || []).forEach((e) => {
            byType[e.type] = (byType[e.type] || 0) + 1;
        });

        return NextResponse.json({ dispatched: ids.length, by_type: byType });
    } catch (err) {
        console.error('after sales run failed', err);
        return NextResponse.json({ error: 'After sales run failed' }, { status: 500 });
    }
}
