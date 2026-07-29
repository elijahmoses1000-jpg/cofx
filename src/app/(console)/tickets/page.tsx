import Link from 'next/link';
import { serverClient } from '@/lib/supabase';
import { naira, sinceNow, dateTime } from '@/lib/format';
import { PageHead, StatusPill, TableShell, Empty } from '@/components/ui';

export const dynamic = 'force-dynamic';

const FILTERS = [
    { id: 'all', label: 'All' },
    { id: 'open', label: 'Open' },
    { id: 'wip', label: 'Work in progress' },
    { id: 'awaiting_payment', label: 'Awaiting payment' },
    { id: 'overdue', label: 'Past service level' },
    { id: 'closed', label: 'Closed' },
];

export default async function Tickets({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
    const { filter = 'all' } = await searchParams;
    const db = await serverClient();

    const { data } = await db
        .from('sales_tickets')
        .select('id, ticket_no, subject, status, priority, value_estimate, last_update_at, due_at, escalation_level, customers(full_name, company), profiles(full_name)')
        .order('created_at', { ascending: false })
        .limit(120);

    let rows = data || [];
    if (filter === 'overdue') {
        rows = rows.filter((t) => ['open', 'wip'].includes(t.status) && t.due_at && new Date(t.due_at) < new Date());
    } else if (filter !== 'all') {
        rows = rows.filter((t) => t.status === filter);
    }

    return (
        <div>
            <PageHead
                eyebrow="Accountability"
                title="Sales tickets"
                sub="Every enquiry carries a number, an owner and a service level target. A ticket cannot be closed without an outcome, and a lost deal cannot be closed without a reason."
            />

            <div className="mb-4 flex flex-wrap gap-2">
                {FILTERS.map((f) => (
                    <Link
                        key={f.id}
                        href={'/tickets?filter=' + f.id}
                        className={
                            'rounded px-3 py-1.5 text-xs font-bold uppercase tracking-wide ' +
                            (filter === f.id ? 'bg-graphite text-white' : 'border border-hairline bg-panel text-steel hover:border-torque hover:text-torqueDark')
                        }
                    >
                        {f.label}
                    </Link>
                ))}
            </div>

            {rows.length ? (
                <TableShell head={['Ticket', 'Customer', 'Subject', 'Owner', 'Status', 'Value', 'Due', 'Last update']}>
                    {rows.map((t) => {
                        const overdue = ['open', 'wip'].includes(t.status) && t.due_at && new Date(t.due_at) < new Date();
                        const customer = t.customers as unknown as { full_name: string; company: string | null } | null;
                        const owner = t.profiles as unknown as { full_name: string } | null;
                        return (
                            <tr key={t.id} className="border-b border-hairline/70 last:border-0 hover:bg-shell/60">
                                <td className="px-4 py-2.5">
                                    <Link href={'/tickets/' + t.id} className="font-mono text-[12px] font-semibold text-torqueDark hover:underline">
                                        {t.ticket_no}
                                    </Link>
                                    {t.escalation_level > 0 && (
                                        <span className="ml-2 pill border-alert/30 bg-alert/10 text-alert">L{t.escalation_level}</span>
                                    )}
                                </td>
                                <td className="max-w-[10rem] truncate px-4 py-2.5">{customer?.company || customer?.full_name || '—'}</td>
                                <td className="max-w-[16rem] truncate px-4 py-2.5">{t.subject}</td>
                                <td className="max-w-[9rem] truncate px-4 py-2.5 text-[13px] text-steel">{owner?.full_name || 'Unassigned'}</td>
                                <td className="px-4 py-2.5"><StatusPill status={t.status} /></td>
                                <td className="px-4 py-2.5 font-mono text-[12px]">{naira(t.value_estimate)}</td>
                                <td className={'px-4 py-2.5 text-[12px] ' + (overdue ? 'font-semibold text-alert' : 'text-steel')}>
                                    {dateTime(t.due_at)}
                                </td>
                                <td className="px-4 py-2.5 text-[12px] text-steel">{sinceNow(t.last_update_at)}</td>
                            </tr>
                        );
                    })}
                </TableShell>
            ) : (
                <Empty text="No tickets match this filter." />
            )}
        </div>
    );
}
