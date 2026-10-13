import { expect, test } from "@playwright/test";
import { PASSWORD, confirmLink, fillAboutYou, logIn, resetAdminMfa, signUpAndConfirm, totp, uniqueEmail, waitForMail, waitForNextTotpWindow } from "./helpers";

/*
  BE-2 gate journeys: signup → verify → onboarding → dashboard (S0), minor hold, log in / out,
  password reset, and the admin second factor.
*/

test("signup → verify → onboarding → dashboard (S0) with welcome credits", async ({ page }) => {
  await signUpAndConfirm(page, "Ada Lovelace");
  await expect(page).toHaveURL(/\/onboarding\/about-you/);

  await fillAboutYou(page, { day: "5", month: "3", year: "2005" }, "Class 12");
  await expect(page).toHaveURL(/\/onboarding\/exam$/);
  await page.getByText("JEE Main", { exact: true }).click();
  await page.getByRole("button", { name: /Continue/ }).click();

  await expect(page).toHaveURL(/\/onboarding\/exam-date/);
  await page.getByLabel("Month").selectOption("January");
  await page.getByLabel("Year").selectOption("2028");
  await page.getByRole("button", { name: /Continue/ }).click();

  await expect(page).toHaveURL(/\/onboarding\/study-time/);
  await page.getByText("60", { exact: true }).click();
  await page.getByRole("button", { name: /Continue/ }).click();

  await expect(page).toHaveURL(/\/onboarding\/ready/);
  await expect(page.getByText("Your 100 welcome credits are ready")).toBeVisible();
  await page.getByRole("link", { name: "Go to home" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Take your first diagnostic" })).toBeVisible();
  await expect(page.getByText("Welcome credits · expire", { exact: false })).toBeVisible();
  await expect(page.getByText("Ada Lovelace").first()).toBeAttached(); // the sidebar name is hidden on phones
  // The credit chip shows the ledger balance: 100 welcome + 30 free for the current month (BE-D36).
  await expect(page.getByRole("button", { name: /130.*credit/i }).first()).toBeVisible();

  // The Credits screen is the same ledger: balance, buckets and history rows.
  await page.goto("/credits");
  await expect(page.locator("#bal-h + p")).toHaveText("130");
  await page.getByText("Breakdown", { exact: true }).click();
  const main = page.locator("#main");
  await expect(main.getByText("Free monthly", { exact: true })).toBeVisible();
  await expect(main.getByText("Promotional", { exact: true })).toBeVisible();
  const history = page.getByRole("region", { name: "Credit history" });
  await expect(history.getByText("Welcome credits")).toBeVisible();
  await expect(history.getByText("Free monthly credits")).toBeVisible();
  await expect(history.getByText("+100")).toBeVisible();
  await expect(history.getByText("+30")).toBeVisible();
});

test("onboarding resumes where it stopped, from a fresh login", async ({ page, context }) => {
  const email = await signUpAndConfirm(page);
  await fillAboutYou(page, { day: "1", month: "6", year: "2004" }, "Dropper");
  await expect(page).toHaveURL(/\/onboarding\/exam$/);

  await context.clearCookies();
  await logIn(page, email);
  await expect(page).toHaveURL(/\/onboarding\/exam$/);

  // Skipping ahead is not possible.
  await page.goto("/onboarding/study-time");
  await expect(page).toHaveURL(/\/onboarding\/exam$/);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/onboarding\/exam$/);
});

test("a student under 18 is held after their date of birth and nothing else is stored", async ({ page }) => {
  await signUpAndConfirm(page);
  await fillAboutYou(page, { day: "10", month: "5", year: "2010" });
  await expect(page).toHaveURL(/\/onboarding\/minor-hold/);
  await expect(page.getByRole("heading", { name: /open soon/ })).toBeVisible();
  await expect(page.getByText("only your name, email and date of birth", { exact: false })).toBeVisible();

  for (const path of ["/onboarding/exam", "/dashboard", "/plan", "/settings/profile"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/onboarding\/minor-hold/);
  }
});

test("log in and out; wrong passwords look the same as unknown emails", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard/);

  await logIn(page, "new@seed.learnometry.test", "not-the-password");
  const problem = page.getByRole("alert").filter({ hasText: "don't match" });
  await expect(problem).toBeVisible();
  const wrongPassword = await problem.innerText();

  await logIn(page, "nobody-here@seed.learnometry.test", "whatever-1");
  await expect(problem).toBeVisible();
  expect(await problem.innerText()).toBe(wrongPassword);

  await logIn(page, "new@seed.learnometry.test", "Seed-Password-1!");
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Take your first diagnostic" })).toBeVisible();

  await page.getByRole("button", { name: "Account menu" }).or(page.getByRole("button", { name: /Nisha Verma/ })).first().click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});

