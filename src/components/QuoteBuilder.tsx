'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Plus, Minus, Search, Check } from 'lucide-react';
import { naira } from '@/lib/format';

interface Part {
    id: string;
    sku: string;
    name: string;
    brand: string | null;
    category: string;
    unit_price: number;
    stock_qty: number;
    fits?: string[];
}

export default function QuoteBuilder({ ticketId, parts }: { ticketId: string; parts: Part[] }) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [picked, setPicked] = useState<Record<string, number>>({});
    const [discount, setDiscount] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [done, setDone] = useState<{ order_no: string; total: number; payment_reference: string } | null>(null);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return parts.slice(0, 8);
        return parts.filter((p) => (p.name + ' ' + p.sku + ' ' + p.category + ' ' + (p.brand || '')).toLowerCase().includes(q)).slice(0, 10);
    }, [parts, query]);

    const lines = Object.entries(picked).filter(([, qty]) => qty > 0);
    const subtotal = lines.reduce((sum, [id, qty]) => sum + (parts.find((p) => p.id === id)?.unit_price || 0) * qty, 0);
    const off = Math.max(0, Math.min(Number(discount) || 0, subtotal));

    function bump(id: string, by: number) {
        setPicked((prev) => {
            const next = { ...prev, [id]: Math.max(0, (prev[id] || 0) + by) };
            if (!next[id]) delete next[id];
            return next;
        });
    }

    async function raise() {
        if (!lines.length) {
            setError('Add at least one part.');
            return;
        }
        setBusy(true);
        setError('');
        try {
            const res = await fetch('/api/orders', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    ticket_id: ticketId,
                    items: lines.map(([part_id, qty]) => ({ part_id, qty })),
                    discount: off,
                }),
            });
            const data = await res.json();
            if (!res.ok) setError(data.error || 'The quotation could not be raised.');
            else {
                setDone(data.order);
                setPicked({});
                setDiscount('');
                router.refresh();
            }
        } catch {
            setError('The quotation could not be sent.');
        }
        setBusy(false);
    }

    if (done) {
        return (
            <section className="card border-signal/40 bg-signal/5 p-5">
                <div className="flex items-center gap-2 font-display text-sm font-bold text-signal">
                    <Check size={16} /> Quotation raised as {done.order_no}
                </div>
                <div className="mt-2 font-display text-2xl font-extrabold">{naira(done.total)}</div>
                <p className="mt-2 text-[13px] leading-relaxed text-steel">
                    Tell the customer to put this code in the transfer narration. When the bank alert arrives, the payment
                    matcher will recognise it and release the goods without waiting for a manual finance check.
                </p>
                <div className="mt-2 inline-block rounded border border-torque/40 bg-panel px-3 py-2 font-mono text-lg font-bold text-torqueDark">
                    {done.payment_reference}
                </div>
                <div className="mt-3">
                    <button onClick={() => setDone(null)} className="btn-ghost">
                        Raise another
                    </button>
                </div>
            </section>
        );
    }

    if (!open) {
        return (
            <section className="card p-5">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                        <h2 className="font-display text-sm font-bold uppercase tracking-wide text-steel">Quotation</h2>
                        <p className="mt-1 text-[12.5px] text-steel">
                            Turn this enquiry into a priced order and issue the payment reference that lets the goods release
                            automatically once the customer transfers.
                        </p>
                    </div>
                    <button onClick={() => setOpen(true)} className="btn-primary">
                        <FileText size={15} /> Build a quotation
                    </button>
                </div>
            </section>
        );
    }

    return (
        <section className="card p-5">
            <div className="flex items-center gap-2">
                <FileText size={16} className="text-torque" />
                <h2 className="font-display text-sm font-bold uppercase tracking-wide text-steel">Build a quotation</h2>
                <button onClick={() => setOpen(false)} className="ml-auto text-xs font-bold text-steel hover:text-torqueDark">
                    Cancel
                </button>
            </div>

            <div className="relative mt-3">
                <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mute" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search the catalogue by name, part number or category" className="field pl-9" />
            </div>

            <div className="mt-3 divide-y divide-hairline/70 rounded border border-hairline">
                {filtered.map((p) => (
                    <div key={p.id} className="flex items-center gap-3 px-3 py-2.5">
                        <div className="min-w-0 flex-1">
                            <div className="truncate text-[13.5px] font-medium">{p.name}</div>
                            <div className="font-mono text-[11px] text-mute">
                                {p.sku} · {naira(p.unit_price)} · stock {p.stock_qty}
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <button onClick={() => bump(p.id, -1)} className="rounded border border-hairline p-1 text-steel hover:border-torque" aria-label="Fewer">
                                <Minus size={12} />
                            </button>
                            <span className="w-6 text-center font-mono text-[13px] font-semibold">{picked[p.id] || 0}</span>
                            <button onClick={() => bump(p.id, 1)} className="rounded border border-hairline p-1 text-steel hover:border-torque" aria-label="More">
                                <Plus size={12} />
                            </button>
                        </div>
                    </div>
                ))}
                {!filtered.length && <div className="px-3 py-5 text-center text-sm text-mute">Nothing matched that search.</div>}
            </div>

            {lines.length > 0 && (
                <div className="mt-3 rounded border border-hairline bg-shell/60 p-3">
                    {lines.map(([id, qty]) => {
                        const p = parts.find((x) => x.id === id);
                        if (!p) return null;
                        return (
                            <div key={id} className="flex items-center justify-between py-1 text-[13px]">
                                <span className="truncate">
                                    {qty} × {p.name}
                                </span>
                                <span className="font-mono">{naira(p.unit_price * qty)}</span>
                            </div>
                        );
                    })}
                    <div className="mt-2 flex items-center gap-2 border-t border-hairline pt-2">
                        <label htmlFor="discount" className="text-[11px] font-bold uppercase tracking-wide text-steel">
                            Discount
                        </label>
                        <input id="discount" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0" className="field w-32 py-1 font-mono text-[12px]" />
                        <span className="ml-auto font-display text-lg font-extrabold">{naira(subtotal - off)}</span>
                    </div>
                </div>
            )}

            {error && <div className="mt-2 text-xs font-semibold text-alert">{error}</div>}

            <button onClick={raise} disabled={busy || !lines.length} className="btn-primary mt-3">
                {busy ? 'Raising the order' : 'Raise the quotation'}
            </button>
        </section>
    );
}
