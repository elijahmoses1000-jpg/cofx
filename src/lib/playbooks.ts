/**
 * Playbooks are the knowledge work workflows from the COFX plugin library
 * (github.com/elijahmoses1000-jpg/knowledge-work-plugins), curated to what an
 * independent aftermarket parts branch actually does and rewritten in
 * Wannerpart's own terms.
 *
 * Each one runs against a live snapshot of branch data: open tickets, the
 * payment queue, stock levels and the customer base. The charter is what the
 * engine is told to produce.
 */

export interface Playbook {
    id: string;
    group: string;
    name: string;
    purpose: string;
    charter: string;
}

export const PLAYBOOK_GROUPS = [
    { id: 'sales', name: 'Sales and pipeline' },
    { id: 'support', name: 'Customer support' },
    { id: 'finance', name: 'Finance and payments' },
    { id: 'marketing', name: 'Marketing and retention' },
    { id: 'operations', name: 'Operations and stock' },
    { id: 'insight', name: 'Data and insight' },
    { id: 'people', name: 'People and hiring' },
    { id: 'legal', name: 'Legal and compliance' },
    { id: 'knowledge', name: 'Briefings and planning' },
];

export const PLAYBOOKS: Playbook[] = [
    // Sales and pipeline
    {
        id: 'sales/pipeline-review',
        group: 'sales',
        name: 'Pipeline review',
        purpose: 'Assess every live ticket, flag what is slipping and set the next action per deal.',
        charter: 'Review the open pipeline ticket by ticket. Identify what is stalled, what is at risk of being lost and what can be closed this week, and give each representative a prioritised action list with the reason for the ranking.',
    },
    {
        id: 'sales/forecast',
        group: 'sales',
        name: 'Sales forecast',
        purpose: 'Turn the current pipeline into a committed, probable and upside number.',
        charter: 'Build a forecast from the live pipeline with committed, probable and upside bands. State the assumptions behind each band, show the gap to target, and name the specific deals that would close the gap.',
    },
    {
        id: 'sales/quote-builder',
        group: 'sales',
        name: 'Quotation builder',
        purpose: 'Turn an enquiry into a priced quotation the customer can approve.',
        charter: 'Build a customer quotation from the enquiry: line items with part numbers and prices, confirmation that each part fits the stated vehicle, the total, the validity period, the payment reference instruction and the next step.',
    },
    {
        id: 'sales/fitment-advisor',
        group: 'sales',
        name: 'Fitment advisor',
        purpose: 'Work out what fits a vehicle and what should be offered alongside it.',
        charter: 'For the stated make, model and year, list every part in range that fits, flag the companion items normally replaced at the same time, note anything that commonly gets ordered wrongly for this vehicle, and give the counter a short script for the additional sale.',
    },
    {
        id: 'sales/account-research',
        group: 'sales',
        name: 'Trade account research',
        purpose: 'Brief a representative before they approach a fleet, workshop or dealer.',
        charter: 'Profile a trade prospect: their likely vehicle mix, the parts they will consume and how often, what would make them switch supplier, the opening offer that fits them and the two questions that will qualify them fastest.',
    },
    {
        id: 'sales/call-prep',
        group: 'sales',
        name: 'Call preparation',
        purpose: 'Prepare the objective, questions and close before a customer call.',
        charter: 'Prepare a customer call: the objective, an opening line, three discovery questions, the likely objections with a response to each, and a specific close with a fallback if the customer will not commit today.',
    },
    {
        id: 'sales/call-summary',
        group: 'sales',
        name: 'Call summary',
        purpose: 'Turn rough call notes into a record, actions and a follow up.',
        charter: 'Convert call notes into a clean summary: what the customer needs, what was agreed, the actions with owners and dates, and a short follow up message ready to send.',
    },
    {
        id: 'sales/draft-outreach',
        group: 'sales',
        name: 'Outreach message',
        purpose: 'Write the follow up that actually gets a reply.',
        charter: 'Draft a short outreach message to a parts or fleet prospect with a specific reason for making contact, one piece of evidence that Wannerpart can help, and a single clear call to action.',
    },
    {
        id: 'sales/lead-triage',
        group: 'sales',
        name: 'Lead triage',
        purpose: 'Rank the leads worth calling today and say what to open with.',
        charter: 'Score the current open enquiries by value, urgency and likelihood of closing. Produce a ranked call list for today with the opening line and the decision each call is trying to reach.',
    },
    {
        id: 'sales/daily-briefing',
        group: 'sales',
        name: 'Daily sales briefing',
        purpose: 'Start the day knowing what matters and what is late.',
        charter: 'Write the morning briefing for the sales floor: what closed yesterday, what is past its service level target, the highest value items open today, and the three things that need a decision before close of business.',
    },

    // Customer support
    {
        id: 'support/ticket-triage',
        group: 'support',
        name: 'Ticket triage',
        purpose: 'Sort incoming tickets by urgency, intent and the right owner.',
        charter: 'Triage the open tickets: assign an intent and an urgency to each, name the right owner, state the first action and the target response time, and separate anything that needs a manager now.',
    },
    {
        id: 'support/handle-complaint',
        group: 'support',
        name: 'Complaint handling',
        purpose: 'Resolve a complaint and keep the customer.',
        charter: 'Handle a customer complaint: acknowledge the issue plainly, set out the facts that need confirming, give the resolution options with their cost and time implications, recommend one, and draft the reply to the customer.',
    },
    {
        id: 'support/customer-escalation',
        group: 'support',
        name: 'Escalation brief',
        purpose: 'Give a manager what they need before they pick up the phone.',
        charter: 'Prepare an escalation brief: the history in date order, where the service failed, what the customer has been told so far, the commercial exposure, and the recommended resolution with the authority needed to approve it.',
    },
    {
        id: 'support/draft-response',
        group: 'support',
        name: 'Customer response',
        purpose: 'Write a clear reply to a customer question or issue.',
        charter: 'Draft a customer response that answers the question directly, states what happens next and by when, and avoids any promise on delivery, price or warranty that the branch has not confirmed.',
    },
    {
        id: 'support/kb-article',
        group: 'support',
        name: 'Knowledge base article',
        purpose: 'Turn a resolved issue into an article the assistant can reuse.',
        charter: 'Write a knowledge base article from a resolved issue: the question in the customer own words, the answer, the exceptions and edge cases, and the tags it should carry so the assistant retrieves it correctly.',
    },
    {
        id: 'support/ticket-deflector',
        group: 'support',
        name: 'Deflection review',
        purpose: 'Find the questions the assistant should be answering without a human.',
        charter: 'Review recent tickets for questions that repeat. Identify which could be answered by the assistant from the knowledge base, draft the missing articles, and estimate the volume each would remove from the counter.',
    },

    // Finance and payments
    {
        id: 'finance/reconciliation',
        group: 'finance',
        name: 'Payment reconciliation',
        purpose: 'Explain unmatched credits and what to do with each one.',
        charter: 'Reconcile the bank alerts against expected payments. List what matched, what partially matched and what cannot be explained, and give the specific action needed to clear each exception.',
    },
    {
        id: 'finance/cash-flow-snapshot',
        group: 'finance',
        name: 'Cash position snapshot',
        purpose: 'Show what is confirmed, what is pending and what is exposed.',
        charter: 'Summarise the cash position: confirmed receipts, payments still awaiting verification, goods released against unconfirmed payment, and the actions that would improve the position this week.',
    },
    {
        id: 'finance/invoice-chase',
        group: 'finance',
        name: 'Collection plan',
        purpose: 'Chase what is owed without damaging the relationship.',
        charter: 'Produce a collection plan for outstanding orders: who to contact and in what order, the message for each stage of lateness, and the point at which supply should be paused.',
    },
    {
        id: 'finance/margin-analyzer',
        group: 'finance',
        name: 'Margin analysis',
        purpose: 'Find where margin is leaking across the range.',
        charter: 'Analyse margin by part category, brand and customer type using cost against selling price. Identify where discounting or cost movement has eroded margin and recommend specific pricing actions with the expected effect.',
    },
    {
        id: 'finance/price-check',
        group: 'finance',
        name: 'Price review',
        purpose: 'Decide which prices should move and by how much.',
        charter: 'Review current pricing against cost and stock movement. Flag lines priced below a sensible margin, lines where a rise is safe and lines where a cut would move dead stock, with the reasoning for each.',
    },
    {
        id: 'finance/variance-analysis',
        group: 'finance',
        name: 'Variance analysis',
        purpose: 'Explain why the numbers differ from plan.',
        charter: 'Compare actual performance against the stated plan or prior period. Quantify each variance, separate volume effects from price effects, and explain the operational cause of the largest three.',
    },
    {
        id: 'finance/close-management',
        group: 'finance',
        name: 'Month end close',
        purpose: 'Run the close without anything being missed.',
        charter: 'Produce the month end close plan: the tasks in dependency order with owners and deadlines, the reconciliations that must balance, the items likely to hold the close up, and the sign off checklist.',
    },
    {
        id: 'finance/journal-entry',
        group: 'finance',
        name: 'Journal entry preparation',
        purpose: 'Draft the entries with their supporting rationale.',
        charter: 'Prepare journal entries for the described transactions: the accounts, the amounts, the direction, the supporting explanation for each, and the reversal treatment where one applies.',
    },
    {
        id: 'finance/audit-support',
        group: 'finance',
        name: 'Audit support pack',
        purpose: 'Assemble what an auditor will ask for before they ask.',
        charter: 'Prepare an audit support pack: the documents and reconciliations to gather, the controls evidence around payment verification and goods release, and clear answers to the questions this process usually attracts.',
    },

    // Marketing and retention
    {
        id: 'marketing/campaign-plan',
        group: 'marketing',
        name: 'Campaign plan',
        purpose: 'Plan a promotion for a part line, season or customer segment.',
        charter: 'Plan a marketing campaign: the audience segment and why it was chosen, the offer, the channels with the message for each, the timeline, the budget shape and the measure that will decide whether it worked.',
    },
    {
        id: 'marketing/email-sequence',
        group: 'marketing',
        name: 'Retention sequence',
        purpose: 'Write the after sales sequence that brings a customer back.',
        charter: 'Write an after sales message sequence with the timing, purpose and full text of each message, aimed at the next service or replacement cycle for the stated vehicle or part type.',
    },
    {
        id: 'marketing/content-creation',
        group: 'marketing',
        name: 'Content piece',
        purpose: 'Write something customers will actually find useful.',
        charter: 'Write a customer facing content piece on the given topic in plain language, accurate to the parts and services Wannerpart actually offers, with a natural call to action at the end.',
    },
    {
        id: 'marketing/customer-pulse',
        group: 'marketing',
        name: 'Customer pulse',
        purpose: 'Read the mood of the base from feedback and tickets.',
        charter: 'Summarise customer sentiment from recent feedback and tickets: what customers praise, what they complain about most often, which complaints are growing, and the two changes that would move satisfaction most.',
    },
    {
        id: 'marketing/loyalty-review',
        group: 'marketing',
        name: 'Loyalty and customer of the year',
        purpose: 'Rank the best customers and design the reward.',
        charter: 'Review loyalty standings: rank customers by value and consistency rather than a single large order, nominate a customer of the year with the evidence, and propose reward tiers for next year with their cost.',
    },
    {
        id: 'marketing/performance-report',
        group: 'marketing',
        name: 'Marketing performance report',
        purpose: 'Say what the marketing spend actually produced.',
        charter: 'Report on marketing performance: what ran, what it cost, the enquiries and orders attributable to it, the cost per acquired customer, and what should be repeated or stopped.',
    },
    {
        id: 'marketing/brand-review',
        group: 'marketing',
        name: 'Brand and message review',
        purpose: 'Check that how the branch presents itself matches what it sells.',
        charter: 'Review the branch messaging for consistency and credibility: whether the aftermarket proposition is stated clearly, where the language overpromises, and the corrections that would make it more convincing to a workshop buyer.',
    },

    // Operations and stock
    {
        id: 'operations/stock-plan',
        group: 'operations',
        name: 'Stock and reorder plan',
        purpose: 'Decide what to reorder and what is sitting still.',
        charter: 'Produce a stock plan from live levels: lines at or below reorder point, fast and slow movers, cash tied up in dead stock, and recommended purchase quantities with the reasoning for each.',
    },
    {
        id: 'operations/capacity-plan',
        group: 'operations',
        name: 'Workshop capacity plan',
        purpose: 'Match the bays and the people to the work coming in.',
        charter: 'Plan workshop capacity against the booked and expected work: where the bottleneck falls, the effect on customer waiting time, and the staffing or scheduling changes that would relieve it.',
    },
    {
        id: 'operations/process-doc',
        group: 'operations',
        name: 'Process document',
        purpose: 'Write down how a branch process actually runs.',
        charter: 'Document a branch process: its purpose, the trigger, the steps in order with owners, the exceptions and how they are handled, and the controls that prevent the failure this process is prone to.',
    },
    {
        id: 'operations/runbook',
        group: 'operations',
        name: 'Operational runbook',
        purpose: 'Give staff a checklist for a recurring or urgent task.',
        charter: 'Write an operational runbook: the preconditions, the numbered steps, what to verify after each, what to do when a step fails, and who to escalate to with the threshold for doing so.',
    },
    {
        id: 'operations/process-optimization',
        group: 'operations',
        name: 'Process improvement',
        purpose: 'Find the wasted time in how the branch works.',
        charter: 'Examine the described process for waste: the steps that add no value, the handoffs that cause delay, the rework loops, and the three changes that would save the most time with the least disruption.',
    },
    {
        id: 'operations/vendor-review',
        group: 'operations',
        name: 'Supplier review',
        purpose: 'Judge whether a supplier is earning their place.',
        charter: 'Review a supplier on price, lead time, fill rate, quality and warranty support. State where they are strong and weak, the questions to put to them, and whether to keep, renegotiate or replace.',
    },
    {
        id: 'operations/risk-assessment',
        group: 'operations',
        name: 'Risk assessment',
        purpose: 'Name what could go wrong and what to do about it.',
        charter: 'Assess the risks in the described situation: what could go wrong, how likely and how damaging, the early warning sign for each, and the mitigation with an owner.',
    },
    {
        id: 'operations/status-report',
        group: 'operations',
        name: 'Branch status report',
        purpose: 'Report the state of the branch to management.',
        charter: 'Write a branch status report: results against target, pipeline health, payment exceptions, stock risks, service level performance, and the decisions needed from management with a recommendation on each.',
    },

    // Data and insight
    {
        id: 'insight/analyze',
        group: 'insight',
        name: 'Data analysis',
        purpose: 'Interpret the numbers and say what they mean.',
        charter: 'Analyse the supplied data: describe what it shows, quantify the notable patterns, state clearly what the data cannot tell us, and give the decision it supports.',
    },
    {
        id: 'insight/business-pulse',
        group: 'insight',
        name: 'Business pulse',
        purpose: 'One read of how the branch is actually doing.',
        charter: 'Give a single readout of branch health across sales, payment verification, stock and customer retention. Lead with the number that matters most this week and what is driving it.',
    },
    {
        id: 'insight/build-dashboard',
        group: 'insight',
        name: 'Dashboard specification',
        purpose: 'Define the metrics and layout for a management view.',
        charter: 'Specify a dashboard: the questions it must answer, the definition and calculation of each metric, the visual for each, the filters, the refresh cadence and what should trigger an alert.',
    },
    {
        id: 'insight/quarterly-review',
        group: 'insight',
        name: 'Quarterly review',
        purpose: 'Step back and judge the quarter honestly.',
        charter: 'Review the quarter: what was achieved against what was intended, the trends in sales, margin and retention, what went wrong and why, and the three priorities for the quarter ahead.',
    },
    {
        id: 'insight/competitive-position',
        group: 'insight',
        name: 'Aftermarket positioning',
        purpose: 'Position Wannerpart against the counter and the open market.',
        charter: 'Compare Wannerpart against original equipment counters and open market sellers on price, availability, warranty and trust. Give the positioning statement and the response to the objections each competitor type creates.',
    },
    {
        id: 'insight/validate-data',
        group: 'insight',
        name: 'Data quality check',
        purpose: 'Find what is wrong in the records before it misleads someone.',
        charter: 'Check the data for quality problems: missing fields, duplicates, values that cannot be right, and records that contradict each other. Rank the problems by how much damage they would cause and give the fix for each.',
    },

    // People and hiring
    {
        id: 'people/onboarding',
        group: 'people',
        name: 'Onboarding plan',
        purpose: 'Get a new joiner productive without hand holding.',
        charter: 'Build an onboarding plan for the stated role: what they must learn in the first week, month and quarter, who they should meet, the systems and access they need, and how their progress will be judged.',
    },
    {
        id: 'people/job-post-builder',
        group: 'people',
        name: 'Job advertisement',
        purpose: 'Write a role advertisement that attracts the right people.',
        charter: 'Write a job advertisement for the stated role: what the job actually involves day to day, what the person must be able to do, what is offered in return, and how to apply.',
    },
    {
        id: 'people/interview-prep',
        group: 'people',
        name: 'Interview preparation',
        purpose: 'Know what to ask and what a good answer sounds like.',
        charter: 'Prepare an interview for the stated role: the competencies to test, two questions per competency, what a strong and a weak answer looks like for each, and a scoring approach.',
    },
    {
        id: 'people/performance-review',
        group: 'people',
        name: 'Performance review',
        purpose: 'Assess a member of staff fairly and usefully.',
        charter: 'Prepare a performance review: what the person achieved against expectation, the evidence, where they are strong, the one thing that would most improve their performance, and the development actions with dates.',
    },
    {
        id: 'people/people-report',
        group: 'people',
        name: 'Team performance report',
        purpose: 'Show how the sales floor is performing and where it is thin.',
        charter: 'Report on team performance using ticket ownership, closure rates, service level breaches and closed value. Identify who is overloaded, who needs support and where the coverage gap sits.',
    },

    // Legal and compliance
    {
        id: 'legal/review-contract',
        group: 'legal',
        name: 'Contract review',
        purpose: 'Find what is unfavourable before it is signed.',
        charter: 'Review the contract: what it obliges each side to do, the clauses that are unfavourable or unusual, the missing protections, the commercial risk in plain terms, and the specific changes to ask for.',
    },
    {
        id: 'legal/triage-nda',
        group: 'legal',
        name: 'NDA triage',
        purpose: 'Decide quickly whether an NDA can be signed as it stands.',
        charter: 'Triage a non disclosure agreement: whether it is mutual, the duration and scope, anything unusual in the definitions or carve outs, and a recommendation to sign, amend or refuse with the reasoning.',
    },
    {
        id: 'legal/compliance-check',
        group: 'legal',
        name: 'Compliance check',
        purpose: 'Check a practice against the rules that govern it.',
        charter: 'Check the described practice against the applicable obligations, including consumer protection, warranty and data handling duties. State where it complies, where it does not, and the remediation needed.',
    },
    {
        id: 'legal/vendor-check',
        group: 'legal',
        name: 'Supplier due diligence',
        purpose: 'Know who you are dealing with before you commit.',
        charter: 'Set out the due diligence for a supplier: what to verify about their legal standing and capacity, the documents to request, the contractual protections to insist on, and the warning signs that should stop the deal.',
    },
    {
        id: 'legal/legal-risk-assessment',
        group: 'legal',
        name: 'Legal risk assessment',
        purpose: 'Understand the exposure before making the decision.',
        charter: 'Assess the legal risk in the described situation: the exposure, how likely it is to materialise, the cost if it does, the mitigations available, and whether the decision should proceed.',
    },

    // Briefings and planning
    {
        id: 'knowledge/monday-brief',
        group: 'knowledge',
        name: 'Monday brief',
        purpose: 'Set the week with what matters and who owns it.',
        charter: 'Write the Monday brief: what carried over from last week, the priorities for this week with owners, the customers and payments needing attention, and the one outcome that would make the week a success.',
    },
    {
        id: 'knowledge/friday-brief',
        group: 'knowledge',
        name: 'Friday brief',
        purpose: 'Close the week honestly and set up the next.',
        charter: 'Write the Friday brief: what was achieved, what slipped and why, the numbers for the week, anything a customer is still waiting on, and what must be picked up first on Monday.',
    },
    {
        id: 'knowledge/knowledge-synthesis',
        group: 'knowledge',
        name: 'Knowledge synthesis',
        purpose: 'Pull scattered information into one usable answer.',
        charter: 'Synthesise the supplied material into a single coherent answer: what is consistently true, where sources disagree and which to trust, what is missing, and the conclusion it supports.',
    },
    {
        id: 'knowledge/stakeholder-update',
        group: 'knowledge',
        name: 'Management update',
        purpose: 'Tell leadership what they need to know without the noise.',
        charter: 'Write an update for management: the position in one paragraph, progress against what was promised, the risks with what is being done about them, and anything needing a decision from them.',
    },
];

export function playbookById(id: string): Playbook | undefined {
    return PLAYBOOKS.find((p) => p.id === id);
}

export function playbooksByGroup(group: string): Playbook[] {
    return PLAYBOOKS.filter((p) => p.group === group);
}
