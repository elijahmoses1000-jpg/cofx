'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Save } from 'lucide-react';

const STATUSES = [
    { id: 'received', label: 'Received' },
    { id: 'diagnosing', label: 'Diagnosing' },
    { id: 'awaiting_parts', label: 'Awaiting parts' },
    { id: 'awaiting_approval', label: 'Awaiting approval' },
    { id: 'in_progress', label: 'In progress' },
    { id: 'ready_for_pickup', label: 'Ready for pickup' },
    { id: 'delivered', label: 'Delivered' },
    { id: 'cancelled', label: 'Cancelled' },
];

export default function JobCardActions({
    jobId,
    status,
    technicianId,
    labourCost,
    partsCost,
    serviceIntervalMonths,
    staff,
}: {
    jobId: string;
    status: string;
    technicianId: string | null;
    labourCost: number;
    partsCost: number;
    serviceIntervalMonths: number;
    staff: Array<{ id: string; name: string }>;
}) {
    const router = useRouter();
    const [next, setNext] = useState(status);
    const [tech, setTech] = useState(technicianId || '');
    const [labour, setLabour] = useState(String(labourCost));
    const [parts, setParts] = useState(String(partsCost));
    const [interval, setInterval] = useState(String(serviceIntervalMonths));
    const [diagnosis, setDiagnosis] = useState('');
    const [work, setWork] = useState('');
    const [mileage, setMileage] = useState('');
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [done, setDone] = useState('');

    // These two transitions message the customer, so the form asks for the
    // detail that makes the message worth receiving before it will send.
    const notifying = next === 'ready_for_pickup' && status !== 'ready_for_pickup';
    const delivering = next === 'delivered' && status !== 'delivered';

    async function save() {
        setBusy(true);
        setError('');
        setDone('');
        try {
            const res = await fetch('/api/jobs/' + jobId, {
                method: 'PATCH',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    status: next !== status ? next : undefined,
                    technician_id: tech && tech !== technicianId ? tech : undefined,
                    labour_cost: Number(labour) !== labourCost ? Number(labour) : undefined,
                    parts_cost: Number(parts) !== partsCost ? Number(parts) : undefined,
                    service_interval_months: Number(interval) !== serviceIntervalMonths ? Number(interval) : undefined,
                    diagnosis: diagnosis.trim() || undefined,
                    work_performed: work.trim() || undefined,
                    mileage_in_km: mileage.trim() ? Number(mileage) : undefined,
                    note: note.trim() || undefined,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || 'The update was rejected.');
            } else {
                setDone(data.message || 'Job card updated.');
                setNote('');
                setDiagnosis('');
                setWork('');
                router.refresh();
            }
        } catch {
            setError('The update could not be sent.');
        }
        setBusy(false);
    }

    return (
        <section className="card p-5">
            <h2 className="font-display text-sm font-bold uppercase tracking-wide text-steel">Update this job</h2>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="block">
                    <span className="mb-1 block text-[11.5px] font-semibold uppercase tracking-wide text-mute">Status</span>
                    <select value={next} onChange={(e) => setNext(e.target.value)} className="field w-full">
                        {STATUSES.map((s) => (
                            <option key={s.id} value={s.id}>
                                {s.label}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="block">
                    <span className="mb-1 block text-[11.5px] font-semibold uppercase tracking-wide text-mute">Technician</span>
                    <select value={tech} onChange={(e) => setTech(e.target.value)} className="field w-full">
                        <option value="">Unassigned</option>
                        {staff.map((s) => (
                            <option key={s.id} value={s.id}>
                                {s.name}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="block">
                    <span className="mb-1 block text-[11.5px] font-semibold uppercase tracking-wide text-mute">Labour</span>
                    <input type="number" min="0" value={labour} onChange={(e) => setLabour(e.target.value)} className="field w-full" />
                </label>

                <label className="block">
                    <span className="mb-1 block text-[11.5px] font-semibold uppercase tracking-wide text-mute">Parts</span>
                    <input type="number" min="0" value={parts} onChange={(e) => setParts(e.target.value)} className="field w-full" />
                </label>
            </div>

            {notifying && (
                <p className="mt-3 rounded border border-signal/30 bg-signal/10 px-3 py-2 text-[12.5px] text-signal">
                    Saving this queues a message telling the customer their vehicle is ready.
                </p>
            )}

            {delivering && (
                <div className="mt-3 space-y-3 rounded border border-caution/30 bg-caution/10 px-3 py-3">
                    <p className="text-[12.5px] text-caution">
                        Delivering stamps the next service date and queues a feedback request. Record what was done first.
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <label className="block">
                            <span className="mb-1 block text-[11.5px] font-semibold uppercase tracking-wide text-mute">Mileage out (km)</span>
                            <input type="number" min="0" value={mileage} onChange={(e) => setMileage(e.target.value)} className="field w-full" />
                        </label>
                        <label className="block">
                            <span className="mb-1 block text-[11.5px] font-semibold uppercase tracking-wide text-mute">Next service in (months)</span>
                            <input type="number" min="1" max="24" value={interval} onChange={(e) => setInterval(e.target.value)} className="field w-full" />
                        </label>
                    </div>
                </div>
            )}

            <label className="mt-3 block">
                <span className="mb-1 block text-[11.5px] font-semibold uppercase tracking-wide text-mute">Diagnosis</span>
                <textarea value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} rows={2} className="field w-full" placeholder="What is actually wrong with it" />
            </label>

            <label className="mt-3 block">
                <span className="mb-1 block text-[11.5px] font-semibold uppercase tracking-wide text-mute">Work performed</span>
                <textarea value={work} onChange={(e) => setWork(e.target.value)} rows={2} className="field w-full" placeholder="What was done, in the words you would use with the customer" />
            </label>

            <label className="mt-3 block">
                <span className="mb-1 block text-[11.5px] font-semibold uppercase tracking-wide text-mute">Note for the trail</span>
                <input value={note} onChange={(e) => setNote(e.target.value)} className="field w-full" placeholder="Why the job moved" />
            </label>

            {error && <p className="mt-3 rounded border border-alert/30 bg-alert/10 px-3 py-2 text-[12.5px] text-alert">{error}</p>}
            {done && <p className="mt-3 rounded border border-signal/30 bg-signal/10 px-3 py-2 text-[12.5px] text-signal">{done}</p>}

            <button onClick={save} disabled={busy} className="btn-primary mt-4 inline-flex items-center gap-2 disabled:opacity-60">
                <Save size={15} /> {busy ? 'Saving' : 'Save job card'}
            </button>
        </section>
    );
}
