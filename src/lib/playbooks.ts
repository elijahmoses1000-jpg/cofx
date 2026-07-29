/**
 * Playbooks are the knowledge work skills from the COFX plugin library
 * (github.com/elijahmoses1000-jpg/knowledge-work-plugins), curated down to the
 * workflows that matter to an aftermarket parts branch and re-pointed at
 * Wannerpart's own data and language.
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
];

export const PLAYBOOKS: Playbook[] = [
    {
        id: 'sales/pipeline-review',
        group: 'sales',
        name: 'Pipeline review',
        purpose: 'Assess every live ticket, flag what is slipping and set the next action per deal.',
        charter: 'Review the open sales pipeline, identify at risk and stalled opportunities, and produce a prioritised action list per sales representative.',
    },
    {
        id: 'sales/forecast',
        group: 'sales',
        name: 'Sales forecast',
        purpose: 'Turn the current pipeline into a committed, probable and upside forecast.',
        charter: 'Build a sales forecast from the pipeline with committed, probable and upside bands, stated assumptions and the risks that would change the number.',
    },
    {
        id: 'sales/account-research',
        group: 'sales',
        name: 'Account research',
        purpose: 'Brief a representative before they approach a fleet, workshop or dealer account.',
        charter: 'Research and brief a trade account: their likely vehicle mix, parts consumption pattern, buying triggers and the opening offer that fits them.',
    },
    {
        id: 'sales/call-prep',
        group: 'sales',
        name: 'Call preparation',
        purpose: 'Prepare talking points, objections and the ask before a customer call.',
        charter: 'Prepare a sales call: objective, opening, three discovery questions, likely objections with responses, and a specific close.',
    },
    {
        id: 'sales/draft-outreach',
        group: 'sales',
        name: 'Outreach message',
        purpose: 'Write the follow up that actually gets a reply.',
        charter: 'Draft a short outreach message for a parts or fleet prospect, with a clear reason for contact and one specific call to action.',
    },
    {
        id: 'sales/quote-builder',
        group: 'sales',
        name: 'Quotation builder',
        purpose: 'Turn an enquiry into a clean, priced quotation the customer can approve.',
        charter: 'Build a customer quotation from the enquiry: line items with part numbers and prices, fitment confirmation, validity period, payment reference instruction and next step.',
    },
    {
        id: 'support/ticket-triage',
        group: 'support',
        name: 'Ticket triage',
        purpose: 'Sort incoming tickets by urgency, intent and the right owner.',
        charter: 'Triage incoming customer tickets: assign intent, urgency and owner, and state the first action for each with a target response time.',
    },
    {
        id: 'support/handle-complaint',
        group: 'support',
        name: 'Complaint handling',
        purpose: 'Resolve a complaint and protect the relationship.',
        charter: 'Handle a customer complaint: acknowledge the issue, establish the facts to confirm, set out the resolution options with cost implications, and draft the reply to the customer.',
    },
    {
        id: 'support/draft-response',
        group: 'support',
        name: 'Customer response',
        purpose: 'Write a clear reply to a customer question or issue.',
        charter: 'Draft a customer response that answers the question directly, states what happens next and by when, in warm plain language.',
    },
    {
        id: 'support/kb-article',
        group: 'support',
        name: 'Knowledge base article',
        purpose: 'Turn a resolved issue into an article the assistant can reuse.',
        charter: 'Write a knowledge base article from a resolved issue: the question in customer words, the answer, the exceptions, and the tags it should carry.',
    },
    {
        id: 'finance/reconciliation',
        group: 'finance',
        name: 'Payment reconciliation',
        purpose: 'Explain unmatched credits and what to do with each one.',
        charter: 'Reconcile bank credit alerts against expected payments: list matched, partially matched and unexplained items, and give the action needed to clear each exception.',
    },
    {
        id: 'finance/invoice-chase',
        group: 'finance',
        name: 'Invoice chase',
        purpose: 'Chase outstanding payments without damaging the relationship.',
        charter: 'Produce a collection plan for outstanding orders: who to contact, in what order, with the message for each stage of lateness.',
    },
    {
        id: 'finance/margin-analyzer',
        group: 'finance',
        name: 'Margin analysis',
        purpose: 'Find where margin is leaking across the parts range.',
        charter: 'Analyse margin by part category and customer type, identify where discounting or cost has eroded margin, and recommend specific pricing actions.',
    },
    {
        id: 'finance/cash-flow-snapshot',
        group: 'finance',
        name: 'Cash position snapshot',
        purpose: 'Show what is confirmed, what is pending and what is at risk.',
        charter: 'Summarise the cash position: confirmed receipts, payments awaiting verification, exposure from released goods and the actions that would improve the position this week.',
    },
    {
        id: 'marketing/campaign-plan',
        group: 'marketing',
        name: 'Campaign plan',
        purpose: 'Plan a promotion for a part line, season or customer segment.',
        charter: 'Plan a marketing campaign: audience segment, offer, channels, message per channel, timeline and the measure of success.',
    },
    {
        id: 'marketing/email-sequence',
        group: 'marketing',
        name: 'Retention sequence',
        purpose: 'Write the after sales sequence that brings a customer back.',
        charter: 'Write an after sales message sequence with the timing, purpose and full text of each message, aimed at the next service or replacement cycle.',
    },
    {
        id: 'marketing/customer-pulse',
        group: 'marketing',
        name: 'Customer pulse',
        purpose: 'Read the mood of the base from feedback and tickets.',
        charter: 'Summarise customer sentiment from recent feedback and tickets: what customers praise, what they complain about, and the two changes that would move satisfaction most.',
    },
    {
        id: 'marketing/loyalty-review',
        group: 'marketing',
        name: 'Loyalty and customer of the year',
        purpose: 'Rank high value customers and design the reward.',
        charter: 'Review loyalty standings: rank customers by value and consistency, nominate a customer of the year with the evidence, and propose the reward tiers for next year.',
    },
    {
        id: 'operations/stock-plan',
        group: 'operations',
        name: 'Stock and reorder plan',
        purpose: 'Decide what to reorder and what is sitting still.',
        charter: 'Produce a stock plan: lines below reorder level, fast and slow movers, and the recommended purchase quantities with the reasoning.',
    },
    {
        id: 'operations/process-doc',
        group: 'operations',
        name: 'Process document',
        purpose: 'Write down how a branch process actually runs.',
        charter: 'Document a branch process: purpose, trigger, step by step actions with owners, exceptions, and the controls that prevent the common failure.',
    },
    {
        id: 'operations/runbook',
        group: 'operations',
        name: 'Operational runbook',
        purpose: 'Give staff a checklist for a recurring or emergency task.',
        charter: 'Write an operational runbook: preconditions, numbered steps, what to check after each step, rollback actions and who to escalate to.',
    },
    {
        id: 'operations/status-report',
        group: 'operations',
        name: 'Branch status report',
        purpose: 'Report the state of the branch to management.',
        charter: 'Write a branch status report: results against target, pipeline health, payment exceptions, stock risks, and the decisions needed from management.',
    },
    {
        id: 'insight/analyze',
        group: 'insight',
        name: 'Data analysis',
        purpose: 'Interpret a dataset and say what it means.',
        charter: 'Analyse the supplied data: describe what it shows, quantify the notable patterns, state the limitations, and give the decision it supports.',
    },
    {
        id: 'insight/build-dashboard',
        group: 'insight',
        name: 'Dashboard specification',
        purpose: 'Define the metrics and layout for a management view.',
        charter: 'Specify a dashboard: the questions it answers, the metric definitions, the visual for each, the filters, and the refresh cadence.',
    },
    {
        id: 'insight/competitive-brief',
        group: 'insight',
        name: 'Competitive brief',
        purpose: 'Position Wannerpart against alternative parts channels.',
        charter: 'Write a competitive brief comparing Wannerpart against original equipment counters and open market sellers on price, availability, warranty and trust, and give the sales positioning that follows.',
    },
];

export function playbookById(id: string): Playbook | undefined {
    return PLAYBOOKS.find((p) => p.id === id);
}
