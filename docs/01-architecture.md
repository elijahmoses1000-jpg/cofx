# Phase 1. System architecture

COFX is the automated operating system for Wannerpart by COFX, the independent aftermarket parts branch. It is one deployed application backed by one database, with n8n bolted on for anything that has to reach outside the building.

1. Design principles

The architecture follows four rules, each one drawn from a bottleneck the branch actually has.

Own the customer record. Everything else in the system writes into a single customer row. A conversation, a ticket, an order, a payment and a reminder all point back to it, which is what makes retention and loyalty possible at all.

Never lose an enquiry. Every commercial conversation becomes a numbered ticket with an owner and a deadline before it can be forgotten. The system, not a person, is responsible for remembering.

Automate the wait, not the judgement. Payment matching runs automatically and releases goods when the evidence is strong. When the evidence is weak it stops and asks a human, and it says exactly why.

Degrade gracefully. Every intelligent path has a deterministic fallback. If the language model key is absent or the model is rate limited, the assistant still quotes real parts from the fitment matrix and the payment parser still reads the alert with patterns. Nothing in the demonstration depends on a third party being up.

2. Technology stack

Layer, choice, and why it was chosen over the alternative.

Application and API: Next.js 15 on Vercel. Server components read the database directly, route handlers serve the assistant, the webhooks and the scheduled jobs. One deployment covers the public help desk, the internal console and the integration surface, which keeps the competition demonstration to a single public URL.

Database, authentication and realtime: Supabase, which is managed Postgres. Chosen over a generic headless CRM such as Zoho because the branch needs a fitment matrix, a payment matching engine and a loyalty ledger, none of which fit a generic CRM object model. Postgres gives real relational integrity, triggers that enforce business rules at the data layer, row level security tied to the signed in user, and SQL views for reporting. Supabase adds hosted authentication and an auto generated REST interface that n8n can call without any custom middleware.

Workflow automation: n8n, self hosted or cloud. It owns everything that touches the outside world: watching the finance mailbox, sending email and WhatsApp, posting to Slack. It deliberately does not own business logic. Rules live in COFX so they are versioned with the code and testable.

Agent framework: the assistant is a retrieval grounded agent in the application layer rather than a separate bot platform. It extracts signals from the conversation, queries the fitment matrix and the knowledge base, then either phrases the answer with the model or from templates. This avoids a second source of truth for prices and stock.

Scheduling: Vercel cron for the two internal jobs, with the identical endpoints also callable from n8n. Whichever the branch prefers, the behaviour is the same.

3. End to end data flow

The diagram traces one customer from first contact to a repeat purchase.

```
   CUSTOMER
   phone, WhatsApp, web, walk in
        |
        v
+---------------------------+
|  WANNER ASSISTANT         |   public, no login
|  intent, vehicle, part     |
+---------------------------+
        |
        | extracts phone or email
        v
+---------------------------+       +--------------------------+
|  CUSTOMER RECORD (CRM)    |<----->|  VEHICLES                |
|  identity, tier, value    |       |  battery and service due |
+---------------------------+       +--------------------------+
        |
        | commercial intent detected
        v
+---------------------------+
|  SALES TICKET             |  number, owner, service level
|  open -> wip -> closed    |  round robin to lightest rep
+---------------------------+
        |                                    ^
        | quote accepted                     | escalation if stalled
        v                                    |
+---------------------------+       +--------------------------+
|  ORDER                    |------>|  ACCOUNTABILITY SWEEP    |
|  carries payment ref code |       |  hourly, raises level    |
+---------------------------+       +--------------------------+
        |
        | customer transfers to head office account
        v
+---------------------------+
|  BANK MAILBOX             |  credit alert email
+---------------------------+
        |  n8n poll
        v
+---------------------------+
|  ALERT INGEST             |  parse: amount, ref, sender, code
|  /api/payments/ingest     |  patterns first, model if weak
+---------------------------+
        |
        v
+---------------------------+
|  MATCHING ENGINE          |  score every awaiting payment
|  amount 45, code 40,      |
|  name 10, recency 5       |
+---------------------------+
        |
   +----+----+--------------------+
   |         |                    |
 >= 85     60 to 84             < 60
   |         |                    |
   v         v                    v
 RELEASE   FINANCE REVIEW      UNMATCHED
 goods     one click confirm   investigate
 ticket
 closed won
   |
   v
+---------------------------+
|  AFTER SALES ENGINE       |  daily
|  feedback at 2 days       |
|  birthday, battery,       |
|  service, win back        |
+---------------------------+
        |
        v
+---------------------------+
|  LOYALTY LEDGER           |  points, tier, customer of the year
+---------------------------+
        |
        v
    REPEAT PURCHASE
```

4. Component responsibilities

Wanner assistant. Runs at /assistant with no login. Detects intent, make, model, year, part category, phone and email from the running transcript rather than a single message, so a customer who gives their number three messages in is still captured. Queries the fitment matrix so a quote is only ever made for a part that genuinely fits. Creates the customer, the ticket and a provisional workshop slot. Hands complaints straight to a human with a reference.

Ticketing. Numbers are issued by the database, not the application, so they cannot collide. The service level target is derived from priority at insert time: two hours for urgent, six for high, twenty four for normal, forty eight for low. Every status change writes an immutable event. The close path is guarded: no outcome, no close; outcome lost with no reason, no close.

Payment verification. Described in full in Phase 2 and Phase 3. The important architectural point is that it needs no bank API and no finance system change. It reads the alert email the bank already sends and the reference code the branch already prints on the order.

After sales. Queueing is a Postgres function, so the rules sit next to the data and run identically whether triggered by Vercel cron or n8n. Every queued message carries a deduplication key such as birthday plus customer plus year, which makes the job safe to run many times a day without ever sending twice.

Playbooks. The knowledge work plugin library from the COFX repository, curated to twenty five workflows that match this branch and pointed at live data. Each run pulls a snapshot of tickets, payments, stock and customers so the output argues from facts rather than generalities.

5. Security and access

Staff authenticate through Supabase. Row level security is enabled on every table: authenticated staff read and write, only administrators and managers delete. The public assistant never touches the database with a user token; it runs server side under the service role, which is why an anonymous visitor can create a lead without being able to read anyone else's.

The ingest webhook is protected by a shared secret header. The scheduled endpoints accept either a bearer token from Vercel cron or the same shared secret header from n8n.

6. Scaling from Nigeria to COFX Africa

The branch column already exists on the staff profile. Adding a country or branch column to customers, tickets and orders, then extending the row level security policy to filter on the signed in user's branch, converts this single tenant deployment into a multi branch one without touching application logic. The fitment matrix and the parts catalogue are shared, which is exactly right: an aftermarket range that fits several brands is the same range in Accra as in Lagos. Currency and the bank alert patterns are the two genuinely local pieces, and both are already isolated, the first in a formatting helper and the second in a single parser module.
