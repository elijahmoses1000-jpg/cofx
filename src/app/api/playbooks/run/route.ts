import { NextRequest, NextResponse } from 'next/server';
import { adminClient, serverClient } from '@/lib/supabase';
import { playbookById } from '@/lib/playbooks';
import { generate, scrub } from '@/lib/ai';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Pulls a compact snapshot of live branch data so a playbook reasons over facts. */
async function branchSnapshot(db: ReturnType<typeof adminClient>): Promise<string> {
    const [tickets, payments, parts, customers] = await Promise.all([
        db.from('sales_tickets').select('ticket_no, subject, status, priority, value_estimate, last_update_at, due_at').order('created_at', { ascending: false }).limit(25),
        db.from('payments').select('amount, status, match_score, match_reason, created_at').order('created_at', { ascending: false }).limit(15),
        db.from('parts').select('sku, name, category, brand, unit_price, cost_price, stock_qty, reorder_level').limit(25),
        db.from('customers').select('full_name, company, customer_type, loyalty_tier, lifetime_value, total_orders, last_purchase_at').order('lifetime_value', { ascending: false }).limit(15),
    ]);

    const lines: string[] = [];
    lines.push('Open and recent tickets:');
    (tickets.data || []).forEach((t) =>
        lines.push(
            '- ' + t.ticket_no + ' | ' + t.subject + ' | status ' + t.status + ' | priority ' + t.priority +
            ' | value ' + Number(t.value_estimate).toLocaleString('en-NG') + ' naira | last update ' + new Date(t.last_update_at).toDateString()
        )
    );
    lines.push('');
    lines.push('Payment verification queue:');
    (payments.data || []).forEach((p) =>
        lines.push('- ' + Number(p.amount).toLocaleString('en-NG') + ' naira | ' + p.status + ' | score ' + p.match_score + ' | ' + (p.match_reason || 'not yet matched'))
    );
    lines.push('');
    lines.push('Parts and stock:');
    (parts.data || []).forEach((p) =>
        lines.push(
            '- ' + p.sku + ' | ' + p.name + ' | ' + p.category + ' | ' + (p.brand || '') +
            ' | price ' + Number(p.unit_price).toLocaleString('en-NG') + ' | cost ' + Number(p.cost_price).toLocaleString('en-NG') +
            ' | stock ' + p.stock_qty + ' | reorder at ' + p.reorder_level
        )
    );
    lines.push('');
    lines.push('Top customers by lifetime value:');
    (customers.data || []).forEach((c) =>
        lines.push(
            '- ' + c.full_name + (c.company ? ' (' + c.company + ')' : '') + ' | ' + c.customer_type + ' | tier ' + c.loyalty_tier +
            ' | lifetime ' + Number(c.lifetime_value).toLocaleString('en-NG') + ' naira | orders ' + c.total_orders
        )
    );
    return lines.join('\n');
}

export async function POST(req: NextRequest) {
    const auth = await serverClient();
    const {
        data: { user },
    } = await auth.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });

    const { playbook_id, objective, context } = (await req.json()) as {
        playbook_id?: string;
        objective?: string;
        context?: string;
    };
    const playbook = playbook_id ? playbookById(playbook_id) : undefined;
    if (!playbook) return NextResponse.json({ error: 'Unknown playbook' }, { status: 400 });
    if (!objective?.trim()) return NextResponse.json({ error: 'Describe what the playbook should deliver' }, { status: 400 });

    try {
        const db = adminClient();
        const snapshot = await branchSnapshot(db);

        const output = await generate({
            system:
                'You are the operations engine of COFX, running the playbook named ' +
                playbook.name +
                ' for Wannerpart by COFX, an independent aftermarket auto parts branch in Nigeria selling parts that fit several vehicle brands. Playbook charter: ' +
                playbook.charter +
                ' Ground every statement in the live branch data supplied. Where the data does not support a claim, say so rather than inventing a figure. Amounts are in naira.',
            prompt:
                'Objective: ' +
                objective.trim() +
                (context?.trim() ? '\n\nAdditional context from the requester:\n' + context.trim() : '') +
                '\n\nLive branch data:\n' +
                snapshot +
                '\n\nProduce the complete deliverable now.',
            maxTokens: 3000,
            temperature: 0.35,
        });

        const finalText =
            output ||
            scrub(
                [
                    playbook.name,
                    '',
                    'Objective: ' + objective.trim(),
                    '',
                    'This playbook composes its deliverable with a language model. No model key is configured on this deployment, so the live branch snapshot is returned below for manual review. Set ANTHROPIC_API_KEY in the project environment to enable full generation.',
                    '',
                    snapshot,
                ].join('\n')
            );

        const { data: run } = await db
            .from('playbook_runs')
            .insert({
                playbook_id: playbook.id,
                playbook_name: playbook.name,
                actor_id: user.id,
                objective: objective.trim(),
                context: context?.trim() || null,
                output: finalText,
            })
            .select('id')
            .single();

        return NextResponse.json({ output: finalText, run_id: run?.id || null, model_used: Boolean(output) });
    } catch (err) {
        console.error('playbook run failed', err);
        return NextResponse.json({ error: 'The playbook could not complete' }, { status: 500 });
    }
}
