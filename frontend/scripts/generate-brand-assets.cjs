const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

// Canonical Brand Colors
const COLORS = {
  vitalBlue: '#0E7A8A',
  syncTeal: '#14C3D0',
  healthGreen: '#4CC26B',
  lightGreen: '#E7F7EC',
  darkTeal: '#094852',
  darkGreen: '#23783E',
  darkBg: '#090D16',
  lightBg: '#FFFFFF'
};

/**
 * Returns the pure SVG path definitions for the VS origami ribbon monogram
 * ViewBox: 0 0 240 200
 */
function getVsRibbonSvg({ idPrefix = 'vs', isMonochrome = false, theme = 'color' } = {}) {
  const gradV1 = `${idPrefix}-grad-v1`;
  const gradV2 = `${idPrefix}-grad-v2`;
  const gradS1 = `${idPrefix}-grad-s1`;
  const gradS2 = `${idPrefix}-grad-s2`;
  const gradS3 = `${idPrefix}-grad-s3`;
  const shadowId = `${idPrefix}-ribbon-shadow`;

  if (isMonochrome) {
    const isLight = theme === 'light';
    const c1 = isLight ? '#334155' : '#E2E8F0';
    const c2 = isLight ? '#64748B' : '#94A3B8';
    const c3 = isLight ? '#1E293B' : '#CBD5E1';
    return `
      <defs>
        <linearGradient id="${gradV1}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${c1}" />
          <stop offset="100%" stop-color="${c2}" />
        </linearGradient>
        <linearGradient id="${gradV2}" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="${c3}" />
          <stop offset="100%" stop-color="${c1}" />
        </linearGradient>
        <linearGradient id="${gradS1}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${c2}" />
          <stop offset="100%" stop-color="${c1}" />
        </linearGradient>
        <linearGradient id="${gradS2}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${c1}" />
          <stop offset="100%" stop-color="${c3}" />
        </linearGradient>
        <linearGradient id="${gradS3}" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="${c2}" />
          <stop offset="100%" stop-color="${c1}" />
        </linearGradient>
        <filter id="${shadowId}" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="2" dy="4" stdDeviation="4" flood-color="#000000" flood-opacity="0.25" />
        </filter>
      </defs>
      ${renderRibbonPaths(gradV1, gradV2, gradS1, gradS2, gradS3, shadowId)}
    `;
  }

  return `
    <defs>
      <!-- V-arm primary: Vital Blue to Sync Teal -->
      <linearGradient id="${gradV1}" x1="15%" y1="10%" x2="55%" y2="90%">
        <stop offset="0%" stop-color="#0E7A8A" />
        <stop offset="60%" stop-color="#10A5B5" />
        <stop offset="100%" stop-color="#14C3D0" />
      </linearGradient>

      <!-- V inner fold & shadow under turn -->
      <linearGradient id="${gradV2}" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#07444D" />
        <stop offset="40%" stop-color="#0A5B66" />
        <stop offset="100%" stop-color="#14C3D0" />
      </linearGradient>

      <!-- S top arch: Sync Teal into Health Green -->
      <linearGradient id="${gradS1}" x1="20%" y1="50%" x2="90%" y2="10%">
        <stop offset="0%" stop-color="#12B5C3" />
        <stop offset="50%" stop-color="#28C98B" />
        <stop offset="100%" stop-color="#4CC26B" />
      </linearGradient>

      <!-- S diagonal sweep: Health Green with vibrant dimension -->
      <linearGradient id="${gradS2}" x1="10%" y1="20%" x2="80%" y2="90%">
        <stop offset="0%" stop-color="#4CC26B" />
        <stop offset="65%" stop-color="#36B357" />
        <stop offset="100%" stop-color="#258E40" />
      </linearGradient>

      <!-- S bottom loop ribbon return: Health Green to Light Green highlight -->
      <linearGradient id="${gradS3}" x1="0%" y1="100%" x2="100%" y2="20%">
        <stop offset="0%" stop-color="#1F7535" />
        <stop offset="45%" stop-color="#4CC26B" />
        <stop offset="85%" stop-color="#80E99E" />
        <stop offset="100%" stop-color="#B7F6C9" />
      </linearGradient>

      <!-- Ambient volumetric shadow for 3D ribbon overlap -->
      <filter id="${shadowId}" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="3" dy="6" stdDeviation="5" flood-color="#042327" flood-opacity="0.32" />
      </filter>
    </defs>
    ${renderRibbonPaths(gradV1, gradV2, gradS1, gradS2, gradS3, shadowId)}
  `;
}

