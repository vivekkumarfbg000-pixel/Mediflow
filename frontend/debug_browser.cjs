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
  
  page.on('console', msg => {
    console.log(`[BROWSER CONSOLE] [${msg.type()}] ${msg.text()}`);
  });

  page.on('pageerror', err => {
    console.error(`[BROWSER EXCEPTION] ${err.toString()}`);
  });

  console.log("Navigating to http://localhost:5173/ ...");
  try {
    await page.goto('http://localhost:5173/', { waitUntil: 'load', timeout: 10000 });
    console.log("Navigation complete. Waiting 5 seconds for page rendering...");
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const screenshotPath = path.resolve(__dirname, 'screenshot.png');
    await page.screenshot({ path: screenshotPath });
    console.log(`Screenshot saved to: ${screenshotPath}`);
    
    const content = await page.content();
    console.log(`Page body HTML length: ${content.length}`);
    
    const rootHtml = await page.evaluate(() => {
      const root = document.getElementById('root');
      return root ? root.innerHTML : 'No #root element found';
    });
    console.log(`Root inner HTML length: ${rootHtml.length}`);
  } catch (err) {
    console.error(`Navigation or page action failed: ${err.message}`);
  } finally {
    await browser.close();
  }
})();
