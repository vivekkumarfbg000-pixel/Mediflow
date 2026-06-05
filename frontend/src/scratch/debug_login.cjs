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
    headless: true,
    executablePath: chromePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  page.on('console', msg => {
    console.log(`[BROWSER CONSOLE] [${msg.type()}] ${msg.text()}`);
  });

  page.on('pageerror', err => {
    console.error(`[BROWSER EXCEPTION] ${err.toString()}`);
  });

  console.log("Navigating to http://localhost:5173/ ...");
  try {
    await page.goto('http://localhost:5173/', { waitUntil: 'load', timeout: 10000 });
    console.log("Waiting 2 seconds for initial page load...");
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log("Locating the doctor mock button 'Vivek'...");
    // Find all buttons on the page
    const buttons = await page.$$('button');
    let targetButton = null;
    
    for (const button of buttons) {
      const text = await page.evaluate(el => el.textContent, button);
      if (text.includes('Vivek') && text.includes('doctor')) {
        targetButton = button;
        console.log(`Found target button with text: "${text.trim().replace(/\s+/g, ' ')}"`);
        break;
      }
    }

    if (!targetButton) {
      console.error("Could not find Vivek doctor mock button.");
      // Take screenshot of what we see
      await page.screenshot({ path: path.resolve(__dirname, 'login_failed.png') });
      process.exit(1);
    }

    console.log("Clicking the Vivek button...");
    await targetButton.click();
    
    console.log("Clicked! Waiting 8 seconds for authentication and dashboard to load...");
    await new Promise(resolve => setTimeout(resolve, 8000));
    
    const screenshotPath = path.resolve(__dirname, 'dashboard_load.png');
    await page.screenshot({ path: screenshotPath });
    console.log(`Dashboard screenshot saved to: ${screenshotPath}`);
    
    const content = await page.content();
    console.log(`Page HTML length after login: ${content.length}`);
    
    const rootHtml = await page.evaluate(() => {
      const root = document.getElementById('root');
      return root ? root.innerHTML : 'No #root element found';
    });
    console.log(`Root inner HTML snippet (first 1000 chars): ${rootHtml.substring(0, 1000)}`);
  } catch (err) {
    console.error(`Action failed: ${err.message}`);
  } finally {
    await browser.close();
  }
})();