function renderRibbonPaths(gradV1, gradV2, gradS1, gradS2, gradS3, shadowId) {
  return `
    <g transform="translate(15, 8)">
      <!-- 1. V Left Downward Wing -->
      <path
        d="M 28 22 
           C 24 22, 20 25, 22 30 
           L 70 148 
           C 72 153, 78 156, 84 153 
           L 116 134 
           C 120 131, 120 126, 117 122 
           L 66 28 
           C 64 24, 60 22, 55 22 
           Z"
        fill="url(#${gradV1})"
        filter="url(#${shadowId})"
      />

      <!-- 2. V Vertex Fold & Inner Turn (Twisting upward into the center) -->
      <path
        d="M 70 148 
           C 75 160, 92 162, 102 152 
           L 132 122 
           C 136 118, 134 112, 129 110 
           L 100 100 
           C 95 98, 90 101, 88 106 
           L 76 132 
           Z"
        fill="url(#${gradV2})"
      />

      <!-- 3. S Bottom Reverse Loop (Folded underside ribbon) -->
      <path
        d="M 126 126 
           C 134 136, 148 150, 168 150 
           C 192 150, 204 135, 204 118 
           C 204 98, 185 86, 162 78 
           L 142 71 
           C 136 69, 132 64, 134 58 
           L 144 26 
           C 146 22, 151 20, 156 22 
           L 182 32 
           C 176 42, 170 54, 166 60 
           C 188 68, 220 82, 220 118 
           C 220 148, 196 168, 162 168 
           C 132 168, 112 148, 104 134 
           Z"
        fill="url(#${gradS3})"
        filter="url(#${shadowId})"
      />

      <!-- 4. S Top Loop Arch -->
      <path
        d="M 144 26 
           C 152 18, 166 12, 184 12 
           C 208 12, 222 24, 222 40 
           C 222 46, 218 50, 212 50 
           L 186 48 
           C 182 48, 180 44, 180 40 
           C 180 34, 174 30, 165 30 
           C 156 30, 149 34, 146 40 
           L 134 76 
           C 130 88, 120 92, 110 86 
           L 116 66 
           Z"
        fill="url(#${gradS1})"
      />

      <!-- 5. Central Dynamic Diagonal Bridge (Connecting the ribbon flow) -->
      <path
        d="M 112 80 
           C 120 74, 128 72, 138 75 
           L 164 84 
           C 182 90, 194 98, 194 112 
           C 194 122, 186 130, 174 130 
           C 160 130, 146 118, 138 108 
           L 118 82 
           Z"
        fill="url(#${gradS2})"
      />
    </g>
  `;
}

/**
 * Creates the Favicon & App Icon Squircle SVG
 * ViewBox: 0 0 512 512
 */
function getSquircleAppIconSvg() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Premium Squircle Background Gradient -->
    <linearGradient id="sq-bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" />
      <stop offset="100%" stop-color="#F3F7F9" />
    </linearGradient>
    <filter id="sq-shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="16" stdDeviation="24" flood-color="#0E7A8A" flood-opacity="0.12" />
      <feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="#0E7A8A" flood-opacity="0.08" />
    </filter>
  </defs>

  <!-- Squircle Base -->
  <rect x="24" y="24" width="464" height="464" rx="112" fill="url(#sq-bg)" stroke="#E2EDF0" stroke-width="2" filter="url(#sq-shadow)" />

  <!-- Centered VS Ribbon Monogram -->
  <g transform="translate(68, 96) scale(1.58)">
    ${getVsRibbonSvg({ idPrefix: 'sq-vs' })}
  </g>
</svg>`;
}

/**
 * Creates the Horizontal Lockup SVG (Mark + Wordmark)
 * ViewBox: 0 0 480 120
 */
function getHorizontalLogoSvg({ theme = 'light' } = {}) {
  const isDark = theme === 'dark';
  const vitalTextColor = isDark ? '#FFFFFF' : '#0E7A8A';
  const syncTextColor = '#4CC26B';
  const taglineColor = isDark ? '#94A3B8' : '#52797F';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="480" height="120" viewBox="0 0 480 120" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- Scaled VS Ribbon Mark -->
  <g transform="translate(10, 10) scale(0.5)">
    ${getVsRibbonSvg({ idPrefix: `horiz-${theme}` })}
  </g>

  <!-- Typography: VITALSYNC Wordmark -->
  <text x="145" y="68" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', Roboto, sans-serif" font-size="44" font-weight="900" letter-spacing="3">
    <tspan fill="${vitalTextColor}">VITAL</tspan><tspan fill="${syncTextColor}">SYNC</tspan>
  </text>

  <!-- Subtitle Tagline -->
  <text x="148" y="94" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', Roboto, sans-serif" font-size="12" font-weight="600" fill="${taglineColor}" letter-spacing="1.8">
    SMARTER CLINICS. HEALTHIER LIVES.
  </text>
</svg>`;
}

