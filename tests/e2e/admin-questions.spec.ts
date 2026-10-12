import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { insertValidatedQuestion, signInAdmin } from "./helpers";

/* BE-3.4 gate: an admin reviews, publishes and suspends a question in the console; each step is audited. */

const SLUG = `zz-e2e-${Date.now().toString(36)}`;
const REASON = "Checked the stem, answer and solution.";

// The admin console is desktop-only (Web App Structure §8.19): it shows a notice below 1024 px.
test.skip(({ isMobile }) => isMobile, "admin console is desktop only");

test.beforeAll(() => insertValidatedQuestion(SLUG));

test.afterAll(async () => {
  const sql = postgres(process.env.DIRECT_DATABASE_URL!, { max: 1, prepare: false });
  await sql`delete from audit_logs where resource_id in (select id from questions where slug = ${SLUG})`;
  await sql`delete from questions where slug = ${SLUG}`;
  await sql.end({ timeout: 2 });
});

test("review → publish → suspend a question in the console, with a written reason each time", async ({ page }) => {
  await signInAdmin(page);
  await page.goto("/admin/questions?status=validated");
  await page.getByRole("link", { name: SLUG }).click();
  await expect(page.getByRole("heading", { name: `Question ${SLUG}` })).toBeVisible();
  await expect(page.getByText("Validated", { exact: true })).toBeVisible();
  await expect(page.getByText("Needs a human review")).toBeVisible();
  await expect(page.getByRole("button", { name: "Publish" })).toBeDisabled();

  const step = async (button: string, confirm: string, status: string) => {
    await page.getByRole("button", { name: button, exact: true }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Reason").fill("short");
    await dialog.getByRole("button", { name: confirm }).click();
    await expect(dialog.getByRole("alert")).toBeVisible(); // too short
    await dialog.getByLabel("Reason").fill(REASON);
    await dialog.getByRole("button", { name: confirm }).click();
    await expect(page.getByText(status, { exact: true }).first()).toBeVisible();
  };
  await step("Mark reviewed", "Mark reviewed", "Reviewed");
  await step("Publish", "Publish", "Published");

  // It shows in the list under Published; semantic checks are visibly not run.
  await page.goto("/admin/questions?status=published");
  await expect(page.getByRole("link", { name: SLUG })).toBeVisible();
  await page.getByRole("link", { name: SLUG }).click();
  await expect(page.getByText("Not run: no AI provider is configured yet.").first()).toBeVisible();

  await step("Suspend", "Suspend", "Suspended");
  await page.goto("/admin/questions?status=published");
  await expect(page.getByRole("link", { name: SLUG })).toHaveCount(0);

  const sql = postgres(process.env.DIRECT_DATABASE_URL!, { max: 1, prepare: false });
  const rows = await sql<{ action: string; reason: string }[]>`
    select action, reason from audit_logs where resource_type = 'question' and resource_id = (select id from questions where slug = ${SLUG}) order by created_at`;
  await sql.end({ timeout: 2 });
  expect(rows.map((r) => r.action)).toEqual(["question.reviewed", "question.published", "question.suspended"]);
  expect(rows.every((r) => r.reason === REASON)).toBe(true);
});
