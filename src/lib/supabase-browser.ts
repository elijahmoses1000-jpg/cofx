'use client';

import { createBrowserClient } from '@supabase/ssr';

/**
 * Browser client used by interactive components for sign in and session state.
 * Kept separate from the server helpers so client bundles never pull in
 * next/headers.
 */
export function browserClient() {
    return createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    );
}
