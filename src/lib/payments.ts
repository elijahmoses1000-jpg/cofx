import type { SupabaseClient } from '@supabase/supabase-js';
import { generate } from './ai';

/**
 * Payment verification without bank API access.
 *
 * Bank credit alerts arrive as email. n8n (or any mail hook) posts the raw
 * subject and body to the ingest route. We parse the alert with deterministic
 * patterns first, fall back to the model only when the patterns are weak, then
 * score it against the payments we are expecting. A confident match releases
 * the goods automatically instead of waiting hours for a manual finance check.
 */

export interface ParsedAlert {
    amount: number | null;
    transaction_ref: string | null;
    sender_name: string | null;
    narration: string | null;
    bank: string | null;
    account_last4: string | null;
    value_date: string | null;
    parse_confidence: number;
    parse_method: 'regex' | 'llm' | 'manual';
}

const AMOUNT = /(?:NGN|₦|N)\s?([\d,]+(?:\.\d{1,2})?)/i;
const CREDITED = /credited\s+with\s+(?:NGN|₦|N)?\s?([\d,]+(?:\.\d{1,2})?)/i;
const REF = /(?:\bref(?:erence)?\b|transaction\s*id|txn\s*id|session\s*id)\s*[:#-]?\s*([A-Z0-9][A-Z0-9\-\/]{5,})/i;
const ACCOUNT = /account\s*(?:no\.?|number)?\s*[x*]*(\d{4})\b/i;
const NARRATION = /(?:desc(?:ription)?|narration|remarks?|details)\s*[:-]\s*([^\n]+?)(?:\s*\bref\b|$)/i;
const TRF_FROM = /(?:trf|transfer)\s+from\s+([A-Z][A-Z\s&.'-]{2,40})/i;
const DATE_TOKEN = /\b(\d{1,2}[-\/](?:[A-Z]{3}|\d{1,2})[-\/]\d{2,4})\b/i;

/** Order payment references are generated as WP followed by six hex characters. */
export const PAYMENT_REF = /\bWP[0-9A-F]{6}\b/gi;

function money(raw: string | undefined): number | null {
    if (!raw) return null;
    const n = Number(raw.replace(/,/g, ''));
    return Number.isFinite(n) && n > 0 ? n : null;
}

export function parseAlertWithPatterns(subject: string, body: string): ParsedAlert {
    const text = (subject || '') + '\n' + (body || '');
    const amount = money((CREDITED.exec(text) || AMOUNT.exec(text) || [])[1]);
    const transaction_ref = (REF.exec(text) || [])[1] || null;
    const account_last4 = (ACCOUNT.exec(text) || [])[1] || null;
    const narration = ((NARRATION.exec(text) || [])[1] || '').trim() || null;
    const senderMatch = TRF_FROM.exec(narration || text);
    const sender_name = senderMatch ? senderMatch[1].trim() : null;
    const dateToken = (DATE_TOKEN.exec(text) || [])[1] || null;

    let bank: string | null = null;
    for (const name of ['First Bank', 'GTBank', 'GTCO', 'Zenith', 'Access Bank', 'UBA', 'Fidelity', 'Sterling', 'Union Bank', 'Stanbic', 'Wema', 'Providus', 'Kuda', 'Moniepoint', 'Opay']) {
        if (text.toLowerCase().includes(name.toLowerCase())) {
            bank = name;
            break;
        }
    }

    let confidence = 0;
    if (amount) confidence += 45;
    if (transaction_ref) confidence += 30;
    if (narration) confidence += 15;
    if (account_last4) confidence += 10;

    let value_date: string | null = null;
    if (dateToken) {
        const parsed = new Date(dateToken.replace(/-/g, ' '));
        if (!Number.isNaN(parsed.getTime())) value_date = parsed.toISOString();
    }

    return {
        amount,
        transaction_ref,
        sender_name,
        narration: narration || (subject || '').trim() || null,
        bank,
        account_last4,
        value_date,
        parse_confidence: confidence,
        parse_method: 'regex',
    };
}

/** Weak pattern extraction is retried with the model when a key is configured. */
export async function parseAlert(subject: string, body: string): Promise<ParsedAlert> {
    const pattern = parseAlertWithPatterns(subject, body);
    if (pattern.parse_confidence >= 75 || !process.env.ANTHROPIC_API_KEY) return pattern;

    const raw = await generate({
        system: 'You read Nigerian bank credit alert emails and return only a single JSON object. Never add commentary.',
        prompt:
            'Extract amount as a number without separators, transaction_ref, sender_name, narration, bank and account_last4 from this credit alert. Use null where a field is absent. Return only JSON.\n\nSubject: ' +
            subject +
            '\n\nBody:\n' +
            body,
        maxTokens: 500,
        temperature: 0,
    });
    if (!raw) return pattern;

    try {
        const start = raw.indexOf('{');
        const end = raw.lastIndexOf('}');
        if (start < 0 || end < 0) return pattern;
        const parsed = JSON.parse(raw.slice(start, end + 1)) as Partial<ParsedAlert>;
        return {
            amount: typeof parsed.amount === 'number' ? parsed.amount : pattern.amount,
            transaction_ref: parsed.transaction_ref || pattern.transaction_ref,
            sender_name: parsed.sender_name || pattern.sender_name,
            narration: parsed.narration || pattern.narration,
            bank: parsed.bank || pattern.bank,
            account_last4: parsed.account_last4 || pattern.account_last4,
            value_date: pattern.value_date,
            parse_confidence: Math.max(pattern.parse_confidence, 80),
            parse_method: 'llm',
        };
    } catch {
        return pattern;
    }
}

function nameOverlap(a: string, b: string): number {
    const norm = (s: string) =>
        s
            .toLowerCase()
            .replace(/\b(ltd|limited|nig|nigeria|enterprises|ent|company|co|plc|motors|workshop|haulage|logistics)\b/g, ' ')
            .replace(/[^a-z\s]/g, ' ')
            .split(/\s+/)
            .filter((w) => w.length > 2);
    const left = new Set(norm(a));
    const right = norm(b);
    if (!left.size || !right.length) return 0;
    const hits = right.filter((w) => left.has(w)).length;
    return hits / Math.max(left.size, right.length);
}

export interface MatchOutcome {
    payment_id: string | null;
    score: number;
    reason: string;
    auto_approved: boolean;
}

export const AUTO_APPROVE_AT = 85;
export const REVIEW_AT = 60;

interface AwaitingPayment {
    id: string;
    amount: number;
    declared_ref: string | null;
    created_at: string;
    order_id: string | null;
    customer_id: string | null;
    orders?: { payment_reference: string | null; order_no: string | null } | null;
    customers?: { full_name: string | null; company: string | null } | null;
}

/**
 * Scores every awaiting payment against one alert.
 * Amount is the strongest signal, the narration reference code is next,
 * then sender name similarity and recency as tie breakers.
 */
export function scoreCandidates(
    alert: { amount: number | null; narration: string | null; sender_name: string | null; raw_body?: string | null },
    candidates: AwaitingPayment[]
): Array<{ payment: AwaitingPayment; score: number; reasons: string[] }> {
    const haystack = ((alert.narration || '') + ' ' + (alert.raw_body || '')).toUpperCase();
    const refsInAlert = new Set((haystack.match(PAYMENT_REF) || []).map((r) => r.toUpperCase()));

    return candidates
        .map((payment) => {
            const reasons: string[] = [];
            let score = 0;

            if (alert.amount !== null && Math.abs(Number(payment.amount) - alert.amount) < 0.5) {
                score += 45;
                reasons.push('amount matches exactly');
            } else if (alert.amount !== null && Math.abs(Number(payment.amount) - alert.amount) <= Number(payment.amount) * 0.01) {
                score += 20;
                reasons.push('amount within one percent');
            }

            const orderRef = (payment.orders?.payment_reference || payment.declared_ref || '').toUpperCase();
            if (orderRef && refsInAlert.has(orderRef)) {
                score += 40;
                reasons.push('payment reference ' + orderRef + ' found in the transfer narration');
            }

            const customerName = payment.customers?.company || payment.customers?.full_name || '';
            if (alert.sender_name && customerName) {
                const overlap = nameOverlap(customerName, alert.sender_name);
                if (overlap >= 0.5) {
                    score += 10;
                    reasons.push('sender name resembles the customer on record');
                } else if (overlap > 0) {
                    score += 5;
                    reasons.push('sender name partially resembles the customer on record');
                }
            }

            const ageHours = (Date.now() - new Date(payment.created_at).getTime()) / 3600000;
            if (ageHours <= 168) {
                score += 5;
                reasons.push('raised within the last seven days');
            }

            return { payment, score: Math.min(score, 100), reasons };
        })
        .sort((a, b) => b.score - a.score);
}

/**
 * Matches one stored bank alert and, when confident, confirms the payment and
 * releases the order. Returns what happened so the caller can report it.
 */
export async function reconcileAlert(db: SupabaseClient, alertId: string): Promise<MatchOutcome> {
    const { data: alert } = await db.from('bank_alerts').select('*').eq('id', alertId).single();
    if (!alert) return { payment_id: null, score: 0, reason: 'Alert not found', auto_approved: false };
    if (alert.status === 'matched') {
        return { payment_id: null, score: 0, reason: 'Alert already matched', auto_approved: false };
    }

    const { data: candidates } = await db
        .from('payments')
        .select('id, amount, declared_ref, created_at, order_id, customer_id, orders(payment_reference, order_no), customers(full_name, company)')
        .in('status', ['awaiting', 'mismatch']);

    const list = (candidates || []) as unknown as AwaitingPayment[];
    if (!list.length) {
        return { payment_id: null, score: 0, reason: 'No payment is awaiting confirmation', auto_approved: false };
    }

    const ranked = scoreCandidates(
        { amount: alert.amount, narration: alert.narration, sender_name: alert.sender_name, raw_body: alert.raw_body },
        list
    );
    const best = ranked[0];
    const runnerUp = ranked[1];
    const ambiguous = Boolean(runnerUp && best.score - runnerUp.score < 15 && runnerUp.score >= REVIEW_AT);
    const reason = best.reasons.join(', ') || 'no matching signal found';

    if (best.score >= AUTO_APPROVE_AT && !ambiguous) {
        await db
            .from('payments')
            .update({
                status: 'confirmed',
                bank_alert_id: alert.id,
                match_score: best.score,
                match_reason: reason,
                auto_approved: true,
                confirmed_at: new Date().toISOString(),
            })
            .eq('id', best.payment.id);

        await db.from('bank_alerts').update({ status: 'matched' }).eq('id', alert.id);

        if (best.payment.order_id) {
            await db.from('orders').update({ status: 'paid' }).eq('id', best.payment.order_id);
            await db
                .from('orders')
                .update({ status: 'released', released_at: new Date().toISOString() })
                .eq('id', best.payment.order_id);

            const { data: order } = await db
                .from('orders')
                .select('ticket_id, order_no')
                .eq('id', best.payment.order_id)
                .single();
            if (order?.ticket_id) {
                await db.from('ticket_events').insert({
                    ticket_id: order.ticket_id,
                    event_type: 'payment',
                    actor_name: 'Payment verification engine',
                    note:
                        'Payment of ' +
                        Number(alert.amount || 0).toLocaleString('en-NG') +
                        ' naira confirmed automatically and goods released. Matched because ' +
                        reason +
                        '.',
                });
                await db
                    .from('sales_tickets')
                    .update({ status: 'closed', outcome: 'won' })
                    .eq('id', order.ticket_id);
            }
        }
        return { payment_id: best.payment.id, score: best.score, reason, auto_approved: true };
    }

    if (best.score >= REVIEW_AT) {
        await db
            .from('payments')
            .update({
                status: 'matched',
                bank_alert_id: alert.id,
                match_score: best.score,
                match_reason: ambiguous ? reason + ', but another payment scored close so a human must decide' : reason,
            })
            .eq('id', best.payment.id);
        await db.from('bank_alerts').update({ status: 'matched' }).eq('id', alert.id);
        return { payment_id: best.payment.id, score: best.score, reason, auto_approved: false };
    }

    return { payment_id: null, score: best.score, reason, auto_approved: false };
}

/** Runs reconciliation across every alert still waiting to be matched. */
export async function reconcileAll(db: SupabaseClient): Promise<{ checked: number; released: number; flagged: number }> {
    const { data: alerts } = await db
        .from('bank_alerts')
        .select('id')
        .eq('status', 'unmatched')
        .order('received_at', { ascending: true })
        .limit(100);

    let released = 0;
    let flagged = 0;
    for (const a of alerts || []) {
        const outcome = await reconcileAlert(db, a.id);
        if (outcome.auto_approved) released += 1;
        else if (outcome.payment_id) flagged += 1;
    }
    return { checked: (alerts || []).length, released, flagged };
}
