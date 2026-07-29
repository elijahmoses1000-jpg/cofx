'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, Check, X, ShieldCheck } from 'lucide-react';
import { naira, dateTime } from '@/lib/format';

interface Row {
    id: string;
    amount: number;
    status: string;
    match_score: number;
    match_reason: string | null;
    auto_approved: boolean;
    order_no: string | null;
    payment_reference: string | null;
    order_status: string | null;
    customer: string;
    created_at: string;
}

const STATUS_STYLE: Record<string, string> = {
    awaiting: 'border-hairline bg-shell text-steel',
    matched: 'border-caution/30 bg-caution/10 text-caution',
    confirmed: 'border-signal/30 bg-signal/10 text-signal',
    mismatch: 'border-alert/30 bg-alert/10 text-alert',
    rejected: 'border-alert/30 bg-alert/10 text-alert',
};

export default function PaymentsConsole({ payments }: { payments: Row[] }) {
    const router = useRouter();
    const [busy, setBusy] = useState('');
    const [message, setMessage] = useState('');

    async function reconcile() {
        setBusy('all');
        setMessage('');
        try {
            const res = await fetch('/api/payments/reconcile', { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
                setMessage(
                    'Checked ' + data.checked + ' alert' + (data.checked === 1 ? '' : 's') + '. Released ' + data.released +
                    ' automatically and flagged ' + data.flagged + ' for review.'
                );
                router.refresh();
            } else {
                setMessage(data.error || 'Reconciliation did not complete.');
            }
        } catch {
            setMessage('Reconciliation could not be started.');
        }
        setBusy('');
    }

    async function decide(id: string, decision: 'confirm' | 'reject') {
        setBusy(id);
        try {
            const res = await fetch('/api/payments/' + id + '/decide', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ decision }),
            });
            if (res.ok) router.refresh();
            else setMessage('That decision could not be applied.');
        } catch {
            setMessage('That decision could not be sent.');
        }
        setBusy('');
    }

    return (
        <section>
            <div className="mb-3 flex flex-wrap items-center gap-3">
                <h2 className="font-display text-xl font-bold">Expected payments</h2>
                <button onClick={reconcile} disabled={busy === 'all'} className="btn-ghost ml-auto">
                    <RefreshCw size={14} className={busy === 'all' ? 'animate-spin' : ''} />
                    {busy === 'all' ? 'Matching' : 'Run matching now'}
                </button>
            </div>
            {message && <div className="mb-3 rounded border border-torque/30 bg-torque/5 px-3 py-2 text-[13px] text-torqueDark">{message}</div>}

            <div className="card divide-y divide-hairline/70">
                {payments.map((p) => (
                    <div key={p.id} className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="font-display text-lg font-bold">{naira(p.amount)}</span>
                            <span className="text-[13px] text-steel">{p.customer}</span>
                            {p.order_no && <span className="font-mono text-[11px] text-mute">{p.order_no}</span>}
                            {p.payment_reference && (
                                <span className="font-mono text-[11px] font-semibold text-torqueDark">{p.payment_reference}</span>
                            )}
                            <span className={'pill ' + (STATUS_STYLE[p.status] || STATUS_STYLE.awaiting)}>{p.status}</span>
                            {p.auto_approved && (
                                <span className="pill border-signal/30 bg-signal/10 text-signal">
                                    <ShieldCheck size={11} /> auto released
                                </span>
                            )}
                            <span className="ml-auto font-mono text-[11px] text-mute">{dateTime(p.created_at)}</span>
                        </div>

                        {p.match_reason && (
                            <div className="mt-1.5 text-[12.5px] text-steel">
                                Match score {p.match_score} because {p.match_reason}.
                            </div>
                        )}

                        {p.status === 'matched' && (
                            <div className="mt-2 flex gap-2">
                                <button onClick={() => decide(p.id, 'confirm')} disabled={busy === p.id} className="btn-primary py-1.5 text-xs">
                                    <Check size={13} /> Confirm and release
                                </button>
                                <button onClick={() => decide(p.id, 'reject')} disabled={busy === p.id} className="btn-ghost py-1.5 text-xs">
                                    <X size={13} /> Reject
                                </button>
                            </div>
                        )}
                    </div>
                ))}
                {!payments.length && (
                    <div className="px-4 py-10 text-center text-sm text-mute">
                        No payments are expected. They appear when an order is raised against a ticket.
                    </div>
                )}
            </div>
        </section>
    );
}
