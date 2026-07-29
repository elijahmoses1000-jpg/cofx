import 'server-only';

import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export function supabaseConfigured(): boolean {
    return Boolean(URL && ANON);
}

type CookieWrite = { name: string; value: string; options?: Record<string, unknown> };

/** Request scoped client that reads and writes the auth cookie. */
export async function serverClient() {
    const store = await cookies();
    return createServerClient(URL, ANON, {
        cookies: {
            getAll() {
                return store.getAll();
            },
            setAll(items: CookieWrite[]) {
                try {
                    items.forEach(({ name, value, options }) => store.set(name, value, options as never));
                } catch {
                    // Called from a server component, where cookies are read only.
                }
            },
        },
    });
}

/**
 * Elevated client for trusted server routes: the public assistant, webhook
 * ingestion and scheduled jobs, which act without a signed in user.
 */
export function adminClient() {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    if (!URL || !key) throw new Error('Supabase service role credentials are not configured');
    return createClient(URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
