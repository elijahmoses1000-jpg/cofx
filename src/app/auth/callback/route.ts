import { NextRequest, NextResponse } from 'next/server';
import { serverClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * Completes every browser based sign in: Google, Microsoft, the emailed sign in
 * link and email confirmation after creating an account. Each of those sends
 * the browser back here with a one time code that is exchanged for a session.
 */
export async function GET(req: NextRequest) {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const tokenHash = url.searchParams.get('token_hash');
    const type = url.searchParams.get('type');
    const next = url.searchParams.get('next') || '/dashboard';

    // Behind the Vercel proxy the forwarded host is the address the user typed.
    const forwardedHost = req.headers.get('x-forwarded-host');
    const forwardedProto = req.headers.get('x-forwarded-proto') || 'https';
    const origin = forwardedHost ? forwardedProto + '://' + forwardedHost : url.origin;

    const fail = (reason: string) =>
        NextResponse.redirect(origin + '/login?error=' + encodeURIComponent(reason));

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        return fail('The database is not connected yet, so sign in is unavailable.');
    }

    try {
        const supabase = await serverClient();

        if (code) {
            const { error } = await supabase.auth.exchangeCodeForSession(code);
            if (error) return fail(error.message);
            return NextResponse.redirect(origin + next);
        }

        if (tokenHash && type) {
            const { error } = await supabase.auth.verifyOtp({
                type: type as 'magiclink' | 'signup' | 'email' | 'recovery' | 'invite',
                token_hash: tokenHash,
            });
            if (error) return fail(error.message);
            return NextResponse.redirect(origin + next);
        }

        const described = url.searchParams.get('error_description');
        return fail(described || 'That sign in link is no longer valid. Please request a new one.');
    } catch {
        return fail('Sign in could not be completed. Please try again.');
    }
}
