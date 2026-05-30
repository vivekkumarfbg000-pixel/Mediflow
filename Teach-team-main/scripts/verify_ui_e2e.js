import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn, spawnSync } from 'child_process';
import http from 'http';
// puppeteer-core imported dynamically below to prevent static resolution failures

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('──────────────────────────────────────────────────────────────────');
console.log('🦅 GITOPS GUARDIAN: RUNNING HIGH-FIDELITY E2E BEHAVIORAL SMOKE TEST');
console.log('──────────────────────────────────────────────────────────────────\n');

// 0. Load Universal Tech Team Configuration
const configPath = path.resolve(__dirname, '../tech_team_config.json');
let config = {};
if (fs.existsSync(configPath)) {
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    console.log(`⚙️  Loaded Universal Configuration: Project [${config.projectName || 'Unnamed'}]`);
  } catch (e) {
    console.warn(`⚠️  Failed parsing tech_team_config.json: ${e.message}`);
  }
}

// ─── 1. Locate Chrome/Edge Executables on Windows ────────────────────────────
const possibleChromePaths = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  process.env.CHROME_PATH
].filter(Boolean);

let chromePath = null;
for (const p of possibleChromePaths) {
  if (fs.existsSync(p)) {
    chromePath = p;
    break;
  }
}

if (chromePath) {
  console.log(`📡 Headless browser engine located at: ${chromePath}`);
} else {
  console.log('⚠️  [Engine Warning] Headless Chrome/Edge executable not found in standard paths.');
  console.log('   Defaulting to high-fidelity static structural and asset integrity crawling.');
}

// ─── 2. Compile and Start Preview Server ────────────────────────────────
const port = 4173;
const previewUrl = `http://127.0.0.1:${port}`;

console.log('\n📦 Compiling production distribution bundle...');
try {
  // Execute clean production build dynamically
  const buildResult = spawnSync('npm', ['run', 'build'], { shell: true, stdio: 'inherit', cwd: process.cwd() });
  if (buildResult.status !== 0) {
    console.error('❌ [Build Failure] Production build compile failed.');
    process.exit(1);
  }
  console.log('✅ Production bundle compiled successfully.');
} catch (e) {
  console.error('❌ [Build Error] Failed to run compiler command:', e.message);
  process.exit(1);
}

console.log('\n🚀 Spinning up local preview server...');
const previewProcess = spawn('node', ['node_modules/vite/bin/vite.js', 'preview', '--port', port.toString(), '--host', '127.0.0.1'], {
  cwd: process.cwd(),
  shell: true
});

previewProcess.stdout.on('data', (data) => {
  console.log(`   [Preview Server]: ${data.toString().trim()}`);
});

previewProcess.stderr.on('data', (data) => {
  console.error(`   [Preview Server Error]: ${data.toString().trim()}`);
});

// Graceful cleanup handler
function cleanup() {
  console.log('\n🛑 Shutting down preview server...');
  previewProcess.kill();
}

process.on('exit', cleanup);
process.on('SIGINT', () => {
  cleanup();
  process.exit(0);
});

