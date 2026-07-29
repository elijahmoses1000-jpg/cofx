/**
 * Switches Google and Microsoft sign in on for the COFX Supabase project.
 *
 * Supabase cannot enable a provider without credentials issued by Google or
 * Microsoft, and those can only be created inside your own Google Cloud or
 * Azure account. Once you have them, put them in .env.local and run:
 *
 *   node scripts/enable-oauth.mjs
 *
 * The values are written into the Supabase project configuration and pushed.
 * They never leave this machine except to Supabase.
 *
 * .env.local keys this reads:
 *   SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID
 *   SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET
 *   SUPABASE_AUTH_EXTERNAL_AZURE_CLIENT_ID
 *   SUPABASE_AUTH_EXTERNAL_AZURE_SECRET
 *   SUPABASE_AUTH_EXTERNAL_AZURE_URL          optional, restricts to one tenant
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const configPath = join(root, 'supabase', 'config.toml');

const START = '# >>> managed oauth providers, written by scripts/enable-oauth.mjs';
const END = '# <<< managed oauth providers';

function readEnvLocal() {
    const file = join(root, '.env.local');
    if (!existsSync(file)) {
        console.error('No .env.local found. Copy .env.example first.');
        process.exit(1);
    }
    const env = {};
    for (const line of readFileSync(file, 'utf8').split('\n')) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
        if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
    return env;
}

/** Finds the Supabase CLI: bundled in .tools, then anything on the PATH. */
function findCli() {
    const bundled = join(root, '.tools', process.platform === 'win32' ? 'supabase.exe' : 'supabase');
    if (existsSync(bundled)) return bundled;
    const probe = spawnSync('supabase', ['--version'], { shell: true, stdio: 'ignore' });
    if (probe.status === 0) return 'supabase';
    return null;
}

const env = readEnvLocal();
const projectRef = (readFileSync(configPath, 'utf8').match(/project_id\s*=\s*"([^"]+)"/) || [])[1];
if (!projectRef) {
    console.error('Could not read project_id from supabase/config.toml.');
    process.exit(1);
}

const google = {
    id: env.SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID,
    secret: env.SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET,
};
const azure = {
    id: env.SUPABASE_AUTH_EXTERNAL_AZURE_CLIENT_ID,
    secret: env.SUPABASE_AUTH_EXTERNAL_AZURE_SECRET,
    url: env.SUPABASE_AUTH_EXTERNAL_AZURE_URL,
};

const wanted = [];
if (google.id && google.secret) wanted.push('google');
if (azure.id && azure.secret) wanted.push('azure');

console.log('COFX OAuth provider setup');
console.log('  project:  ' + projectRef);
console.log('  callback: https://' + projectRef + '.supabase.co/auth/v1/callback');
console.log('');

if (!wanted.length) {
    console.log('Nothing to enable yet. Add at least one pair of credentials to .env.local:');
    console.log('');
    console.log('  SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=...apps.googleusercontent.com');
    console.log('  SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=GOCSPX-...');
    console.log('');
    console.log('Create them at console.cloud.google.com, APIs and services, Credentials,');
    console.log('Create credentials, OAuth client ID, Web application, using this redirect URI:');
    console.log('  https://' + projectRef + '.supabase.co/auth/v1/callback');
    console.log('');
    console.log('Full walkthrough: docs/05-authentication.md');
    process.exit(0);
}

// Rewrite the managed block so repeat runs stay clean.
let config = readFileSync(configPath, 'utf8');
const startIdx = config.indexOf(START);
if (startIdx !== -1) {
    const endIdx = config.indexOf(END, startIdx);
    config = config.slice(0, startIdx) + config.slice(endIdx === -1 ? startIdx : endIdx + END.length);
}
config = config.replace(/\n{3,}$/, '\n');

const block = [START];
if (wanted.includes('google')) {
    block.push('');
    block.push('[auth.external.google]');
    block.push('enabled = true');
    block.push('client_id = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID)"');
    block.push('secret = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET)"');
    block.push('skip_nonce_check = false');
}
if (wanted.includes('azure')) {
    block.push('');
    block.push('[auth.external.azure]');
    block.push('enabled = true');
    block.push('client_id = "env(SUPABASE_AUTH_EXTERNAL_AZURE_CLIENT_ID)"');
    block.push('secret = "env(SUPABASE_AUTH_EXTERNAL_AZURE_SECRET)"');
    if (azure.url) block.push('url = "env(SUPABASE_AUTH_EXTERNAL_AZURE_URL)"');
}
block.push('');
block.push(END);
block.push('');

writeFileSync(configPath, config.trimEnd() + '\n\n' + block.join('\n'), 'utf8');
console.log('Updated supabase/config.toml for: ' + wanted.join(', '));

const cli = findCli();
if (!cli) {
    console.log('');
    console.log('The Supabase CLI was not found, so the configuration was written but not pushed.');
    console.log('Install it, then run: supabase config push --project-ref ' + projectRef + ' --yes');
    process.exit(0);
}

console.log('Pushing configuration to Supabase');
// The repository path may contain spaces, so the bundled binary is invoked
// directly rather than through a shell that would split it.
const useShell = cli === 'supabase';
const res = spawnSync(cli, ['config', 'push', '--project-ref', projectRef, '--yes'], {
    stdio: 'inherit',
    shell: useShell,
    cwd: root,
    env: { ...process.env, ...env },
});

if (res.status !== 0) {
    console.error('The push failed. Check the credentials and try again.');
    process.exit(1);
}

console.log('');
console.log('Done. Reload https://cofx.vercel.app/login and the buttons will appear.');
