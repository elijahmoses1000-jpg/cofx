'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
    LayoutDashboard, Ticket, Users, BadgeCheck, Package, Trophy, BookOpen, Bot, LogOut, Menu, X,
} from 'lucide-react';
import { browserClient } from '@/lib/supabase-browser';

const NAV = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/tickets', label: 'Sales tickets', icon: Ticket },
    { href: '/customers', label: 'Customers', icon: Users },
    { href: '/payments', label: 'Payments', icon: BadgeCheck },
    { href: '/parts', label: 'Parts and stock', icon: Package },
    { href: '/loyalty', label: 'Loyalty', icon: Trophy },
    { href: '/playbooks', label: 'Playbooks', icon: BookOpen },
];

export default function Shell({ children, who }: { children: React.ReactNode; who: string }) {
    const path = usePathname();
    const router = useRouter();
    const [open, setOpen] = useState(false);

    async function signOut() {
        try {
            await browserClient().auth.signOut();
        } catch {
            // session already cleared
        }
        router.push('/login');
        router.refresh();
    }

    const rail = (
        <div className="flex h-full flex-col">
            <div className="px-5 pb-5 pt-6">
                <div className="font-display text-2xl font-extrabold leading-none tracking-tight text-white">
                    CO<span className="text-torque">F</span>X
                </div>
                <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.25em] text-white/40">Wannerpart operations</div>
            </div>
            <nav className="flex-1 space-y-0.5 px-3">
                {NAV.map((n) => {
                    const active = path === n.href || path.startsWith(n.href + '/');
                    return (
                        <Link
                            key={n.href}
                            href={n.href}
                            onClick={() => setOpen(false)}
                            className={
                                'flex items-center gap-3 rounded px-3 py-2.5 text-sm font-medium transition-colors ' +
                                (active ? 'bg-white/10 text-white' : 'text-white/55 hover:bg-white/5 hover:text-white')
                            }
                        >
                            <span className={'h-5 w-1 rounded-sm ' + (active ? 'bg-torque' : 'bg-transparent')} />
                            <n.icon size={17} className={active ? 'text-torque' : ''} />
                            {n.label}
                        </Link>
                    );
                })}
                <Link
                    href="/assistant"
                    className="mt-3 flex items-center gap-3 rounded border border-white/15 px-3 py-2.5 text-sm font-medium text-white/60 hover:border-torque hover:text-white"
                >
                    <Bot size={17} className="text-torque" /> Customer assistant
                </Link>
            </nav>
            <div className="border-t border-white/10 p-4">
                <div className="mb-3 truncate text-sm font-semibold text-white">{who}</div>
                <button onClick={signOut} className="flex w-full items-center justify-center gap-2 rounded border border-white/15 px-3 py-2 text-xs font-semibold text-white/70 hover:border-torque hover:text-white">
                    <LogOut size={13} /> Sign out
                </button>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-shell">
            <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 bg-graphite lg:block">{rail}</aside>
            {open && (
                <div className="fixed inset-0 z-40 lg:hidden">
                    <div className="absolute inset-0 bg-graphite/60" onClick={() => setOpen(false)} />
                    <aside className="absolute inset-y-0 left-0 w-64 bg-graphite">
                        <button onClick={() => setOpen(false)} className="absolute right-3 top-4 text-white/60" aria-label="Close menu">
                            <X size={20} />
                        </button>
                        {rail}
                    </aside>
                </div>
            )}
            <div className="lg:pl-60">
                <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-hairline bg-panel/95 px-4 backdrop-blur sm:px-6">
                    <button onClick={() => setOpen(true)} className="text-graphite lg:hidden" aria-label="Open menu">
                        <Menu size={20} />
                    </button>
                    <span className="font-display text-sm font-bold uppercase tracking-[0.15em] text-steel lg:hidden">COFX</span>
                    <div className="flex-1" />
                    <span className="hidden font-mono text-[11px] uppercase tracking-[0.2em] text-mute sm:inline">
                        Wannerpart by COFX, Nigeria
                    </span>
                </header>
                <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
            </div>
        </div>
    );
}
