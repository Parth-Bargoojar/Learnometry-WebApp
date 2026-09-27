import Link from "next/link";
import { EmptyState } from "@/components/feedback";
import { btn } from "@/components/ui";

export default function NotFound() {
  return (
    <main id="main" className="flex flex-1 items-center justify-center px-4">
      <EmptyState
        title="We can't find that page"
        body="It may have moved, or the link was mistyped."
        action={
          <Link href="/dashboard" className={btn()}>
            Go to home
          </Link>
        }
      />
    </main>
  );
}
