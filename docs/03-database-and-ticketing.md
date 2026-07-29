# Phase 3. Database schema and ticketing logic

The full schema is in supabase/migrations. This document explains the shape and the rules it enforces.

1. Entity map

```
profiles (staff)
   |
   | owns
   v
customers ------< vehicles
   |  \
   |   \------< engagements        (after sales queue)
   |    \-----< loyalty_events     (points ledger)
   |
   +----< sales_tickets ----< ticket_events      (immutable trail)
   |            |
   |            v
   +----< orders ----< order_items >---- parts ----< part_fitments
                |
                v
            payments >---- bank_alerts
   |
   +----< conversations ----< messages
   +----< appointments
```

2. Core tables and the reason each exists

customers. The record the branch never had. Carries identity, type (individual, fleet, dealer, workshop), birthday for the greeting rule, marketing consent, loyalty tier and points, lifetime value, order count and last purchase date. Lifetime value and tier are maintained by trigger, never by application code, so they cannot drift.

vehicles. One customer has many. Holds battery fitted date with warranty months and next service due date. These two columns are what make the battery and service reminders possible; without them after sales is guesswork.

parts and part_fitments. The aftermarket difference. A part row is the item; fitment rows say which make, model and year range it fits. One ceramic brake pad set fits Corolla, Camry, Accord, Almera and Elantra across overlapping year ranges. The assistant queries fitments first and parts second, which is why it can promise fit rather than hope for it.

sales_tickets. Every enquiry, whatever the channel. Carries the number, the owner, the intent, the status, the priority, the estimated value, the service level deadline, the last activity timestamp, the escalation level and, on close, the outcome and lost reason.

ticket_events. Append only. Nothing updates or deletes here. This is the audit trail that answers the question the branch could not previously answer: what actually happened to that lead.

orders and order_items. An order carries a unique payment_reference, generated as WP plus six hexadecimal characters. That code is printed for the customer and is the single strongest matching signal in the payment engine.

bank_alerts. The raw credit alert as received, plus every field the parser extracted, the confidence and whether patterns or the model did the work. Keeping the raw text means a parser improvement can be replayed over history.

payments. What we expect, against which alerts are matched. Carries the score, the human readable reason, whether it was auto approved, and who confirmed it if not.

engagements. The after sales outbox. The unique deduplication key is the safety mechanism that makes the queueing job idempotent.

conversations and messages. The assistant transcript, linked to the customer and the ticket it produced.

3. Rules enforced in the database, not the application

Ticket numbering. A before insert trigger issues WP, the year and a zero padded sequence value. Concurrency safe because the sequence is a database object.

Service level target. The same trigger sets due_at from priority: urgent two hours, high six hours, normal twenty four hours, low forty eight hours.

Activity clock. Any insert into ticket_events updates last_update_at on the parent ticket. The escalation query therefore measures real activity, not the last time somebody opened the record.

Status history. An after update trigger writes a status_change event whenever status moves, with the from and to values. Nobody can move a ticket quietly.

Order numbering and payment reference. A before insert trigger issues both.

Paid order consequences. An after update trigger on orders fires when status becomes paid and, in one transaction, increments the customer order count, adds the order total to lifetime value, awards one loyalty point per thousand naira, recalculates the tier against the thresholds, writes the loyalty ledger entry, and queues the feedback request for two days later. Putting this in a trigger means it happens no matter which path marked the order paid, whether the automatic matcher, a finance confirmation or an import.

Loyalty tiers. Bronze below five hundred thousand naira lifetime, silver from five hundred thousand, gold from two million, platinum from five million.

4. The ticketing logic loop

The requirement was a mechanism that forces representatives to update status so no lead sits in a black box. It is enforced at four points.

Creation is automatic. The assistant raises the ticket the moment a commercial intent has contact details. A representative cannot fail to create one because they never create one.

Assignment is automatic and fair. The system counts live tickets per active representative and assigns to the lightest load. No lead sits unassigned waiting for a manager.

Closing is guarded. The update endpoint rejects a close with HTTP 422 unless an outcome is supplied, and rejects an outcome of lost unless a reason is supplied. A status change to any other state is rejected without a note. The representative cannot clear their queue by silently closing tickets.

Stalling is visible. Every hour the sweep finds tickets past their target with no activity for four hours, raises the escalation level, lifts the priority, and writes the reason into the trail. At the same time the representative receives one grouped email and management receives a summary. Escalation stops at level three, at which point the ticket is unmistakably a management problem.

The lifecycle, with the guard on each transition:

```
   open
    | note required
    v
   wip  ----------------+
    | note required     | no activity past target
    v                   v
 awaiting_payment    ESCALATION L1 -> L2 -> L3
    |                   | rep emailed, manager notified
    | payment matched   |
    v                   |
   closed <-------------+
    ^  outcome required: won, lost, no_response
    |  lost also requires a reason
    |
   lost
```

Reporting sits on two views. v_sales_leaderboard gives closed, open and overdue counts plus closed value per representative, which is the accountability picture management asked for. v_customer_of_the_year aggregates paid and released orders by customer and year, which is the loyalty picture.

5. Row level security

Every table has row level security enabled. Authenticated staff may select, insert and update. Delete is restricted to profiles whose role is admin or manager, checked with a subquery against the signed in user. The public assistant never uses a user token: it runs server side under the service role, so an anonymous visitor can create their own lead but cannot read the customer table.

6. Indexes

Trigram indexes on customer name, part name and knowledge base body support fuzzy search. Conventional indexes cover ticket status, ticket owner, payment status, bank alert reference and status, fitment part and lowered make, and the foreign keys used by the console pages.
