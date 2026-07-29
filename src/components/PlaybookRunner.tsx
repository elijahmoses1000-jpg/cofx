'use client';

import { useState } from 'react';
import { Play, Copy, Check, Clock } from 'lucide-react';
import { dateTime } from '@/lib/format';

interface Playbook {
    id: string;
    group: string;
    name: string;
    purpose: string;
}

interface Recent {
    id: string;
    name: string;
    objective: string;
    output: string;
    created_at: string;
}

export default function PlaybookRunner({
    playbooks,
    groups,
    recent,
}: {
    playbooks: Playbook[];
    groups: Array<{ id: string; name: string }>;
    recent: Recent[];
}) {
    const [group, setGroup] = useState(groups[0].id);
    const [selected, setSelected] = useState<Playbook | null>(null);
    const [objective, setObjective] = useState('');
    const [context, setContext] = useState('');
    const [output, setOutput] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [copied, setCopied] = useState(false);

    async function run() {
        if (!selected || !objective.trim()) {
            setError('Choose a playbook and describe what it should deliver.');
            return;
        }
        setBusy(true);
        setError('');
        setOutput('');
        try {
            const res = await fetch('/api/playbooks/run', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ playbook_id: selected.id, objective, context }),
            });
            const data = await res.json();
            if (!res.ok) setError(data.error || 'The playbook did not complete.');
            else setOutput(data.output);
        } catch {
            setError('The playbook could not be reached.');
        }
        setBusy(false);
    }

    function download() {
        const blob = new Blob([(selected?.name || 'Playbook') + '\n\n' + output], { type: 'text/plain;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = (selected?.name || 'playbook').toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.txt';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            URL.revokeObjectURL(a.href);
            a.remove();
        }, 800);
    }

    const list = playbooks.filter((p) => p.group === group);

    return (
        <div className="grid gap-6 lg:grid-cols-[1fr_1.25fr]">
            <div>
                <div className="mb-3 flex flex-wrap gap-2">
                    {groups.map((g) => (
                        <button
                            key={g.id}
                            onClick={() => setGroup(g.id)}
                            className={
                                'rounded px-3 py-1.5 text-xs font-bold uppercase tracking-wide ' +
                                (group === g.id ? 'bg-graphite text-white' : 'border border-hairline bg-panel text-steel hover:border-torque hover:text-torqueDark')
                            }
                        >
                            {g.name}
                        </button>
                    ))}
                </div>

                <div className="card divide-y divide-hairline/70">
                    {list.map((p) => (
                        <button
                            key={p.id}
                            onClick={() => {
                                setSelected(p);
                                setOutput('');
                                setError('');
                            }}
                            className={'block w-full px-4 py-3 text-left hover:bg-shell/60 ' + (selected?.id === p.id ? 'bg-torque/5' : '')}
                        >
                            <div className={'font-display text-[15px] font-bold ' + (selected?.id === p.id ? 'text-torqueDark' : '')}>{p.name}</div>
                            <div className="mt-0.5 text-[12.5px] leading-relaxed text-steel">{p.purpose}</div>
                        </button>
                    ))}
                </div>

                {recent.length > 0 && (
                    <section className="mt-6">
                        <h2 className="mb-2 flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wide text-steel">
                            <Clock size={14} /> Recent runs
                        </h2>
                        <div className="card divide-y divide-hairline/70">
                            {recent.map((r) => (
                                <button key={r.id} onClick={() => setOutput(r.output)} className="block w-full px-4 py-2.5 text-left hover:bg-shell/60">
                                    <div className="text-[13px] font-semibold">{r.name}</div>
                                    <div className="truncate text-[11.5px] text-mute">{r.objective}</div>
                                    <div className="font-mono text-[10.5px] text-mute">{dateTime(r.created_at)}</div>
                                </button>
                            ))}
                        </div>
                    </section>
                )}
            </div>

            <div className="space-y-4">
                <section className="card p-5">
                    <div className="font-display text-lg font-bold">{selected ? selected.name : 'Select a playbook'}</div>
                    <p className="mt-1 text-[13px] text-steel">
                        {selected ? selected.purpose : 'Pick one from the list to see what it produces.'}
                    </p>

                    <label htmlFor="objective" className="mb-1 mt-4 block text-[11px] font-bold uppercase tracking-wide text-steel">
                        Objective
                    </label>
                    <input
                        id="objective"
                        value={objective}
                        onChange={(e) => setObjective(e.target.value)}
                        placeholder="What should this deliver?"
                        className="field"
                    />

                    <label htmlFor="context" className="mb-1 mt-3 block text-[11px] font-bold uppercase tracking-wide text-steel">
                        Extra context, optional
                    </label>
                    <textarea
                        id="context"
                        rows={4}
                        value={context}
                        onChange={(e) => setContext(e.target.value)}
                        placeholder="Constraints, names, figures or background the deliverable should reflect."
                        className="field"
                    />

                    {error && <div className="mt-2 text-xs font-semibold text-alert">{error}</div>}

                    <button onClick={run} disabled={busy || !selected} className="btn-primary mt-4 w-full">
                        <Play size={15} /> {busy ? 'Working on the deliverable' : 'Run playbook'}
                    </button>
                </section>

                {output && (
                    <section className="card overflow-hidden">
                        <div className="flex items-center gap-2 border-b border-hairline bg-shell/70 px-4 py-2.5">
                            <span className="text-[11px] font-bold uppercase tracking-wide text-steel">Deliverable</span>
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(output).catch(() => {});
                                    setCopied(true);
                                    setTimeout(() => setCopied(false), 1500);
                                }}
                                className="ml-auto rounded border border-hairline bg-panel p-1.5 text-steel hover:border-torque hover:text-torqueDark"
                                aria-label="Copy deliverable"
                            >
                                {copied ? <Check size={13} className="text-signal" /> : <Copy size={13} />}
                            </button>
                            <button onClick={download} className="rounded border border-hairline bg-panel px-2.5 py-1 text-[11px] font-semibold hover:border-torque hover:text-torqueDark">
                                Download
                            </button>
                        </div>
                        <div className="max-h-[36rem] overflow-y-auto whitespace-pre-wrap px-5 py-4 text-[13.5px] leading-relaxed">{output}</div>
                    </section>
                )}
            </div>
        </div>
    );
}
