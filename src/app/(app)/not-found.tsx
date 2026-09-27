import { ButtonLink } from "@/components/ui";
import { EmptyState } from "@/components/feedback";

export default function AppNotFound() {
  return <EmptyState title="We can't find that page" body="It may have moved, or the link was mistyped." action={<ButtonLink href="/dashboard">Go to home</ButtonLink>} />;
}
