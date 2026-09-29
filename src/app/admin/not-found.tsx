import Link from "next/link";
import { btn } from "@/components/ui";

export default function AdminNotFound() {
  return (
    <div className="flex flex-col items-start gap-3 py-8">
      <h1 tabIndex={-1} className="font-display text-3xl text-ink outline-none">
        Not found
      </h1>
      <p className="text-sm text-muted">No record matches that link. It may have been deleted, or the ID is mistyped.</p>
      <Link href="/admin" className={btn("secondary", "md")}>
        Back to dashboard
      </Link>
    </div>
  );
}
