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
  console.log(`Using browser: ${chromePath} to convert image...`);
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    
    // Read the current JPEG file
    const jpegPath = path.resolve('mobile/assets/icon.png');
    const base64Jpeg = fs.readFileSync(jpegPath).toString('base64');
    
    await page.setContent(`
      <html>
        <body>
          <canvas id="canvas"></canvas>
          <script>
            const img = new Image();
            img.src = 'data:image/jpeg;base64,${base64Jpeg}';
            img.onload = () => {
              const canvas = document.getElementById('canvas');
              canvas.width = img.width;
              canvas.height = img.height;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(img, 0, 0);
              window.pngData = canvas.toDataURL('image/png').split(',')[1];
            };
          </script>
        </body>
      </html>
    `);
    
    await page.waitForFunction(() => window.pngData !== undefined, { timeout: 10000 });
    
    const pngBase64 = await page.evaluate(() => window.pngData);
    const pngBuffer = Buffer.from(pngBase64, 'base64');
    
    // Write the actual PNG bytes to the destinations
    fs.writeFileSync('mobile/assets/icon.png', pngBuffer);
    fs.writeFileSync('mobile/assets/adaptive-icon.png', pngBuffer);
    fs.writeFileSync('mobile/assets/splash.png', pngBuffer);
    fs.writeFileSync('mobile/assets/favicon.png', pngBuffer);
    
    console.log("Successfully converted JPEG to authentic PNG and updated mobile/assets/!");
  } catch (err) {
    console.error("Conversion failed:", err);
  } finally {
    await browser.close();
  }
})();
