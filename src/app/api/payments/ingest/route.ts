import { NextRequest, NextResponse } from 'next/server';
import { adminClient } from '@/lib/supabase';
import { parseAlert, reconcileAlert } from '@/lib/payments';

export const dynamic = 'force-dynamic';

/**
 * Bank alert ingestion.
 *
 * n8n (or any mail hook) posts the raw credit alert here. The route parses it,
 * stores it, then immediately attempts to match it against an expected payment.
 * A confident match releases the order without a manual finance check.
 */
export async function POST(req: NextRequest) {
    const secret = process.env.COFX_WEBHOOK_SECRET;
    if (secret && req.headers.get('x-cofx-token') !== secret) {
        return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    try {
        const body = (await req.json()) as {
            subject?: string;
            body?: string;
            text?: string;
            source?: string;
        };
        const subject = body.subject || '';
        const content = body.body || body.text || '';
        if (!subject && !content) {
            return NextResponse.json({ error: 'subject or body is required' }, { status: 400 });
        }

        const db = adminClient();
        const parsed = await parseAlert(subject, content);

        // Guard against the same alert arriving twice from the mail poller
        if (parsed.transaction_ref) {
            const { data: seen } = await db
                .from('bank_alerts')
                .select('id')
                .eq('transaction_ref', parsed.transaction_ref)
                .maybeSingle();
            if (seen) {
                return NextResponse.json({ status: 'duplicate', alert_id: seen.id });
            }
        }

        const { data: alert, error } = await db
            .from('bank_alerts')
            .insert({
                source: body.source || 'email',
                raw_subject: subject,
                raw_body: content,
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

        if (error || !alert) {
            console.error('could not store alert', error);
            return NextResponse.json({ error: 'Could not store the alert' }, { status: 500 });
        }

        const outcome = await reconcileAlert(db, alert.id);
        return NextResponse.json({
            status: outcome.auto_approved ? 'released' : outcome.payment_id ? 'needs_review' : 'unmatched',
            alert_id: alert.id,
            parsed,
            match: outcome,
        });
    } catch (err) {
        console.error('ingest failed', err);
        return NextResponse.json({ error: 'Could not process the alert' }, { status: 500 });
    }
}
