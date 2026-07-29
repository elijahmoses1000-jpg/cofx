# Staff authentication

The console offers four ways to reach the same account. Two work the moment the Supabase project exists; two need a provider switched on.

Works immediately, no configuration:

Emailed sign in link. The member of staff types their work email and receives a one time link. No password to choose, forget or share. This is the easiest option for a branch and the one to demonstrate.
Email and password, including create an account.

Needs the provider switched on in Supabase:

Continue with Google.
Continue with Microsoft, which is the natural fit if the company runs Microsoft 365.

1. Redirect URLs, already applied

These are versioned in supabase/config.toml and were pushed to the live project, so there is nothing to click. Without them a provider refuses to send the browser back and sign in fails with a redirect mismatch.

Site URL: https://cofx.vercel.app
Additional redirect URLs:

```
https://cofx.vercel.app/auth/callback
https://cofx.vercel.app/**
http://localhost:3000/auth/callback
http://localhost:3000/**
```

If you change the domain later, edit supabase/config.toml and run:

```bash
.tools/supabase.exe config push --project-ref dpmxxmzaiyqafmeeyxog --yes
```

2. Google

Supabase cannot switch Google on by itself. Google will only issue credentials from your own Google Cloud account, so this part has to be done once by a person.

In the Google Cloud console, open APIs and services, then Credentials, then Create credentials, OAuth client ID, and choose Web application. If it asks you to configure the consent screen first, choose External, give the app a name and your email, and save.

Authorised JavaScript origins:

```
https://cofx.vercel.app
```

Authorised redirect URI, exactly this, for the live COFX project:

```
https://dpmxxmzaiyqafmeeyxog.supabase.co/auth/v1/callback
```

Google then shows a client ID ending in apps.googleusercontent.com and a client secret starting with GOCSPX. Put both in .env.local:

```
SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=...apps.googleusercontent.com
SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=GOCSPX-...
```

Then run one command from the repository:

```bash
node scripts/enable-oauth.mjs
```

That writes the provider into supabase/config.toml and pushes it to the project. Reload the sign in page and the Google button appears.

3. Microsoft

Azure portal, Microsoft Entra ID, App registrations, New registration.

Redirect URI, type Web:

```
https://dpmxxmzaiyqafmeeyxog.supabase.co/auth/v1/callback
```

Create a client secret under Certificates and secrets, and copy the secret value, not the secret ID. Put the application client ID and the secret in .env.local as SUPABASE_AUTH_EXTERNAL_AZURE_CLIENT_ID and SUPABASE_AUTH_EXTERNAL_AZURE_SECRET, then run the same script. To admit only your own tenant, also set SUPABASE_AUTH_EXTERNAL_AZURE_URL to https://login.microsoftonline.com/YOUR-TENANT-ID.

4. What the sign in page does when a provider is off

The page asks the project which providers are switched on before it draws anything, and only offers the ones that will work. If the lookup is slow the button is still drawn, and clicking it checks again and shows a plain explanation rather than sending the browser to a raw Supabase error page. Nobody ever sees a provider is not enabled error.

5. What happens on first sign in

A database trigger creates the staff profile automatically from the account, taking the full name from the Google or Microsoft profile, or from the email when there is none. The application repeats the check as a safety net, so a profile always exists whichever route was used.

The very first person to sign in becomes admin. Everyone after that joins with the sales role, and an admin or manager can change it. If a profile already exists for that email, for example a member of staff seeded by the setup script who now signs in with Google, the existing record is kept rather than duplicated.

6. Email confirmation

Email confirmation is switched off on this project, set in supabase/config.toml, so creating an account signs the person straight in. That is deliberate: the built in Supabase mail service is rate limited and intended for testing, so requiring confirmation would strand new staff behind an email that may never arrive.

The same limitation affects the emailed sign in link, which does depend on mail delivery. For real branch use set an SMTP provider under Project settings, Authentication, SMTP, then set enable_confirmations back to true in supabase/config.toml and push it.

7. Restricting who may join

The console is staff facing, so open sign up may not be wanted. Two options.

Turn off sign ups entirely under Authentication, Sign In and Providers, and create staff with the setup script or by invitation from the Supabase dashboard.

Or leave sign up open and rely on the role model: new accounts land as sales, and nothing destructive is permitted below manager, since delete policies check the role on every table.
