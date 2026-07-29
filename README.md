# COFX

Automated operations platform for Wannerpart by COFX, the independent aftermarket auto parts branch of COFX in Nigeria.

Wannerpart supplies parts that fit several vehicle brands rather than one manufacturer. COFX joins the four things the branch was missing: an assistant that answers every customer, a ticket that holds a representative accountable, an engine that verifies payment from bank alert email without bank API access, and a customer record that drives after sales and loyalty.

Built for the internal COFX Nigeria innovation competition, designed to scale to COFX Africa.

1. What it does

AI customer routing. Wanner answers parts, fitment, price and service questions with no login, quotes only from the real fitment matrix, captures contact details, books a workshop slot, and raises a ticket routed to the sales representative with the lightest load.

Sales ticketing and accountability. Every enquiry becomes a numbered ticket with an owner and a service level target. A ticket cannot be closed without an outcome, a lost deal cannot be closed without a reason, and anything that stalls past its target is escalated hourly with the representative and management both told.

Payment verification. Bank credit alerts are parsed and scored against expected payments on amount, the order narration code, sender name and recency. A score of eighty five or more releases the goods automatically. Between sixty and eighty four it goes to finance with the reasoning attached. No bank API and no finance system change is required.

CRM and after sales. One customer record carries vehicles, purchases, loyalty tier and points. Birthday greetings, battery checks near end of warranty, service reminders, post purchase feedback and six month win backs queue themselves, and the customer of the year standing is tracked continuously.

Playbooks. Twenty five knowledge work workflows curated from the COFX plugin library and pointed at live branch data.

Staff sign in. Four routes into the same account: Google, Microsoft, a one time emailed sign in link that needs no password, and email with password including create an account. Staff profiles are created automatically on first sign in whichever route was used, and the first person to sign in becomes the administrator.

2. Stack

Next.js 15 with the App Router on Vercel, Supabase for Postgres, authentication, row level security and realtime, n8n for anything that reaches outside the building, and an optional language model for phrasing. Every intelligent path has a deterministic fallback, so the platform works end to end even with no model key configured.

3. Documentation

docs/01-architecture.md, the stack, the reasoning and the end to end flow diagram.
docs/02-n8n-workflows.md, node by node configuration for all three workflows.
docs/03-database-and-ticketing.md, the schema and the rules the database enforces.
docs/04-ai-agent.md, the agent design and its production system prompt.
docs/05-authentication.md, the four staff sign in methods and how to switch Google and Microsoft on.

4. Connecting Supabase and going live

Create a Supabase project at supabase.com, then copy .env.example to .env.local and fill in four values from the project dashboard.

NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY come from Project settings, API.
SUPABASE_SERVICE_ROLE_KEY comes from the same page, under service role. Keep it secret.
DATABASE_URL comes from Project settings, Database, Connection string, URI. Substitute your database password.

Then run one command:

```bash
npm install
node scripts/connect.mjs
```

The connector applies both migrations, loads the demonstration catalogue and customers, creates the staff sign in accounts, distributes the demonstration tickets across the sales team, pushes the same variables into the Vercel project, and ships a production deployment. It prints the staff accounts and their password when it finishes. Nothing is sent anywhere except Supabase and Vercel.

To work locally instead:

```bash
npm run db:setup
npm run dev
```

5. Integration surface

POST /api/payments/ingest, bank alert ingestion, protected by the x-cofx-token header. Accepts the raw subject and body, returns the parse, the match score and whether goods were released.

GET /api/cron/after-sales, queues and dispatches the after sales messages.

GET /api/cron/escalate, escalates stalled tickets and retries payment matching.

POST /api/chat, the assistant, used by the public help desk.

Both cron endpoints accept either a Vercel bearer token or the x-cofx-token header, so Vercel cron and n8n can drive the same logic. Schedules for the Vercel path are declared in vercel.json.

Note on schedules. vercel.json runs both jobs once daily because Vercel Hobby accounts allow one cron run per day. The accountability sweep is designed to run hourly, which is what the n8n ticket accountability workflow does. Either raise the Vercel plan or let n8n drive that loop.

6. Repository layout

```
src/app          pages, the public assistant and the internal console
src/app/api      assistant, webhooks, scheduled jobs, playbooks
src/lib          agent, payment matching, playbooks, Supabase clients
supabase         migrations and demonstration seed
n8n              three importable workflow blueprints
docs             the four architecture documents
scripts          database setup and staff account creation
```
