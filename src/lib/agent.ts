import type { SupabaseClient } from '@supabase/supabase-js';
import { generate, scrub } from './ai';
import { normalisePhone } from './format';

/**
 * Wanner, the customer facing agent for Wannerpart by COFX.
 *
 * The agent answers parts and service questions, quotes from the real fitment
 * matrix, captures the contact details that turn an anonymous chat into a CRM
 * record, books workshop slots and raises a sales ticket so no lead is lost.
 * It works with or without a language model key: retrieval and business logic
 * are deterministic, and the model only improves the phrasing when available.
 */

export const MAKES = [
    'Toyota', 'Honda', 'Nissan', 'Ford', 'Hyundai', 'Kia', 'Mitsubishi', 'Peugeot',
    'Mercedes', 'BMW', 'Volkswagen', 'Suzuki', 'Mazda', 'Lexus', 'Isuzu',
];

const MODELS = [
    'Corolla', 'Camry', 'Hilux', 'Accord', 'Civic', 'Almera', 'Ranger', 'Elantra',
    'Rio', 'L200', 'Sienna', 'Highlander', 'RAV4', 'Sorento', 'Sportage', 'Sunny', 'Micra',
];

const PART_WORDS: Record<string, string> = {
    brake: 'brakes', pad: 'brakes', disc: 'brakes', rotor: 'brakes',
    filter: 'filters', 'oil filter': 'filters', air: 'filters', cabin: 'filters', fuel: 'filters',
    battery: 'battery', batteries: 'battery',
    shock: 'suspension', absorber: 'suspension', suspension: 'suspension', strut: 'suspension',
    plug: 'ignition', spark: 'ignition', ignition: 'ignition',
    oil: 'lubricants', lubricant: 'lubricants', engine: 'lubricants',
    alternator: 'electrical', starter: 'electrical',
    wiper: 'body', blade: 'body',
};

export type Intent = 'parts_enquiry' | 'appointment' | 'complaint' | 'payment' | 'fleet_quote' | 'general';

export interface Signals {
    phone: string | null;
    email: string | null;
    name: string | null;
    make: string | null;
    model: string | null;
    year: number | null;
    categories: string[];
    intent: Intent;
}

export function extractSignals(text: string): Signals {
    const t = String(text || '');
    const lower = t.toLowerCase();

    const phoneMatch = t.match(/(?:\+?234|0)[\s-]?\d{3}[\s-]?\d{3}[\s-]?\d{4}/);
    const emailMatch = t.match(/[\w.+-]+@[\w-]+\.[\w.]{2,}/);
    const nameMatch =
        t.match(/\b(?:my name is|i am|this is|name[:\s]+)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})/) ||
        t.match(/\b(?:my name is|i am|this is)\s+([a-z]+(?:\s+[a-z]+){0,2})/i);

    const make = MAKES.find((m) => new RegExp('\\b' + m + '\\b', 'i').test(t)) || null;
    const model = MODELS.find((m) => new RegExp('\\b' + m + '\\b', 'i').test(t)) || null;
    const yearMatch = t.match(/\b(19[89]\d|20[0-4]\d)\b/);

    const categories = Array.from(
        new Set(
            Object.entries(PART_WORDS)
                .filter(([word]) => new RegExp('\\b' + word + '\\b', 'i').test(lower))
                .map(([, category]) => category)
        )
    );

    let intent: Intent = 'general';
    if (/\b(complain|complaint|faulty|damaged|wrong part|refund|not working|disappointed|broke)\b/.test(lower)) intent = 'complaint';
    else if (/\b(book|appointment|schedule|slot|come in|visit|fitting|install|when can i)\b/.test(lower)) intent = 'appointment';
    else if (/\b(paid|payment|transfer|receipt|confirm my|proof of payment|sent the money)\b/.test(lower)) intent = 'payment';
    else if (/\b(fleet|bulk|units|dealer|workshop account|trade account|quantity|wholesale)\b/.test(lower)) intent = 'fleet_quote';
    else if (categories.length || make || /\b(price|cost|quote|how much|available|in stock)\b/.test(lower)) intent = 'parts_enquiry';

    return {
        phone: phoneMatch ? normalisePhone(phoneMatch[0]) : null,
        email: emailMatch ? emailMatch[0] : null,
        name: nameMatch ? nameMatch[1].replace(/\b\w/g, (c) => c.toUpperCase()).trim() : null,
        make,
        model,
        year: yearMatch ? Number(yearMatch[1]) : null,
        categories,
        intent,
    };
}

