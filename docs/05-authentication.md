# Staff authentication

The console offers four ways to reach the same account. Two work the moment the Supabase project exists; two need a provider switched on.

Works immediately, no configuration:

Emailed sign in link. The member of staff types their work email and receives a one time link. No password to choose, forget or share. This is the easiest option for a branch and the one to demonstrate.
Email and password, including create an account.

Needs the provider switched on in Supabase:

Continue with Google.
Continue with Microsoft, which is the natural fit if the company runs Microsoft 365.

1. Redirect URLs, required for every method

In the Supabase dashboard open Authentication, then URL Configuration.

Site URL: https://cofx.vercel.app
Additional redirect URLs, one per line:

```
https://cofx.vercel.app/auth/callback
https://cofx.vercel.app/**
http://localhost:3000/auth/callback
```

Without these the provider refuses to send the browser back and sign in fails with a redirect mismatch.

2. Google

Google Cloud console, APIs and services, Credentials, Create credentials, OAuth client ID, Web application.

Authorised JavaScript origins: https://cofx.vercel.app
Authorised redirect URI: the callback URL shown on the Supabase Google provider page, which has the form https://YOUR-PROJECT.supabase.co/auth/v1/callback

Copy the client ID and client secret into Supabase, Authentication, Providers, Google, and enable it.

3. Microsoft

Azure portal, Microsoft Entra ID, App registrations, New registration.

Redirect URI, type Web: https://YOUR-PROJECT.supabase.co/auth/v1/callback
Create a client secret under Certificates and secrets.

Copy the application client ID and the secret value into Supabase, Authentication, Providers, Azure, and enable it. If the branch should only admit its own tenant, set the Azure tenant URL on the same page.

Until a provider is enabled the button still appears and returns a plain message saying the provider is not switched on yet, rather than failing silently.

4. What happens on first sign in

A database trigger creates the staff profile automatically from the account, taking the full name from the Google or Microsoft profile, or from the email when there is none. The application repeats the check as a safety net, so a profile always exists whichever route was used.

The very first person to sign in becomes admin. Everyone after that joins with the sales role, and an admin or manager can change it. If a profile already exists for that email, for example a member of staff seeded by the setup script who now signs in with Google, the existing record is kept rather than duplicated.

5. Email confirmation

Supabase asks new password accounts to confirm their email by default, and the confirmation link returns to the same callback. For a competition demonstration you can turn confirmation off under Authentication, Sign In and Providers, Email, which makes create an account sign the person straight in.

The built in Supabase email service is rate limited and intended for testing. For real branch use, set an SMTP provider under Project settings, Authentication, SMTP.

6. Restricting who may join

The console is staff facing, so open sign up may not be wanted. Two options.

Turn off sign ups entirely under Authentication, Sign In and Providers, and create staff with the setup script or by invitation from the Supabase dashboard.

Or leave sign up open and rely on the role model: new accounts land as sales, and nothing destructive is permitted below manager, since delete policies check the role on every table.
