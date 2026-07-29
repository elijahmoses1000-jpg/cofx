'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Mail, Lock, User, Loader2, CheckCircle2 } from 'lucide-react';
import { browserClient } from '@/lib/supabase-browser';

type Mode = 'signin' | 'signup' | 'link';

function GoogleMark() {
    return (
        <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
        </svg>
    );
}

function MicrosoftMark() {
    return (
        <svg width="16" height="16" viewBox="0 0 23 23" aria-hidden="true">
            <path fill="#F25022" d="M1 1h10v10H1z" />
            <path fill="#7FBA00" d="M12 1h10v10H12z" />
            <path fill="#00A4EF" d="M1 12h10v10H1z" />
            <path fill="#FFB900" d="M12 12h10v10H12z" />
        </svg>
    );
}

function LoginForm() {
    const router = useRouter();
    const params = useSearchParams();
    const next = params.get('next') || '/dashboard';

    const [mode, setMode] = useState<Mode>('signin');
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [busy, setBusy] = useState('');
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [providers, setProviders] = useState<Record<string, boolean> | null>(null);

    useEffect(() => {
        const fromCallback = params.get('error');
        if (fromCallback) setError(fromCallback);
    }, [params]);

    // Ask the project which providers are actually switched on. Clicking a
    // provider that is off sends the browser to a raw Supabase error page, so
    // the button must never be offered unless it will work.
    useEffect(() => {
        const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (!base || !key) return;
        let cancelled = false;
        fetch(base + '/auth/v1/settings', { headers: { apikey: key } })
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => {
                if (!cancelled && data && data.external) setProviders(data.external as Record<string, boolean>);
            })
            .catch(() => {
                // Leave providers unknown; the click guard below still protects.
            });
        return () => {
            cancelled = true;
        };
    }, []);

    async function providerEnabled(provider: string): Promise<boolean> {
        if (providers) return Boolean(providers[provider]);
        const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (!base || !key) return false;
        try {
            const res = await fetch(base + '/auth/v1/settings', { headers: { apikey: key } });
            if (!res.ok) return false;
            const data = await res.json();
            if (data?.external) setProviders(data.external as Record<string, boolean>);
            return Boolean(data?.external?.[provider]);
        } catch {
            return false;
        }
    }

    function redirectTarget() {
        return window.location.origin + '/auth/callback?next=' + encodeURIComponent(next);
    }

    function friendly(message: string): string {
        const m = message.toLowerCase();
        if (m.includes('invalid login credentials')) return 'That email and password combination was not recognised.';
        if (m.includes('email not confirmed')) return 'Confirm your email address first. Check your inbox for the confirmation link.';
        if (m.includes('user already registered')) return 'An account already exists for that email. Sign in instead, or use the emailed link.';
        if (m.includes('provider is not enabled')) return 'That sign in provider is not switched on for this project yet. Enable it under Authentication, Providers in Supabase.';
        if (m.includes('password should be')) return 'Choose a password of at least six characters.';
        if (m.includes('rate limit') || m.includes('too many')) return 'Too many attempts. Wait a minute and try again.';
        return message;
    }

    async function oauth(provider: 'google' | 'azure') {
        setBusy(provider);
        setError('');
        setNotice('');

        if (!(await providerEnabled(provider))) {
            setError(
                (provider === 'google' ? 'Google' : 'Microsoft') +
                    ' sign in is not switched on for this project yet. An administrator can enable it in Supabase under Authentication, Providers. Meanwhile use your email and password below.'
            );
            setBusy('');
            return;
        }

        try {
            const supabase = browserClient();
            const { error: err } = await supabase.auth.signInWithOAuth({
                provider,
                options: {
                    redirectTo: redirectTarget(),
                    scopes: provider === 'azure' ? 'email profile openid' : undefined,
                    queryParams: provider === 'google' ? { access_type: 'offline', prompt: 'select_account' } : undefined,
                },
            });
            if (err) {
                setError(friendly(err.message));
                setBusy('');
            }
            // On success the browser leaves this page for the provider.
        } catch {
            setError('Sign in is unavailable. The database may not be connected yet.');
            setBusy('');
        }
    }

    async function sendLink(e: React.FormEvent) {
        e.preventDefault();
        if (!email.trim()) return;
        setBusy('link');
        setError('');
        setNotice('');
        try {
            const supabase = browserClient();
            const { error: err } = await supabase.auth.signInWithOtp({
                email: email.trim(),
                options: { emailRedirectTo: redirectTarget() },
            });
            if (err) setError(friendly(err.message));
            else setNotice('Check ' + email.trim() + '. We sent a sign in link that works once and expires in an hour.');
        } catch {
            setError('The sign in link could not be sent.');
        }
        setBusy('');
    }

    async function withPassword(e: React.FormEvent) {
        e.preventDefault();
        setBusy('password');
        setError('');
        setNotice('');
        try {
            const supabase = browserClient();

            if (mode === 'signup') {
                const { data, error: err } = await supabase.auth.signUp({
                    email: email.trim(),
                    password,
                    options: { data: { full_name: fullName.trim() }, emailRedirectTo: redirectTarget() },
                });
                if (err) {
                    setError(friendly(err.message));
                } else if (data.session) {
                    router.push(next);
                    router.refresh();
                    return;
                } else {
                    setNotice('Account created. Check ' + email.trim() + ' for the confirmation link, then sign in.');
                    setMode('signin');
                }
            } else {
                const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
                if (err) {
                    setError(friendly(err.message));
                } else {
                    router.push(next);
                    router.refresh();
                    return;
                }
            }
        } catch {
            setError('Sign in is unavailable. The database may not be connected yet.');
        }
        setBusy('');
    }

    const working = busy !== '';
    // Unknown means the settings lookup has not answered yet; offer the button
    // and let the click guard decide, so a slow network never removes a route in.
    const showGoogle = providers === null || Boolean(providers.google);
    const showMicrosoft = providers === null || Boolean(providers.azure);

    return (
        <div className="flex min-h-screen items-center justify-center bg-graphite px-4 py-10">
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

                <div className="card p-5">
                    <h1 className="font-display text-lg font-bold">
                        {mode === 'signup' ? 'Create your staff account' : 'Sign in to the console'}
                    </h1>
                    <p className="mt-1 text-[12.5px] text-steel">
                        {mode === 'signup'
                            ? 'Use your work account. New members join with the sales role and a manager can change it.'
                            : 'Choose whichever method is easiest. They all reach the same account.'}
                    </p>

                    {(showGoogle || showMicrosoft) && (
                        <>
                            <div className="mt-4 space-y-2">
                                {showGoogle && (
                                    <button onClick={() => oauth('google')} disabled={working} className="btn-ghost w-full">
                                        {busy === 'google' ? <Loader2 size={15} className="animate-spin" /> : <GoogleMark />}
                                        Continue with Google
                                    </button>
                                )}
                                {showMicrosoft && (
                                    <button onClick={() => oauth('azure')} disabled={working} className="btn-ghost w-full">
                                        {busy === 'azure' ? <Loader2 size={15} className="animate-spin" /> : <MicrosoftMark />}
                                        Continue with Microsoft
                                    </button>
                                )}
                            </div>

                            <div className="my-4 flex items-center gap-3">
                                <span className="h-px flex-1 bg-hairline" />
                                <span className="font-mono text-[10px] uppercase tracking-widest text-mute">or</span>
                                <span className="h-px flex-1 bg-hairline" />
                            </div>
                        </>
                    )}

                    {mode === 'link' ? (
                        <form onSubmit={sendLink} className="space-y-3">
                            <div>
                                <label htmlFor="email" className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-steel">
                                    Work email
                                </label>
                                <div className="relative">
                                    <Mail size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mute" />
                                    <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="field pl-9" autoComplete="username" placeholder="you@wannerpart.cofx.ng" />
                                </div>
                            </div>
                            <button type="submit" disabled={working} className="btn-primary w-full">
                                {busy === 'link' ? <Loader2 size={15} className="animate-spin" /> : <Mail size={15} />}
                                Email me a sign in link
                            </button>
                            <p className="text-center text-[12px] text-steel">
                                No password needed.{' '}
                                <button type="button" onClick={() => { setMode('signin'); setError(''); setNotice(''); }} className="font-semibold text-torqueDark hover:underline">
                                    Use a password instead
                                </button>
                            </p>
                        </form>
                    ) : (
                        <form onSubmit={withPassword} className="space-y-3">
                            {mode === 'signup' && (
                                <div>
                                    <label htmlFor="name" className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-steel">
                                        Full name
                                    </label>
                                    <div className="relative">
                                        <User size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mute" />
                                        <input id="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} className="field pl-9" autoComplete="name" placeholder="Kelechi Obi" />
                                    </div>
                                </div>
                            )}
                            <div>
                                <label htmlFor="email" className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-steel">
                                    Work email
                                </label>
                                <div className="relative">
                                    <Mail size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mute" />
                                    <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="field pl-9" autoComplete="username" placeholder="you@wannerpart.cofx.ng" />
                                </div>
                            </div>
                            <div>
                                <label htmlFor="password" className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-steel">
                                    Password
                                </label>
                                <div className="relative">
                                    <Lock size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mute" />
                                    <input
                                        id="password"
                                        type="password"
                                        required
                                        minLength={6}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="field pl-9"
                                        autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                                        placeholder={mode === 'signup' ? 'At least six characters' : ''}
                                    />
                                </div>
                            </div>
                            <button type="submit" disabled={working} className="btn-primary w-full">
                                {busy === 'password' ? <Loader2 size={15} className="animate-spin" /> : <Lock size={15} />}
                                {mode === 'signup' ? 'Create account' : 'Sign in'}
                            </button>
                            <button type="button" onClick={() => { setMode('link'); setError(''); setNotice(''); }} className="w-full text-center text-[12px] font-semibold text-torqueDark hover:underline">
                                Email me a sign in link instead
                            </button>
                        </form>
                    )}

                    {error && <div className="mt-3 rounded border border-alert/30 bg-alert/5 px-3 py-2 text-[12.5px] font-medium text-alert">{error}</div>}
                    {notice && (
                        <div className="mt-3 flex items-start gap-2 rounded border border-signal/30 bg-signal/5 px-3 py-2 text-[12.5px] font-medium text-signal">
                            <CheckCircle2 size={15} className="mt-px shrink-0" />
                            <span>{notice}</span>
                        </div>
                    )}

                    <div className="mt-4 border-t border-hairline pt-3 text-center text-[12.5px] text-steel">
                        {mode === 'signup' ? (
                            <>
                                Already have an account?{' '}
                                <button onClick={() => { setMode('signin'); setError(''); setNotice(''); }} className="font-semibold text-torqueDark hover:underline">
                                    Sign in
                                </button>
                            </>
                        ) : (
                            <>
                                New to the console?{' '}
                                <button onClick={() => { setMode('signup'); setError(''); setNotice(''); }} className="font-semibold text-torqueDark hover:underline">
                                    Create an account
                                </button>
                            </>
                        )}
                    </div>
                </div>

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
