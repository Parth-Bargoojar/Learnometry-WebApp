import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { functions } from "@/inngest/functions";

/* Inngest calls back into the app here. Requests are signed (INNGEST_SIGNING_KEY); the dev server needs none. */
export const { GET, POST, PUT } = serve({ client: inngest, functions });
