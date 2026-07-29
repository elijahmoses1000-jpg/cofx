'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Send, Bot, ArrowLeft, Ticket } from 'lucide-react';

interface Turn {
    role: 'user' | 'assistant';
    content: string;
    ticket?: string | null;
}

const STARTERS = [
    'I need front brake pads for a Toyota Corolla 2015',
    'How much is a battery for a Kia Rio and do you fit it?',
    'I want to book a service for my Ford Ranger next week',
    'I made a transfer, how do I confirm my payment?',
];

function newSession(): string {
    const key = 'cofx_session';
    if (typeof window === 'undefined') return 'server';
    let id = window.localStorage.getItem(key);
    if (!id) {
        id = 'web-' + Math.random().toString(36).slice(2) + '-' + Date.now().toString(36);
        window.localStorage.setItem(key, id);
    }
    return id;
}

export default function Assistant() {
    const [turns, setTurns] = useState<Turn[]>([]);
    const [busy, setBusy] = useState(false);
    const [session, setSession] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const endRef = useRef<HTMLDivElement>(null);

    useEffect(() => setSession(newSession()), []);
    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [turns, busy]);

    async function send(preset?: string) {
        const text = (preset || inputRef.current?.value || '').trim();
        if (!text || busy) return;
        if (inputRef.current) inputRef.current.value = '';
        setTurns((t) => [...t, { role: 'user', content: text }]);
        setBusy(true);
        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ session_id: session || newSession(), message: text }),
            });
            const data = await res.json();
            setTurns((t) => [
                ...t,
                {
                    role: 'assistant',
                    content: data.reply || data.error || 'I could not answer that just now. Please try again.',
                    ticket: data.ticket_no || null,
                },
            ]);
        } catch {
            setTurns((t) => [...t, { role: 'assistant', content: 'The assistant is unreachable right now. Please try again shortly.' }]);
        }
        setBusy(false);
    }

    return (
        <div className="flex min-h-screen flex-col bg-shell">
            <header className="flex items-center gap-3 border-b border-hairline bg-panel px-5 py-3">
                <Link href="/" className="text-steel hover:text-torque" aria-label="Back to home">
                    <ArrowLeft size={18} />
                </Link>
                <span className="flex h-9 w-9 items-center justify-center rounded bg-torque text-white">
                    <Bot size={18} />
                </span>
                <div>
                    <div className="font-display text-base font-bold leading-tight">Wanner</div>
                    <div className="text-[11px] text-mute">Parts, fitment and service assistant for Wannerpart by COFX</div>
                </div>
                <span className="ml-auto flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-signal">
                    <span className="h-1.5 w-1.5 rounded-full bg-signal" /> Online
                </span>
            </header>

            <main className="mx-auto w-full max-w-3xl flex-1 space-y-4 overflow-y-auto px-4 py-6">
                {!turns.length && (
                    <div className="card p-5">
                        <div className="font-display text-lg font-bold">How can I help with your vehicle?</div>
                        <p className="mt-1 text-sm text-steel">
                            Tell me the part you need with your make, model and year and I will check what fits, what it costs
                            and when you can collect it. I can also book a workshop slot or explain how payment confirmation works.
                        </p>
                        <div className="mt-4 grid gap-2 sm:grid-cols-2">
                            {STARTERS.map((s) => (
                                <button key={s} onClick={() => send(s)} className="rounded border border-hairline bg-shell/70 px-3 py-2.5 text-left text-[13px] hover:border-torque hover:text-torqueDark">
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {turns.map((t, i) => (
                    <div key={i} className={t.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                        <div
                            className={
                                'max-w-[85%] whitespace-pre-wrap rounded-lg px-4 py-3 text-[13.5px] leading-relaxed ' +
                                (t.role === 'user' ? 'bg-graphite text-white' : 'card text-graphite')
                            }
                        >
                            {t.content}
                            {t.ticket && (
                                <div className="mt-3 inline-flex items-center gap-1.5 rounded bg-torque/10 px-2 py-1 font-mono text-[11px] font-semibold text-torqueDark">
                                    <Ticket size={12} /> {t.ticket}
                                </div>
                            )}
                        </div>
                    </div>
                ))}

                {busy && (
                    <div className="flex items-center gap-2 text-xs font-medium text-mute">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-torque" /> Wanner is checking the catalogue
                    </div>
                )}
                <div ref={endRef} />
            </main>

            <div className="border-t border-hairline bg-panel px-4 py-3">
                <div className="mx-auto flex max-w-3xl gap-2">
                    <input
                        ref={inputRef}
                        onKeyDown={(e) => e.key === 'Enter' && send()}
                        placeholder="Ask about a part, a price, a booking or a payment"
                        className="field flex-1"
                    />
                    <button onClick={() => send()} disabled={busy} className="btn-primary">
                        <Send size={15} /> Send
                    </button>
                </div>
            </div>
        </div>
    );
}
