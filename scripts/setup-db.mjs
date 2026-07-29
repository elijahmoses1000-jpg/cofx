/**
 * Applies the COFX schema, business logic and demonstration data to a Supabase
 * Postgres database, then creates the staff sign in accounts.
 *
 * Usage:
 *   DATABASE_URL=... NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/setup-db.mjs
 *
 * DATABASE_URL is the Supabase connection string found under
 * Project settings, Database, Connection string, URI.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

function loadEnvFile() {
    const file = join(root, '.env.local');
    if (!existsSync(file)) return;
    for (const line of readFileSync(file, 'utf8').split('\n')) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
}
loadEnvFile();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
    console.error('DATABASE_URL is required. Copy it from Supabase project settings, database, connection string.');
    process.exit(1);
}

const STAFF = [
    { email: 'admin@wannerpart.cofx.ng', name: 'Ifeoma Adeyemi', role: 'admin' },
    { email: 'manager@wannerpart.cofx.ng', name: 'Segun Oyelaran', role: 'manager' },
    { email: 'sales1@wannerpart.cofx.ng', name: 'Kelechi Obi', role: 'sales' },
    { email: 'sales2@wannerpart.cofx.ng', name: 'Halima Bello', role: 'sales' },
    { email: 'finance@wannerpart.cofx.ng', name: 'Damilola Ajayi', role: 'finance' },
    { email: 'support@wannerpart.cofx.ng', name: 'Uche Nnamdi', role: 'support' },
];
const PASSWORD = process.env.DEMO_PASSWORD || 'Wannerpart2026!';

async function runSql(client, file) {
    const sql = readFileSync(join(root, 'supabase', file), 'utf8');
    process.stdout.write('applying ' + file + ' ... ');
    await client.query(sql);
    console.log('done');
}

async function createStaff() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
        console.log('Skipping staff accounts: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are not both set.');
        return [];
    }

    const created = [];
    for (const person of STAFF) {
        const res = await fetch(url + '/auth/v1/admin/users', {
            method: 'POST',
            headers: { 'content-type': 'application/json', apikey: key, authorization: 'Bearer ' + key },
            body: JSON.stringify({
                email: person.email,
                password: PASSWORD,
                email_confirm: true,
                user_metadata: { full_name: person.name, role: person.role },
            }),
        });
        const body = await res.json().catch(() => ({}));
        if (res.ok && body.id) {
            created.push({ ...person, id: body.id });
            console.log('  created ' + person.email);
        } else if (res.status === 422 || String(body.msg || body.error_description || body.message || '').toLowerCase().includes('already')) {
            const look = await fetch(url + '/auth/v1/admin/users?per_page=200', {
                headers: { apikey: key, authorization: 'Bearer ' + key },
            });
            const list = await look.json().catch(() => ({}));
            const found = (list.users || []).find((u) => u.email === person.email);
            if (found) {
                created.push({ ...person, id: found.id });
                console.log('  reused ' + person.email);
            }
        } else {
            console.log('  could not create ' + person.email + ': ' + JSON.stringify(body).slice(0, 200));
        }
    }
    return created;
}

async function main() {
    const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
    await client.connect();

    try {
        await runSql(client, 'migrations/0001_schema.sql');
        await runSql(client, 'migrations/0002_logic_rls.sql');
        await runSql(client, 'seed.sql');

        console.log('creating staff sign in accounts');
        const staff = await createStaff();

        for (const person of staff) {
            await client.query(
                `insert into profiles (id, full_name, email, role)
                 values ($1, $2, $3, $4)
                 on conflict (id) do update set full_name = excluded.full_name, role = excluded.role`,
                [person.id, person.name, person.email, person.role]
            );
        }

        if (staff.length) {
            // Spread the demonstration tickets and customers across the sales team
            const reps = staff.filter((s) => s.role === 'sales' || s.role === 'manager');
            if (reps.length) {
                const { rows: tickets } = await client.query('select id from sales_tickets where assigned_to is null order by created_at');
                for (let i = 0; i < tickets.length; i += 1) {
                    await client.query('update sales_tickets set assigned_to = $1 where id = $2', [reps[i % reps.length].id, tickets[i].id]);
                }
                const { rows: customers } = await client.query('select id from customers where owner_id is null order by created_at');
                for (let i = 0; i < customers.length; i += 1) {
                    await client.query('update customers set owner_id = $1 where id = $2', [reps[i % reps.length].id, customers[i].id]);
                }
                console.log('assigned ' + tickets.length + ' tickets and ' + customers.length + ' customers to the sales team');
            }
        }

        await client.query('select fn_queue_after_sales()');
        const { rows: counts } = await client.query(`
            select
              (select count(*) from customers) as customers,
              (select count(*) from parts) as parts,
              (select count(*) from part_fitments) as fitments,
              (select count(*) from sales_tickets) as tickets,
              (select count(*) from bank_alerts) as alerts,
              (select count(*) from engagements) as engagements
        `);

        console.log('\nCOFX database ready.');
        console.table(counts[0]);
        if (staff.length) {
            console.log('\nStaff sign in:');
            staff.forEach((s) => console.log('  ' + s.email + '  ' + PASSWORD + '  (' + s.role + ')'));
        }
    } finally {
        await client.end();
    }
}

main().catch((err) => {
    console.error('\nSetup failed:', err.message);
    process.exit(1);
});