test("forgot password → emailed link → new password → log in", async ({ page }) => {
  const email = await signUpAndConfirm(page);
  await page.context().clearCookies();

  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("heading", { name: "Check your inbox" })).toBeVisible();

  const mail = await waitForMail(email, /Reset your Learnometry password/);
  await page.goto(confirmLink(mail));
  await expect(page).toHaveURL(/\/reset-password/);
  const next = "A-brand-new-phrase-7";
  await page.getByLabel("New password", { exact: true }).fill(next);
  await page.getByLabel("Confirm new password").fill(next);
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page.getByRole("heading", { name: "Password changed" })).toBeVisible();

  // The link works once (signed out, or the login redirect would hide the result).
  await page.context().clearCookies();
  await page.goto(confirmLink(mail));
  await expect(page).toHaveURL(/\/forgot-password\?error=expired/);

  await page.context().clearCookies();
  await logIn(page, email, next);
  await expect(page).toHaveURL(/\/onboarding\/about-you/);
});

test("an unconfirmed address cannot log in and is sent to check its inbox", async ({ page }) => {
  const email = uniqueEmail();
  await page.goto("/signup");
  await page.getByLabel("Your name").fill("Pending Person");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByLabel(/I agree to the/).check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/verify-email/);

  await logIn(page, email);
  await expect(page).toHaveURL(/\/verify-email/);
  await expect(page.getByText(email)).toBeVisible();
});

test("the admin console is a 404 for everyone but an admin with a fresh second factor", async ({ page, context }) => {
  // Signed out and as a learner: a plain 404, the same as any unknown page.
  const missing = await page.goto("/admin");
  expect(missing?.status()).toBe(404);
  await logIn(page, "new@seed.learnometry.test", "Seed-Password-1!");
  await expect(page).toHaveURL(/\/dashboard$/);
  expect((await page.goto("/admin/learners"))?.status()).toBe(404);
  expect((await page.goto("/security/2fa"))?.status()).toBe(404);
  await context.clearCookies();

  // An admin without a second factor: the console is still a 404, and the 2FA screen offers enrolment.
  await resetAdminMfa();
  await logIn(page, "admin@seed.learnometry.test", "Seed-Password-1!");
  await expect(page).toHaveURL(/\/security\/2fa/);
  expect((await page.goto("/admin"))?.status()).toBe(404);
  await page.goto("/security/2fa");
  await page.getByRole("button", { name: "Set up authenticator" }).click();
  const secret = (await page.getByText(/Enter this key/).locator("span").innerText()).trim();
  const enrolledAt = Date.now();
  await page.getByLabel("6-digit code").fill(totp(secret, enrolledAt));
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();

  // A new sign-in is back at the first factor only: 404 until the code is entered (waits for the next 30 s window: codes are single-use).
  await context.clearCookies();
  await logIn(page, "admin@seed.learnometry.test", "Seed-Password-1!");
  await expect(page).toHaveURL(/\/security\/2fa/);
  expect((await page.goto("/admin"))?.status()).toBe(404);
  await page.goto("/security/2fa");
  await expect(page.getByRole("button", { name: "Set up authenticator" })).toHaveCount(0);
  await page.getByLabel("6-digit code").fill("000000");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("didn't work")).toBeVisible();
  await waitForNextTotpWindow(enrolledAt);
  await page.getByLabel("6-digit code").fill(totp(secret));
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/admin$/);
});
