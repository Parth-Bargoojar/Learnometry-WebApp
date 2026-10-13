import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { signInAdmin } from "./helpers";

/* BE-3.5 gate: an admin edits the prerequisite graph as a draft, sees loops refused live, and publishes the next version with a reason. */

test.skip(({ isMobile }) => isMobile, "admin console is desktop only");

const restore = async () => {
  const sql = postgres(process.env.DIRECT_DATABASE_URL!, { max: 1, prepare: false });
  await sql`delete from concept_edges where from_concept_id in (select id from concepts where code = 'power' and exam_id = (select id from exams where code = 'neet'))
    and to_concept_id in (select id from concepts where code = 'fbd' and exam_id = (select id from exams where code = 'neet'))`;
  await sql`delete from curriculum_versions where exam_id = (select id from exams where code = 'neet') and version_number > 1`;
  await sql`update curriculum_versions set status = 'published', snapshot = null where exam_id = (select id from exams where code = 'neet') and version_number = 1`;
  await sql`delete from audit_logs where action = 'curriculum.published' and metadata->>'exam' = 'neet'`;
  await sql.end({ timeout: 2 });
};
test.beforeAll(restore);
test.afterAll(restore);

test("add a prerequisite as a draft, refuse a loop, publish v2 with a reason", async ({ page }) => {
  await signInAdmin(page);
  await page.goto("/admin/curriculum?track=neet");
  await expect(page.getByText("Published v1 · draft v2 with 0 changes")).toBeVisible();
  await expect(page.getByText("1 / 12 Qs").or(page.getByText("0 / 12 Qs")).first()).toBeVisible();

  await page.getByLabel("Prerequisite", { exact: true }).selectOption({ label: "Free-body diagrams" });
  await page.getByLabel("Comes before").selectOption({ label: "Power" });
  await expect(page.getByText("No loop.")).toBeVisible();
  await page.getByRole("button", { name: "Add edge" }).click();
  await expect(page.getByText("Published v1 · draft v2 with 1 change.")).toBeVisible();

  // The reverse edge would close a loop through Power → ... only if a path exists, so use a real one: Work–energy → Power exists, so Power → Work–energy loops.
  await page.getByLabel("Prerequisite", { exact: true }).selectOption({ label: "Power" });
  await page.getByLabel("Comes before").selectOption({ label: "Work–energy theorem" });
  await expect(page.getByText(/This would create a loop/)).toBeVisible();

  // The draft survives a reload: it is stored on the server, not in the browser.
  await page.reload();
  await expect(page.getByText("Published v1 · draft v2 with 1 change.")).toBeVisible();

  await page.getByRole("button", { name: "Publish v2" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Reason").fill("Power needs free-body diagrams.");
  await dialog.getByRole("button", { name: "Publish v2" }).click();
  await expect(page.getByText("Published v2 · draft v3 with 0 changes")).toBeVisible();
});
