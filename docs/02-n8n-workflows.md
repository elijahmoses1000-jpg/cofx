# Phase 2. n8n workflow blueprints

Three workflows ship as importable JSON in the n8n folder of this repository. Import them into n8n, set the four environment variables below, connect the mailbox and messaging credentials, and they run.

Environment variables used by all three workflows:

COFX_BASE_URL, the public URL of the deployed application.
COFX_WEBHOOK_SECRET, the shared secret that protects the ingest endpoint.
CRON_SECRET, the shared secret that protects the scheduled endpoints.
SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, used only by the nodes that read rows back out of the database for delivery.

1. Payment verification, the finance bottleneck

File: n8n/payment-verification.json

The problem being solved. Every payment lands in one COFX Mobility head office account. Finance confirms transfers by reading email by hand, so a customer standing at the counter waits hours for goods that are already paid for. Direct bank API access is blocked by internal approval, so the workaround has to use what the branch already receives: the credit alert email.

Node by node.

Node 1, Bank alert mailbox. Type gmailTrigger, polling every minute. Filter q set to from the bank alert sender, subject containing credit alert, unread only. Any IMAP node substitutes directly. This node exists so no human has to open the mailbox.

Node 2, Normalise mail payload. Type code. Flattens the differences between Gmail, IMAP and Outlook payloads into three fields: subject, body, source. Without this the downstream nodes break every time the mail provider changes.

Node 3, Extract amount, reference and code. Type code. A fast local extraction using three patterns:

Amount, credited\s+with\s+(?:NGN|N|naira symbol)?\s?([\d,]+(?:\.\d{1,2})?) with a looser currency pattern as fallback.
Bank reference, (?:\bref(?:erence)?\b|transaction\s*id|session\s*id)\s*[:#-]?\s*([A-Z0-9][A-Z0-9\-\/]{5,}).
Order code, \bWP[0-9A-F]{6}\b, which is the narration code COFX prints on every order.

This node is a filter, not the source of truth. COFX repeats the parse server side where it can also fall back to a language model.

Node 4, Is a credit alert with an amount. Type if. Passes only when the mail is a credit and an amount was found. Debits, balance summaries and marketing mail stop here, which keeps noise out of the alert table.

Node 5, Post to COFX ingest. Type httpRequest, POST to COFX_BASE_URL/api/payments/ingest with header x-cofx-token. Body is the raw subject and body, deliberately not the parsed fields, so the server side parser remains authoritative and improvements to it apply immediately without editing the workflow.

The endpoint stores the alert, suppresses duplicates on the bank reference, scores it against every awaiting payment, and returns a status of released, needs_review, unmatched or duplicate together with the parse and the match reasoning.

Node 6, Route on match outcome. Type switch on the returned status, three outputs.

Node 7, Tell the sales floor to release. Fires on released. Message names the amount, the score and the reason. This is the message that replaces a two hour wait with a two second one.

Node 8, Escalate to finance. Fires on needs_review, with the score and the reason so finance knows what the machine was unsure about before opening the console.

Node 9, Report unmatched credit. Fires on anything else. An unmatched credit is money in the account with no order attached and is a genuine exception worth chasing.

Why the matching is trustworthy. The score is additive and every component is explainable: forty five points for an exact amount, forty for the order code appearing in the narration, ten for the sender name resembling the customer of record, five for the payment being raised within the last seven days. Release requires eighty five or more, which in practice means the amount matched and the code was quoted. If a second payment scores within fifteen points, the engine refuses to auto approve and sends both to a human, because two customers transferring the same amount on the same day is the one case where automation could release the wrong goods.

2. After sales follow up engine

File: n8n/after-sales-engine.json

Node 1, Every morning at 7.20. Schedule trigger, before the branch opens.

Node 2, Ask COFX to queue engagements. GET to /api/cron/after-sales with the shared secret. This calls the Postgres function fn_queue_after_sales, which evaluates five rules in one pass:

Birthday, where the stored birthday month and day equal today.
Battery reminder, where the fitted date plus the warranty months is within thirty days of today.
Service reminder, where the next service due date falls within the next fourteen days.
Feedback, queued automatically two days after an order is paid, by a database trigger rather than this workflow.
Win back, where the last purchase is older than six months.

Each insert carries a unique deduplication key, for example battery plus vehicle plus the year and month of fitting. Running the job five times in one morning still sends one message.

Node 3, Fetch the messages to deliver. Reads the engagements marked sent in this run, joined to the customer, through the Supabase REST interface.

Node 4, One item per customer. Split out.

Node 5, Marketing consent given. If node on the customer consent flag. Consent is checked in the database when queueing and again here before anything leaves, because consent is the one thing worth checking twice.

Node 6, Route by channel. Switch on email, WhatsApp, or the fallback branch which runs the accountability sweep.

Nodes 7 and 8, Send the email and Send the WhatsApp message. Subject and body come from the engagement row, so the wording is identical across channels and can be edited by the branch without touching the workflow.

Node 9, Run the accountability sweep. GET to /api/cron/escalate, so one morning job covers both retention and sales accountability.

3. Ticket accountability loop

File: n8n/ticket-accountability.json

Node 1, Every hour. Schedule trigger.

Node 2, Escalate stalled tickets. GET to /api/cron/escalate. The endpoint calls fn_escalate_stale_tickets, which selects tickets that are open or in progress, past their service level target, with no activity for four hours and below escalation level three. It raises the level, lifts the priority, writes the reason into the ticket trail and returns the ticket numbers.

Node 3, Anything escalated. If node, stops the workflow when the branch is clean.

Node 4, Fetch the stalled tickets. Reads them back with the assigned representative joined.

Node 5, Group by representative. Code node that builds one message per representative rather than one per ticket. A representative with six stalled tickets gets one list, not six alerts, which is the difference between a system people act on and one they mute.

Node 6, Email the representative. Names each ticket and restates the rule: a ticket cannot be closed without an outcome, and a lost deal needs a reason.

Node 7, Summarise for management. One line to the management channel with the count escalated and what the payment matcher did in the same sweep.

4. Testing the payment workflow without a real bank

Post a simulated alert to the ingest endpoint. The seeded demonstration data includes orders whose narration codes will match.

```bash
curl -X POST "$COFX_BASE_URL/api/payments/ingest" \
  -H "content-type: application/json" \
  -H "x-cofx-token: $COFX_WEBHOOK_SECRET" \
  -d '{"subject":"Credit Alert","body":"Dear Customer, your account 1234 has been credited with NGN178,000.00 on 08-JUL-2026. Description: TRF FROM SWIFT AUTO WORKSHOP WPA31F09. Ref: FT26071900123456"}'
```

The response reports the parse, the score, the reason and whether the goods were released. The payments console shows the payment confirmed and the linked order released, and the ticket trail shows the automatic entry.
