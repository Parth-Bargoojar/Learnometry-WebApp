import type { Metadata } from "next";
import { Suspense } from "react";
import { ConceptList } from "@/components/concept-list";

export const metadata: Metadata = { title: "All concepts" };

export default function ConceptsPage() {
  return (
    <Suspense>
      <ConceptList />
    </Suspense>
  );
}
