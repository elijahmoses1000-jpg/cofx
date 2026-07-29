'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, Check, Plug, RefreshCw, Trash2, Play, Network, Webhook, ChevronDown, ChevronUp } from 'lucide-react';
import { dateTime } from '@/lib/format';

interface ToolInfo {
    name: string;
    description?: string;
    inputSchema?: unknown;
}
interface Server {
    id: string;
    name: string;
    url: string;
    server_name: string | null;
    instructions: string | null;
    status: string;
    last_checked_at: string | null;
    tools: ToolInfo[];
}
interface Call {
    id: string;
    server_name: string | null;
    tool: string;
    ok: boolean;
    duration_ms: number | null;
    created_at: string;
}

function CopyLine({ value }: { value: string }) {
    const [copied, setCopied] = useState(false);
    return (
        <div className="flex items-center gap-2 rounded border border-hairline bg-shell/60 px-3 py-2">
            <code className="min-w-0 flex-1 truncate font-mono text-[12px] text-graphite">{value}</code>
            <button
                onClick={() => {
                    navigator.clipboard.writeText(value).catch(() => {});
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                }}
                className="flex shrink-0 items-center gap-1 rounded bg-graphite px-2.5 py-1 text-[11px] font-bold text-white hover:bg-torque"
            >
                {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? 'Copied' : 'Copy'}
            </button>
        </div>
    );
}

