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
 * and win back messages. It does NOT mark them sent.
 *
 * It used to. The previous version flipped every queued row to 'sent' in the
 * same request that created it, on the assumption that a downstream worker
 * would pick the queued rows up first. Nothing ever could: by the time anything
 * else looked, the queue was empty and the rows claimed to have been delivered.
 * Every reminder since launch was recorded as sent and never actually reached
 * anybody.
 *
 * Delivery now belongs to whatever owns the channel - the WhatsApp gateway, or
 * an email or SMS dispatcher. Each marks its own rows sent once a provider has
 * accepted the message. This endpoint only fills the queue and reports on it.
 */
export async function GET(req: NextRequest) {
    if (!authorised(req)) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    try {
        const db = adminClient();
        await db.rpc('fn_queue_after_sales');

        const { data: waiting } = await db
            .from('engagements')
            .select('id, type, channel')
            .eq('status', 'queued')
            .lte('scheduled_for', new Date().toISOString())
            .limit(500);

        const byType: Record<string, number> = {};
        const byChannel: Record<string, number> = {};
        (waiting || []).forEach((e) => {
            byType[e.type] = (byType[e.type] || 0) + 1;
            byChannel[e.channel] = (byChannel[e.channel] || 0) + 1;
        });

        return NextResponse.json({
            queued: (waiting || []).length,
            by_type: byType,
            by_channel: byChannel,
            note: 'Queued only. A channel dispatcher marks these sent once delivered.',
        });
    } catch (err) {
        console.error('after sales run failed', err);
        return NextResponse.json({ error: 'After sales run failed' }, { status: 500 });
    }
}
