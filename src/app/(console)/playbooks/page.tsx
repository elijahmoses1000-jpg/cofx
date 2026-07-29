import { serverClient } from '@/lib/supabase';
import { PLAYBOOKS, PLAYBOOK_GROUPS } from '@/lib/playbooks';
import { PageHead } from '@/components/ui';
import PlaybookRunner from '@/components/PlaybookRunner';

export const dynamic = 'force-dynamic';

export default async function Playbooks() {
    const db = await serverClient();
    const { data: recent } = await db
        .from('playbook_runs')
        .select('id, playbook_name, objective, output, created_at')
        .order('created_at', { ascending: false })
        .limit(8);

    return (
        <div>
            <PageHead
                eyebrow="Knowledge work"
                title="Playbooks"
                sub="The COFX plugin library, curated for an aftermarket parts branch and pointed at live Wannerpart data. Each playbook turns a short brief into a finished deliverable."
            />
            <PlaybookRunner
                playbooks={PLAYBOOKS}
                groups={PLAYBOOK_GROUPS}
                recent={(recent || []).map((r) => ({
                    id: r.id,
                    name: r.playbook_name,
                    objective: r.objective,
                    output: r.output || '',
                    created_at: r.created_at,
                }))}
            />
        </div>
    );
}
