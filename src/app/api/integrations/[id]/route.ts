import { NextRequest, NextResponse } from 'next/server';
import { adminClient, serverClient } from '@/lib/supabase';
import { connectExternal, callExternal } from '@/lib/mcp';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function requireUser() {
    const auth = await serverClient();
    const {
        data: { user },
    } = await auth.auth.getUser();
    return user;
}

/** Re-handshakes a registered server, or invokes one of its tools. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
    const { id } = await ctx.params;
    const user = await requireUser();
    if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as { action?: string; tool?: string; args?: unknown };
    const db = adminClient();
    const { data: server } = await db.from('mcp_servers').select('*').eq('id', id).maybeSingle();
    if (!server) return NextResponse.json({ error: 'That server is not registered.' }, { status: 404 });

    if (body.action === 'refresh') {
        try {
            const conn = await connectExternal(server.url, server.headers || undefined);
            await db
                .from('mcp_servers')
                .update({
                    server_name: conn.serverName,
                    instructions: conn.instructions || null,
                    tools: conn.tools,
                    status: 'connected',
                    last_checked_at: new Date().toISOString(),
                })
                .eq('id', id);
            return NextResponse.json({ status: 'connected', tools: conn.tools });
        } catch (e) {
            await db.from('mcp_servers').update({ status: 'unreachable', last_checked_at: new Date().toISOString() }).eq('id', id);
            const message = e instanceof Error ? e.message : 'connection failed';
            return NextResponse.json({ error: 'Still unreachable: ' + message }, { status: 400 });
        }
    }

    if (!body.tool) return NextResponse.json({ error: 'Name the tool to call.' }, { status: 400 });

    const started = Date.now();
    try {
        const output = await callExternal(server.url, server.headers || undefined, body.tool, body.args);
        await db.from('integration_calls').insert({
            server_id: server.id,
            server_name: server.name,
            tool: body.tool,
            arguments: (body.args || {}) as Record<string, unknown>,
            output: output.slice(0, 20000),
            ok: true,
            duration_ms: Date.now() - started,
            actor_id: user.id,
        });
        return NextResponse.json({ output });
    } catch (e) {
        const message = e instanceof Error ? e.message : 'call failed';
        await db.from('integration_calls').insert({
            server_id: server.id,
            server_name: server.name,
            tool: body.tool,
            arguments: (body.args || {}) as Record<string, unknown>,
            output: message,
            ok: false,
            duration_ms: Date.now() - started,
            actor_id: user.id,
        });
        return NextResponse.json({ error: 'The external tool failed: ' + message }, { status: 502 });
    }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
    const { id } = await ctx.params;
    if (!(await requireUser())) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    await adminClient().from('mcp_servers').delete().eq('id', id);
    return NextResponse.json({ ok: true });
}
