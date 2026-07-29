import Link from 'next/link';
import { STATUS_LABEL, STATUS_STYLE } from '@/lib/format';

export function PageHead({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
    return (
        <div className="mb-6">
            <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-torque">{eyebrow}</div>
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-graphite">{title}</h1>
            {sub && <p className="mt-1 max-w-2xl text-sm text-steel">{sub}</p>}
        </div>
    );
}

export function Stat({ label, value, hint, tone }: { label: string; value: string | number; hint?: string; tone?: 'alert' | 'signal' | 'caution' }) {
    const toneClass = tone === 'alert' ? 'text-alert' : tone === 'signal' ? 'text-signal' : tone === 'caution' ? 'text-caution' : 'text-graphite';
    return (
        <div className="card px-4 py-4">
            <div className={'font-display text-3xl font-extrabold ' + toneClass}>{value}</div>
            <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-mute">{label}</div>
            {hint && <div className="mt-1 text-[11px] text-steel">{hint}</div>}
        </div>
    );
}

export function StatusPill({ status }: { status: string }) {
    return <span className={'pill ' + (STATUS_STYLE[status] || 'border-hairline bg-shell text-steel')}>{STATUS_LABEL[status] || status}</span>;
}

export function Empty({ text }: { text: string }) {
    return <div className="card px-4 py-10 text-center text-sm text-mute">{text}</div>;
}

export function TableShell({ head, children }: { head: string[]; children: React.ReactNode }) {
    return (
        <div className="card overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full min-w-[40rem] text-left text-sm">
                    <thead>
                        <tr className="border-b border-hairline bg-shell/70">
                            {head.map((h) => (
                                <th key={h} className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-steel">
                                    {h}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>{children}</tbody>
                </table>
            </div>
        </div>
    );
}

export function SetupNotice() {
    return (
        <div className="card overflow-hidden">
            <div className="stripe h-1 w-full" />
            <div className="p-6">
                <div className="font-mono text-[11px] uppercase tracking-[0.28em] text-torque">Setup required</div>
                <h1 className="mt-1 font-display text-2xl font-extrabold text-graphite">Connect the Supabase project</h1>
                <p className="mt-2 text-sm leading-relaxed text-steel">
                    The application is deployed and running. The console needs a database before it can show tickets,
                    customers and payments.
                </p>
                <ol className="mt-4 space-y-2 text-[13.5px] text-graphite">
                    <li>1. Create a project at supabase.com, then copy .env.example to .env.local and fill in the project URL, the anon key, the service role key and the database connection string.</li>
                    <li>2. Run node scripts/connect.mjs from the repository. It applies the schema, loads the demonstration data, creates the staff accounts, pushes the same variables into Vercel and redeploys.</li>
                    <li>3. Return here and sign in with one of the accounts the script prints.</li>
                </ol>
                <div className="mt-5 flex flex-wrap gap-2">
                    <Link href="/" className="btn-ghost">
                        Back to overview
                    </Link>
                    <Link href="/assistant" className="btn-primary">
                        Try the assistant
                    </Link>
                </div>
            </div>
        </div>
    );
}
