import { NextResponse } from 'next/server';
import { adminClient, serverClient } from '@/lib/supabase';
import { reconcileAll } from '@/lib/payments';

export const dynamic = 'force-dynamic';

/** Re-runs matching across every unmatched alert. Used by the finance console. */
export async function POST() {
    const auth = await serverClient();
    const {
        data: { user },
    } = await auth.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });

    try {
        const result = await reconcileAll(adminClient());
        return NextResponse.json(result);
    } catch (err) {
        console.error('reconcile failed', err);
        return NextResponse.json({ error: 'Reconciliation could not complete' }, { status: 500 });
    }
}
