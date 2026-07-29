import { serverClient } from '@/lib/supabase';
import { naira } from '@/lib/format';
import { PageHead, Stat, Empty } from '@/components/ui';

export const dynamic = 'force-dynamic';

function Bar({ label, value, max, note }: { label: string; value: number; max: number; note?: string }) {
    const pct = max > 0 ? Math.round((value / max) * 100) : 0;
    return (
        <div className="py-2">
            <div className="flex items-baseline gap-2">
                <span className="min-w-0 flex-1 truncate text-[13px]">{label}</span>
                <span className="font-mono text-[12px] font-semibold">{naira(value)}</span>
            </div>
            <div className="mt-1 h-2 w-full overflow-hidden rounded-sm bg-hairline">
                <div className="h-full rounded-sm bg-torque" style={{ width: Math.max(pct, 2) + '%' }} />
            </div>
            {note && <div className="mt-0.5 text-[11px] text-mute">{note}</div>}
        </div>
    );
}

export default async function Reports() {
    const db = await serverClient();
    const [{ data: parts }, { data: orderItems }, { data: orders }, { data: tickets }, { data: customers }, { data: payments }] =
        await Promise.all([
            db.from('parts').select('id, sku, name, category, unit_price, cost_price, stock_qty, reorder_level').eq('active', true),
            db.from('order_items').select('part_id, qty, line_total, unit_price, order_id'),
            db.from('orders').select('id, status, total, created_at'),
            db.from('sales_tickets').select('status, outcome, lost_reason, intent, channel, value_estimate'),
            db.from('customers').select('customer_type, loyalty_tier, lifetime_value, source'),
            db.from('payments').select('status, auto_approved, match_score'),
        ]);

    const partById = new Map((parts || []).map((p) => [p.id, p]));

    // Only lines on orders that were actually paid count as revenue, so the
    // category figures reconcile with the headline number.
    const soldOrderIds = new Set((orders || []).filter((o) => ['paid', 'released'].includes(o.status)).map((o) => o.id));
    const soldLines = (orderItems || []).filter((li) => soldOrderIds.has(li.order_id as string));

    // Revenue and margin per category, from actual sold order lines
    const catRevenue = new Map<string, { revenue: number; cost: number; units: number }>();
    soldLines.forEach((li) => {
        const p = partById.get(li.part_id as string);
        if (!p) return;
        const row = catRevenue.get(p.category) || { revenue: 0, cost: 0, units: 0 };
        row.revenue += Number(li.line_total);
        row.cost += Number(p.cost_price) * Number(li.qty);
        row.units += Number(li.qty);
        catRevenue.set(p.category, row);
    });
    const categories = [...catRevenue.entries()].sort((a, b) => b[1].revenue - a[1].revenue);
    const maxRevenue = categories.length ? categories[0][1].revenue : 0;

    // Best selling individual lines
    const partUnits = new Map<string, number>();
    soldLines.forEach((li) => {
        partUnits.set(li.part_id as string, (partUnits.get(li.part_id as string) || 0) + Number(li.qty));
    });
    const topParts = [...partUnits.entries()]
        .map(([id, units]) => ({ part: partById.get(id), units }))
        .filter((r) => r.part)
        .sort((a, b) => b.units - a.units)
        .slice(0, 8);

    const t = tickets || [];
    const closed = t.filter((x) => x.status === 'closed');
    const won = closed.filter((x) => x.outcome === 'won');
    const lost = t.filter((x) => x.outcome === 'lost');
    const winRate = closed.length ? Math.round((won.length / closed.length) * 100) : 0;

    const channelCount = new Map<string, number>();
    t.forEach((x) => channelCount.set(x.channel, (channelCount.get(x.channel) || 0) + 1));

    const lostReasons = new Map<string, number>();
    lost.forEach((x) => {
        const key = (x.lost_reason || 'not recorded').toLowerCase().slice(0, 40);
        lostReasons.set(key, (lostReasons.get(key) || 0) + 1);
    });

    const revenue = (orders || []).filter((o) => ['paid', 'released'].includes(o.status)).reduce((s, o) => s + Number(o.total), 0);
    const totalCost = categories.reduce((s, [, v]) => s + v.cost, 0);
    const totalRev = categories.reduce((s, [, v]) => s + v.revenue, 0);
    const marginPct = totalRev > 0 ? Math.round(((totalRev - totalCost) / totalRev) * 100) : 0;

    const p = payments || [];
    const autoRate = p.filter((x) => x.status === 'confirmed').length
        ? Math.round((p.filter((x) => x.auto_approved).length / p.filter((x) => x.status === 'confirmed').length) * 100)
        : 0;

    const deadStock = (parts || [])
        .filter((x) => !partUnits.get(x.id) && x.stock_qty > 0)
        .map((x) => ({ ...x, tied: Number(x.cost_price) * x.stock_qty }))
        .sort((a, b) => b.tied - a.tied)
        .slice(0, 8);

    const sourceCount = new Map<string, number>();
    (customers || []).forEach((c) => sourceCount.set(c.source, (sourceCount.get(c.source) || 0) + 1));

    return (
        <div>
            <PageHead
                eyebrow="Analysis"
                title="Reports"
                sub="What the branch data actually says: where revenue and margin come from, how the pipeline converts, how much of the payment work runs without a human, and where cash is trapped in stock."
            />

            <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Stat label="Revenue recognised" value={naira(revenue)} hint="Paid and released orders" />
                <Stat label="Gross margin" value={marginPct + '%'} tone={marginPct >= 25 ? 'signal' : 'caution'} hint="Across sold lines" />
                <Stat label="Win rate" value={winRate + '%'} hint={won.length + ' won of ' + closed.length + ' closed'} />
                <Stat label="Payments cleared automatically" value={autoRate + '%'} tone="signal" hint="No finance wait" />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                <section className="card p-5">
                    <h2 className="font-display text-lg font-bold">Revenue by category</h2>
                    <p className="mt-1 text-[12px] text-mute">Paid and released orders only, so these reconcile with the headline figure.</p>
                    {categories.length ? (
                        <div className="mt-2">
                            {categories.map(([cat, v]) => (
                                <Bar
                                    key={cat}
                                    label={cat}
                                    value={v.revenue}
                                    max={maxRevenue}
                                    note={
                                        v.units +
                                        ' units, margin ' +
                                        (v.revenue > 0 ? Math.round(((v.revenue - v.cost) / v.revenue) * 100) : 0) +
                                        ' percent'
                                    }
                                />
                            ))}
                        </div>
                    ) : (
                        <p className="mt-2 text-sm text-mute">No order lines yet. Raise a quotation from a ticket to start the picture.</p>
                    )}
                </section>

                <section className="card p-5">
                    <h2 className="font-display text-lg font-bold">Best selling lines</h2>
                    <div className="mt-2 divide-y divide-hairline/70">
                        {topParts.map((r) => (
                            <div key={r.part!.id} className="flex items-center gap-3 py-2">
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-[13px]">{r.part!.name}</span>
                                    <span className="font-mono text-[11px] text-mute">{r.part!.sku}</span>
                                </span>
                                <span className="font-mono text-[12px] font-semibold">{r.units} sold</span>
                            </div>
                        ))}
                        {!topParts.length && <div className="py-6 text-center text-sm text-mute">Nothing sold yet.</div>}
                    </div>
                </section>

                <section className="card p-5">
                    <h2 className="font-display text-lg font-bold">Where enquiries come from</h2>
                    <div className="mt-2 divide-y divide-hairline/70">
                        {[...channelCount.entries()].sort((a, b) => b[1] - a[1]).map(([ch, n]) => (
                            <div key={ch} className="flex items-center justify-between py-2 text-[13px]">
                                <span className="capitalize">{ch.replace('_', ' ')}</span>
                                <span className="font-mono font-semibold">{n}</span>
                            </div>
                        ))}
                    </div>
                    <h3 className="mt-4 font-display text-sm font-bold uppercase tracking-wide text-steel">Customer acquisition</h3>
                    <div className="mt-1 divide-y divide-hairline/70">
                        {[...sourceCount.entries()].sort((a, b) => b[1] - a[1]).map(([src, n]) => (
                            <div key={src} className="flex items-center justify-between py-1.5 text-[13px]">
                                <span className="capitalize">{src.replace('_', ' ')}</span>
                                <span className="font-mono font-semibold">{n}</span>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="card p-5">
                    <h2 className="font-display text-lg font-bold">Why deals are lost</h2>
                    {lostReasons.size ? (
                        <div className="mt-2 divide-y divide-hairline/70">
                            {[...lostReasons.entries()].sort((a, b) => b[1] - a[1]).map(([reason, n]) => (
                                <div key={reason} className="flex items-center justify-between gap-3 py-2 text-[13px]">
                                    <span className="min-w-0 flex-1 truncate">{reason}</span>
                                    <span className="font-mono font-semibold">{n}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="mt-2 text-sm text-mute">
                            No deals recorded as lost. Because closing requires an outcome and a lost deal requires a reason,
                            this list fills itself as the pipeline turns over.
                        </p>
                    )}
                </section>

                <section className="card p-5 lg:col-span-2">
                    <h2 className="font-display text-lg font-bold">Cash trapped in stock</h2>
                    <p className="mt-1 text-[13px] text-steel">Lines holding stock with no recorded sales, ranked by the cash tied up.</p>
                    {deadStock.length ? (
                        <div className="mt-2 divide-y divide-hairline/70">
                            {deadStock.map((p2) => (
                                <div key={p2.id} className="flex items-center gap-3 py-2">
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-[13px]">{p2.name}</span>
                                        <span className="font-mono text-[11px] text-mute">
                                            {p2.sku} · {p2.stock_qty} in stock
                                        </span>
                                    </span>
                                    <span className="font-mono text-[12px] font-semibold">{naira(p2.tied)}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <Empty text="Every line with stock has sold at least once." />
                    )}
                </section>
            </div>
        </div>
    );
}
