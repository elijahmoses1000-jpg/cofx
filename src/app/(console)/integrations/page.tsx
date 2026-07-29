import { adminClient } from '@/lib/supabase';
import { COFX_TOOLS } from '@/lib/mcp';
import { PageHead } from '@/components/ui';
import IntegrationsConsole from '@/components/IntegrationsConsole';

export const dynamic = 'force-dynamic';

export default async function Integrations() {
    const db = adminClient();
    const [{ data: servers }, { data: calls }] = await Promise.all([
        db.from('mcp_servers').select('id, name, url, server_name, instructions, tools, status, last_checked_at').order('created_at', { ascending: false }),
        db.from('integration_calls').select('id, server_name, tool, ok, duration_ms, created_at').order('created_at', { ascending: false }).limit(12),
    ]);

    return (
        <div>
            <PageHead
                eyebrow="Open architecture"
                title="Integrations"
                sub="COFX speaks Model Context Protocol in both directions. Other systems can drive the branch through the COFX server, and any external MCP server can be plugged in and used from inside COFX."
            />
            <IntegrationsConsole
                tools={COFX_TOOLS.map((t) => ({ name: t.name, description: t.description }))}
                servers={(servers || []).map((s) => ({
                    id: s.id,
                    name: s.name,
                    url: s.url,
                    server_name: s.server_name,
                    instructions: s.instructions,
                    status: s.status,
                    last_checked_at: s.last_checked_at,
                    tools: (s.tools || []) as Array<{ name: string; description?: string }>,
                }))}
                calls={(calls || []).map((c) => ({
                    id: c.id,
                    server_name: c.server_name,
                    tool: c.tool,
                    ok: c.ok,
                    duration_ms: c.duration_ms,
                    created_at: c.created_at,
                }))}
                tokenRequired={Boolean(process.env.COFX_MCP_TOKEN)}
            />
        </div>
    );
}
