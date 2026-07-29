export function naira(value: number | string | null | undefined): string {
    const n = Number(value || 0);
    return 'NGN ' + n.toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function shortDate(value: string | Date | null | undefined): string {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function dateTime(value: string | Date | null | undefined): string {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return (
        d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) +
        ' ' +
        d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    );
}

export function sinceNow(value: string | Date | null | undefined): string {
    if (!value) return '—';
    const then = new Date(value).getTime();
    if (Number.isNaN(then)) return '—';
    const mins = Math.round((Date.now() - then) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + ' min ago';
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return hrs + (hrs === 1 ? ' hour ago' : ' hours ago');
    const days = Math.round(hrs / 24);
    return days + (days === 1 ? ' day ago' : ' days ago');
}

export function normalisePhone(raw: string): string {
    const digits = String(raw || '').replace(/[^\d+]/g, '');
    if (digits.startsWith('+234')) return digits;
    if (digits.startsWith('234')) return '+' + digits;
    if (digits.startsWith('0') && digits.length >= 11) return '+234' + digits.slice(1);
    return digits;
}

export const STATUS_LABEL: Record<string, string> = {
    open: 'Open',
    wip: 'Work in progress',
    awaiting_payment: 'Awaiting payment',
    closed: 'Closed',
    lost: 'Lost',
};

export const STATUS_STYLE: Record<string, string> = {
    open: 'bg-torque/10 text-torqueDark border-torque/30',
    wip: 'bg-caution/10 text-caution border-caution/30',
    awaiting_payment: 'bg-slateInk/10 text-slateInk border-slateInk/25',
    closed: 'bg-signal/10 text-signal border-signal/30',
    lost: 'bg-alert/10 text-alert border-alert/30',
};
