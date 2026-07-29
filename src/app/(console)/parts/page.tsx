import { serverClient } from '@/lib/supabase';
import { naira } from '@/lib/format';
import { PageHead, Stat, TableShell, Empty } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function Parts() {
    const db = await serverClient();
    const [{ data: parts }, { data: fitments }] = await Promise.all([
        db.from('parts').select('*').order('category').order('name').limit(200),
        db.from('part_fitments').select('part_id, make, model, year_from, year_to'),
    ]);

    const rows = parts || [];
    const byPart = new Map<string, Array<{ make: string; model: string | null }>>();
    (fitments || []).forEach((f) => {
        const list = byPart.get(f.part_id) || [];
        list.push({ make: f.make, model: f.model });
        byPart.set(f.part_id, list);
    });

    const lowStock = rows.filter((p) => p.stock_qty <= p.reorder_level);
    const stockValue = rows.reduce((s, p) => s + Number(p.cost_price) * p.stock_qty, 0);
    const makesCovered = new Set((fitments || []).map((f) => f.make)).size;

    return (
        <div>
            <PageHead
                eyebrow="Aftermarket range"
                title="Parts and stock"
                sub="Wannerpart sells independent parts that fit several vehicle brands. The fitment matrix is what lets the assistant quote with confidence instead of guessing."
            />

            <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Stat label="Active part numbers" value={rows.length} />
                <Stat label="Vehicle makes covered" value={makesCovered} hint="Across the fitment matrix" />
                <Stat label="Lines at or below reorder" value={lowStock.length} tone={lowStock.length ? 'caution' : 'signal'} />
                <Stat label="Stock at cost" value={naira(stockValue)} />
            </div>

            {rows.length ? (
                <TableShell head={['Part number', 'Name', 'Brand', 'Fits', 'Price', 'Stock', 'Warranty']}>
                    {rows.map((p) => {
                        const fits = byPart.get(p.id) || [];
                        const makes = Array.from(new Set(fits.map((f) => f.make)));
                        const low = p.stock_qty <= p.reorder_level;
                        return (
                            <tr key={p.id} className="border-b border-hairline/70 last:border-0 hover:bg-shell/60">
                                <td className="px-4 py-2.5 font-mono text-[12px] font-semibold text-torqueDark">{p.sku}</td>
                                <td className="max-w-[16rem] px-4 py-2.5">
                                    <div className="truncate font-medium">{p.name}</div>
                                    <div className="text-[11px] capitalize text-mute">{p.category}</div>
                                </td>
                                <td className="px-4 py-2.5 text-[13px] text-steel">{p.brand || '—'}</td>
                                <td className="max-w-[14rem] px-4 py-2.5 text-[12px] text-steel">
                                    {makes.length ? makes.slice(0, 4).join(', ') + (makes.length > 4 ? ' and more' : '') : 'Universal'}
                                </td>
                                <td className="px-4 py-2.5 font-mono text-[12px]">{naira(p.unit_price)}</td>
                                <td className={'px-4 py-2.5 text-[13px] ' + (low ? 'font-semibold text-caution' : '')}>
                                    {p.stock_qty}
                                    {low && <span className="ml-1 text-[11px]">reorder</span>}
                                </td>
                                <td className="px-4 py-2.5 text-[12px] text-steel">{p.warranty_months ? p.warranty_months + ' months' : 'n/a'}</td>
                            </tr>
                        );
                    })}
                </TableShell>
            ) : (
                <Empty text="The catalogue is empty. Run the database setup script to load the demonstration range." />
            )}
        </div>
    );
}
