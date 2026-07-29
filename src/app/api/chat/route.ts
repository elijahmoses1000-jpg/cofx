import { NextRequest, NextResponse } from 'next/server';
import { adminClient } from '@/lib/supabase';
import { respond } from '@/lib/agent';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const { session_id, message } = (await req.json()) as { session_id?: string; message?: string };
        if (!session_id || !message || !message.trim()) {
            return NextResponse.json({ error: 'session_id and message are required' }, { status: 400 });
        }
        const db = adminClient();
        const result = await respond(db, session_id, message.trim());
        return NextResponse.json(result);
    } catch (err) {
        console.error('assistant failed', err);
        return NextResponse.json(
            { error: 'The assistant is not reachable right now. Please try again in a moment.' },
            { status: 500 }
        );
    }
}
