import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const PROTECTED = ['/dashboard', '/tickets', '/customers', '/payments', '/parts', '/loyalty', '/playbooks'];

export async function middleware(req: NextRequest) {
    const res = NextResponse.next({ request: req });

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anon) return res;

    const supabase = createServerClient(url, anon, {
        cookies: {
            getAll() {
                return req.cookies.getAll();
            },
            setAll(items) {
                items.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
            },
        },
    });

    const {
        data: { user },
    } = await supabase.auth.getUser();

    const needsAuth = PROTECTED.some((p) => req.nextUrl.pathname.startsWith(p));
    if (needsAuth && !user) {
        const to = req.nextUrl.clone();
        to.pathname = '/login';
        to.searchParams.set('next', req.nextUrl.pathname);
        return NextResponse.redirect(to);
    }

    return res;
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
};
