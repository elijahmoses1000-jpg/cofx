import { redirect } from 'next/navigation';
import { adminClient, serverClient, supabaseConfigured } from '@/lib/supabase';
import Shell from '@/components/Shell';
import { SetupNotice } from '@/components/ui';

export const dynamic = 'force-dynamic';

interface StaffProfile {
    id: string;
    full_name: string;
    role: string;
}

/**
 * Resolves the staff record for whoever just signed in, whatever method they
 * used. A database trigger normally creates it, and this is the safety net that
 * makes Google, Microsoft, emailed link and password accounts all behave the
 * same even on a database that predates the trigger.
 */
async function resolveProfile(userId: string, email: string | undefined, displayName: string): Promise<StaffProfile | null> {
    const db = await serverClient();

    const { data: byId } = await db.from('profiles').select('id, full_name, role').eq('id', userId).maybeSingle();
    if (byId) return byId as StaffProfile;

    if (email) {
        const { data: byEmail } = await db.from('profiles').select('id, full_name, role').ilike('email', email).maybeSingle();
        if (byEmail) return byEmail as StaffProfile;
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null;

    try {
        const admin = adminClient();
        const { count } = await admin.from('profiles').select('id', { count: 'exact', head: true });
        const { data: created } = await admin
            .from('profiles')
            .insert({
                id: userId,
                full_name: displayName,
                email: email || userId + '@unknown.local',
                role: (count || 0) === 0 ? 'admin' : 'sales',
            })
            .select('id, full_name, role')
            .single();
        return (created as StaffProfile) || null;
    } catch {
        return null;
    }
}

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
    if (!supabaseConfigured()) {
        return (
            <div className="min-h-screen bg-shell px-4 py-16">
                <div className="mx-auto max-w-xl">
                    <SetupNotice />
                </div>
            </div>
        );
    }

    const supabase = await serverClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    const meta = (user.user_metadata || {}) as { full_name?: string; name?: string };
    const fallbackName =
        meta.full_name || meta.name || (user.email ? user.email.split('@')[0].replace(/[._]/g, ' ') : 'Staff');

    const profile = await resolveProfile(user.id, user.email, fallbackName);
    const who = profile ? profile.full_name + ' · ' + profile.role : fallbackName;

    return <Shell who={who}>{children}</Shell>;
}
