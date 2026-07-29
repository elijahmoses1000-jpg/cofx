'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Save } from 'lucide-react';

const STATUSES = [
    { id: 'open', label: 'Open' },
    { id: 'wip', label: 'Work in progress' },
    { id: 'awaiting_payment', label: 'Awaiting payment' },
    { id: 'closed', label: 'Closed' },
    { id: 'lost', label: 'Lost' },
];

export default function TicketActions({
    ticketId,
    status,
    staff,
    assignedTo,
}: {
    ticketId: string;
    status: string;
    staff: Array<{ id: string; name: string }>;
    assignedTo: string | null;
}) {
    const router = useRouter();
    const [next, setNext] = useState(status);
    const [owner, setOwner] = useState(assignedTo || '');
    const [note, setNote] = useState('');
    const [outcome, setOutcome] = useState('');
    const [lostReason, setLostReason] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [done, setDone] = useState('');

    const closing = next === 'closed' || next === 'lost';

    async function save() {
        setBusy(true);
        setError('');
        setDone('');
        try {
            const res = await fetch('/api/tickets/' + ticketId, {
                method: 'PATCH',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    status: next !== status ? next : undefined,
                    assigned_to: owner && owner !== assignedTo ? owner : undefined,
                    note: note.trim() || undefined,
                    outcome: closing ? outcome || undefined : undefined,
                    lost_reason: outcome === 'lost' ? lostReason : undefined,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || 'The update was rejected.');
            } else {
                setDone('Ticket updated and the activity trail recorded.');
                setNote('');
                router.refresh();
            }
        } catch {
            setError('The update could not be sent.');
        }
        setBusy(false);
    }

    return (
        <section className="card p-5">
            <h2 className="font-display text-sm font-bold uppercase tracking-wide text-steel">Update this ticket</h2>
            <p className="mt-1 text-[12.5px] text-steel">
                Movement is mandatory. A close needs an outcome, and a lost deal needs a reason, so management always sees
                what happened to the lead.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                    <label htmlFor="status" className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-steel">Status</label>
                    <select id="status" value={next} onChange={(e) => setNext(e.target.value)} className="field">
                        {STATUSES.map((s) => (
                            <option key={s.id} value={s.id}>{s.label}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label htmlFor="owner" className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-steel">Assigned representative</label>
                    <select id="owner" value={owner} onChange={(e) => setOwner(e.target.value)} className="field">
                        <option value="">Unassigned</option>
                        {staff.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {closing && (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div>
                        <label htmlFor="outcome" className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-steel">Outcome, required</label>
                        <select id="outcome" value={outcome} onChange={(e) => setOutcome(e.target.value)} className="field">
                            <option value="">Select an outcome</option>
                            <option value="won">Won</option>
                            <option value="lost">Lost</option>
                            <option value="no_response">No response from customer</option>
                        </select>
                    </div>
                    {outcome === 'lost' && (
                        <div>
                            <label htmlFor="lost" className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-steel">Reason lost, required</label>
                            <input id="lost" value={lostReason} onChange={(e) => setLostReason(e.target.value)} placeholder="Price, availability, competitor, no budget" className="field" />
                        </div>
                    )}
                </div>
            )}

            <div className="mt-3">
                <label htmlFor="note" className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-steel">What happened</label>
                <textarea id="note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Called the customer, quoted the ceramic pads, waiting on their confirmation." className="field" />
            </div>

            {error && <div className="mt-2 text-xs font-semibold text-alert">{error}</div>}
            {done && <div className="mt-2 text-xs font-semibold text-signal">{done}</div>}

            <button onClick={save} disabled={busy} className="btn-primary mt-4">
                <Save size={15} /> {busy ? 'Saving' : 'Save update'}
            </button>
        </section>
    );
}
