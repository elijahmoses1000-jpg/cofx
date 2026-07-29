import Link from 'next/link';
import { Bot, Ticket, BadgeCheck, HeartHandshake, ArrowRight, Wrench } from 'lucide-react';

const PILLARS = [
    {
        icon: Bot,
        title: 'AI customer routing',
        body: 'Wanner answers parts and service questions around the clock, quotes from the real fitment matrix, books workshop slots and hands warm leads to the right representative. No call goes unanswered.',
    },
    {
        icon: Ticket,
        title: 'Sales ticketing',
        body: 'Every enquiry becomes a numbered ticket with an owner and a service level target. The system refuses a close without an outcome, and escalates anything that stalls.',
    },
    {
        icon: BadgeCheck,
        title: 'Payment verification',
        body: 'Bank credit alerts are parsed and matched to expected payments by amount, reference code and sender. A confident match releases the goods in seconds instead of hours.',
    },
    {
        icon: HeartHandshake,
        title: 'CRM and after sales',
        body: 'One customer record carries vehicles, purchases and loyalty. Birthday, battery, service and feedback messages queue themselves, and the customer of the year is tracked all year.',
    },
];

export default function Home() {
    return (
        <div className="min-h-screen bg-graphite text-white">
            <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6">
                <div>
                    <div className="font-display text-2xl font-extrabold leading-none tracking-tight">
                        CO<span className="text-torque">F</span>X
                    </div>
                    <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.25em] text-white/45">
                        Wannerpart operations
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Link href="/assistant" className="rounded border border-white/20 px-4 py-2 text-sm font-semibold hover:border-torque hover:text-torque">
                        Try the assistant
                    </Link>
                    <Link href="/login" className="rounded bg-torque px-4 py-2 text-sm font-semibold hover:bg-torqueDark">
                        Staff sign in
                    </Link>
                </div>
            </header>

            <div className="stripe h-1.5 w-full" />

            <main className="mx-auto max-w-6xl px-5">
                <section className="grid gap-10 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:py-24">
                    <div>
                        <div className="mb-4 font-mono text-[11px] uppercase tracking-[0.3em] text-torque">
                            Independent aftermarket, one operating system
                        </div>
                        <h1 className="font-display text-5xl font-extrabold leading-[1.03] tracking-tight sm:text-6xl">
                            Every enquiry
                            <br />
                            answered, tracked
                            <br />
                            and closed.
                        </h1>
                        <p className="mt-6 max-w-lg text-[15px] leading-relaxed text-white/60">
                            COFX is the automated operating system for Wannerpart by COFX. It joins the assistant that
                            answers customers, the ticket that holds a representative accountable, the engine that verifies
                            payment from bank alerts, and the CRM that keeps a customer coming back. Built for the Nigeria
                            branch, designed to scale across COFX Africa.
                        </p>
                        <div className="mt-8 flex flex-wrap gap-3">
                            <Link href="/assistant" className="btn-primary">
                                Talk to Wanner <ArrowRight size={15} />
                            </Link>
                            <Link href="/login" className="rounded border border-white/20 px-4 py-2 text-sm font-semibold hover:border-torque">
                                Open the console
                            </Link>
                        </div>
                    </div>

                    <div className="card grid content-start gap-px overflow-hidden bg-hairline p-0 text-graphite">
                        <div className="bg-panel px-5 py-4">
                            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-mute">The bottleneck today</div>
                        </div>
                        {[
                            ['Missed calls', 'Customers ring when staff are on the floor and the enquiry is lost.'],
                            ['No feedback loop', 'Leads are handed out and nobody reports whether the deal closed.'],
                            ['Payment delay', 'Confirming one transfer takes hours of manual email checking before release.'],
                            ['No memory', 'Nothing retains the customer, the vehicle or the next service due.'],
                        ].map(([title, body]) => (
                            <div key={title} className="bg-panel px-5 py-4">
                                <div className="font-display text-sm font-bold">{title}</div>
                                <div className="mt-1 text-[13px] leading-relaxed text-steel">{body}</div>
                            </div>
                        ))}
                        <div className="bg-torque px-5 py-4 text-white">
                            <div className="flex items-center gap-2 font-display text-sm font-bold">
                                <Wrench size={15} /> COFX closes all four
                            </div>
                        </div>
                    </div>
                </section>

                <section className="grid gap-4 border-t border-white/10 py-14 sm:grid-cols-2">
                    {PILLARS.map((p) => (
                        <div key={p.title} className="rounded-lg border border-white/10 p-6">
                            <p.icon size={20} className="text-torque" />
                            <div className="mt-3 font-display text-lg font-bold">{p.title}</div>
                            <div className="mt-2 text-[13.5px] leading-relaxed text-white/55">{p.body}</div>
                        </div>
                    ))}
                </section>
            </main>

            <footer className="border-t border-white/10 py-6 text-center font-mono text-[11px] uppercase tracking-[0.25em] text-white/30">
                COFX operations platform. Wannerpart by COFX, Nigeria.
            </footer>
        </div>
    );
}
