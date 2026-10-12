import { AppShell } from "@/components/shell";
import { TodayPlanSnapshot } from "@/components/pwa";
import { ViewerProvider } from "@/components/viewer";
import { PLANS } from "@/lib/config";
import { requireLearner } from "@/lib/auth/session";
import { istDate, now } from "@/lib/time";
import type { ShellViewer } from "@/lib/viewer";

/*
  The signed-in learner's shell. `requireLearner` sends anyone else where they belong (login,
  onboarding, the guardian portal, 2FA) and gives client components their data through
  ViewerProvider (BE-D12). Today's tasks arrive with plans (BE-8); until then the offline
  snapshot is empty.
*/
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const viewer = await requireLearner();
  const shell: ShellViewer = {
    firstName: viewer.firstName,
    lastName: viewer.lastName,
    email: viewer.email,
    initials: viewer.initials,
    examName: viewer.learner.examName,
    plan: viewer.plan,
    balance: viewer.balance,
    creditState: viewer.creditState,
    buckets: viewer.buckets,
    periodCredits: PLANS[viewer.plan].periodCredits,
    unreadCount: viewer.unreadCount,
    isMinor: viewer.isMinor,
    needsApproval: viewer.needsApproval,
    theme: viewer.learner.theme,
  };
  return (
    <ViewerProvider viewer={shell}>
      <AppShell>
        <TodayPlanSnapshot date={istDate(now())} tasks={[]} />
        {children}
      </AppShell>
    </ViewerProvider>
  );
}
