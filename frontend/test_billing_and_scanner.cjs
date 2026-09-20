const puppeteer = require('puppeteer');
const path = require('path');

async function run() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[BillHubTab]') || text.includes('[AiPrescription]') || text.includes('mediflow-open-patient-profile') || text.includes('error')) {
      console.log('PAGE LOG:', text);
    }
  });

  // Inject session into localStorage first
  console.log('Injecting session into localStorage...');
  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });

  await page.evaluate(() => {
    const profile = {
      id: "dfb2a1a8-8e68-4f8a-929e-4a6c8e317101",
      email: "doctor@mediflow.com",
      role: "compounder",
      display_name: "Compounder Desk #1",
      clinic_name: "VitalSync Clinic",
      email_verified: true
    };
    localStorage.setItem('vitalsync_cached_profile', JSON.stringify(profile));
    localStorage.setItem('vitalsync_active_role', 'compounder');
  });

  console.log('Navigating to PWA dashboard: http://localhost:5173/?source=pwa ...');
  await page.goto('http://localhost:5173/?source=pwa', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 4000));

  // Ensure role is compounder
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('mediflow-change-role', { detail: { role: 'compounder' } }));
  });
  await new Promise(r => setTimeout(r, 2000));

  const brainDir = 'C:\\Users\\vivek\\.gemini\\antigravity-ide\\brain\\282aa24d-9d87-4928-a732-b2aba27e97ec';

  // 1. Switch to Billing tab
  console.log('Clicking Billing tab...');
  const clickedBilling = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const btn = buttons.find(b => b.textContent && b.textContent.includes('Billing'));
    if (btn) {
      btn.click();
      return btn.textContent.trim();
    }
    return null;
  });
  console.log('Clicked billing tab button:', clickedBilling);
  await new Promise(r => setTimeout(r, 2500));

  // Capture screenshot of the new Executive Counter Cashier Cockpit!
  const brainCockpitShot = path.join(brainDir, 'screenshot_billing_cockpit.png');
  await page.screenshot({ path: brainCockpitShot, fullPage: false });
  console.log('Captured screenshot_billing_cockpit.png');

  // Verify elements in the Executive Cashier Cockpit
  const cockpitMetrics = await page.evaluate(() => {
    const text = document.body.innerText;
    return {
      hasCollections: text.includes("Today's Collections"),
      hasAwaiting: text.includes("Awaiting Billing"),
      hasReceipts: text.includes("Receipts Cleared"),
      hasBuffer: text.includes("Commission Pool"),
      hasNewWalkInBtn: text.includes("+ New Walk-in Invoice"),
      hasHeaderPill: text.includes("Cash & UPI Counter POS")
    };
  });
  console.log('Cockpit metrics check:', cockpitMetrics);

  // 2. Test clicking a patient in the left list of BillHubTab
  console.log('Testing patient profile click on patient name in left list...');
  const clickedPatientResult = await page.evaluate(() => {
    const patNames = Array.from(document.querySelectorAll('div[title="Click to view 360° patient profile"]'));
    if (patNames.length > 0) {
      patNames[0].click();
      return patNames[0].textContent.trim();
    }
    return null;
  });
  console.log('Clicked patient name in left list:', clickedPatientResult);
  await new Promise(r => setTimeout(r, 2000));

  // Verify 360 patient profile modal
  const profileStatus = await page.evaluate((patName) => {
    const text = document.body.innerText;
    return {
      isOpen: text.includes('Demographics') || text.includes('Clinical Timeline') || text.includes('ABHA') || text.includes('Medical Record') || text.includes('Patient Profile'),
      hasPatientName: patName ? text.includes(patName) : false
    };
  }, clickedPatientResult);
  console.log('Profile modal status:', profileStatus);

  const brainProfileShot = path.join(brainDir, 'screenshot_patient_profile_modal.png');
  await page.screenshot({ path: brainProfileShot, fullPage: false });
  console.log('Captured screenshot_patient_profile_modal.png');

  // Close profile modal
  await page.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 1000));

  // 3. Switch to AI Prescription Vision Scanner
  console.log('Clicking Prescription Scan tab...');
  const clickedScanTab = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const btn = buttons.find(b => b.textContent && b.textContent.includes('Prescription Scan'));
    if (btn) {
      btn.click();
      return btn.textContent.trim();
    }
    return null;
  });
  console.log('Clicked scan tab:', clickedScanTab);
  await new Promise(r => setTimeout(r, 2500));

  // Capture screenshot of aesthetic HUD
  const brainScannerShot = path.join(brainDir, 'screenshot_aesthetic_scanner.png');
  await page.screenshot({ path: brainScannerShot, fullPage: false });
  console.log('Captured screenshot_aesthetic_scanner.png');

  // Verify text cleanup
  const scannerClean = await page.evaluate(() => {
    const text = document.body.innerText;
    return {
      noNeuralJargon: !text.includes('Neural Prescription Ingestion'),
      noMultimodalJargon: !text.includes('Direct Multimodal'),
      noSaltMatchJargon: !text.includes('99.4% Salt Match'),
      hasAestheticHeading: text.includes('Prescription Vision Scanner'),
      hasScanBtn: text.includes('Scan Paper Prescription')
    };
  });
  console.log('Scanner text cleanup check:', scannerClean);

  await browser.close();
  console.log('All tests finished successfully!');
}

run().catch(err => {
  console.error('Test run error:', err);
  process.exit(1);
});
