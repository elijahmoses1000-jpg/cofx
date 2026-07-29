'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { LogIn, ArrowLeft } from 'lucide-react';
import { browserClient } from '@/lib/supabase-browser';

function LoginForm() {
    const router = useRouter();
    const params = useSearchParams();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        setBusy(true);
        setError('');
        try {
            const supabase = browserClient();
            const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
            if (err) {
                setError(err.message === 'Invalid login credentials' ? 'That email and password combination was not recognised.' : err.message);
                setBusy(false);
                return;
            }
            router.push(params.get('next') || '/dashboard');
            router.refresh();
        } catch {
            setError('Sign in is unavailable. Check that the platform environment variables are set.');
            setBusy(false);
        }
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-graphite px-4">
            <div className="w-full max-w-sm">
                <Link href="/" className="mb-6 inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-torque">
                    <ArrowLeft size={14} /> Back
                </Link>
                <div className="mb-6">
                    <div className="font-display text-3xl font-extrabold text-white">
                        CO<span className="text-torque">F</span>X
                    </div>
                    <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.25em] text-white/45">
                        Wannerpart operations console
                    </div>
                </div>

                <form onSubmit={submit} className="card space-y-3 p-5">
                    <div>
                        <label htmlFor="email" className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-steel">
                            Work email
                        </label>
                        <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="field" autoComplete="username" />
                    </div>
                    <div>
                        <label htmlFor="password" className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-steel">
                            Password
                        </label>
                        <input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="field" autoComplete="current-password" />
                    </div>
                    {error && <div className="text-xs font-medium text-alert">{error}</div>}
                    <button type="submit" disabled={busy} className="btn-primary w-full">
                        <LogIn size={15} /> {busy ? 'Signing in' : 'Sign in'}
                    </button>
                </form>

                <p className="mt-4 text-center text-xs text-white/40">
                    Customers do not need an account. The assistant is open at{' '}
                    <Link href="/assistant" className="text-torque hover:underline">
                        the public help desk
                    </Link>
                    .
                </p>
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-graphite" />}>
            <LoginForm />
        </Suspense>
    );
}
