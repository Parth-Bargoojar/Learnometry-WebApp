import type { Metadata } from "next";
import { Suspense } from "react";
import { PlanView } from "@/components/plan-view";

export const metadata: Metadata = { title: "Plan" };

export default function PlanPage() {
  return (
    <Suspense>
      <PlanView />
    </Suspense>
  );
}
