/**
 * One command wiring for COFX.
 *
 * Reads .env.local, applies the database schema and demonstration data to your
 * Supabase project, pushes the same variables into the Vercel project, and then
 * ships a production deployment.
 *
 * Your keys never leave this machine except to Supabase and Vercel themselves.
 *
 *   node scripts/connect.mjs
 *
 * Flags:
 *   --skip-db      only push environment variables and deploy
 *   --skip-vercel  only run the database setup
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const args = process.argv.slice(2);

const REQUIRED = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'DATABASE_URL'];
const PUSH_TO_VERCEL = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'ANTHROPIC_API_KEY',
    'ANTHROPIC_MODEL',
    'COFX_WEBHOOK_SECRET',
    'CRON_SECRET',
    'COFX_MCP_TOKEN',
    'SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID',
    'SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET',
];

function readEnvLocal() {
    const file = join(root, '.env.local');
    if (!existsSync(file)) {
        console.error('No .env.local found.');
        console.error('Copy .env.example to .env.local and fill in the values from your Supabase dashboard first.');
        process.exit(1);
    }
    const env = {};
    for (const line of readFileSync(file, 'utf8').split('\n')) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
        if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
    return env;
}

function run(cmd, cmdArgs, opts = {}) {
    const res = spawnSync(cmd, cmdArgs, { stdio: 'inherit', shell: true, cwd: root, ...opts });
    return res.status === 0;
}

const env = readEnvLocal();
const missing = REQUIRED.filter((k) => !env[k]);
if (missing.length && !args.includes('--skip-db')) {
    console.error('These values are still missing from .env.local: ' + missing.join(', '));
    process.exit(1);
}

console.log('COFX connector');
console.log('  Supabase project: ' + (env.NEXT_PUBLIC_SUPABASE_URL || 'not set'));
console.log('  Language model:   ' + (env.ANTHROPIC_API_KEY ? 'configured' : 'not configured, deterministic fallbacks will be used'));
console.log('');

if (!args.includes('--skip-db')) {
    console.log('Step 1 of 3. Applying the database schema, business logic and demonstration data.');
    if (!run('node', ['scripts/setup-db.mjs'], { env: { ...process.env, ...env } })) {
        console.error('Database setup failed. Check that DATABASE_URL is the connection string from Supabase project settings, database.');
        process.exit(1);
    }
    console.log('');
}

if (!args.includes('--skip-vercel')) {
    console.log('Step 2 of 3. Pushing environment variables into the Vercel project.');
    for (const key of PUSH_TO_VERCEL) {
        const value = env[key];
        if (!value) continue;
        for (const target of ['production', 'preview', 'development']) {
            spawnSync('vercel', ['env', 'rm', key, target, '--yes'], { stdio: 'ignore', shell: true, cwd: root });
            const res = spawnSync('vercel', ['env', 'add', key, target], {
                input: value + '\n',
                stdio: ['pipe', 'ignore', 'ignore'],
                shell: true,
                cwd: root,
            });
            if (res.status !== 0) console.log('  could not set ' + key + ' for ' + target);
        }
        console.log('  set ' + key);
    }
    console.log('');

    console.log('Step 3 of 3. Deploying to production.');
    if (!run('vercel', ['deploy', '--prod', '--yes'])) {
        console.error('Deployment failed. Run vercel deploy --prod again to retry; uploads sometimes drop on unstable connections.');
        process.exit(1);
    }
}

console.log('');
console.log('COFX is connected. Open the deployment URL printed above.');
console.log('Sign in with the staff accounts printed by the database step, and try the assistant at /assistant.');
console.log('');
console.log('One manual step remains for sign in, in the Supabase dashboard:');
console.log('  Authentication, URL Configuration');
console.log('    Site URL:                https://cofx.vercel.app');
console.log('    Additional redirect URLs: https://cofx.vercel.app/auth/callback');
console.log('                              https://cofx.vercel.app/**');
console.log('                              http://localhost:3000/auth/callback');
console.log('');
console.log('Emailed sign in links and passwords work as soon as that is saved.');
console.log('For the Google and Microsoft buttons, follow docs/05-authentication.md.');
