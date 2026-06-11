const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const possibleChromePaths = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
];

let chromePath = null;
for (const p of possibleChromePaths) {
  if (fs.existsSync(p)) {
    chromePath = p;
    break;
  }
}

if (!chromePath) {
  console.error("Chrome/Edge executable not found.");
  process.exit(1);
}

(async () => {
  console.log(`Using browser: ${chromePath}`);
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  
  page.on('console', msg => {
    console.log(`[BROWSER CONSOLE] [${msg.type()}] ${msg.text()}`);
  });

  page.on('pageerror', err => {
    console.error(`[BROWSER EXCEPTION] ${err.toString()}`);
  });

  console.log("Navigating to http://localhost:5173/ ...");
  try {
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2', timeout: 15000 });
    console.log("Navigation complete. Checking for existing session...");
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check if we see a Sign Out button
    const signOutBtn = await page.evaluate(() => {
      // Find buttons containing sign out text
      const buttons = Array.from(document.querySelectorAll('button'));
      const found = buttons.find(b => b.textContent.toLowerCase().includes('sign out') || b.textContent.toLowerCase().includes('log out'));
      if (found) {
        found.click();
        return true;
      }
      return false;
    });

    if (signOutBtn) {
      console.log("Found existing session. Clicked Sign Out, waiting for Landing Page...");
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    // Capture initial state screenshot
    await page.screenshot({ path: path.resolve(__dirname, 'landing_page_state.png') });
    console.log("Captured landing page state.");

    // Look for SaaS Ops tab button and click it
    console.log("Clicking SaaS Ops tab button...");
    const tabClicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const opsTab = buttons.find(b => b.textContent.trim() === 'SaaS Ops');
      if (opsTab) {
        opsTab.click();
        return true;
      }
      return false;
    });

    if (!tabClicked) {
      throw new Error("Could not find SaaS Ops tab button!");
    }

    console.log("SaaS Ops tab clicked. Waiting for inputs...");
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Fill in Email
    console.log("Typing email...");
    await page.type('input[placeholder="owner@mediflow.com"]', 'owner@mediflow.com');

    // Fill in Password
    console.log("Typing password...");
    await page.type('input[placeholder="••••••••••••"]', 'password123');

    // Screenshot right before clicking Sign In
    await page.screenshot({ path: path.resolve(__dirname, 'filled_ops_form.png') });

    // Click submit
    console.log("Clicking Authenticate Operations Console button...");
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const submitBtn = buttons.find(b => b.textContent.includes('Authenticate Operations Console'));
      if (submitBtn) {
        submitBtn.click();
      } else {
        // Fallback: submit form
        const form = document.querySelector('form');
        if (form) form.submit();
      }
    });

    console.log("Sign in clicked. Waiting for redirect and dashboard loading...");
    // Wait for the SaaS Operations Dashboard to load
    await new Promise(resolve => setTimeout(resolve, 8000));

    // Check if SaaS operations dashboard is displayed
    const pageText = await page.evaluate(() => document.body.innerText);
    console.log(`Page body snippet: ${pageText.substring(0, 500)}`);

    const screenshotPath = path.resolve(__dirname, 'owner_dashboard_logged_in.png');
    await page.screenshot({ path: screenshotPath });
    console.log(`Verification screenshot saved to: ${screenshotPath}`);

  } catch (err) {
    console.error(`Verification flow failed: ${err.message}`);
  } finally {
    await browser.close();
  }
})();
