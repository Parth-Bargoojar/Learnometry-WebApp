import { redirect } from "next/navigation";

/* The app has no landing page of its own; the marketing site is `web/`.
   Once auth is wired, signed-out visitors go to /login instead. */
export default function Root() {
  redirect("/dashboard");
}