export interface PartHit {
    id: string;
    sku: string;
    name: string;
    brand: string | null;
    category: string;
    unit_price: number;
    stock_qty: number;
    warranty_months: number;
    fits: string;
}

/** Looks up parts that genuinely fit the vehicle described in the conversation. */
export async function lookupParts(db: SupabaseClient, s: Signals): Promise<PartHit[]> {
    if (!s.make && !s.categories.length) return [];

    let partIds: string[] | null = null;
    if (s.make) {
        let q = db.from('part_fitments').select('part_id, make, model, year_from, year_to').ilike('make', s.make);
        const { data: fits } = await q;
        let rows = fits || [];
        if (s.model) {
            const narrowed = rows.filter((r) => !r.model || r.model.toLowerCase() === s.model!.toLowerCase());
            if (narrowed.length) rows = narrowed;
        }
        if (s.year) {
            const narrowed = rows.filter(
                (r) => (!r.year_from || r.year_from <= s.year!) && (!r.year_to || r.year_to >= s.year!)
            );
            if (narrowed.length) rows = narrowed;
        }
        partIds = Array.from(new Set(rows.map((r) => r.part_id)));
        if (!partIds.length) return [];
    }

    let query = db
        .from('parts')
        .select('id, sku, name, brand, category, unit_price, stock_qty, warranty_months')
        .eq('active', true)
        .limit(6);
    if (partIds) query = query.in('id', partIds);
    if (s.categories.length) query = query.in('category', s.categories);

    const { data: parts } = await query;
    const vehicle = [s.make, s.model, s.year].filter(Boolean).join(' ');
    return (parts || []).map((p) => ({
        ...p,
        unit_price: Number(p.unit_price),
        fits: vehicle || 'multiple vehicle brands',
    })) as PartHit[];
}

export async function searchKnowledge(db: SupabaseClient, text: string): Promise<Array<{ title: string; body: string }>> {
    const terms = ['hours', 'location', 'payment', 'transfer', 'release', 'fitment', 'return', 'warranty', 'battery', 'delivery', 'dispatch', 'fleet', 'trade', 'workshop'];
    const hits = terms.filter((t) => text.toLowerCase().includes(t));
    if (!hits.length) return [];
    const { data } = await db.from('kb_articles').select('title, body, tags').overlaps('tags', hits).limit(3);
    return (data || []).map((a) => ({ title: a.title, body: a.body }));
}

