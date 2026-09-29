import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";
import { COST, PLANS } from "@/lib/config";
import { learner } from "@/lib/data";
import { REFUND_WINDOW_DAYS } from "@/lib/billing";
import { APPROVAL_DAYS, isMinor } from "@/lib/guardian";
import { SUPPORT_REPLY, siteUrl } from "@/lib/site";
import { Card, CardHeader } from "@/components/ui";
import { ContactSupport, HelpAnswers } from "@/components/help";
import { SUPPORT_TOPICS, type SupportTopic } from "@/lib/support";

export const metadata: Metadata = { title: "Help" };

/**
 * Help — Web App Structure §4.1: quick answers about the app, links to the website's
 * FAQ and policies, and the support email. Every number comes from config, so the
 * answers can't drift from the product rules.
 */
export default async function HelpPage(props: PageProps<"/help">) {
  const { contact } = await props.searchParams;
  const initialTopic = typeof contact === "string" && contact in SUPPORT_TOPICS ? (contact as SupportTopic) : undefined;
  const plan = PLANS[learner.plan];
  const guardianName = learner.guardian?.guardianFirstName;

  const answers = [
    {
      q: "How do credits work?",
      a:
        plan.period === "daily"
          ? `Your ${plan.name} pass gives you ${plan.periodCredits} credits a day, refilled at 00:00 IST; unused daily credits don't roll over. Every action that costs credits shows the cost before you tap it: a full diagnostic is ${COST.fullDiagnostic}, a practice set ${COST.practiceSet5}, a retest ${COST.retest}. Reading reports, solutions, your plan and progress is always free. We use the credits that expire soonest first.`
          : `On Free you get ${plan.periodCredits} credits on the 1st of each month. Every action that costs credits shows the cost before you tap it. Reading reports, solutions, your plan and progress is always free.`,
    },
    ...(isMinor(learner.dateOfBirth) && guardianName
      ? [
          {
            q: `Why does ${guardianName} need to approve purchases?`,
            a: `Until you turn 18, a parent or guardian approves and pays for every pass and credit pack. Requests last ${APPROVAL_DAYS} days, and you can see their status on your Billing page. ${guardianName} sees your scores and weak topics, never your answers or settings.`,
          },
        ]
      : []),
    {
      q: "What if I miss a day?",
      a: "Your plan re-prioritises instead of piling up a backlog. Tap \"Can't study today?\" on your plan: we spread today's tasks over the week and drop the lowest-yield practice if there isn't room. Your retest date stays the same, and it's free.",
    },
    {
      q: "How do I know a weak concept actually improved?",
      a: "A retest asks new questions on the same concepts. A concept counts as improved only when its score rises by at least 10 points on at least 3 retest questions. Finishing tasks alone never changes your mastery.",
    },
    {
      q: "Are my scores decided by AI?",
      a: "No. Scoring, answer checking and prerequisite ordering run on fixed rules on our servers. Where there is too little evidence to call a concept weak, your report says so instead of guessing.",
    },
    {
      q: "Can I get a refund?",
      a: `Within ${REFUND_WINDOW_DAYS} days of the first payment for a pass, if under 20% of that cycle's plan credits were used. Request it from Billing; we confirm within 2 business days and the money reaches the original payment method in 5–7 business days. If something didn't work on our side, we refund it regardless.`,
    },
  ];

  const links = [
    ["All FAQs", "/faq"],
    ["Refund policy", "/refunds"],
    ["Privacy policy", "/privacy"],
    ["Guardian consent", "/guardian-consent"],
    ["Terms", "/terms"],
  ];

  return (
    <div className="mx-auto flex max-w-[860px] flex-col gap-6">
      <section aria-labelledby="answers-h">
        <h2 id="answers-h" className="mb-3 text-lg font-semibold text-ink">
          Quick answers
        </h2>
        <HelpAnswers items={answers} />
      </section>

      <Card level="structural" className="p-5 sm:p-6" aria-labelledby="contact-h">
        <CardHeader id="contact-h" title="Still stuck?" meta={SUPPORT_REPLY} />
        <p className="mt-3 text-[15px] text-ink">Email us about anything: a question that looks wrong, a payment, consent or your data.</p>
        <div className="mt-4">
          <ContactSupport initialTopic={initialTopic} />
        </div>
      </Card>

      <nav aria-labelledby="more-h">
        <h2 id="more-h" className="text-sm font-semibold text-muted">
          On the Learnometry website
        </h2>
        <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
          {links.map(([l, path]) => (
            <li key={path}>
              <a href={siteUrl(path)} target="_blank" rel="noopener" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-primary-text underline underline-offset-4">
                {l}
                <ExternalLink aria-hidden="true" className="size-3.5" />
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
