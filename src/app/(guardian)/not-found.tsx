import { ButtonLink } from "@/components/ui";
import { EmptyState } from "@/components/feedback";

export default function GuardianNotFound() {
  return <EmptyState title="We can't find that page" body="It may have moved, or the link was mistyped." action={<ButtonLink href="/guardian">Go to overview</ButtonLink>} />;
}