/** Picks the active sales representative currently carrying the fewest live tickets. */
async function pickRep(db: SupabaseClient): Promise<string | null> {
    const { data: reps } = await db.from('profiles').select('id').eq('active', true).in('role', ['sales', 'manager']);
    if (!reps?.length) return null;
    const { data: load } = await db
        .from('sales_tickets')
        .select('assigned_to')
        .in('status', ['open', 'wip', 'awaiting_payment']);
    const counts = new Map<string, number>();
    reps.forEach((r) => counts.set(r.id, 0));
    (load || []).forEach((t) => {
        if (t.assigned_to && counts.has(t.assigned_to)) counts.set(t.assigned_to, (counts.get(t.assigned_to) || 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => a[1] - b[1])[0][0];
}

async function upsertCustomer(db: SupabaseClient, s: Signals): Promise<string | null> {
    if (!s.phone && !s.email) return null;
    let existing = null;
    if (s.phone) {
        const { data } = await db.from('customers').select('id, full_name').eq('phone', s.phone).maybeSingle();
        existing = data;
    }
    if (!existing && s.email) {
        const { data } = await db.from('customers').select('id, full_name').eq('email', s.email).maybeSingle();
        existing = data;
    }
    if (existing) {
        const patch: Record<string, unknown> = {};
        if (s.name && (!existing.full_name || existing.full_name === 'Assistant enquiry')) patch.full_name = s.name;
        if (s.email) patch.email = s.email;
        if (Object.keys(patch).length) await db.from('customers').update(patch).eq('id', existing.id);
        return existing.id;
    }
    const { data: created } = await db
        .from('customers')
        .insert({
            full_name: s.name || 'Assistant enquiry',
            phone: s.phone,
            email: s.email,
            source: 'assistant',
            owner_id: await pickRep(db),
        })
        .select('id')
        .single();
    return created?.id || null;
}

function estimateWaitMinutes(openAppointments: number): number {
    return 15 + openAppointments * 10;
}

export interface AssistantResult {
    reply: string;
    intent: Intent;
    ticket_no: string | null;
    parts: PartHit[];
    captured_contact: boolean;
    handoff: boolean;
}

/** Handles one turn of a customer conversation end to end. */
export async function respond(
    db: SupabaseClient,
    sessionId: string,
    userMessage: string
): Promise<AssistantResult> {
    // Conversation continuity
    let { data: convo } = await db.from('conversations').select('*').eq('session_id', sessionId).maybeSingle();
    if (!convo) {
        const { data: created } = await db
            .from('conversations')
            .insert({ session_id: sessionId, channel: 'web' })
            .select('*')
            .single();
        convo = created;
    }
    if (!convo) throw new Error('Could not start a conversation');

    await db.from('messages').insert({ conversation_id: convo.id, role: 'user', content: userMessage.slice(0, 4000) });

    const { data: history } = await db
        .from('messages')
        .select('role, content')
        .eq('conversation_id', convo.id)
        .order('created_at', { ascending: true })
        .limit(24);

    const transcript = (history || []).map((m) => m.content).join('\n');
    const signals = extractSignals(transcript);
    const turnSignals = extractSignals(userMessage);
    if (turnSignals.intent !== 'general') signals.intent = turnSignals.intent;

    const parts = await lookupParts(db, signals);
    const knowledge = await searchKnowledge(db, transcript);

    // Turn the conversation into a CRM record and a tracked ticket
    let ticketNo: string | null = convo.ticket_id ? null : null;
    let customerId = convo.customer_id as string | null;
    const commercial = ['parts_enquiry', 'appointment', 'fleet_quote', 'complaint'].includes(signals.intent);

    if (!customerId && (signals.phone || signals.email)) {
        customerId = await upsertCustomer(db, signals);
        if (customerId) await db.from('conversations').update({ customer_id: customerId }).eq('id', convo.id);
    }

    if (customerId && commercial && !convo.ticket_id) {
        const vehicle = [signals.make, signals.model, signals.year].filter(Boolean).join(' ');
        const subject =
            signals.intent === 'appointment'
                ? 'Service booking request' + (vehicle ? ' for ' + vehicle : '')
                : signals.intent === 'complaint'
                  ? 'Customer complaint raised through the assistant'
                  : signals.intent === 'fleet_quote'
                    ? 'Fleet or trade quotation request'
                    : 'Parts enquiry' + (vehicle ? ' for ' + vehicle : '');

        const { data: ticket } = await db
            .from('sales_tickets')
            .insert({
                customer_id: customerId,
                assigned_to: await pickRep(db),
                channel: 'assistant',
                subject,
                description: transcript.slice(-2000),
                intent: signals.intent,
                priority: signals.intent === 'complaint' ? 'high' : signals.intent === 'fleet_quote' ? 'high' : 'normal',
                value_estimate: parts.reduce((sum, p) => sum + p.unit_price, 0),
            })
            .select('id, ticket_no')
            .single();

        if (ticket) {
            ticketNo = ticket.ticket_no;
            await db.from('conversations').update({ ticket_id: ticket.id, intent: signals.intent }).eq('id', convo.id);
            convo.ticket_id = ticket.id;

            if (signals.intent === 'appointment') {
                const { count } = await db
                    .from('appointments')
                    .select('id', { count: 'exact', head: true })
                    .gte('scheduled_for', new Date().toISOString());
                const slot = new Date();
                slot.setDate(slot.getDate() + 1);
                slot.setHours(10, 0, 0, 0);
                await db.from('appointments').insert({
                    customer_id: customerId,
                    ticket_id: ticket.id,
                    service_type: signals.categories[0] === 'battery' ? 'battery_check' : 'general_service',
                    scheduled_for: slot.toISOString(),
                    estimated_wait_minutes: estimateWaitMinutes(count || 0),
                    status: 'scheduled',
                    notes: 'Provisional slot created by the assistant, to be confirmed by the sales representative.',
                });
            }
        }
    }

    const reply = await composeReply({ signals, parts, knowledge, ticketNo, hasContact: Boolean(customerId), transcript });

    await db.from('messages').insert({
        conversation_id: convo.id,
        role: 'assistant',
        content: reply,
        meta: { intent: signals.intent, parts: parts.map((p) => p.sku), ticket_no: ticketNo },
    });
    await db
        .from('conversations')
        .update({ last_message_at: new Date().toISOString(), intent: signals.intent })
        .eq('id', convo.id);

    return {
        reply,
        intent: signals.intent,
        ticket_no: ticketNo,
        parts,
        captured_contact: Boolean(customerId),
        handoff: signals.intent === 'complaint',
    };
}

const SYSTEM_PROMPT = `You are Wanner, the customer assistant for Wannerpart by COFX, an independent aftermarket auto parts business in Nigeria. Wannerpart supplies parts that fit several vehicle brands rather than one manufacturer.

How you behave:
- Be brief, warm and practical. Two short paragraphs at most, then a clear next step.
- Quote only the parts supplied to you in the retrieved catalogue block. Never invent a part, price or stock figure.
- Prices are in naira. Always state that a quoted part is checked against the fitment matrix for the customer vehicle.
- If the customer has not given a phone number or email, ask for one so a sales representative can follow up and so their record is kept.
- If a ticket number is supplied to you, tell the customer their reference and that a representative will follow up.
- For payment questions, explain that the payment reference code must appear in the transfer narration so the system matches it automatically and releases the goods without a manual finance wait.
- For complaints, apologise once, confirm the issue is logged with a reference, and say a representative will call.
- Never promise a delivery date, discount or warranty outcome that is not in the retrieved knowledge block.`;

async function composeReply(input: {
    signals: Signals;
    parts: PartHit[];
    knowledge: Array<{ title: string; body: string }>;
    ticketNo: string | null;
    hasContact: boolean;
    transcript: string;
}): Promise<string> {
    const { signals, parts, knowledge, ticketNo, hasContact, transcript } = input;

    const catalogue = parts.length
        ? parts
              .map(
                  (p) =>
                      p.name +
                      ' by ' +
                      (p.brand || 'Wannerpart') +
                      ', part number ' +
                      p.sku +
                      ', ' +
                      p.unit_price.toLocaleString('en-NG') +
                      ' naira, ' +
                      (p.stock_qty > 0 ? p.stock_qty + ' in stock' : 'on order') +
                      ', ' +
                      p.warranty_months +
                      ' month warranty, fits ' +
                      p.fits
              )
              .join('\n')
        : 'No catalogue match was retrieved for this request.';

    const kb = knowledge.length ? knowledge.map((k) => k.title + ': ' + k.body).join('\n') : 'No policy article retrieved.';

    const modelReply = await generate({
        system: SYSTEM_PROMPT,
        prompt:
            'Conversation so far:\n' +
            transcript.slice(-2500) +
            '\n\nRetrieved catalogue:\n' +
            catalogue +
            '\n\nRetrieved knowledge:\n' +
            kb +
            '\n\nDetected intent: ' +
            signals.intent +
            '\nContact captured: ' +
            (hasContact ? 'yes' : 'no') +
            (ticketNo ? '\nTicket reference raised: ' + ticketNo : '') +
            '\n\nWrite the next reply from Wanner.',
        maxTokens: 700,
        temperature: 0.4,
    });
    if (modelReply) return modelReply;

    // Deterministic reply used when no model key is configured.
    const lines: string[] = [];
    const vehicle = [signals.make, signals.model, signals.year].filter(Boolean).join(' ');

    if (signals.intent === 'complaint') {
        lines.push('I am sorry that happened, and I have logged it so it is followed up properly.');
    } else if (signals.intent === 'payment') {
        lines.push(
            'For transfers, put the payment reference code from your order in the transfer narration. Our system matches the credit alert to your order automatically and releases your parts without waiting for a manual finance check.'
        );
    } else if (parts.length) {
        lines.push(
            'Here is what we have' + (vehicle ? ' that fits your ' + vehicle : '') + ', checked against our fitment matrix:'
        );
        parts.forEach((p) => {
            lines.push(
                '- ' +
                    p.name +
                    ' by ' +
                    (p.brand || 'Wannerpart') +
                    ', part number ' +
                    p.sku +
                    ', ' +
                    p.unit_price.toLocaleString('en-NG') +
                    ' naira, ' +
                    (p.stock_qty > 0 ? 'in stock' : 'available on order') +
                    ', ' +
                    p.warranty_months +
                    ' month warranty.'
            );
        });
    } else if (signals.intent === 'appointment') {
        lines.push('I can hold a workshop slot for you. Our bays run Monday to Friday from 8am to 6pm and Saturday from 9am to 4pm.');
    } else if (knowledge.length) {
        lines.push(knowledge[0].body);
    } else {
        lines.push(
            'Welcome to Wannerpart by COFX. Tell me the part you need along with your vehicle make, model and year, and I will check what fits and what it costs.'
        );
    }

    if (!hasContact) {
        lines.push('');
        lines.push('Please share your phone number or email so a representative can follow up and we can keep your record for future service reminders.');
    } else if (ticketNo) {
        lines.push('');
        lines.push('Your reference is ' + ticketNo + '. A sales representative has been assigned and will follow up shortly.');
    }

    return scrub(lines.join('\n'));
}
