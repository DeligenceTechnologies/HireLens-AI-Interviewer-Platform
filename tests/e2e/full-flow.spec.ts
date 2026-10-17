import { expect, test } from "@playwright/test";
import path from "node:path";

// End-to-end: recruiter signs up → creates job → invites candidate with resume →
// candidate consents, passes device check, completes the interview (demo AI mode,
// typed answers) → recruiter sees transcript and report.
// Requires the app running with AI_PROVIDER=mock or without OPENAI_API_KEY.

const LONG_ANSWER =
  "In my current role I personally owned the payments platform. I designed the webhook processing service in Node.js, " +
  "added idempotency keys to prevent duplicate charges, and worked with product to define retries. The hardest production issue " +
  "was a race condition during peak traffic, which I diagnosed with tracing and fixed by moving to a queue. Latency dropped forty percent.";

test("recruiter to candidate to report", async ({ page, browser }) => {
  const id = Date.now().toString(36);
  const email = `recruiter-${id}@e2e.test`;
  const candidateEmail = `candidate-${id}@e2e.test`;

  // 1. Sign up
  await page.goto("/signup");
  await page.getByLabel("Full name").fill("Casey Recruiter");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Company / workspace name").fill(`E2E Co ${id}`);
  await page.getByLabel("Access code").fill(process.env.SIGNUP_ACCESS_CODE ?? "");
  await page.getByLabel("Password").fill(`pw-${id}-${Math.random().toString(36).slice(2)}`);
  await page.getByRole("button", { name: "Create workspace" }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  // 2. Create job with the short screening template
  await page.goto("/jobs/new");
  await page.getByLabel("Job title").fill("Senior Full Stack Engineer");
  await page.getByLabel("Job description").fill("We need a senior engineer with 5+ years of React, Node.js and PostgreSQL experience. AWS is a plus.");
  await page.getByLabel("Required skills").fill("React");
  await page.getByLabel("Required skills").press("Enter");
  await page.getByLabel("Round 1 template").selectOption({ label: "Quick Screening (15 min) · 15 min" });
  await page.getByRole("button", { name: "Create job" }).click();
  await expect(page.getByRole("heading", { name: /Senior Full Stack Engineer/ })).toBeVisible();

  // 3. Invite a new candidate with a resume
  await page.getByRole("button", { name: "Invite candidate" }).click();
  await page.getByLabel("Full name").fill("Taylor Morgan");
  await page.getByRole("textbox", { name: "Email" }).fill(candidateEmail);
  await page.locator("#inv-file").setInputFiles(path.join(__dirname, "fixtures/resume.txt"));
  await page.getByRole("button", { name: "Send invitation" }).click();
  const linkInput = page.locator("input[readonly]").first();
  await expect(linkInput).toHaveValue(/\/interview\//);
  const link = await linkInput.inputValue();
  await page.getByRole("button", { name: "Done" }).click();

  // 4. Candidate flow in a separate browser context (no recruiter cookies)
  const ctx = await browser.newContext({ permissions: ["camera", "microphone"] });
  const cand = await ctx.newPage();
  await cand.goto(link);
  await expect(cand.getByRole("heading", { name: /welcome/i })).toBeVisible();
  await cand.getByRole("link", { name: "Get started" }).click();
  await cand.getByRole("checkbox").click();
  await cand.getByRole("button", { name: /I agree/ }).click();
  await expect(cand).toHaveURL(/device-check/);
  // Headless Chromium's fake capture devices can stall on the very first request; warm them up.
  await cand.evaluate(async () => {
    try { await Promise.race([navigator.mediaDevices.getUserMedia({ audio: true, video: true }), new Promise((r) => setTimeout(r, 5000))]); } catch { /* ignore */ }
  });
  await expect(cand.getByText(/We can hear you/)).toBeVisible({ timeout: 30_000 });
  await expect(cand.getByText("Test recording worked")).toBeVisible({ timeout: 20_000 });
  if (process.env.E2E_SCREENSHOTS) await cand.screenshot({ path: "test-results/device-check.png" });
  await cand.getByRole("button", { name: "I heard it" }).click();
  await expect(cand.getByText(/being prepared/)).toBeHidden({ timeout: 60_000 });
  await cand.getByRole("button", { name: "Continue to interview" }).click();
  await expect(cand).toHaveURL(/session/);
  await cand.getByRole("button", { name: "Start interview" }).click();
  // After the closing line the candidate is told the interview is over while the video saves.
  const sawSavingScreen = cand.getByText("Interview complete").waitFor({ timeout: 200_000 }).then(async () => {
    if (process.env.E2E_SCREENSHOTS) await cand.screenshot({ path: "test-results/saving-screen.png" }).catch(() => {});
    return true;
  }, () => false);

  for (let turn = 0; turn < 25; turn++) {
    const answer = cand.locator("#typed");
    await Promise.race([
      answer.waitFor({ state: "visible", timeout: 60_000 }),
      cand.waitForURL(/completed/, { timeout: 60_000 }),
    ]).catch(() => {});
    if (cand.url().includes("/completed")) break;
    if (turn === 1 && process.env.E2E_SCREENSHOTS) await cand.screenshot({ path: "test-results/candidate-session.png" });
    if (turn === 1) {
      // No answer at all: the interviewer nudges, shows a countdown, then moves on by itself.
      const question = await cand.getByText(/^(Question|Follow-up)$/).locator("xpath=following-sibling::p").first().textContent();
      await expect(cand.getByText(/Start speaking when you're ready/)).toBeVisible({ timeout: 30_000 });
      await expect(cand.getByText("No answer yet — moving to the next question.")).toBeVisible({ timeout: 30_000 });
      if (process.env.E2E_SCREENSHOTS) await cand.screenshot({ path: "test-results/no-answer-countdown.png" });
      await expect(cand.getByText(question!, { exact: true })).toBeHidden({ timeout: 30_000 });
      continue;
    }
    if (turn === 3) {
      // The microphone disconnects mid-interview: the session carries on with another one.
      await cand.evaluate(() => {
        const cam = [...document.querySelectorAll("video")].map((v) => v.srcObject).find((s): s is MediaStream => s instanceof MediaStream)!;
        const mic = cam.getAudioTracks()[0];
        mic.stop();
        mic.dispatchEvent(new Event("ended"));
      });
      await expect(cand.getByText(/Microphone switched to/)).toBeVisible({ timeout: 20_000 });
      if (process.env.E2E_SCREENSHOTS) await cand.screenshot({ path: "test-results/mic-switched.png" });
    }
    await answer.fill(LONG_ANSWER);
    await cand.getByRole("button", { name: "Done answering" }).click();
    await expect(answer).toBeHidden();
  }
  await expect(cand).toHaveURL(/completed/, { timeout: 120_000 });
  await expect(cand.getByRole("heading", { name: /Thank you/ })).toBeVisible();
  expect(await sawSavingScreen).toBe(true);
  await ctx.close();

  // 5. Recruiter reviews transcript and report
  await page.goto("/interviews");
  await page.getByRole("link", { name: "Taylor Morgan" }).click();
  await expect(page.getByText("Report ready")).toBeVisible({ timeout: 90_000 });
  await page.getByRole("tab", { name: "Report" }).click();
  await expect(page.getByText("Candidate interview report")).toBeVisible();
  await expect(page.getByText(/not a hiring recommendation/)).toBeVisible();
  if (process.env.E2E_SCREENSHOTS) await page.screenshot({ path: "test-results/recruiter-report.png", fullPage: true });
  // Recording is stored and streams with Range support (needed for seeking).
  const interviewId = page.url().match(/interviews\/([0-9a-f-]{36})/)![1];
  const rec = await (await page.request.get(`/api/interviews/${interviewId}/recording`)).json();
  // The microphone switch continued the recording as a second part; both are stored.
  expect(rec.parts.length).toBeGreaterThanOrEqual(2);
  for (const part of rec.parts) expect((await page.request.get(part.url, { headers: { Range: "bytes=0-3" } })).status()).toBe(206);
  const head = await page.request.get(rec.parts[0].url, { headers: { Range: "bytes=0-3" } });
  expect(head.status()).toBe(206);
  expect(Buffer.from(await head.body()).toString("hex")).toBe("1a45dfa3"); // WebM/EBML magic
  const total = Number(head.headers()["content-range"].split("/")[1]);
  const tail = await page.request.get(rec.parts[0].url, { headers: { Range: `bytes=${total - 10}-` } });
  expect(tail.status()).toBe(206);
  expect((await tail.body()).length).toBe(10);
  await page.getByRole("tab", { name: "Transcript" }).click();
  await expect(page.getByText(LONG_ANSWER.slice(0, 40)).first()).toBeVisible();
  await page.getByRole("tab", { name: "Questions" }).click();
  await expect(page.getByText(/Question/).first()).toBeVisible();
});
