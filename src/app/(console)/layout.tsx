import { redirect } from 'next/navigation';
import { serverClient } from '@/lib/supabase';
import Shell from '@/components/Shell';

export const dynamic = 'force-dynamic';

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
    const supabase = await serverClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    const { data: profile } = await supabase.from('profiles').select('full_name, role').eq('id', user.id).maybeSingle();
    const who = profile ? profile.full_name + ' · ' + profile.role : user.email || 'Staff';

    return <Shell who={who}>{children}</Shell>;
}
