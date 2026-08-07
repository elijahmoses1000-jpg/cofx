import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Car, User, History } from 'lucide-react';
import { serverClient } from '@/lib/supabase';
import { dateTime, naira, sinceNow } from '@/lib/format';
import { PageHead } from '@/components/ui';
import JobCardActions from '@/components/JobCardActions';

export const dynamic = 'force-dynamic';

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

/**
 * The client carries no generated database types, so the shape is declared here
 * rather than inferred from the select string.
 */
interface JobDetail {
    id: string;
    job_no: string;
    status: string;
    bay: string | null;
    branch: string;
    complaint: string | null;
    diagnosis: string | null;
    work_performed: string | null;
    mileage_in_km: number | null;
    service_interval_months: number;
    labour_cost: number;
    parts_cost: number;
    total_cost: number;
    promised_at: string | null;
    ready_at: string | null;
    delivered_at: string | null;
    created_at: string;
    technician_id: string | null;
    customers: { id: string; full_name: string; company: string | null; phone: string | null; whatsapp: string | null } | null;
    vehicles: { id: string; make: string; model: string | null; year: number | null; plate_number: string | null; vin: string | null; next_service_due: string | null } | null;
}

export default async function JobCard({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const db = await serverClient();

    const { data } = await db
        .from('job_cards')
        .select(
            'id, job_no, status, bay, branch, complaint, diagnosis, work_performed, mileage_in_km, ' +
                'service_interval_months, labour_cost, parts_cost, total_cost, promised_at, ready_at, ' +
                'delivered_at, created_at, technician_id, ' +
                'customers(id, full_name, company, phone, whatsapp), ' +
                'vehicles(id, make, model, year, plate_number, vin, next_service_due)'
        )
        .eq('id', id)
        .maybeSingle();

    const job = data as unknown as JobDetail | null;
    if (!job) notFound();

    const [{ data: events }, { data: staff }] = await Promise.all([
        db.from('job_card_events').select('id, from_status, to_status, note, actor_name, created_at').eq('job_card_id', id).order('created_at', { ascending: false }),
        db.from('profiles').select('id, full_name').eq('active', true).order('full_name'),
    ]);

    const customer = job.customers;
    const vehicle = job.vehicles;

    return (
        <div>
            <PageHead
                eyebrow={'Job ' + job.job_no}
                title={vehicle ? vehicle.make + ' ' + (vehicle.model || '') : 'Job card'}
                sub={job.complaint || undefined}
            />

            <div className="mb-6 flex flex-wrap items-center gap-2">
                <span className={'pill ' + (LANE_STYLE[job.status] || LANE_STYLE.received)}>{job.status.replace(/_/g, ' ')}</span>
                {job.bay && <span className="pill border-hairline bg-shell text-steel">{job.bay}</span>}
                <span className="text-[12px] text-mute">opened {sinceNow(job.created_at)}</span>
                {job.promised_at && (
                    <span className="text-[12px] text-mute">· promised {dateTime(job.promised_at)}</span>
                )}
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
                <div className="space-y-6">
                    <JobCardActions
                        jobId={job.id}
                        status={job.status}
                        technicianId={job.technician_id}
                        labourCost={Number(job.labour_cost)}
                        partsCost={Number(job.parts_cost)}
                        serviceIntervalMonths={job.service_interval_months}
                        staff={(staff || []).map((s) => ({ id: s.id, name: s.full_name }))}
                    />

                    <section className="card p-5">
                        <h2 className="mb-3 font-display text-sm font-bold uppercase tracking-wide text-steel">Work</h2>
                        <dl className="space-y-3 text-[13.5px]">
                            <div>
                                <dt className="text-[11.5px] font-semibold uppercase tracking-wide text-mute">Complaint</dt>
                                <dd>{job.complaint || '—'}</dd>
                            </div>
                            <div>
                                <dt className="text-[11.5px] font-semibold uppercase tracking-wide text-mute">Diagnosis</dt>
                                <dd>{job.diagnosis || 'Not recorded yet.'}</dd>
                            </div>
                            <div>
                                <dt className="text-[11.5px] font-semibold uppercase tracking-wide text-mute">Work performed</dt>
                                <dd>{job.work_performed || 'Not recorded yet.'}</dd>
                            </div>
                        </dl>
                        <div className="mt-4 flex gap-6 border-t border-hairline pt-3 font-mono text-[12.5px]">
                            <span className="text-steel">Labour {naira(job.labour_cost)}</span>
                            <span className="text-steel">Parts {naira(job.parts_cost)}</span>
                            <span className="ml-auto font-semibold">Total {naira(job.total_cost)}</span>
                        </div>
                    </section>

                    <section>
                        <h2 className="mb-3 flex items-center gap-2 font-display text-xl font-bold">
                            <History size={18} className="text-torque" /> Trail
                        </h2>
                        <div className="card divide-y divide-hairline/70">
                            {(events || []).map((e) => (
                                <div key={e.id} className="px-4 py-2.5">
                                    <div className="flex items-center gap-2 text-[12.5px]">
                                        <span className="font-semibold">
                                            {e.from_status ? e.from_status.replace(/_/g, ' ') + ' → ' : ''}
                                            {(e.to_status || '').replace(/_/g, ' ')}
                                        </span>
                                        <span className="ml-auto text-[11.5px] text-mute">{dateTime(e.created_at)}</span>
                                    </div>
                                    {e.note && <div className="mt-0.5 text-[12.5px] text-steel">{e.note}</div>}
                                    <div className="text-[11px] text-mute">{e.actor_name}</div>
                                </div>
                            ))}
                            {!events?.length && <div className="px-4 py-6 text-center text-sm text-mute">No status changes yet.</div>}
                        </div>
                    </section>
                </div>

                <div className="space-y-6">
                    <section className="card p-5">
                        <h2 className="mb-3 flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wide text-steel">
                            <Car size={14} /> Vehicle
                        </h2>
                        {vehicle ? (
                            <dl className="space-y-1.5 text-[13px]">
                                <div className="flex justify-between gap-3">
                                    <dt className="text-mute">Make and model</dt>
                                    <dd className="text-right font-medium">{vehicle.make} {vehicle.model || ''} {vehicle.year || ''}</dd>
                                </div>
                                <div className="flex justify-between gap-3">
                                    <dt className="text-mute">Plate</dt>
                                    <dd className="text-right font-mono">{vehicle.plate_number || '—'}</dd>
                                </div>
                                <div className="flex justify-between gap-3">
                                    <dt className="text-mute">Mileage in</dt>
                                    <dd className="text-right font-mono">{job.mileage_in_km ? job.mileage_in_km.toLocaleString() + ' km' : '—'}</dd>
                                </div>
                                <div className="flex justify-between gap-3">
                                    <dt className="text-mute">Next service due</dt>
                                    <dd className="text-right font-mono">{vehicle.next_service_due || '—'}</dd>
                                </div>
                            </dl>
                        ) : (
                            <p className="text-sm text-mute">The vehicle record has been removed.</p>
                        )}
                    </section>

                    <section className="card p-5">
                        <h2 className="mb-3 flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wide text-steel">
                            <User size={14} /> Customer
                        </h2>
                        {customer ? (
                            <div className="space-y-1 text-[13px]">
                                <Link href={'/customers/' + customer.id} className="font-semibold hover:text-torqueDark">
                                    {customer.company || customer.full_name}
                                </Link>
                                {customer.company && <div className="text-mute">{customer.full_name}</div>}
                                <div className="font-mono text-[12px] text-steel">{customer.whatsapp || customer.phone || 'No number on file'}</div>
                            </div>
                        ) : (
                            <p className="text-sm text-mute">No customer attached.</p>
                        )}
                    </section>
                </div>
            </div>
        </div>
    );
}
