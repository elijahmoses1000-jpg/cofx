import Link from 'next/link';
import { Trophy, Medal } from 'lucide-react';
import { serverClient } from '@/lib/supabase';
import { naira, shortDate } from '@/lib/format';
import { PageHead, Stat, Empty } from '@/components/ui';

export const dynamic = 'force-dynamic';

const TIERS = [
    { id: 'platinum', label: 'Platinum', threshold: 'Lifetime value from 5,000,000 naira' },
    { id: 'gold', label: 'Gold', threshold: 'Lifetime value from 2,000,000 naira' },
    { id: 'silver', label: 'Silver', threshold: 'Lifetime value from 500,000 naira' },
    { id: 'bronze', label: 'Bronze', threshold: 'Every new customer starts here' },
];

export default async function Loyalty() {
    const db = await serverClient();
    const year = new Date().getFullYear();

    const [{ data: standings }, { data: customers }, { data: engagements }] = await Promise.all([
        db.from('v_customer_of_the_year').select('*').eq('year', year).order('total_spend', { ascending: false }).limit(10),
        db.from('customers').select('id, full_name, company, loyalty_tier, loyalty_points, lifetime_value, total_orders, last_purchase_at').order('loyalty_points', { ascending: false }).limit(20),
        db.from('engagements').select('id, type, status').limit(300),
    ]);

    const rows = customers || [];
    const byTier = (tier: string) => rows.filter((c) => c.loyalty_tier === tier).length;
    const queued = (engagements || []).filter((e) => e.status === 'queued').length;
    const sent = (engagements || []).filter((e) => e.status === 'sent').length;
    const leader = (standings || [])[0] as { customer_id: string; full_name: string; company: string | null; total_spend: number; orders_count: number } | undefined;

    return (
        <div>
            <PageHead
                eyebrow="Retention"
                title="Loyalty and customer of the year"
                sub="Purchase volume is tracked continuously, so the branch knows who its best customers are before the year ends rather than after it."
            />

            <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Stat label="Messages sent" value={sent} hint="Birthday, battery, service, feedback" />
                <Stat label="Queued to go out" value={queued} />
                <Stat label="Gold and platinum" value={byTier('gold') + byTier('platinum')} tone="signal" />
                <Stat label="Customers tracked" value={rows.length} />
            </div>

            {leader && (
                <div className="card mb-6 overflow-hidden">
                    <div className="stripe h-1 w-full" />
                    <div className="flex flex-wrap items-center gap-4 p-5">
                        <span className="flex h-12 w-12 items-center justify-center rounded bg-torque text-white">
                            <Trophy size={22} />
                        </span>
                        <div>
                            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-mute">
                                Customer of the year, {year} standing
                            </div>
                            <Link href={'/customers/' + leader.customer_id} className="font-display text-2xl font-extrabold hover:text-torqueDark">
                                {leader.company || leader.full_name}
                            </Link>
                        </div>
                        <div className="ml-auto text-right">
                            <div className="font-display text-2xl font-extrabold">{naira(leader.total_spend)}</div>
                            <div className="text-[12px] text-steel">across {leader.orders_count} orders this year</div>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
                <section>
                    <h2 className="mb-3 font-display text-xl font-bold">Standings for {year}</h2>
                    {(standings || []).length ? (
                        <div className="card divide-y divide-hairline/70">
                            {(standings || []).map((s: { customer_id: string; full_name: string; company: string | null; total_spend: number; orders_count: number; loyalty_tier: string }, i: number) => (
                                <Link key={s.customer_id} href={'/customers/' + s.customer_id} className="flex items-center gap-3 px-4 py-3 hover:bg-shell/60">
                                    <span className={'font-display text-lg font-extrabold ' + (i === 0 ? 'text-torque' : 'text-hairline')}>
                                        {String(i + 1).padStart(2, '0')}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <div className="truncate font-semibold">{s.company || s.full_name}</div>
                                        <div className="text-[11px] uppercase tracking-wide text-mute">{s.loyalty_tier} tier</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-mono text-[12.5px] font-semibold">{naira(s.total_spend)}</div>
                                        <div className="text-[11px] text-mute">{s.orders_count} orders</div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    ) : (
                        <Empty text="No paid orders recorded this year yet. Standings build as payments are confirmed." />
                    )}
                </section>

                <div className="space-y-5">
                    <section>
                        <h2 className="mb-3 flex items-center gap-2 font-display text-xl font-bold">
                            <Medal size={18} className="text-torque" /> Tier structure
                        </h2>
                        <div className="card divide-y divide-hairline/70">
                            {TIERS.map((t) => (
                                <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                                    <div className="min-w-0 flex-1">
                                        <div className="font-semibold capitalize">{t.label}</div>
                                        <div className="text-[11.5px] text-mute">{t.threshold}</div>
                                    </div>
                                    <span className="font-display text-lg font-extrabold">{byTier(t.id)}</span>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section>
                        <h2 className="mb-3 font-display text-xl font-bold">Points leaders</h2>
                        <div className="card divide-y divide-hairline/70">
                            {rows.slice(0, 8).map((c) => (
                                <div key={c.id} className="flex items-center gap-3 px-4 py-2.5">
                                    <div className="min-w-0 flex-1 truncate text-[13.5px]">{c.company || c.full_name}</div>
                                    <span className="font-mono text-[12px] font-semibold">{c.loyalty_points}</span>
                                    <span className="text-[11px] text-mute">{shortDate(c.last_purchase_at)}</span>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
