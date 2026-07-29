import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, Car, Gift } from 'lucide-react';
import { serverClient } from '@/lib/supabase';
import { naira, shortDate, dateTime } from '@/lib/format';
import { StatusPill } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function CustomerDetail({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const db = await serverClient();

    const { data: customer } = await db.from('customers').select('*').eq('id', id).maybeSingle();
    if (!customer) notFound();

    const [{ data: vehicles }, { data: tickets }, { data: engagements }, { data: orders }] = await Promise.all([
        db.from('vehicles').select('*').eq('customer_id', id),
        db.from('sales_tickets').select('id, ticket_no, subject, status, value_estimate, created_at').eq('customer_id', id).order('created_at', { ascending: false }).limit(15),
        db.from('engagements').select('id, type, status, subject, scheduled_for, sent_at').eq('customer_id', id).order('scheduled_for', { ascending: false }).limit(15),
        db.from('orders').select('id, order_no, status, total, created_at').eq('customer_id', id).order('created_at', { ascending: false }).limit(10),
    ]);

    return (
        <div>
            <Link href="/customers" className="mb-4 inline-flex items-center gap-1 text-xs font-semibold text-steel hover:text-torqueDark">
                <ChevronLeft size={14} /> All customers
            </Link>

            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="font-display text-2xl font-extrabold tracking-tight">{customer.company || customer.full_name}</h1>
                    {customer.company && <div className="text-sm text-steel">{customer.full_name}</div>}
                    <div className="mt-2 flex flex-wrap gap-2">
                        <span className="pill border-torque/30 bg-torque/10 text-torqueDark">{customer.loyalty_tier} tier</span>
                        <span className="pill border-hairline bg-shell text-steel">{customer.customer_type}</span>
                        <span className="pill border-hairline bg-shell text-steel">via {customer.source.replace('_', ' ')}</span>
                    </div>
                </div>
                <div className="text-right">
                    <div className="font-display text-3xl font-extrabold">{naira(customer.lifetime_value)}</div>
                    <div className="text-[12px] text-steel">{customer.total_orders} orders, {customer.loyalty_points} loyalty points</div>
                </div>
            </div>

            <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_1.3fr]">
                <div className="space-y-5">
                    <section className="card p-5">
                        <h2 className="font-display text-sm font-bold uppercase tracking-wide text-steel">Contact</h2>
                        <div className="mt-2 space-y-1 text-[13.5px]">
                            <div className="font-mono text-[12.5px]">{customer.phone || 'No phone on record'}</div>
                            <div>{customer.email || 'No email on record'}</div>
                            <div className="text-steel">{customer.address || 'No address on record'}</div>
                            <div className="text-steel">{[customer.city, customer.state].filter(Boolean).join(', ')}</div>
                            <div className="pt-2 text-[12px] text-mute">
                                Birthday {customer.birthday ? shortDate(customer.birthday) : 'not recorded'}
                            </div>
                            <div className="text-[12px] text-mute">
                                Marketing consent {customer.consent_marketing ? 'granted' : 'withheld'}
                            </div>
                        </div>
                        {customer.notes && <p className="mt-3 border-t border-hairline pt-3 text-[13px] text-steel">{customer.notes}</p>}
                    </section>

                    <section className="card p-5">
                        <h2 className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wide text-steel">
                            <Car size={15} className="text-torque" /> Vehicles
                        </h2>
                        <div className="mt-3 space-y-3">
                            {(vehicles || []).map((v) => (
                                <div key={v.id} className="rounded border border-hairline p-3">
                                    <div className="font-display text-sm font-bold">
                                        {v.make} {v.model} {v.year}
                                    </div>
                                    <div className="font-mono text-[11px] text-steel">{v.plate_number || 'No plate recorded'}</div>
                                    <div className="mt-1.5 grid gap-0.5 text-[12px] text-steel">
                                        <div>Battery fitted {shortDate(v.battery_installed_on)}, {v.battery_warranty_months} month warranty</div>
                                        <div>Next service due {shortDate(v.next_service_due)}</div>
                                    </div>
                                </div>
                            ))}
                            {!(vehicles || []).length && <p className="text-sm text-mute">No vehicles recorded yet.</p>}
                        </div>
                    </section>
                </div>

                <div className="space-y-5">
                    <section>
                        <h2 className="mb-3 font-display text-lg font-bold">Tickets</h2>
                        <div className="card divide-y divide-hairline/70">
                            {(tickets || []).map((t) => (
                                <Link key={t.id} href={'/tickets/' + t.id} className="flex items-center gap-3 px-4 py-3 hover:bg-shell/60">
                                    <div className="min-w-0 flex-1">
                                        <div className="font-mono text-[11.5px] font-semibold text-torqueDark">{t.ticket_no}</div>
                                        <div className="truncate text-[13px]">{t.subject}</div>
                                    </div>
                                    <StatusPill status={t.status} />
                                    <span className="font-mono text-[12px]">{naira(t.value_estimate)}</span>
                                </Link>
                            ))}
                            {!(tickets || []).length && <div className="px-4 py-6 text-center text-sm text-mute">No tickets yet.</div>}
                        </div>
                    </section>

                    <section>
                        <h2 className="mb-3 font-display text-lg font-bold">Orders</h2>
                        <div className="card divide-y divide-hairline/70">
                            {(orders || []).map((o) => (
                                <div key={o.id} className="flex items-center gap-3 px-4 py-3">
                                    <span className="font-mono text-[12px] font-semibold">{o.order_no}</span>
                                    <span className="pill border-hairline bg-shell text-steel">{o.status.replace('_', ' ')}</span>
                                    <span className="ml-auto font-mono text-[12px]">{naira(o.total)}</span>
                                    <span className="text-[11px] text-mute">{shortDate(o.created_at)}</span>
                                </div>
                            ))}
                            {!(orders || []).length && <div className="px-4 py-6 text-center text-sm text-mute">No orders yet.</div>}
                        </div>
                    </section>

                    <section>
                        <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold">
                            <Gift size={17} className="text-torque" /> After sales engagements
                        </h2>
                        <div className="card divide-y divide-hairline/70">
                            {(engagements || []).map((e) => (
                                <div key={e.id} className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        <span className="pill border-hairline bg-shell text-steel">{e.type.replace('_', ' ')}</span>
                                        <span className={'pill ' + (e.status === 'sent' ? 'border-signal/30 bg-signal/10 text-signal' : 'border-caution/30 bg-caution/10 text-caution')}>
                                            {e.status}
                                        </span>
                                        <span className="ml-auto font-mono text-[11px] text-mute">{dateTime(e.sent_at || e.scheduled_for)}</span>
                                    </div>
                                    <div className="mt-1 text-[13px]">{e.subject}</div>
                                </div>
                            ))}
                            {!(engagements || []).length && (
                                <div className="px-4 py-6 text-center text-sm text-mute">
                                    Nothing queued. The after sales engine adds birthday, battery and service messages automatically.
                                </div>
                            )}
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
