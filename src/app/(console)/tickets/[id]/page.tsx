import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { serverClient } from '@/lib/supabase';
import { naira, dateTime, sinceNow } from '@/lib/format';
import { StatusPill } from '@/components/ui';
import TicketActions from '@/components/TicketActions';
import QuoteBuilder from '@/components/QuoteBuilder';

export const dynamic = 'force-dynamic';

export default async function TicketDetail({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const db = await serverClient();

    const { data: ticket } = await db
        .from('sales_tickets')
        .select('*, customers(id, full_name, company, phone, email, loyalty_tier), profiles(full_name)')
        .eq('id', id)
        .maybeSingle();
    if (!ticket) notFound();

    const [{ data: events }, { data: staff }, { data: orders }, { data: parts }] = await Promise.all([
        db.from('ticket_events').select('*').eq('ticket_id', id).order('created_at', { ascending: false }).limit(60),
        db.from('profiles').select('id, full_name, role').eq('active', true).order('full_name'),
        db.from('orders').select('id, order_no, status, total, payment_reference').eq('ticket_id', id),
        db.from('parts').select('id, sku, name, brand, category, unit_price, stock_qty').eq('active', true).order('name'),
    ]);

    const customer = ticket.customers as unknown as {
        id: string; full_name: string; company: string | null; phone: string | null; email: string | null; loyalty_tier: string;
    } | null;
    const owner = ticket.profiles as unknown as { full_name: string } | null;
    const overdue = ['open', 'wip'].includes(ticket.status) && ticket.due_at && new Date(ticket.due_at) < new Date();

    return (
        <div>
            <Link href="/tickets" className="mb-4 inline-flex items-center gap-1 text-xs font-semibold text-steel hover:text-torqueDark">
                <ChevronLeft size={14} /> All tickets
            </Link>

            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <div className="font-mono text-sm font-bold text-torqueDark">{ticket.ticket_no}</div>
                    <h1 className="font-display text-2xl font-extrabold tracking-tight">{ticket.subject}</h1>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                        <StatusPill status={ticket.status} />
                        <span className="pill border-hairline bg-shell text-steel">{ticket.priority} priority</span>
                        <span className="pill border-hairline bg-shell text-steel">{ticket.channel}</span>
                        {ticket.escalation_level > 0 && (
                            <span className="pill border-alert/30 bg-alert/10 text-alert">escalation level {ticket.escalation_level}</span>
                        )}
                    </div>
                </div>
                <div className="text-right text-[13px]">
                    <div className="font-display text-2xl font-extrabold">{naira(ticket.value_estimate)}</div>
                    <div className={overdue ? 'font-semibold text-alert' : 'text-steel'}>Due {dateTime(ticket.due_at)}</div>
                    <div className="text-mute">Updated {sinceNow(ticket.last_update_at)}</div>
                </div>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-[1.35fr_1fr]">
                <div className="space-y-5">
                    <section className="card p-5">
                        <h2 className="font-display text-sm font-bold uppercase tracking-wide text-steel">Enquiry</h2>
                        <p className="mt-2 whitespace-pre-wrap text-[13.5px] leading-relaxed">{ticket.description || 'No description recorded.'}</p>
                    </section>

                    <QuoteBuilder
                        ticketId={ticket.id}
                        parts={(parts || []).map((p) => ({
                            id: p.id,
                            sku: p.sku,
                            name: p.name,
                            brand: p.brand,
                            category: p.category,
                            unit_price: Number(p.unit_price),
                            stock_qty: p.stock_qty,
                        }))}
                    />

                    <TicketActions
                        ticketId={ticket.id}
                        status={ticket.status}
                        staff={(staff || []).map((s) => ({ id: s.id, name: s.full_name + ' · ' + s.role }))}
                        assignedTo={ticket.assigned_to}
                    />

                    <section>
                        <h2 className="mb-3 font-display text-lg font-bold">Activity trail</h2>
                        <div className="card divide-y divide-hairline/70">
                            {(events || []).map((e) => (
                                <div key={e.id} className="px-4 py-3">
                                    <div className="flex flex-wrap items-baseline gap-2">
                                        <span className="text-[12px] font-bold text-graphite">{e.actor_name}</span>
                                        <span className="pill border-hairline bg-shell text-[10px] text-steel">{e.event_type.replace('_', ' ')}</span>
                                        <span className="ml-auto font-mono text-[11px] text-mute">{dateTime(e.created_at)}</span>
                                    </div>
                                    <div className="mt-1 text-[13px] leading-relaxed text-steel">{e.note}</div>
                                </div>
                            ))}
                            {!(events || []).length && <div className="px-4 py-6 text-center text-sm text-mute">No activity recorded yet.</div>}
                        </div>
                    </section>
                </div>

                <div className="space-y-5">
                    <section className="card p-5">
                        <h2 className="font-display text-sm font-bold uppercase tracking-wide text-steel">Customer</h2>
                        {customer ? (
                            <div className="mt-2 space-y-1 text-[13.5px]">
                                <Link href={'/customers/' + customer.id} className="block font-display text-base font-bold text-graphite hover:text-torqueDark">
                                    {customer.company || customer.full_name}
                                </Link>
                                {customer.company && <div className="text-steel">{customer.full_name}</div>}
                                <div className="font-mono text-[12px] text-steel">{customer.phone || 'No phone on record'}</div>
                                <div className="text-[12px] text-steel">{customer.email || 'No email on record'}</div>
                                <span className="pill mt-2 border-hairline bg-shell text-steel">{customer.loyalty_tier} tier</span>
                            </div>
                        ) : (
                            <p className="mt-2 text-sm text-mute">No customer record linked yet.</p>
                        )}
                    </section>

                    <section className="card p-5">
                        <h2 className="font-display text-sm font-bold uppercase tracking-wide text-steel">Owner</h2>
                        <p className="mt-2 text-[13.5px]">{owner?.full_name || 'Unassigned'}</p>
                    </section>

                    {(orders || []).length > 0 && (
                        <section className="card p-5">
                            <h2 className="font-display text-sm font-bold uppercase tracking-wide text-steel">Orders</h2>
                            <div className="mt-2 space-y-3">
                                {(orders || []).map((o) => (
                                    <div key={o.id} className="rounded border border-hairline p-3">
                                        <div className="flex items-center justify-between">
                                            <span className="font-mono text-[12px] font-semibold">{o.order_no}</span>
                                            <span className="pill border-hairline bg-shell text-steel">{o.status.replace('_', ' ')}</span>
                                        </div>
                                        <div className="mt-1 font-display text-lg font-bold">{naira(o.total)}</div>
                                        <div className="mt-1 text-[11px] text-steel">
                                            Transfer narration code{' '}
                                            <span className="font-mono font-semibold text-torqueDark">{o.payment_reference}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}
                </div>
            </div>
        </div>
    );
}
