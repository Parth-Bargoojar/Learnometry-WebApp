/**
 * Support topics for the in-app contact dialog (Help). Subjects match the website's
 * email-support modal so the inbox sorts the same way. Server-safe: the Help page
 * validates `?contact=` against these keys.
 */
export const SUPPORT_TOPICS = {
  problem: { label: "Something isn't working", subject: "Learnometry app: something isn't working", ask: "What happened, and on which screen:" },
  diagnostic: { label: "Diagnostic & study plan", subject: "Learnometry Help: Diagnostic Assessment & Study Plan", ask: "What I need help with:" },
  billing: { label: "Billing & refunds", subject: "Learnometry Support: Billing & Refund Inquiry", ask: "Plan, payment date and what I need:" },
  guardian: { label: "Parent or guardian", subject: "Learnometry Inquiry: Parent / Guardian Question", ask: "My question about consent, approvals or privacy:" },
  general: { label: "Something else", subject: "Learnometry Inquiry: General Question", ask: "My question:" },
} as const;

export type SupportTopic = keyof typeof SUPPORT_TOPICS;