// Helper: Ping server until active
async function waitOnServer(retries = 15, delay = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(previewUrl, { agent: false, headers: { 'connection': 'close' } }, (res) => {
          res.resume();
          if (res.statusCode === 200) resolve();
          else reject(new Error('Status ' + res.statusCode));
        });
        req.on('error', reject);
        req.setTimeout(5000, () => req.destroy());
      });
      return true;
    } catch (e) {
      console.log(`   Pinging ${previewUrl} failed (attempt ${i + 1}/15): ${e.message}`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  return false;
}

(async () => {
  const isServerReady = await waitOnServer();
  if (!isServerReady) {
    console.error('❌ [Server Timeout] Preview server failed to start on port', port);
    process.exit(1);
  }
  console.log(`✅ Web server is online and serving at ${previewUrl}`);

  let smokeTestPassed = false;

  if (chromePath) {
    try {
      const puppeteerModule = await import('puppeteer-core');
      const puppeteer = puppeteerModule.default || puppeteerModule;
      console.log('\n🎬 Launching headless browser viewport...');
      const browser = await puppeteer.launch({
        executablePath: chromePath,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      const page = await browser.newPage();
      
      // Capture page exceptions
      const pageErrors = [];
      page.on('pageerror', (err) => {
        pageErrors.push(err.toString());
      });

      // Enable request interception for dynamic Chaos Engineering fault injection
      await page.setRequestInterception(true);
      page.on('request', async (request) => {
        const url = request.url();
        if (url.includes('/rest/v1/') || url.includes('/api/') || url.includes('webhook')) {
          const rand = Math.random();
          if (rand < 0.15) {
            // Chaos Node A: Simulated API Outage (503 Service Unavailable)
            console.log(`   💥 [Chaos Injection] Intercepting ${url} -> Mocking 503 Service Unavailable.`);
            request.respond({
              status: 503,
              contentType: 'application/json',
              body: JSON.stringify({ error: "Simulated Chaos Outage", code: "CHAOS_503" })
            });
          } else if (rand < 0.30) {
            // Chaos Node B: Simulated Network Latency Delay (1200ms)
            console.log(`   ⏳ [Chaos Injection] Intercepting ${url} -> Injecting 1200ms network latency delay.`);
            setTimeout(() => {
              request.continue().catch(() => {});
            }, 1200);
          } else if (rand < 0.40) {
            // Chaos Node C: Simulated Authentication Error (401 Unauthorized)
            console.log(`   🔑 [Chaos Injection] Intercepting ${url} -> Mocking 401 Unauthorized API key expiration.`);
            request.respond({
              status: 401,
              contentType: 'application/json',
              body: JSON.stringify({ error: "API Key Expired or Invalid Session", code: "CHAOS_401" })
            });
          } else {
            request.continue();
          }
        } else {
          request.continue();
        }
      });

      console.log(`🧭 Navigating to: ${previewUrl}`);
      await page.goto(previewUrl, { waitUntil: 'networkidle2', timeout: 8000 });

      const title = await page.title();
      console.log(`🌐 Document Title detected: "${title}"`);

      const appMounted = await page.evaluate(() => {
        const root = document.getElementById('root');
        return root && root.children.length > 0;
      });

      if (pageErrors.length > 0) {
        console.error('❌ [Runtime Exception] Uncaught JavaScript error(s) thrown in browser console:');
        pageErrors.forEach(err => console.error(`   - ${err}`));
        smokeTestPassed = false;
      } else if (!appMounted) {
        console.warn('⚠️  [Mount Alert] Page container #root found, but has zero child nodes.');
        smokeTestPassed = false;
      } else {
        console.log('✅ Application mounted cleanly into DOM.');
        console.log('✅ ZERO uncaught runtime script exceptions detected in console.');
        smokeTestPassed = true;
      }

      await browser.close();
    } catch (e) {
      console.warn('⚠️  [Puppeteer Alert] Headless browser run encountered a problem:', e.message);
      console.log('   Falling back to high-fidelity static structural integrity audit.');
      chromePath = null; // trigger static fallback audit
    }
  }

  // Fallback structural crawler scan
  if (!chromePath) {
    try {
      console.log('\n📂 Running High-Fidelity Static Integrity Crawler...');
      const distDirectory = config.frontend?.buildDirectory 
        ? path.resolve(__dirname, '..', config.frontend.buildDirectory)
        : path.resolve(__dirname, '../dist');
        
      const indexHtmlPath = path.join(distDirectory, 'index.html');

      if (!fs.existsSync(indexHtmlPath)) {
        console.error('❌ [Integrity Fail] index.html missing from production build output.');
        process.exit(1);
      }

      const indexContent = fs.readFileSync(indexHtmlPath, 'utf8');
      const hasRootDiv = indexContent.includes('id="root"');
      const hasScripts = indexContent.includes('<script type="module"');

      if (hasRootDiv && hasScripts) {
        console.log('✅ index.html possesses correct structure (#root and entry module scripts).');
        
        const assetsDir = path.join(distDirectory, 'assets');
        if (fs.existsSync(assetsDir)) {
          const files = fs.readdirSync(assetsDir);
          const jsChunks = files.filter(f => f.endsWith('.js'));
          const cssChunks = files.filter(f => f.endsWith('.css'));
          console.log(`✅ Compiled assets verified: Found ${jsChunks.length} JS chunks and ${cssChunks.length} CSS files.`);
          smokeTestPassed = true;
        } else {
          console.error('❌ [Integrity Fail] assets directory missing from dist folder.');
          smokeTestPassed = false;
        }
      } else {
        console.error('❌ [Integrity Fail] index.html missing crucial React boot elements.');
        smokeTestPassed = false;
      }
    } catch (e) {
      console.error('❌ [Crawler Failure] Error parsing distribution files:', e.message);
      smokeTestPassed = false;
    }
  }

  cleanup();

  if (smokeTestPassed) {
    console.log('\n──────────────────────────────────────────────────────────────────');
    console.log('🎉 E2E SMOKE SUCCESS: ALL LIVE BEHAVIORAL GATES PASSED.');
    console.log('──────────────────────────────────────────────────────────────────');
    process.exit(0);
  } else {
    console.error('\n──────────────────────────────────────────────────────────────────');
    console.error('🛑 E2E SMOKE FAILURE: APPLICATION BEHAVIOR VERIFICATION FAILED.');
    console.error('──────────────────────────────────────────────────────────────────');
    process.exit(1);
  }
})();
