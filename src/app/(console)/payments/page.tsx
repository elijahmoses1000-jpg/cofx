import { serverClient } from '@/lib/supabase';
import { naira, dateTime } from '@/lib/format';
import { PageHead, Stat, Empty } from '@/components/ui';
import PaymentsConsole from '@/components/PaymentsConsole';

export const dynamic = 'force-dynamic';

export default async function Payments() {
    const db = await serverClient();

    const [{ data: payments }, { data: alerts }] = await Promise.all([
        db
            .from('payments')
            .select('id, amount, status, match_score, match_reason, auto_approved, confirmed_at, created_at, orders(order_no, payment_reference, status), customers(full_name, company)')
            .order('created_at', { ascending: false })
            .limit(60),
        db.from('bank_alerts').select('*').order('received_at', { ascending: false }).limit(30),
    ]);

    const rows = payments || [];
    const awaiting = rows.filter((p) => p.status === 'awaiting');
    const review = rows.filter((p) => p.status === 'matched');
    const auto = rows.filter((p) => p.auto_approved);
    const unmatched = (alerts || []).filter((a) => a.status === 'unmatched');

    return (
        <div>
            <PageHead
                eyebrow="Finance automation"
                title="Payment verification"
                sub="Bank credit alerts are parsed and scored against the payments we expect. A confident match confirms the payment and releases the goods without waiting on a manual finance check."
            />

            <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Stat label="Awaiting a credit alert" value={awaiting.length} />
                <Stat label="Needs a human decision" value={review.length} tone={review.length ? 'caution' : undefined} />
                <Stat label="Released automatically" value={auto.length} tone="signal" hint="No finance wait" />
                <Stat label="Alerts not yet matched" value={unmatched.length} />
            </div>

            <PaymentsConsole
                payments={rows.map((p) => {
                    const order = p.orders as unknown as { order_no: string; payment_reference: string; status: string } | null;
                    const customer = p.customers as unknown as { full_name: string; company: string | null } | null;
                    return {
                        id: p.id,
                        amount: Number(p.amount),
                        status: p.status,
                        match_score: Number(p.match_score),
                        match_reason: p.match_reason,
                        auto_approved: p.auto_approved,
                        order_no: order?.order_no || null,
                        payment_reference: order?.payment_reference || null,
                        order_status: order?.status || null,
                        customer: customer?.company || customer?.full_name || 'Unknown',
                        created_at: p.created_at,
                    };
                })}
            />

            <section className="mt-8">
                <h2 className="mb-3 font-display text-xl font-bold">Incoming bank alerts</h2>
                {(alerts || []).length ? (
                    <div className="card divide-y divide-hairline/70">
                        {(alerts || []).map((a) => (
                            <div key={a.id} className="px-4 py-3">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-display text-base font-bold">{naira(a.amount)}</span>
                                    <span className="font-mono text-[11px] text-steel">{a.transaction_ref || 'no reference'}</span>
                                    <span
                                        className={
                                            'pill ' +
                                            (a.status === 'matched'
                                                ? 'border-signal/30 bg-signal/10 text-signal'
                                                : 'border-caution/30 bg-caution/10 text-caution')
                                        }
                                    >
                                        {a.status}
                                    </span>
                                    <span className="ml-auto font-mono text-[11px] text-mute">{dateTime(a.received_at)}</span>
                                </div>
                                <div className="mt-1 text-[13px] text-steel">{a.narration || a.raw_subject}</div>
                                <div className="mt-1 font-mono text-[11px] text-mute">
                                    {a.bank || 'bank not identified'} · parsed by {a.parse_method} at {Number(a.parse_confidence)} percent confidence
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <Empty text="No bank alerts ingested yet. Point the mail workflow at the ingest endpoint to start the feed." />
                )}
            </section>
        </div>
    );
}
