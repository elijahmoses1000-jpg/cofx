/**
 * Language model access for COFX.
 *
 * Every module that calls the model must still work when no key is configured,
 * so each caller pairs a model call with a deterministic fallback. That keeps
 * the assistant, the payment parser and the playbooks usable out of the box.
 */

const API = 'https://api.anthropic.com/v1/messages';

export function modelAvailable(): boolean {
    return Boolean(process.env.ANTHROPIC_API_KEY);
}

export function modelName(): string {
    return process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';
}

/**
 * Strips machine formatting so nothing reaches a customer or a downloadable
 * document carrying hash headings, asterisk emphasis, code fences or rule
 * characters. COFX writes plain professional prose everywhere.
 */
export function scrub(input: string): string {
    let t = String(input || '');
    t = t.replace(/```[a-zA-Z0-9]*\n?/g, '');
    t = t.replace(/\*\*/g, '');
    t = t.replace(/^#{1,6}\s*/gm, '');
    t = t.replace(/#{2,}/g, '');
    t = t.replace(/[─-╿]{2,}/g, '');
    t = t.replace(/^\s*[*+]\s+/gm, '- ');
    t = t.replace(/`/g, '');
    return t.trim();
}

export const PLAIN_TEXT_CONTRACT =
    'Write plain professional business English. Never use markdown syntax of any kind: no hash headings, no double asterisks, no backticks, no pipe tables and no box drawing characters. Where a deliverable needs sections, write them as plain numbered lines such as 1. Summary, followed by short paragraphs and simple dash lists.';

interface GenerateOptions {
    system: string;
    prompt: string;
    maxTokens?: number;
    temperature?: number;
}

/** Returns model text, or null when no key is set or the call fails. */
export async function generate(opts: GenerateOptions): Promise<string | null> {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) return null;
    try {
        const res = await fetch(API, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'x-api-key': key,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
                model: modelName(),
                max_tokens: opts.maxTokens ?? 1600,
                temperature: opts.temperature ?? 0.4,
                system: opts.system + ' ' + PLAIN_TEXT_CONTRACT,
                messages: [{ role: 'user', content: opts.prompt }],
            }),
        });
        if (!res.ok) {
            console.error('model call failed', res.status, (await res.text()).slice(0, 400));
            return null;
        }
        const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
        const text = (data.content || [])
            .filter((c) => c.type === 'text')
            .map((c) => c.text || '')
            .join('\n');
        return text ? scrub(text) : null;
    } catch (err) {
        console.error('model call threw', err);
        return null;
    }
}
