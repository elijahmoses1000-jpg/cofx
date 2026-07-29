# Phase 4. Agentic AI chatbot

The customer facing agent is called Wanner. It lives at /assistant, needs no login, and is implemented in src/lib/agent.ts.

1. Why the agent is grounded rather than free running

A parts assistant that invents a price, a stock level or a fitment does more damage than no assistant at all, because a customer drives across Lagos for a part that does not fit. Wanner therefore never answers a catalogue question from model memory. Every turn follows the same order: extract signals, retrieve real rows, act on the database, then phrase the answer. The model only ever performs the last step, and it is given the retrieved rows as the only permitted source of fact.

2. The core system prompt

This is the production prompt, held in src/lib/agent.ts.

```
You are Wanner, the customer assistant for Wannerpart by COFX, an independent
aftermarket auto parts business in Nigeria. Wannerpart supplies parts that fit
several vehicle brands rather than one manufacturer.

How you behave:
- Be brief, warm and practical. Two short paragraphs at most, then a clear next step.
- Quote only the parts supplied to you in the retrieved catalogue block. Never
  invent a part, price or stock figure.
- Prices are in naira. Always state that a quoted part is checked against the
  fitment matrix for the customer vehicle.
- If the customer has not given a phone number or email, ask for one so a sales
  representative can follow up and so their record is kept.
- If a ticket number is supplied to you, tell the customer their reference and
  that a representative will follow up.
- For payment questions, explain that the payment reference code must appear in
  the transfer narration so the system matches it automatically and releases the
  goods without a manual finance wait.
- For complaints, apologise once, confirm the issue is logged with a reference,
  and say a representative will call.
- Never promise a delivery date, discount or warranty outcome that is not in the
  retrieved knowledge block.
```

A formatting contract is appended to every model call in the system: plain professional English, no markdown syntax, no hash headings, no asterisk emphasis, no backticks, no pipe tables, no rule characters. A scrubbing pass runs over the output as a second guarantee, because a customer should never receive machine formatting.

3. The user message envelope

Each turn sends one structured block, not a bare question.

```
Conversation so far:
<the running transcript, trimmed to the last 2500 characters>

Retrieved catalogue:
Front brake pad set, ceramic by Bosch, part number WP-BRK-1001, 48,500 naira,
42 in stock, 12 month warranty, fits Toyota Corolla 2015
<one line per genuinely fitting part, or an explicit statement that nothing matched>

Retrieved knowledge:
How payment and release works: <the policy article body>
<or an explicit statement that no article was retrieved>

Detected intent: parts_enquiry
Contact captured: no
Ticket reference raised: WP-2026-0042

Write the next reply from Wanner.
```

Two details matter. The catalogue block always says something, even when empty, so the model cannot interpret silence as permission to improvise. The transcript rather than the last message is supplied, so a customer who gives their vehicle in message one and their phone number in message four is understood as one person with one need.

4. Signal extraction

Deterministic, run over the whole transcript, before any model call.

Phone, the Nigerian pattern (?:\+?234|0)[\s-]?\d{3}[\s-]?\d{3}[\s-]?\d{4}, normalised to the international form.
Email, a standard address pattern.
Name, following my name is, I am, or this is.
Make and model, matched against the known lists.
Year, a four digit year between 1980 and 2049.
Part category, keyword mapped: brake, pad, disc to brakes; filter, air, cabin, fuel to filters; battery to battery; shock, absorber, strut to suspension; plug, spark to ignition; oil, lubricant to lubricants; alternator, starter to electrical; wiper, blade to body.

Intent is decided by priority so the strongest signal wins: complaint, then appointment, then payment, then fleet quote, then parts enquiry, otherwise general.

5. Tools, expressed as database actions

Wanner does not use free form tool calling. It performs a fixed sequence of actions whose order is itself the safety property.

lookupParts. Queries part_fitments on the make, narrows by model then by year range, and only then reads the matching parts, optionally filtered by category. If the vehicle is known and nothing fits, it returns nothing rather than a near miss.

searchKnowledge. Tag overlap against the knowledge base for policy questions on hours, payment, fitment, warranty, delivery and trade accounts.

upsertCustomer. Fires the moment a phone number or email appears. Matches on phone first, then email, and updates a placeholder name once the real one is known.

createTicket. Fires when a customer record exists and intent is commercial. Subject is built from intent and vehicle, priority is raised for complaints and fleet quotes, estimated value is the sum of the quoted parts, and the owner is the representative with the lightest live load.

bookAppointment. On appointment intent, holds a provisional slot for the next working morning and estimates the wait from the number of appointments already scheduled.

6. Behaviour without a model key

Every branch above is deterministic, so with no key configured the assistant still identifies the vehicle, retrieves genuinely fitting parts with real prices and stock, creates the customer, raises the ticket, books the slot and answers policy questions from the knowledge base. Only the phrasing changes: templated sentences instead of model prose. This is deliberate. The competition demonstration cannot depend on a third party API being reachable.

7. Worked example

Customer: I need front brake pads for a Toyota Corolla 2015.

Extraction gives make Toyota, model Corolla, year 2015, category brakes, intent parts_enquiry, no contact. Fitment lookup returns the ceramic pad set and the vented disc. No customer record is created because no contact was given, so no ticket yet. The reply quotes both parts with prices, stock and warranty, states they are checked against the fitment matrix, and asks for a phone number.

Customer: 08031234567, my name is Adeola.

Extraction now yields the phone and the name across the transcript. The customer is created or matched, a ticket is raised with subject Parts enquiry for Toyota Corolla 2015 and an estimated value equal to the quoted parts, and it is assigned to the lightest loaded representative. The reply gives the reference number and confirms follow up.

At that moment the branch has a permanent customer record, a numbered ticket with an owner and a deadline, and a representative who cannot close it without saying what happened. That is the difference between the assistant and a chat widget.
