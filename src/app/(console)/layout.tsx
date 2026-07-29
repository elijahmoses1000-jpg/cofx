import { redirect } from 'next/navigation';
import { serverClient, supabaseConfigured } from '@/lib/supabase';
import Shell from '@/components/Shell';
import { SetupNotice } from '@/components/ui';

export const dynamic = 'force-dynamic';

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

    const { data: profile } = await supabase.from('profiles').select('full_name, role').eq('id', user.id).maybeSingle();
    const who = profile ? profile.full_name + ' · ' + profile.role : user.email || 'Staff';

    return <Shell who={who}>{children}</Shell>;
}
