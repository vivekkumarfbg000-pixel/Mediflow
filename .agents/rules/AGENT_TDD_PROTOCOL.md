# 🤖 Agent Test-Driven Development (TDD) Protocol

## ⚠️ MANDATORY RULE: NEVER WRITE APPLICATION CODE FIRST ⚠️

To prevent UI hallucinations, broken layouts, and architectural drift, all AI agents operating in this repository MUST follow the strict **Red-Green TDD Loop**.

### Step 1: The Playwright Spec (RED)
When a user asks you to build a new feature (e.g., "Add a 'Print' button to the dashboard"):
1. You **MUST NOT** edit `frontend/src` immediately.
2. You **MUST** first write or update a Playwright E2E test in `tests/e2e/`.
3. The test should simulate the user's workflow (e.g., `await page.click('text=Print')`).
4. Run the test using `npx playwright test`. It will fail (**RED**).

### Step 2: The Implementation (GREEN)
1. Once the test fails, you are authorized to edit the application code in `frontend/src`.
2. Write the code required to make the test pass.
3. Re-run `npx playwright test`. Keep modifying the code until the test passes (**GREEN**).

### Step 3: Visual Guard Verification
1. Ensure your Playwright test includes `await expect(page).toHaveScreenshot()` for any UI additions.
2. If the snapshot fails, fix the CSS before declaring the task complete.

---
**Why?** This protocol guarantees that every new feature is mathematically proven to work in a real browser, completely eliminating the "It looks right but clicking it crashes" syndrome.
