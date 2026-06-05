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
  console.log(`Using browser: ${chromePath} to generate PWA PNG icons from SVG...`);
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    
    // Read the SVG content
    const svgPath = path.resolve('frontend/public/favicon.svg');
    const svgContent = fs.readFileSync(svgPath, 'utf8');
    
    // Create an HTML page containing the SVG, sized to take up 100% of the viewport with no margins.
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            html, body {
              margin: 0;
              padding: 0;
              width: 100%;
              height: 100%;
              overflow: hidden;
              background: transparent;
            }
            svg {
              width: 100%;
              height: 100%;
              display: block;
            }
          </style>
        </head>
        <body>
          ${svgContent}
        </body>
      </html>
    `;
    
    await page.setContent(htmlContent);

    // Helper function to capture the SVG at a specific size
    const captureIcon = async (size, destPath) => {
      console.log(`Generating ${size}x${size} icon to ${destPath}...`);
      await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
      // Take a screenshot of the page
      const screenshot = await page.screenshot({
        type: 'png',
        omitBackground: true
      });
      fs.writeFileSync(destPath, screenshot);
    };

    // Generate PWA icons
    await captureIcon(192, 'frontend/public/icon-192.png');
    await captureIcon(512, 'frontend/public/icon-512.png');
    await captureIcon(180, 'frontend/public/apple-touch-icon.png');
    
    console.log("Successfully generated all PWA PNG icons!");
  } catch (err) {
    console.error("Icon generation failed:", err);
  } finally {
    await browser.close();
  }
})();
