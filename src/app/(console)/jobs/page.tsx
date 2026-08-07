import Link from 'next/link';
import { Wrench, AlertTriangle } from 'lucide-react';
import { serverClient } from '@/lib/supabase';
import { dateTime, naira, sinceNow } from '@/lib/format';
import { PageHead, Stat, Empty } from '@/components/ui';

export const dynamic = 'force-dynamic';

/**
 * The workshop board.
 *
 * Appointments describe a booking. This describes the work: which car is on
 * which ramp, who is holding it, and what is stopping it moving. A job reaching
 * "ready for pickup" is what tells the customer to come, and "delivered" is what
 * sets the next service date, so the reminder engine keeps turning.
 */

const LANES = [
    { id: 'received', label: 'Received' },
    { id: 'diagnosing', label: 'Diagnosing' },
    { id: 'awaiting_parts', label: 'Awaiting parts' },
    { id: 'awaiting_approval', label: 'Awaiting approval' },
    { id: 'in_progress', label: 'In progress' },
    { id: 'ready_for_pickup', label: 'Ready for pickup' },
];

const LANE_STYLE: Record<string, string> = {
    received: 'border-hairline bg-shell text-steel',
    diagnosing: 'border-torque/30 bg-torque/10 text-torqueDark',
    awaiting_parts: 'border-caution/30 bg-caution/10 text-caution',
    awaiting_approval: 'border-caution/30 bg-caution/10 text-caution',
    in_progress: 'border-torque/30 bg-torque/10 text-torqueDark',
    ready_for_pickup: 'border-signal/30 bg-signal/10 text-signal',
    delivered: 'border-hairline bg-shell text-mute',
    cancelled: 'border-hairline bg-shell text-mute',
};

interface JobRow {
    id: string;
    job_no: string;
    status: string;
    bay: string | null;
    complaint: string | null;
    promised_at: string | null;
    total_cost: number;
    created_at: string;
    customers: { id: string; full_name: string; company: string | null } | null;
    vehicles: { make: string; model: string | null; plate_number: string | null } | null;
    profiles: { full_name: string } | null;
}

export default async function Jobs() {
    const db = await serverClient();
    const { data } = await db
        .from('job_cards')
        .select(
            'id, job_no, status, bay, complaint, promised_at, total_cost, created_at, ' +
                'customers(id, full_name, company), vehicles(make, model, plate_number), profiles:technician_id(full_name)'
        )
        .order('created_at', { ascending: false })
        .limit(200);

    const rows = (data || []) as unknown as JobRow[];
    const now = new Date();

    const open = rows.filter((j) => !['delivered', 'cancelled'].includes(j.status));
    const ready = rows.filter((j) => j.status === 'ready_for_pickup');
    const blocked = open.filter((j) => ['awaiting_parts', 'awaiting_approval'].includes(j.status));
    const late = open.filter((j) => j.promised_at && new Date(j.promised_at) < now);

    return (
        <div>
            <PageHead
                eyebrow="Workshop"
                title="Job cards"
                sub="Every vehicle currently in the hands of the workshop, and what is holding it. Marking a job delivered stamps the next service date, which is what schedules the reminder that brings the customer back."
            />

            <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Stat label="Open jobs" value={open.length} />
                <Stat label="Ready for pickup" value={ready.length} tone={ready.length ? 'signal' : undefined} />
                <Stat label="Blocked" value={blocked.length} tone={blocked.length ? 'caution' : undefined} />
                <Stat label="Past promised time" value={late.length} tone={late.length ? 'alert' : undefined} />
            </div>

            {open.length ? (
                <div className="grid gap-4 lg:grid-cols-3">
                    {LANES.map((lane) => {
                        const inLane = open.filter((j) => j.status === lane.id);
                        return (
                            <section key={lane.id}>
                                <h2 className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-steel">
                                    {lane.label}
                                    <span className="rounded bg-shell px-1.5 py-0.5 font-mono text-[10.5px] text-mute">{inLane.length}</span>
                                </h2>
                                <div className="space-y-2">
                                    {inLane.map((j) => {
                                        const overdue = j.promised_at && new Date(j.promised_at) < now;
                                        return (
                                            <Link
                                                key={j.id}
                                                href={'/jobs/' + j.id}
                                                className="card block px-3 py-2.5 transition-colors hover:border-torque/40"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono text-[11px] font-semibold text-torqueDark">{j.job_no}</span>
                                                    {j.bay && <span className="pill border-hairline bg-shell text-steel">{j.bay}</span>}
                                                    {overdue && (
                                                        <span className="ml-auto flex items-center gap-1 text-[11px] font-semibold text-alert">
                                                            <AlertTriangle size={11} /> late
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="mt-1 truncate text-[13.5px] font-semibold">
                                                    {j.vehicles ? j.vehicles.make + ' ' + (j.vehicles.model || '') : 'Vehicle removed'}
                                                    {j.vehicles?.plate_number ? ' · ' + j.vehicles.plate_number : ''}
                                                </div>
                                                <div className="truncate text-[12px] text-mute">
                                                    {j.customers?.company || j.customers?.full_name || 'No customer'}
                                                    {j.profiles ? ' · ' + j.profiles.full_name : ''}
                                                </div>
                                                {j.complaint && <div className="mt-1 truncate text-[12px] text-steel">{j.complaint}</div>}
                                                <div className="mt-1 flex items-center gap-2 text-[11px] text-mute">
                                                    <span>opened {sinceNow(j.created_at)}</span>
                                                    {j.total_cost > 0 && <span className="ml-auto font-mono">{naira(j.total_cost)}</span>}
                                                </div>
                                            </Link>
                                        );
                                    })}
                                    {!inLane.length && (
                                        <div className="rounded border border-dashed border-hairline px-3 py-4 text-center text-[12px] text-mute">
                                            Nothing here
                                        </div>
                                    )}
                                </div>
                            </section>
                        );
                    })}
                </div>
            ) : (
                <Empty text="No vehicles in the workshop. Open a job card from a customer record or an appointment when a car arrives." />
            )}

            <section className="mt-8">
                <h2 className="mb-3 flex items-center gap-2 font-display text-xl font-bold">
                    <Wrench size={18} className="text-torque" /> Recently closed
                </h2>
                {rows.filter((j) => ['delivered', 'cancelled'].includes(j.status)).length ? (
                    <div className="card divide-y divide-hairline/70">
                        {rows
                            .filter((j) => ['delivered', 'cancelled'].includes(j.status))
                            .slice(0, 15)
                            .map((j) => (
                                <Link key={j.id} href={'/jobs/' + j.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-shell/60">
                                    <span className="font-mono text-[11px] font-semibold text-torqueDark">{j.job_no}</span>
                                    <span className={'pill ' + LANE_STYLE[j.status]}>{j.status.replace(/_/g, ' ')}</span>
                                    <span className="min-w-0 flex-1 truncate text-[13.5px]">
                                        {j.vehicles ? j.vehicles.make + ' ' + (j.vehicles.model || '') : '—'}
                                        <span className="text-mute"> · {j.customers?.company || j.customers?.full_name || 'No customer'}</span>
                                    </span>
                                    <span className="font-mono text-[11.5px] text-steel">{naira(j.total_cost)}</span>
                                </Link>
                            ))}
                    </div>
                ) : (
                    <Empty text="Nothing has been delivered yet." />
                )}
            </section>
        </div>
    );
}
