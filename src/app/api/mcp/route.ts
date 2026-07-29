import { NextRequest, NextResponse } from 'next/server';
import { handleMcp, COFX_TOOLS } from '@/lib/mcp';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * The COFX Model Context Protocol server.
 *
 * Any MCP client can connect here and operate the branch through the same
 * rules the console enforces. Protected by a bearer token when COFX_MCP_TOKEN
 * is set; left open when it is not, so a demonstration works out of the box.
 */

function authorised(req: NextRequest): boolean {
    const token = process.env.COFX_MCP_TOKEN;
    if (!token) return true;
    const header = req.headers.get('authorization') || '';
    return header === 'Bearer ' + token || req.headers.get('x-cofx-token') === token;
}

export async function GET() {
    return NextResponse.json({
        name: 'cofx-wannerpart',
        version: '1.0.0',
        transport: 'streamable-http',
        protocol: '2025-06-18',
        hint: 'POST JSON-RPC 2.0 messages to this same URL. Methods: initialize, tools/list, tools/call, ping.',
        authentication: process.env.COFX_MCP_TOKEN ? 'Bearer token required' : 'open',
        tools: COFX_TOOLS.map((t) => ({ name: t.name, description: t.description })),
    });
}

export async function POST(req: NextRequest) {
    if (!authorised(req)) {
        return NextResponse.json(
            { jsonrpc: '2.0', id: null, error: { code: -32001, message: 'Unauthorised. Supply the COFX MCP bearer token.' } },
            { status: 401 }
        );
    }

    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }, { status: 400 });
    }

    try {
        const r = await handleMcp(body);
        if (r.status === 202) return new NextResponse(null, { status: 202 });
        return NextResponse.json(r.payload || {}, { status: r.status });
    } catch (e) {
        console.error('mcp failed', e);
        return NextResponse.json({ jsonrpc: '2.0', id: null, error: { code: -32603, message: 'Internal error' } }, { status: 500 });
    }
}

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: {
            'access-control-allow-origin': '*',
            'access-control-allow-methods': 'GET, POST, OPTIONS',
            'access-control-allow-headers': 'content-type, authorization, x-cofx-token, mcp-session-id, mcp-protocol-version',
        },
    });
}
