import { conceptById, concepts, planTasks } from "./data";

const SETTINGS_TITLES: Record<string, string> = {
  profile: "Profile",
  study: "Study setup",
  notifications: "Notifications",
  appearance: "Appearance",
  ai: "Explanation engine",
  privacy: "Privacy & data",
  account: "Account",
};

interface RouteInfo {
  title: string;
  /** Parent page for the mobile Back button; absent on top-level destinations. */
  parent?: { href: string; label: string };
  section: string;
}

const rules: [RegExp, (m: RegExpExecArray) => RouteInfo][] = [
  [/^\/dashboard$/, () => ({ title: "Home", section: "/dashboard" })],
  [/^\/assess$/, () => ({ title: "Assess", section: "/assess" })],
  [/^\/assess\/diagnostic$/, () => ({ title: "Physics diagnostic", section: "/assess", parent: { href: "/assess", label: "Assess" } })],
  [/^\/assess\/results\/([^/]+)\/review$/, (m) => ({ title: "Answer review", section: "/assess", parent: { href: `/assess/results/${m[1]}`, label: "Report" } })],
  [/^\/assess\/results\/([^/]+)$/, () => ({ title: "Diagnostic report", section: "/assess", parent: { href: "/assess", label: "Assess" } })],
  [/^\/assess\/retests\/([^/]+)\/result$/, () => ({ title: "Retest result", section: "/assess", parent: { href: "/assess", label: "Assess" } })],
  [/^\/assess\/retests\/([^/]+)$/, () => ({ title: "Retest", section: "/assess", parent: { href: "/assess", label: "Assess" } })],
  [/^\/practice$/, () => ({ title: "Practice", section: "/practice" })],
  [/^\/practice\/new$/, () => ({ title: "New practice set", section: "/practice", parent: { href: "/practice", label: "Practice" } })],
  [/^\/practice\/results\/([^/]+)$/, () => ({ title: "Practice results", section: "/practice", parent: { href: "/practice", label: "Practice" } })],
  [/^\/plan$/, () => ({ title: "Plan", section: "/plan" })],
  [/^\/plan\/history$/, () => ({ title: "Previous plans", section: "/plan", parent: { href: "/plan", label: "Plan" } })],
  [
    /^\/plan\/tasks\/([^/]+)$/,
    (m) => {
      const task = planTasks.find((t) => t.id === m[1]);
      return { title: task ? conceptById(task.conceptId).name : "Task", section: "/plan", parent: { href: "/plan", label: "Plan" } };
    },
  ],
  [/^\/progress$/, () => ({ title: "Progress", section: "/progress" })],
  [/^\/progress\/history$/, () => ({ title: "History", section: "/progress", parent: { href: "/progress", label: "Progress" } })],
  [/^\/progress\/concepts$/, () => ({ title: "All concepts", section: "/progress", parent: { href: "/progress", label: "Progress" } })],
  [
    /^\/progress\/concepts\/([^/]+)$/,
    (m) => ({
      title: concepts.find((c) => c.id === m[1])?.name ?? "Concept",
      section: "/progress",
      parent: { href: "/progress/concepts", label: "All concepts" },
    }),
  ],
  [/^\/credits$/, () => ({ title: "Credits", section: "/credits" })],
  [/^\/credits\/buy$/, () => ({ title: "Get credits", section: "/credits", parent: { href: "/credits", label: "Credits" } })],
  [/^\/billing$/, () => ({ title: "Billing", section: "/billing" })],
  [/^\/billing\/plans$/, () => ({ title: "Plans", section: "/billing", parent: { href: "/billing", label: "Billing" } })],
  [/^\/billing\/confirm$/, () => ({ title: "Payment", section: "/billing", parent: { href: "/billing", label: "Billing" } })],
  [/^\/settings$/, () => ({ title: "Settings", section: "/settings" })],
  [
    /^\/settings\/([a-z]+)$/,
    (m) => ({ title: SETTINGS_TITLES[m[1]] ?? "Settings", section: "/settings", parent: { href: "/settings", label: "Settings" } }),
  ],
  [/^\/help$/, () => ({ title: "Help", section: "/help" })],
  [/^\/notifications$/, () => ({ title: "Notifications", section: "/notifications" })],
];

export function routeInfo(pathname: string): RouteInfo {
  for (const [re, fn] of rules) {
    const m = re.exec(pathname);
    if (m) return fn(m);
  }
  return { title: "Learnometry", section: "" };
}
