# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: chaos-offline-sync.spec.ts >> Autonomous QA: Chaos Engineering & Offline Guardian >> should queue telemetry offline and flush upon reconnection
- Location: tests\e2e\chaos-offline-sync.spec.ts:4:7

# Error details

```
Error: expect(received).toBeGreaterThanOrEqual(expected)

Expected: >= 1
Received:    0
```

# Page snapshot

```yaml
- generic [active] [ref=f2e1]:
  - generic [ref=f2e4]:
    - generic [ref=f2e5]:
      - img "VitalSync" [ref=f2e6]
      - generic [ref=f2e11]:
        - heading "VitalSync Dashboard" [level=3] [ref=f2e12]
        - paragraph [ref=f2e13]: Enterprise Care Connected Console
    - generic [ref=f2e15]:
      - generic [ref=f2e16]:
        - button "Sign In" [ref=f2e17] [cursor=pointer]
        - button "Clinic Sign Up" [ref=f2e18] [cursor=pointer]
        - button "Partner Sign In" [ref=f2e19] [cursor=pointer]
      - generic [ref=f2e20]:
        - generic [ref=f2e21]:
          - text: Professional Email Address
          - textbox "Professional Email Address" [ref=f2e26]:
            - /placeholder: name@mediflow.com
        - generic [ref=f2e27]:
          - text: Security Password
          - generic [ref=f2e28]:
            - textbox "Security Password" [ref=f2e32]:
              - /placeholder: ••••••••••••
            - button [ref=f2e33] [cursor=pointer]
        - button "Forgot Password?" [ref=f2e38] [cursor=pointer]
        - button "Enter Workspace" [ref=f2e39] [cursor=pointer]
        - generic [ref=f2e42]: or
        - button "Continue with Google" [ref=f2e46] [cursor=pointer]
        - generic [ref=f2e52]:
          - generic [ref=f2e53]: ⚡ Dev 1-Tap Quick Demo Logins
          - generic [ref=f2e54]:
            - button "👨‍⚕️ Doctor EMR" [ref=f2e55] [cursor=pointer]:
              - generic [ref=f2e56]: 👨‍⚕️
              - generic [ref=f2e57]: Doctor EMR
            - button "🏥 Compounder" [ref=f2e58] [cursor=pointer]:
              - generic [ref=f2e59]: 🏥
              - generic [ref=f2e60]: Compounder
            - button "💊 Pharmacy POS" [ref=f2e61] [cursor=pointer]:
              - generic [ref=f2e62]: 💊
              - generic [ref=f2e63]: Pharmacy POS
            - button "🧪 Pathology Lab" [ref=f2e64] [cursor=pointer]:
              - generic [ref=f2e65]: 🧪
              - generic [ref=f2e66]: Pathology Lab
            - button "🛡️ SaaS Admin" [ref=f2e67] [cursor=pointer]:
              - generic [ref=f2e68]: 🛡️
              - generic [ref=f2e69]: SaaS Admin
        - paragraph [ref=f2e70]:
          - text: Are you a partner (pharmacist/lab)? Use the
          - button "Partner Sign In" [ref=f2e71] [cursor=pointer]
          - text: tab.
    - link "← Return to Public Site" [ref=f2e73] [cursor=pointer]:
      - /url: /landing-page
  - generic [ref=f2e74]: 🚨 JARVIS BUG DETECTEDSimulated Offline Fatal Crash...Crash Payload saved. Open Antigravity AI to auto-fix.
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('Autonomous QA: Chaos Engineering & Offline Guardian', () => {
  4  |   test('should queue telemetry offline and flush upon reconnection', async ({ context, page }) => {
  5  |     console.log('[Chaos QA] Booting Mediflow Dashboard...');
  6  |     // We use the local dev server defined in playwright.config.ts
  7  |     await page.goto('/', { waitUntil: 'domcontentloaded' });
  8  | 
  9  |     // Wait for the app to hydrate
  10 |     await page.waitForSelector('body');
  11 |     // Removed pre-offline error to prevent telemetry cooldown from discarding our offline test error
  12 | 
  13 |     console.log('[Chaos QA] 🔌 SABOTAGING NETWORK: Forcing offline mode...');
  14 |     // Intercept and abort all network requests to simulate internet loss
  15 |     await context.setOffline(true);
  16 |     
  17 |     // Also tell the browser to dispatch the 'offline' event so the React app updates state
  18 |     await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  19 |     
  20 |     console.log('[Chaos QA] 🔴 System is now completely offline.');
  21 | 
  22 |     // Trigger a simulated anomaly while offline
  23 |     console.log('[Chaos QA] Injecting fatal anomaly while offline...');
  24 |     await page.evaluate(() => {
  25 |       window.dispatchEvent(new ErrorEvent('error', {
  26 |         error: new Error('[Chaos QA] Simulated Offline Fatal Crash'),
  27 |         message: 'Simulated Offline Fatal Crash'
  28 |       }));
  29 |     });
  30 | 
  31 |     // Wait briefly to allow the offline outbox (IndexedDB/localStorage) to catch it
  32 |     await page.waitForTimeout(2000);
  33 | 
  34 |     // Assert that the offline outbox actually caught it
  35 |     const memOutboxCount = await page.evaluate(async () => {
  36 |       return new Promise((resolve) => {
  37 |         try {
  38 |           const req = indexedDB.open('mediflow_telemetry_outbox_db', 1);
  39 |           req.onsuccess = () => {
  40 |             const db = req.result;
  41 |             if (!db.objectStoreNames.contains('telemetry_outbox')) return resolve(0);
  42 |             const tx = db.transaction('telemetry_outbox', 'readonly');
  43 |             const store = tx.objectStore('telemetry_outbox');
  44 |             const countReq = store.count();
  45 |             countReq.onsuccess = () => resolve(countReq.result);
  46 |           };
  47 |           req.onerror = () => {
  48 |             const raw = localStorage.getItem('telemetry_mem_outbox');
  49 |             resolve(raw ? JSON.parse(raw).length : 0);
  50 |           };
  51 |         } catch (e) {
  52 |           const raw = localStorage.getItem('telemetry_mem_outbox');
  53 |           resolve(raw ? JSON.parse(raw).length : 0);
  54 |         }
  55 |       });
  56 |     });
  57 |     
  58 |     console.log(`[Chaos QA] Offline Queue size: ${memOutboxCount}`);
  59 |     // The test requires that the error was caught and queued while offline
> 60 |     expect(Number(memOutboxCount)).toBeGreaterThanOrEqual(1);
     |                                    ^ Error: expect(received).toBeGreaterThanOrEqual(expected)
  61 | 
  62 |     console.log('[Chaos QA] 🟢 RESTORING NETWORK: Forcing online mode...');
  63 |     await context.setOffline(false);
  64 |     
  65 |     // Dispatch online event to trigger the flush listener in autoHealerAgent
  66 |     await page.evaluate(() => window.dispatchEvent(new Event('online')));
  67 | 
  68 |     // Wait for flush to happen
  69 |     await page.waitForTimeout(3000);
  70 | 
  71 |     // Verify localStorage queue is empty (flushed)
  72 |     const finalOutboxCount = await page.evaluate(async () => {
  73 |       return new Promise((resolve) => {
  74 |         try {
  75 |           const req = indexedDB.open('mediflow_telemetry_outbox_db', 1);
  76 |           req.onsuccess = () => {
  77 |             const db = req.result;
  78 |             if (!db.objectStoreNames.contains('telemetry_outbox')) return resolve(0);
  79 |             const tx = db.transaction('telemetry_outbox', 'readonly');
  80 |             const store = tx.objectStore('telemetry_outbox');
  81 |             const countReq = store.count();
  82 |             countReq.onsuccess = () => resolve(countReq.result);
  83 |           };
  84 |           req.onerror = () => {
  85 |             const raw = localStorage.getItem('telemetry_mem_outbox');
  86 |             resolve(raw ? JSON.parse(raw).length : 0);
  87 |           };
  88 |         } catch (e) {
  89 |           const raw = localStorage.getItem('telemetry_mem_outbox');
  90 |           resolve(raw ? JSON.parse(raw).length : 0);
  91 |         }
  92 |       });
  93 |     });
  94 |     
  95 |     expect(Number(finalOutboxCount)).toBe(0);
  96 |     console.log('[Chaos QA] ✅ Network restored. Offline queue automatically flushed to Supabase.');
  97 |   });
  98 | });
  99 | 
```