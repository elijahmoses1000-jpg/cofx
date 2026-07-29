import Link from 'next/link';
import { serverClient } from '@/lib/supabase';
import { naira, shortDate } from '@/lib/format';
import { PageHead, TableShell, Empty, Stat } from '@/components/ui';

export const dynamic = 'force-dynamic';

const TIER_STYLE: Record<string, string> = {
    bronze: 'border-hairline bg-shell text-steel',
    silver: 'border-steel/30 bg-steel/10 text-steel',
    gold: 'border-caution/30 bg-caution/10 text-caution',
    platinum: 'border-torque/30 bg-torque/10 text-torqueDark',
};

export default async function Customers() {
    const db = await serverClient();
    const { data } = await db
        .from('customers')
        .select('id, full_name, company, phone, customer_type, loyalty_tier, lifetime_value, total_orders, last_purchase_at, source')
        .order('lifetime_value', { ascending: false })
        .limit(200);

    const rows = data || [];
    const fleets = rows.filter((c) => ['fleet', 'dealer', 'workshop'].includes(c.customer_type)).length;
    const fromAssistant = rows.filter((c) => c.source === 'assistant').length;
    const value = rows.reduce((s, c) => s + Number(c.lifetime_value || 0), 0);

    return (
        <div>
            <PageHead
                eyebrow="Customer memory"
                title="Customers"
                sub="One record per customer carrying their vehicles, purchase history and loyalty standing. This is the database the branch never had."
            />

            <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Stat label="Customers on record" value={rows.length} />
                <Stat label="Trade and fleet accounts" value={fleets} />
                <Stat label="Captured by the assistant" value={fromAssistant} hint="Leads that would have been lost" />
                <Stat label="Lifetime value tracked" value={naira(value)} />
            </div>

            {rows.length ? (
                <TableShell head={['Customer', 'Type', 'Phone', 'Tier', 'Lifetime value', 'Orders', 'Last purchase']}>
                    {rows.map((c) => (
                        <tr key={c.id} className="border-b border-hairline/70 last:border-0 hover:bg-shell/60">
                            <td className="px-4 py-2.5">
                                <Link href={'/customers/' + c.id} className="font-semibold text-graphite hover:text-torqueDark">
                                    {c.company || c.full_name}
                                </Link>
                                {c.company && <div className="text-[11px] text-mute">{c.full_name}</div>}
                            </td>
                            <td className="px-4 py-2.5 text-[13px] capitalize text-steel">{c.customer_type}</td>
                            <td className="px-4 py-2.5 font-mono text-[12px] text-steel">{c.phone || '—'}</td>
                            <td className="px-4 py-2.5">
                                <span className={'pill ' + (TIER_STYLE[c.loyalty_tier] || TIER_STYLE.bronze)}>{c.loyalty_tier}</span>
                            </td>
                            <td className="px-4 py-2.5 font-mono text-[12px]">{naira(c.lifetime_value)}</td>
                            <td className="px-4 py-2.5 text-[13px]">{c.total_orders}</td>
                            <td className="px-4 py-2.5 text-[12px] text-steel">{shortDate(c.last_purchase_at)}</td>
                        </tr>
                    ))}
                </TableShell>
            ) : (
                <Empty text="No customers yet. Records are created automatically when the assistant captures contact details." />
            )}
        </div>
    );
}