/**
 * Generates OpenGraph / Social preview image SVG
 * ViewBox: 0 0 1200 630
 */
function getSocialPreviewSvg() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="630" viewBox="0 0 1200 630" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="bg-glow" cx="50%" cy="40%" r="65%">
      <stop offset="0%" stop-color="#0F242C" />
      <stop offset="60%" stop-color="#090D16" />
      <stop offset="100%" stop-color="#05080E" />
    </radialGradient>
    <radialGradient id="mark-glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#14C3D0" stop-opacity="0.25" />
      <stop offset="100%" stop-color="#0E7A8A" stop-opacity="0" />
    </radialGradient>
  </defs>

  <!-- Rich Background -->
  <rect width="1200" height="630" fill="url(#bg-glow)" />
  <circle cx="600" cy="270" r="280" fill="url(#mark-glow)" />

  <!-- Centered VS Ribbon Monogram -->
  <g transform="translate(460, 110) scale(1.15)">
    ${getVsRibbonSvg({ idPrefix: 'og-vs' })}
  </g>

  <!-- Main Wordmark -->
  <text x="600" y="380" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', Roboto, sans-serif" font-size="64" font-weight="900" letter-spacing="6">
    <tspan fill="#FFFFFF">VITAL</tspan><tspan fill="#4CC26B">SYNC</tspan>
  </text>

  <!-- Tagline -->
  <text x="600" y="425" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', Roboto, sans-serif" font-size="22" font-weight="600" fill="#14C3D0" letter-spacing="4">
    SMARTER CLINICS. HEALTHIER LIVES.
  </text>

  <!-- System Badge -->
  <rect x="420" y="470" width="360" height="42" rx="21" fill="#0E232B" stroke="#165159" stroke-width="1.5" />
  <text x="600" y="497" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="600" fill="#A4D8DC" letter-spacing="1.5">
    AI CLINIC OPERATING SYSTEM &amp; SMART EMR
  </text>
</svg>`;
}

async function main() {
  console.log('🚀 Starting VitalSync Brand Identity Assets Generation...');

  const publicDir = path.resolve(__dirname, '../public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  // 1. Write Vector SVGs
  const squircleSvg = getSquircleAppIconSvg();
  const faviconSvgPath = path.join(publicDir, 'favicon.svg');
  fs.writeFileSync(faviconSvgPath, squircleSvg, 'utf8');
  console.log(`✅ Saved ${faviconSvgPath}`);

  const horizSvg = getHorizontalLogoSvg({ theme: 'light' });
  const horizSvgPath = path.join(publicDir, 'logo-horizontal.svg');
  fs.writeFileSync(horizSvgPath, horizSvg, 'utf8');
  console.log(`✅ Saved ${horizSvgPath}`);

  const socialSvg = getSocialPreviewSvg();
  const socialSvgPath = path.join(publicDir, 'og-preview.svg');
  fs.writeFileSync(socialSvgPath, socialSvg, 'utf8');
  console.log(`✅ Saved ${socialSvgPath}`);

  // 2. Launch headless browser to generate crisp PNGs & ICO
  console.log('🌐 Launching headless browser for high-res PNG rasterization...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  const page = await browser.newPage();

  // Helper to render SVG string to high-res PNG
  async function renderSvgToPng(svgContent, width, height, outputPath) {
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;overflow:hidden;background:transparent;">${svgContent}</body></html>`;
    await page.setContent(html);
    await page.screenshot({ path: outputPath, omitBackground: true, type: 'png' });
    console.log(`✅ Rendered PNG: ${outputPath} (${width}x${height})`);
  }

  // Render PWA and Apple Touch Icons
  await renderSvgToPng(squircleSvg, 512, 512, path.join(publicDir, 'icon-512.png'));
  await renderSvgToPng(squircleSvg, 192, 192, path.join(publicDir, 'icon-192.png'));
  await renderSvgToPng(squircleSvg, 180, 180, path.join(publicDir, 'apple-touch-icon.png'));
  await renderSvgToPng(squircleSvg, 48, 48, path.join(publicDir, 'favicon-48.png'));
  await renderSvgToPng(socialSvg, 1200, 630, path.join(publicDir, 'og-preview.png'));

  // Copy or generate favicon.ico from the 48x48 PNG
  const fav48 = fs.readFileSync(path.join(publicDir, 'favicon-48.png'));
  fs.writeFileSync(path.join(publicDir, 'favicon.ico'), fav48);
  console.log('✅ Generated favicon.ico');

  await browser.close();
  console.log('🎉 All brand assets generated successfully!');
}

main().catch(err => {
  console.error('❌ Asset generation failed:', err);
  process.exit(1);
});
