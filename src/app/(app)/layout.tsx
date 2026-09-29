import { AppShell } from "@/components/shell";
import { TodayPlanSnapshot } from "@/components/pwa";
import { TODAY, conceptById, planTasks } from "@/lib/data";

/* Today's tasks, kept on the device so /offline can show them (Web App Structure §8.20). */
const today = planTasks
  .filter((t) => t.date === TODAY)
  .map((t) => ({ id: t.id, concept: conceptById(t.conceptId).name, action: t.action, minutes: t.minutes, done: t.status === "completed" }));

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <AppShell>
      <TodayPlanSnapshot date={TODAY} tasks={today} />
      {children}
    </AppShell>
  );
}