export default function IntegrationsConsole({
    tools,
    servers,
    calls,
    tokenRequired,
}: {
    tools: ToolInfo[];
    servers: Server[];
    calls: Call[];
    tokenRequired: boolean;
}) {
    const router = useRouter();
    const [origin, setOrigin] = useState('');
    const [name, setName] = useState('');
    const [url, setUrl] = useState('');
    const [headers, setHeaders] = useState('');
    const [busy, setBusy] = useState('');
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [expanded, setExpanded] = useState('');
    const [runTool, setRunTool] = useState<{ server: Server; tool: ToolInfo } | null>(null);
    const [runArgs, setRunArgs] = useState('{}');
    const [runOut, setRunOut] = useState('');
    const [showTools, setShowTools] = useState(false);

    useEffect(() => setOrigin(window.location.origin), []);

    async function connect() {
        if (!name.trim() || !url.trim()) {
            setError('Give the server a name and its endpoint URL.');
            return;
        }
        setBusy('connect');
        setError('');
        setNotice('');
        try {
            const res = await fetch('/api/integrations', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ name, url, headers }),
            });
            const data = await res.json();
            if (!res.ok) setError(data.error || 'Could not connect.');
            else {
                setNotice('Connected to ' + (data.server?.server_name || name) + ' with ' + (data.server?.tools?.length || 0) + ' tools available.');
                setName('');
                setUrl('');
                setHeaders('');
                router.refresh();
            }
        } catch {
            setError('The connection attempt could not be sent.');
        }
        setBusy('');
    }

    async function act(id: string, action: 'refresh' | 'delete') {
        setBusy(id);
        setError('');
        try {
            if (action === 'delete') await fetch('/api/integrations/' + id, { method: 'DELETE' });
            else {
                const res = await fetch('/api/integrations/' + id, {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ action: 'refresh' }),
                });
                const data = await res.json();
                if (!res.ok) setError(data.error || 'Refresh failed.');
            }
            router.refresh();
        } catch {
            setError('That action could not be completed.');
        }
        setBusy('');
    }

    async function invoke() {
        if (!runTool) return;
        let args: unknown = {};
        if (runArgs.trim()) {
            try {
                args = JSON.parse(runArgs);
            } catch {
                setError('Arguments must be valid JSON.');
                return;
            }
        }
        setBusy('invoke');
        setError('');
        setRunOut('');
        try {
            const res = await fetch('/api/integrations/' + runTool.server.id, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ tool: runTool.tool.name, args }),
            });
            const data = await res.json();
            if (!res.ok) setError(data.error || 'The tool call failed.');
            else {
                setRunOut(data.output || '');
                router.refresh();
            }
        } catch {
            setError('The tool call could not be sent.');
        }
        setBusy('');
    }

    const mcpUrl = origin ? origin + '/api/mcp' : '/api/mcp';

    return (
        <div className="space-y-6">
            <section className="card overflow-hidden">
                <div className="stripe h-1 w-full" />
                <div className="p-5">
                    <div className="flex flex-wrap items-center gap-2">
                        <Network size={18} className="text-torque" />
                        <h2 className="font-display text-lg font-bold">The COFX MCP server</h2>
                        <span className="ml-auto flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-signal">
                            <span className="h-1.5 w-1.5 rounded-full bg-signal" /> Live
                        </span>
                    </div>
                    <p className="mt-1 text-[13px] leading-relaxed text-steel">
                        Point any Model Context Protocol client at this endpoint and it can search the fitment matrix, raise and
                        close tickets under the same rules the console enforces, build a quotation with a payment reference,
                        submit a bank alert for automatic verification and run any playbook against live data.
                    </p>
                    <div className="mt-3">
                        <CopyLine value={mcpUrl} />
                    </div>
                    <div className="mt-2 text-[12px] text-steel">
                        Transport streamable HTTP, protocol 2025-06-18.{' '}
                        {tokenRequired
                            ? 'A bearer token is required, held in the COFX_MCP_TOKEN environment variable.'
                            : 'No token is set, so the endpoint is open. Set COFX_MCP_TOKEN before exposing it beyond a demonstration.'}
                    </div>

                    <button
                        onClick={() => setShowTools(!showTools)}
                        className="mt-4 flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide text-torqueDark"
                    >
                        {showTools ? <ChevronUp size={14} /> : <ChevronDown size={14} />} {tools.length} tools exposed
                    </button>
                    {showTools && (
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            {tools.map((t) => (
                                <div key={t.name} className="rounded border border-hairline px-3 py-2.5">
                                    <div className="font-mono text-[12px] font-semibold text-torqueDark">{t.name}</div>
                                    <div className="mt-0.5 text-[11.5px] leading-relaxed text-steel">{t.description}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </section>

            <section className="card p-5">
                <div className="flex items-center gap-2">
                    <Plug size={17} className="text-torque" />
                    <h2 className="font-display text-lg font-bold">Connect an external MCP server</h2>
                </div>
                <p className="mt-1 text-[13px] text-steel">
                    Any system that exposes an MCP endpoint can be plugged in here. COFX performs the handshake, lists what the
                    server can do, and routes calls to it with every result recorded in the audit trail.
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1.6fr_1fr_auto]">
                    <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name, e.g. Fleet Telemetry" className="field" />
                    <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://host/api/mcp" className="field font-mono text-[12px]" />
                    <input value={headers} onChange={(e) => setHeaders(e.target.value)} placeholder='Headers JSON, optional' className="field font-mono text-[12px]" />
                    <button onClick={connect} disabled={busy === 'connect'} className="btn-primary">
                        {busy === 'connect' ? 'Connecting' : 'Connect'}
                    </button>
                </div>
                {error && <div className="mt-2 text-xs font-semibold text-alert">{error}</div>}
                {notice && <div className="mt-2 text-xs font-semibold text-signal">{notice}</div>}

                <div className="mt-4 space-y-2">
                    {!servers.length && (
                        <div className="rounded border border-dashed border-hairline px-4 py-6 text-center text-sm text-mute">
                            No external servers connected yet.
                        </div>
                    )}
                    {servers.map((s) => (
                        <div key={s.id} className="rounded border border-hairline">
                            <div className="flex flex-wrap items-center gap-2 px-4 py-3">
                                <span className={'h-2 w-2 rounded-full ' + (s.status === 'connected' ? 'bg-signal' : 'bg-caution')} />
                                <span className="font-display text-sm font-bold">{s.name}</span>
                                {s.server_name && <span className="text-[11.5px] text-steel">reports as {s.server_name}</span>}
                                <code className="hidden truncate font-mono text-[11px] text-mute sm:inline">{s.url}</code>
                                <span className="ml-auto font-mono text-[11px] text-steel">{s.tools.length} tools</span>
                                <button onClick={() => setExpanded(expanded === s.id ? '' : s.id)} className="rounded border border-hairline px-2 py-1 text-[11px] font-bold text-steel hover:border-torque hover:text-torqueDark">
                                    {expanded === s.id ? 'Hide' : 'Tools'}
                                </button>
                                <button onClick={() => act(s.id, 'refresh')} disabled={busy === s.id} className="rounded border border-hairline p-1.5 text-steel hover:border-torque hover:text-torqueDark" aria-label="Refresh">
                                    <RefreshCw size={13} className={busy === s.id ? 'animate-spin' : ''} />
                                </button>
                                <button onClick={() => act(s.id, 'delete')} disabled={busy === s.id} className="rounded border border-hairline p-1.5 text-steel hover:border-alert hover:text-alert" aria-label="Remove">
                                    <Trash2 size={13} />
                                </button>
                            </div>
                            {expanded === s.id && (
                                <div className="border-t border-hairline bg-shell/50 p-3">
                                    {s.instructions && <p className="mb-3 text-[12px] leading-relaxed text-steel">{s.instructions}</p>}
                                    <div className="grid gap-2 sm:grid-cols-2">
                                        {s.tools.map((t) => (
                                            <div key={t.name} className="flex items-start gap-2 rounded border border-hairline bg-panel px-3 py-2.5">
                                                <div className="min-w-0 flex-1">
                                                    <div className="truncate font-mono text-[12px] font-semibold">{t.name}</div>
                                                    <div className="mt-0.5 line-clamp-2 text-[11px] text-steel">{t.description}</div>
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        setRunTool({ server: s, tool: t });
                                                        setRunArgs('{}');
                                                        setRunOut('');
                                                        setError('');
                                                    }}
                                                    className="flex shrink-0 items-center gap-1 rounded bg-graphite px-2 py-1 text-[11px] font-bold text-white hover:bg-torque"
                                                >
                                                    <Play size={11} /> Run
                                                </button>
                                            </div>
                                        ))}
                                        {!s.tools.length && <div className="text-xs text-mute">This server reports no tools.</div>}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {runTool && (
                    <div className="mt-4 rounded border border-torque/40 bg-torque/5 p-4">
                        <div className="flex items-center gap-2">
                            <span className="font-mono text-[12px] font-bold text-torqueDark">{runTool.tool.name}</span>
                            <span className="text-xs text-steel">on {runTool.server.name}</span>
                            <button onClick={() => setRunTool(null)} className="ml-auto text-xs font-bold text-steel hover:text-torqueDark">
                                Close
                            </button>
                        </div>
                        {runTool.tool.description && <p className="mt-1 text-[12px] text-steel">{runTool.tool.description}</p>}
                        <textarea value={runArgs} onChange={(e) => setRunArgs(e.target.value)} rows={3} className="field mt-3 font-mono text-[12px]" />
                        <button onClick={invoke} disabled={busy === 'invoke'} className="btn-primary mt-2">
                            {busy === 'invoke' ? 'Calling' : 'Call tool'}
                        </button>
                        {runOut && (
                            <div className="mt-3 max-h-80 overflow-y-auto whitespace-pre-wrap rounded border border-hairline bg-panel px-4 py-3 text-[13px] leading-relaxed">
                                {runOut}
                            </div>
                        )}
                    </div>
                )}
            </section>

            <section className="card p-5">
                <div className="flex items-center gap-2">
                    <Webhook size={17} className="text-torque" />
                    <h2 className="font-display text-lg font-bold">Webhooks for n8n and other systems</h2>
                </div>
                <p className="mt-1 text-[13px] text-steel">
                    Systems that do not speak MCP use these endpoints. They are what the three n8n workflows in the repository call.
                </p>
                <div className="mt-3 space-y-3">
                    {[
                        ['Bank alert ingestion', 'POST', '/api/payments/ingest', 'Send the raw credit alert subject and body. COFX parses, matches and releases.'],
                        ['After sales engine', 'GET', '/api/cron/after-sales', 'Queues and dispatches birthday, battery, service, feedback and win back messages.'],
                        ['Accountability sweep', 'GET', '/api/cron/escalate', 'Escalates stalled tickets and retries payment matching.'],
                        ['Customer assistant', 'POST', '/api/chat', 'Ask Wanner a question as a customer would, from any channel.'],
                    ].map(([label, method, path, note]) => (
                        <div key={path}>
                            <div className="flex items-center gap-2">
                                <span className="pill border-graphite/20 bg-graphite/10 text-graphite">{method}</span>
                                <span className="text-[13px] font-semibold">{label}</span>
                            </div>
                            <div className="mt-1">
                                <CopyLine value={origin + path} />
                            </div>
                            <div className="mt-1 text-[11.5px] text-mute">{note}</div>
                        </div>
                    ))}
                </div>
            </section>

            {calls.length > 0 && (
                <section className="card p-5">
                    <h2 className="font-display text-lg font-bold">Recent integration calls</h2>
                    <div className="mt-2 divide-y divide-hairline/70">
                        {calls.map((c) => (
                            <div key={c.id} className="flex flex-wrap items-center gap-2 py-2">
                                <span className={'h-1.5 w-1.5 rounded-full ' + (c.ok ? 'bg-signal' : 'bg-alert')} />
                                <span className="font-mono text-[12px] font-semibold">{c.tool}</span>
                                <span className="text-[12px] text-steel">{c.server_name}</span>
                                <span className="ml-auto font-mono text-[11px] text-mute">
                                    {c.duration_ms ? c.duration_ms + ' ms' : ''} {dateTime(c.created_at)}
                                </span>
                            </div>
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
}
