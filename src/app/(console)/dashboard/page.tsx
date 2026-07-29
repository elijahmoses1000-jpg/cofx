import Link from 'next/link';
import { AlertTriangle, ArrowRight, TrendingUp } from 'lucide-react';
import { serverClient } from '@/lib/supabase';
import { naira, sinceNow } from '@/lib/format';
import { PageHead, Stat, StatusPill, TableShell, Empty } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function Dashboard() {
    const db = await serverClient();

    const [tickets, payments, engagements, leaderboard, topCustomers] = await Promise.all([
        db.from('sales_tickets').select('id, ticket_no, subject, status, priority, value_estimate, last_update_at, due_at').order('created_at', { ascending: false }).limit(50),
        db.from('payments').select('id, amount, status, match_score').limit(100),
        db.from('engagements').select('id, type, status').limit(200),
        db.from('v_sales_leaderboard').select('*').limit(10),
        db.from('customers').select('id, full_name, company, loyalty_tier, lifetime_value').order('lifetime_value', { ascending: false }).limit(5),
    ]);

    const rows = tickets.data || [];
    const open = rows.filter((t) => ['open', 'wip', 'awaiting_payment'].includes(t.status));
    const overdue = open.filter((t) => t.due_at && new Date(t.due_at) < new Date());
    const pipeline = open.reduce((sum, t) => sum + Number(t.value_estimate || 0), 0);

    const pays = payments.data || [];
    const awaiting = pays.filter((p) => p.status === 'awaiting');
    const review = pays.filter((p) => p.status === 'matched');
    const confirmed = pays.filter((p) => p.status === 'confirmed');

    const queued = (engagements.data || []).filter((e) => e.status === 'queued').length;

    return (
        <div>
            <PageHead
                eyebrow="Branch control"
                title="Operations dashboard"
                sub="The live state of the Wannerpart branch: what is in the pipeline, what is waiting on payment, and what is slipping past its service level."
            />

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Stat label="Open tickets" value={open.length} hint={rows.length + ' raised in total'} />
                <Stat label="Past service level" value={overdue.length} tone={overdue.length ? 'alert' : 'signal'} hint="No movement inside target" />
                <Stat label="Pipeline value" value={naira(pipeline)} hint="Across live tickets" />
                <Stat label="Payments to verify" value={awaiting.length + review.length} tone={review.length ? 'caution' : undefined} hint={confirmed.length + ' confirmed to date'} />
            </div>

            {overdue.length > 0 && (
                <div className="card mt-4 border-alert/30 bg-alert/5 p-4">
                    <div className="flex items-center gap-2 font-display text-sm font-bold text-alert">
                        <AlertTriangle size={16} /> {overdue.length} ticket{overdue.length === 1 ? '' : 's'} past the service level target
                    </div>
                    <p className="mt-1 text-[13px] text-steel">
                        These are escalated automatically on the next accountability sweep. Update the status or record the
                        outcome to clear them.
                    </p>
                    <Link href="/tickets?filter=overdue" className="btn-ghost mt-3">
                        Review them <ArrowRight size={14} />
                    </Link>
                </div>
            )}

            <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
                <section>
                    <h2 className="mb-3 font-display text-xl font-bold">Latest tickets</h2>
                    {rows.length ? (
                        <TableShell head={['Ticket', 'Subject', 'Status', 'Value', 'Last update']}>
                            {rows.slice(0, 8).map((t) => (
                                <tr key={t.id} className="border-b border-hairline/70 last:border-0 hover:bg-shell/60">
                                    <td className="px-4 py-2.5">
                                        <Link href={'/tickets/' + t.id} className="font-mono text-[12px] font-semibold text-torqueDark hover:underline">
                                            {t.ticket_no}
                                        </Link>
                                    </td>
                                    <td className="max-w-[18rem] truncate px-4 py-2.5">{t.subject}</td>
                                    <td className="px-4 py-2.5"><StatusPill status={t.status} /></td>
                                    <td className="px-4 py-2.5 font-mono text-[12px]">{naira(t.value_estimate)}</td>
                                    <td className="px-4 py-2.5 text-[12px] text-steel">{sinceNow(t.last_update_at)}</td>
                                </tr>
                            ))}
                        </TableShell>
                    ) : (
                        <Empty text="No tickets yet. Enquiries from the assistant and the counter appear here." />
                    )}
                </section>

                <div className="space-y-6">
                    <section>
                        <h2 className="mb-3 font-display text-xl font-bold">Representative accountability</h2>
                        <div className="card divide-y divide-hairline/70">
                            {(leaderboard.data || []).length ? (
                                (leaderboard.data || []).map((r: { profile_id: string; full_name: string; open_tickets: number; closed_tickets: number; overdue_tickets: number }) => (
                                    <div key={r.profile_id} className="flex items-center gap-3 px-4 py-3">
                                        <div className="min-w-0 flex-1">
                                            <div className="truncate text-sm font-semibold">{r.full_name}</div>
                                            <div className="text-[11px] text-mute">
                                                {r.open_tickets} live, {r.closed_tickets} closed
                                            </div>
                                        </div>
                                        {r.overdue_tickets > 0 && (
                                            <span className="pill border-alert/30 bg-alert/10 text-alert">{r.overdue_tickets} late</span>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <div className="px-4 py-6 text-center text-sm text-mute">No representatives on record.</div>
                            )}
                        </div>
                    </section>

                    <section>
                        <h2 className="mb-3 flex items-center gap-2 font-display text-xl font-bold">
                            <TrendingUp size={18} className="text-torque" /> Top customers
                        </h2>
                        <div className="card divide-y divide-hairline/70">
                            {(topCustomers.data || []).map((c) => (
                                <Link key={c.id} href={'/customers/' + c.id} className="flex items-center gap-3 px-4 py-3 hover:bg-shell/60">
                                    <div className="min-w-0 flex-1">
                                        <div className="truncate text-sm font-semibold">{c.company || c.full_name}</div>
                                        <div className="text-[11px] uppercase tracking-wide text-mute">{c.loyalty_tier}</div>
                                    </div>
                                    <span className="font-mono text-[12px]">{naira(c.lifetime_value)}</span>
                                </Link>
                            ))}
                        </div>
                    </section>

                    <section className="card p-4">
                        <div className="font-display text-sm font-bold">After sales queue</div>
                        <p className="mt-1 text-[13px] text-steel">
                            {queued} message{queued === 1 ? '' : 's'} waiting to go out: birthdays, battery checks, service
                            reminders and feedback requests.
                        </p>
                    </section>
                </div>
            </div>
        </div>
    );
}
