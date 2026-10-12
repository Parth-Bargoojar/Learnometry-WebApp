import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { functions } from "@/inngest/functions";

/*
  Inngest calls back into the app here. Requests are signed (INNGEST_SIGNING_KEY); the dev server needs none.
  A deployed environment without a signing key would run in unauthenticated dev mode, so it answers 404
  until the key is set: nobody can trigger a job by hand.
*/
const handlers = serve({ client: inngest, functions });
const closed = () => new Response("Not found", { status: 404 });
const open = process.env.NODE_ENV !== "production" || Boolean(process.env.INNGEST_SIGNING_KEY);

export const GET = open ? handlers.GET : closed;
export const POST = open ? handlers.POST : closed;
export const PUT = open ? handlers.PUT : closed;
