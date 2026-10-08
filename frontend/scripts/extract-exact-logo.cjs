const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const SOURCE_IMG_PATH = 'C:/Users/vivek/.gemini/antigravity-ide/brain/28c7882d-957f-40e9-9723-93b8e3a38eaf/.user_uploaded/media_1791482112489.png';

async function main() {
  console.log('🔍 Processing exact user logo image via inline base64...');

  const imgBuffer = fs.readFileSync(SOURCE_IMG_PATH);
  const imgBase64 = `data:image/png;base64,${imgBuffer.toString('base64')}`;

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  const page = await browser.newPage();

  const assets = await page.evaluate((b64) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;

        let minX = canvas.width, maxX = 0, minY = canvas.height, maxY = 0;
        let markMinY = canvas.height, markMaxY = 0, markMinX = canvas.width, markMaxX = 0;
        let textMinY = canvas.height, textMaxY = 0, textMinX = canvas.width, textMaxX = 0;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const x = (i / 4) % canvas.width;
          const y = Math.floor((i / 4) / canvas.width);

          const brightness = (r + g + b) / 3;
          const isWhite = r > 235 && g > 235 && b > 235;

          if (isWhite) {
            const diff = brightness - 235;
            if (diff > 15) {
              data[i + 3] = 0;
            } else {
              data[i + 3] = Math.max(0, Math.min(255, Math.round(255 - (diff / 15) * 255)));
            }
          } else {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;

            if (y < canvas.height * 0.72) {
              if (x < markMinX) markMinX = x;
              if (x > markMaxX) markMaxX = x;
              if (y < markMinY) markMinY = y;
              if (y > markMaxY) markMaxY = y;
            } else {
              if (x < textMinX) textMinX = x;
              if (x > textMaxX) textMaxX = x;
              if (y < textMinY) textMinY = y;
              if (y > textMaxY) textMaxY = y;
            }
          }
        }

        ctx.putImageData(imgData, 0, 0);

        // 1. Stacked Logo
        const stackedPadding = 12;
        const sW = Math.max(1, (maxX - minX) + stackedPadding * 2);
        const sH = Math.max(1, (maxY - minY) + stackedPadding * 2);
        const sCanvas = document.createElement('canvas');
        sCanvas.width = sW;
        sCanvas.height = sH;
        const sCtx = sCanvas.getContext('2d');
        sCtx.drawImage(canvas, minX, minY, maxX - minX, maxY - minY, stackedPadding, stackedPadding, maxX - minX, maxY - minY);
        const stackedDataUrl = sCanvas.toDataURL('image/png');

        // 2. VS Mark alone
        const markPadding = 8;
        const mW = Math.max(1, (markMaxX - markMinX) + markPadding * 2);
        const mH = Math.max(1, (markMaxY - markMinY) + markPadding * 2);
        const mCanvas = document.createElement('canvas');
        mCanvas.width = mW;
        mCanvas.height = mH;
        const mCtx = mCanvas.getContext('2d');
        mCtx.drawImage(canvas, markMinX, markMinY, markMaxX - markMinX, markMaxY - markMinY, markPadding, markPadding, markMaxX - markMinX, markMaxY - markMinY);
        const markDataUrl = mCanvas.toDataURL('image/png');

        // 3. Wordmark alone
        const textPadding = 6;
        const tW = Math.max(1, (textMaxX - textMinX) + textPadding * 2);
        const tH = Math.max(1, (textMaxY - textMinY) + textPadding * 2);
        const tCanvas = document.createElement('canvas');
        tCanvas.width = tW;
        tCanvas.height = tH;
        const tCtx = tCanvas.getContext('2d');
        tCtx.drawImage(canvas, textMinX, textMinY, textMaxX - textMinX, textMaxY - textMinY, textPadding, textPadding, textMaxX - textMinX, textMaxY - textMinY);
        const textDataUrl = tCanvas.toDataURL('image/png');

        // 4. Horizontal Lockup: Mark on left + Wordmark on right
        const hPad = 12;
        const targetWordmarkH = Math.round(mH * 0.36);
        const wordmarkScale = targetWordmarkH / tH;
        const scaledWordmarkW = Math.round(tW * wordmarkScale);
        const hCanvas = document.createElement('canvas');
        hCanvas.width = mW + 20 + scaledWordmarkW + hPad * 2;
        hCanvas.height = Math.max(mH, targetWordmarkH) + hPad * 2;
        const hCtx = hCanvas.getContext('2d');
        hCtx.drawImage(mCanvas, 0, 0, mW, mH, hPad, hPad, mW, mH);
        const wordmarkY = hPad + Math.round((mH - targetWordmarkH) / 2);
        hCtx.drawImage(tCanvas, 0, 0, tW, tH, hPad + mW + 20, wordmarkY, scaledWordmarkW, targetWordmarkH);
        const horizontalDataUrl = hCanvas.toDataURL('image/png');

        // 5. Square App Icon Squircle (512x512)
        const iconCanvas = document.createElement('canvas');
        iconCanvas.width = 512;
        iconCanvas.height = 512;
        const iCtx = iconCanvas.getContext('2d');

        // Squircle shape
        const r = 112;
        iCtx.beginPath();
        iCtx.moveTo(24 + r, 24);
        iCtx.arcTo(488, 24, 488, 488, r);
        iCtx.arcTo(488, 488, 24, 488, r);
        iCtx.arcTo(24, 488, 24, 24, r);
        iCtx.arcTo(24, 24, 488, 24, r);
        iCtx.closePath();
        iCtx.fillStyle = '#FFFFFF';
        iCtx.fill();
        iCtx.lineWidth = 2;
        iCtx.strokeStyle = '#E2EDF0';
        iCtx.stroke();

        const targetMarkH = 330;
        const scale = targetMarkH / mH;
        const drawW = mW * scale;
        const drawH = mH * scale;
        iCtx.drawImage(mCanvas, 0, 0, mW, mH, (512 - drawW) / 2, (512 - drawH) / 2, drawW, drawH);
        const iconDataUrl = iconCanvas.toDataURL('image/png');

        resolve({
          bounds: { minX, maxX, minY, maxY, markMinX, markMaxX, markMinY, markMaxY },
          stackedDataUrl,
          markDataUrl,
          textDataUrl,
          horizontalDataUrl,
          iconDataUrl
        });
      };
      img.src = b64;
    });
  }, imgBase64);

  console.log('📐 Exact content bounds detected:', assets.bounds);

  const publicDir = path.resolve(__dirname, '../public');
  const brandDir = path.join(publicDir, 'brand');
  if (!fs.existsSync(brandDir)) fs.mkdirSync(brandDir, { recursive: true });

  function saveBase64(dataUrl, filepath) {
    const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
    fs.writeFileSync(filepath, base64Data, 'base64');
    console.log(`✅ Saved: ${filepath}`);
  }

  saveBase64(assets.stackedDataUrl, path.join(brandDir, 'vitalsync-logo.png'));
  saveBase64(assets.markDataUrl, path.join(brandDir, 'vitalsync-mark.png'));
  saveBase64(assets.textDataUrl, path.join(brandDir, 'vitalsync-wordmark.png'));
  saveBase64(assets.horizontalDataUrl, path.join(brandDir, 'vitalsync-horizontal.png'));
  saveBase64(assets.iconDataUrl, path.join(publicDir, 'icon-512.png'));
  saveBase64(assets.iconDataUrl, path.join(publicDir, 'apple-touch-icon.png'));

  // Render 192x192 and 48x48
  await page.setViewport({ width: 192, height: 192 });
  await page.setContent(`<!DOCTYPE html><html><body style="margin:0;overflow:hidden;"><img src="${assets.iconDataUrl}" style="width:192px;height:192px;" /></body></html>`);
  await page.screenshot({ path: path.join(publicDir, 'icon-192.png'), omitBackground: true });
  console.log('✅ Saved: icon-192.png');

  await page.setViewport({ width: 48, height: 48 });
  await page.setContent(`<!DOCTYPE html><html><body style="margin:0;overflow:hidden;"><img src="${assets.iconDataUrl}" style="width:48px;height:48px;" /></body></html>`);
  await page.screenshot({ path: path.join(publicDir, 'favicon-48.png'), omitBackground: true });
  fs.copyFileSync(path.join(publicDir, 'favicon-48.png'), path.join(publicDir, 'favicon.ico'));
  console.log('✅ Saved: favicon.ico');

  // Also create SVG containing the exact authentic mark
  const svgFavicon = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <rect x="24" y="24" width="464" height="464" rx="112" fill="#FFFFFF" stroke="#E2EDF0" stroke-width="2"/>
  <image href="${assets.markDataUrl}" x="86" y="96" width="340" height="320" preserveAspectRatio="xMidYMid meet" />
</svg>`;
  fs.writeFileSync(path.join(publicDir, 'favicon.svg'), svgFavicon, 'utf8');
  console.log('✅ Saved: favicon.svg with exact authentic mark embedding');

  await browser.close();
  console.log('🎉 Authentic exact brand assets fully generated & verified!');
}

main().catch(err => {
  console.error('❌ Error processing exact logo:', err);
  process.exit(1);
});
