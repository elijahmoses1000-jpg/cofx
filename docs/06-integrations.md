# Integrations and the COFX MCP server

COFX speaks Model Context Protocol in both directions. Other systems can drive the branch through the COFX server, and any external MCP server can be registered and used from inside COFX. Systems that do not speak MCP use the webhook surface.

1. The COFX MCP server

Endpoint: https://cofx.vercel.app/api/mcp
Transport: streamable HTTP, protocol 2025-06-18
Authentication: bearer token, held in the COFX_MCP_TOKEN environment variable

A GET returns a description of the server and its tools. A POST carries JSON-RPC 2.0 messages: initialize, tools/list, tools/call and ping.

Connecting from a client. Add a custom connector, choose the streamable HTTP transport, paste the endpoint and set the Authorization header to Bearer followed by the token. The token is in .env.local and in the Vercel project environment.

The fifteen tools, grouped by what they do.

Catalogue and fitment:
search_parts, search the range by keyword, category, brand or vehicle.
check_fitment, the authoritative answer for whether a part fits a given make, model and year.

Customers:
search_customers, find by name, company or phone.
get_customer, the full record including vehicles with battery and service dates, tickets and orders.

Sales:
list_tickets, filter by status or by anything past its service level target.
create_ticket, raises a ticket, creating the customer if the phone number is new and assigning the representative with the lightest load.
update_ticket, moves a ticket along under the same guardrails as the console. Closing requires an outcome and a lost deal requires a reason. The tool refuses otherwise.
create_quote, turns a ticket into a priced order and issues the payment reference.

Finance:
ingest_bank_alert, submit a credit alert. COFX parses it, scores it against expected payments and releases the goods when the evidence is strong enough.
payment_status, the state of the payment queue.

Operations and analysis:
stock_alerts, lines at or below reorder level with the cost to refill.
branch_snapshot, live branch health in one call.
list_playbooks and run_playbook, the knowledge work library executed against live data.
ask_wanner, the customer assistant, which quotes only real parts and can capture a lead.

Worked example, a complete sale through MCP. Each step below was run against the live deployment.

```
check_fitment  {"make":"Toyota","model":"Hilux","year":2019}
  -> WP-FLT-2001 Engine oil filter 7,800 naira, WP-FLT-2004 Diesel fuel filter 16,400 naira, and others

create_ticket  {"subject":"Filter service kit for Hilux fleet","customer_phone":"+2348030000002",
                "intent":"fleet_quote","priority":"high"}
  -> Ticket WP-2026-0003 raised and assigned, response due within six hours

create_quote   {"ticket_no":"WP-2026-0003",
                "items":[{"sku":"WP-FLT-2001","qty":9},{"sku":"WP-FLT-2004","qty":9}]}
  -> Order ORD-2026-0001 for 217,800 naira, payment reference WPC77665

ingest_bank_alert {"body":"... credited with NGN217,800.00 ... TRF FROM OKEKE HAULAGE LTD WPC77665 ..."}
  -> Matched with a score of 100 and the goods were released automatically

update_ticket  {"ticket_no":"WP-2026-0003","status":"closed"}
  -> Refused: closing a ticket requires an outcome of won, lost or no_response
```

The last line matters as much as the others. The rules that stop a lead disappearing are enforced in the system, not in the interface, so an automated client cannot bypass them either.

2. Connecting an external MCP server

Open Integrations in the console, give the server a name and its endpoint URL, and add a headers block as JSON if it needs authentication, for example {"authorization": "Bearer abc"}.

COFX performs the initialize handshake, reads the server instructions, lists its tools and stores the registration. From then on any of those tools can be run from inside COFX, and every call is written to the integration_calls table with its arguments, output, duration and who ran it. Registrations can be refreshed when the remote server changes, or removed.

Both JSON and server sent event responses are handled, and the mcp-session-id header is carried through the handshake, so servers that require a session work without special handling.

3. Webhooks for systems that do not speak MCP

POST /api/payments/ingest, bank alert ingestion, protected by the x-cofx-token header.
GET /api/cron/after-sales, queues and dispatches the after sales messages.
GET /api/cron/escalate, escalates stalled tickets and retries payment matching.
POST /api/chat, the customer assistant, usable from any channel.

These are what the three n8n workflows in the n8n folder call. The cron endpoints accept either a Vercel bearer token or the x-cofx-token header, so Vercel cron and n8n can drive the same logic.

4. Security

The MCP endpoint is bearer protected whenever COFX_MCP_TOKEN is set, and returns 401 without it. Leave it unset only for a local demonstration.

Tools that write, create_ticket, update_ticket, create_quote and ingest_bank_alert, run under the service role, so treat the token as equivalent to staff access and rotate it if it is ever exposed. Credentials for external servers are stored with the registration and never returned to the browser.
