import Link from 'next/link';
import { CalendarClock, Clock } from 'lucide-react';
import { serverClient } from '@/lib/supabase';
import { dateTime, shortDate } from '@/lib/format';
import { PageHead, Stat, Empty } from '@/components/ui';

export const dynamic = 'force-dynamic';

const STATUS_STYLE: Record<string, string> = {
    scheduled: 'border-torque/30 bg-torque/10 text-torqueDark',
    confirmed: 'border-signal/30 bg-signal/10 text-signal',
    completed: 'border-hairline bg-shell text-steel',
    no_show: 'border-alert/30 bg-alert/10 text-alert',
    cancelled: 'border-hairline bg-shell text-mute',
};

export default async function Appointments() {
    const db = await serverClient();
    const [{ data: appointments }, { data: vehicles }] = await Promise.all([
        db
            .from('appointments')
            .select('id, service_type, scheduled_for, duration_minutes, bay, estimated_wait_minutes, status, notes, customers(id, full_name, company, phone), vehicles(make, model, year, plate_number), sales_tickets(id, ticket_no)')
            .order('scheduled_for', { ascending: true })
            .limit(120),
        db.from('vehicles').select('id, make, model, next_service_due, battery_installed_on, battery_warranty_months, customers(id, full_name, company)').limit(200),
    ]);

    const rows = appointments || [];
    const now = new Date();
    const upcoming = rows.filter((a) => new Date(a.scheduled_for) >= now && !['cancelled', 'completed'].includes(a.status));
    const today = upcoming.filter((a) => new Date(a.scheduled_for).toDateString() === now.toDateString());
    const avgWait = upcoming.length
        ? Math.round(upcoming.reduce((s, a) => s + (a.estimated_wait_minutes || 0), 0) / upcoming.length)
        : 0;

    const dueSoon = (vehicles || [])
        .filter((v) => {
            if (!v.next_service_due) return false;
            const d = new Date(v.next_service_due);
            const days = (d.getTime() - now.getTime()) / 86400000;
            return days >= -30 && days <= 21;
        })
        .sort((a, b) => new Date(a.next_service_due!).getTime() - new Date(b.next_service_due!).getTime())
        .slice(0, 10);

    return (
        <div>
            <PageHead
                eyebrow="Workshop"
                title="Appointments"
                sub="Slots booked by the assistant and by the counter, with the vehicles falling due for service so the diary can be filled before the customer has to be chased."
            />

            <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Stat label="Booked today" value={today.length} />
                <Stat label="Upcoming" value={upcoming.length} />
                <Stat label="Average wait quoted" value={avgWait ? avgWait + ' min' : '—'} />
                <Stat label="Vehicles due within 3 weeks" value={dueSoon.length} tone={dueSoon.length ? 'caution' : 'signal'} />
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
                <section>
                    <h2 className="mb-3 flex items-center gap-2 font-display text-xl font-bold">
                        <CalendarClock size={18} className="text-torque" /> Diary
                    </h2>
                    {rows.length ? (
                        <div className="card divide-y divide-hairline/70">
                            {rows.map((a) => {
                                const c = a.customers as unknown as { id: string; full_name: string; company: string | null; phone: string | null } | null;
                                const v = a.vehicles as unknown as { make: string; model: string | null; year: number | null; plate_number: string | null } | null;
                                const t = a.sales_tickets as unknown as { id: string; ticket_no: string } | null;
                                const past = new Date(a.scheduled_for) < now;
                                return (
                                    <div key={a.id} className={'px-4 py-3 ' + (past ? 'opacity-60' : '')}>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="font-display text-sm font-bold">{dateTime(a.scheduled_for)}</span>
                                            <span className={'pill ' + (STATUS_STYLE[a.status] || STATUS_STYLE.scheduled)}>{a.status.replace('_', ' ')}</span>
                                            {a.bay && <span className="pill border-hairline bg-shell text-steel">{a.bay}</span>}
                                            {a.estimated_wait_minutes ? (
                                                <span className="flex items-center gap-1 text-[11.5px] text-mute">
                                                    <Clock size={11} /> about {a.estimated_wait_minutes} min wait
                                                </span>
                                            ) : null}
                                            {t && (
                                                <Link href={'/tickets/' + t.id} className="ml-auto font-mono text-[11px] font-semibold text-torqueDark hover:underline">
                                                    {t.ticket_no}
                                                </Link>
                                            )}
                                        </div>
                                        <div className="mt-1 text-[13.5px]">
                                            {c ? (
                                                <Link href={'/customers/' + c.id} className="font-semibold hover:text-torqueDark">
                                                    {c.company || c.full_name}
                                                </Link>
                                            ) : (
                                                'No customer attached'
                                            )}
                                            <span className="text-steel">
                                                {' '}
                                                · {a.service_type.replace(/_/g, ' ')}
                                                {v ? ' · ' + v.make + ' ' + (v.model || '') + ' ' + (v.year || '') : ''}
                                                {v?.plate_number ? ' · ' + v.plate_number : ''}
                                            </span>
                                        </div>
                                        {a.notes && <div className="mt-1 text-[12px] text-mute">{a.notes}</div>}
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <Empty text="No appointments yet. The assistant books a provisional slot whenever a customer asks for one." />
                    )}
                </section>

                <section>
                    <h2 className="mb-3 font-display text-xl font-bold">Service falling due</h2>
                    <div className="card divide-y divide-hairline/70">
                        {dueSoon.map((v) => {
                            const c = v.customers as unknown as { id: string; full_name: string; company: string | null } | null;
                            const overdue = new Date(v.next_service_due!) < now;
                            return (
                                <div key={v.id} className="px-4 py-2.5">
                                    <div className="flex items-center gap-2">
                                        <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">
                                            {v.make} {v.model}
                                        </span>
                                        <span className={'font-mono text-[11.5px] ' + (overdue ? 'font-semibold text-alert' : 'text-steel')}>
                                            {shortDate(v.next_service_due)}
                                        </span>
                                    </div>
                                    {c && (
                                        <Link href={'/customers/' + c.id} className="text-[11.5px] text-mute hover:text-torqueDark">
                                            {c.company || c.full_name}
                                        </Link>
                                    )}
                                </div>
                            );
                        })}
                        {!dueSoon.length && <div className="px-4 py-6 text-center text-sm text-mute">Nothing falls due in the next three weeks.</div>}
                    </div>
                </section>
            </div>
        </div>
    );
}
