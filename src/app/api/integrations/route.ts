import { NextRequest, NextResponse } from 'next/server';
import { adminClient, serverClient } from '@/lib/supabase';
import { connectExternal } from '@/lib/mcp';
import { scrub } from '@/lib/ai';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function requireUser() {
    const auth = await serverClient();
    const {
        data: { user },
    } = await auth.auth.getUser();
    return user;
}

export async function GET() {
    if (!(await requireUser())) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    const db = adminClient();
    const [{ data: servers }, { data: calls }] = await Promise.all([
        db.from('mcp_servers').select('id, name, url, server_name, instructions, tools, status, last_checked_at, created_at').order('created_at', { ascending: false }),
        db.from('integration_calls').select('id, server_name, tool, ok, duration_ms, created_at').order('created_at', { ascending: false }).limit(15),
    ]);
    return NextResponse.json({ servers: servers || [], calls: calls || [] });
}

/** Registers an external MCP server after a successful handshake. */
export async function POST(req: NextRequest) {
    const user = await requireUser();
    if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });

    const { name, url, headers } = (await req.json()) as { name?: string; url?: string; headers?: string };
    if (!name || !url) return NextResponse.json({ error: 'A name and an endpoint URL are both required.' }, { status: 400 });
    if (!/^https?:\/\//i.test(url)) return NextResponse.json({ error: 'The endpoint URL must start with http or https.' }, { status: 400 });
    if (headers) {
        try {
            JSON.parse(headers);
        } catch {
            return NextResponse.json({ error: 'Headers must be valid JSON, for example {"authorization": "Bearer abc"}.' }, { status: 400 });
        }
    }

    try {
        const conn = await connectExternal(url, headers);
        const db = adminClient();
        const { data, error } = await db
            .from('mcp_servers')
            .insert({
                name: scrub(name).slice(0, 80),
                url,
                headers: headers || null,
                server_name: conn.serverName,
                instructions: conn.instructions || null,
                tools: conn.tools,
                status: 'connected',
                last_checked_at: new Date().toISOString(),
                added_by: user.id,
            })
            .select('id, name, url, server_name, instructions, tools, status, last_checked_at')
            .single();
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ server: data });
    } catch (e) {
        const message = e instanceof Error ? e.message : 'connection failed';
        return NextResponse.json({ error: 'Could not reach that server: ' + message }, { status: 400 });
    }
}
