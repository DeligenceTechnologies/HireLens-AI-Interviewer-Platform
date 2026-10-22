import { expect, test, type Page } from "@playwright/test";
import { execSync } from "node:child_process";

// Contact us on the home page, then Help and support for a signed-in customer,
// answered by a platform admin. No AI calls are made.

async function signUp(page: Page, name: string, email: string, company: string, password: string) {
  await page.goto("/signup?code=1");
  await page.getByLabel("Full name").fill(name);
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Company / workspace name").fill(company);
  await page.getByLabel("Access code").fill(process.env.SIGNUP_ACCESS_CODE ?? "");
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create workspace" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test("contact us, then help and support answered by the platform team", async ({ page, browser }) => {
  test.setTimeout(180_000);
  const id = Date.now().toString(36);

  // A visitor uses Contact us with their own topic.
  await page.goto("/#contact");
  await expect(page.getByRole("tab", { name: "Contact us" })).toHaveAttribute("aria-selected", "true");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("What can we help with?").selectOption("other");
  await page.getByLabel("Please tell us what it's about").fill(`Reseller question ${id}`);
  await page.getByLabel("Full name").fill("Val Visitor");
  await page.getByLabel("Work email").fill(`visitor-${id}@e2e.test`);
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText("Please write a message")).toBeVisible();
  await page.getByLabel("Message").fill("Do you work with recruitment agencies?");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText("Thanks, we've received your message")).toBeVisible();
  await page.goto("/#request-access");
  await expect(page.getByRole("tab", { name: "Request access" })).toHaveAttribute("aria-selected", "true");

  // A signed-in customer sees support instead of sales on the home page.
  await signUp(page, "Cora Customer", `customer-${id}@e2e.test`, `Customer Co ${id}`, `pw-${id}-customer-secret`);
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Book a demo" })).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "Request access" })).toHaveCount(0);
  await page.getByRole("link", { name: "Contact support" }).click();
  await expect(page).toHaveURL(/\/help$/);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Subject").fill(`Invite email missing ${id}`);
  await page.getByLabel("Message").fill("A candidate says they never got the invite.");
  await page.getByRole("button", { name: "Send to support" }).click();
  await expect(page).toHaveURL(/\/help\/[0-9a-f-]{36}$/);
  const ticketUrl = page.url();
  await expect(page.getByText("A candidate says they never got the invite.")).toBeVisible();

  // The platform team sees both, and answers the support request.
  const adminCtx = await browser.newContext();
  const ap = await adminCtx.newPage();
  const adminEmail = `support-admin-${id}@e2e.test`;
  await signUp(ap, "Avery Admin", adminEmail, `Admin Co ${id}`, `pw-${id}-admin-secret`);
  execSync(`npm run -s admin:grant -- ${adminEmail}`, { stdio: "pipe" });
  await ap.goto("/admin/requests?topic=other");
  const inquiry = ap.locator("li", { hasText: `Other: Reseller question ${id}` });
  await expect(inquiry).toBeVisible();
  await expect(inquiry.getByRole("button", { name: "Approve" })).toHaveCount(0);
  await inquiry.getByRole("button", { name: "Close" }).click();
  await expect(inquiry.getByText("Closed", { exact: true })).toBeVisible();

  await ap.goto("/admin/support");
  await ap.getByRole("link", { name: new RegExp(`Invite email missing ${id}`) }).click();
  await expect(ap.getByText(`Customer Co ${id}`)).toBeVisible();
  await ap.waitForLoadState("networkidle"); // let the reply box hydrate before typing
  await ap.getByLabel("Reply to customer").fill("We resent it. Please ask them to check spam.");
  await ap.getByRole("button", { name: "Send reply" }).click();
  await expect(ap.getByText("Reply sent")).toBeVisible();
  await expect(ap.getByRole("listitem").filter({ hasText: "We resent it. Please ask them to check spam." })).toBeVisible();
  await adminCtx.close();

  // The customer sees the reply from "PickMyHire.ai support" and closes the request.
  await page.goto(ticketUrl);
  await expect(page.getByText("We resent it. Please ask them to check spam.")).toBeVisible();
  await expect(page.getByText(/^PickMyHire\.ai support ·/)).toBeVisible();
  await expect(page.getByText("In progress", { exact: true })).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Mark resolved" }).click();
  await expect(page.getByText("Resolved", { exact: true })).toBeVisible();
  await page.goto("/help");
  await expect(page.getByRole("link", { name: new RegExp(`Invite email missing ${id}`) })).toBeVisible();
});
