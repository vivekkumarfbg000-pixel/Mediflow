const puppeteer = require('puppeteer');
const path = require('path');

async function run() {
  console.log('Launching browser for full completion test...');
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('ocrScan') || text.includes('OCR Success') || text.includes('Extracted') || text.includes('mediflow')) {
      console.log('PAGE LOG:', text);
    }
  });

  // Inject session
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

  await page.goto('http://localhost:5173/?source=pwa', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 3000));

  // Switch to Prescription Scan tab
  console.log('Switching to Prescription Scan tab...');
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const btn = buttons.find(b => b.textContent && b.textContent.includes('Prescription Scan'));
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 2000));

  // Upload prescription image
  const rxImagePath = 'C:\\Users\\vivek\\.gemini\\antigravity-ide\\brain\\282aa24d-9d87-4928-a732-b2aba27e97ec\\.user_uploaded\\media_1789866763311.png';
  console.log('Uploading prescription file:', rxImagePath);

  const fileInput = await page.$('input[type="file"]');
  if (!fileInput) {
    throw new Error('File input not found');
  }
  await fileInput.uploadFile(rxImagePath);

  console.log('Waiting for AI pipeline to finish (polling for Auto-Enrolled)...');
  let isDone = false;
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 1000));
    isDone = await page.evaluate(() => {
      return document.body.innerText.includes('Auto-Enrolled') || 
             document.body.innerText.includes('Extracted Medications');
    });
    if (isDone) {
      console.log(`Pipeline completed at second ${i + 1}!`);
      break;
    }
  }

  // Extra pause for rendering transitions
  await new Promise(r => setTimeout(r, 2000));

  const brainDir = 'C:\\Users\\vivek\\.gemini\\antigravity-ide\\brain\\282aa24d-9d87-4928-a732-b2aba27e97ec';
  const rxExtractedShot = path.join(brainDir, 'screenshot_rx_extracted_profile.png');
  await page.screenshot({ path: rxExtractedShot, fullPage: false });
  console.log('Saved screenshot_rx_extracted_profile.png');

  // Verify extracted patient details
  const extractedDetails = await page.evaluate(() => {
    const text = document.body.innerText;
    return {
      hasAshaDevi: text.includes('Asha Devi'),
      hasDoneBadge: text.includes('Auto-Enrolled'),
      hasAgeGender: text.includes('60 Yrs') || text.includes('Yrs'),
      hasMeds: text.includes('Extracted Medications') || text.includes('Tabs')
    };
  });
  console.log('Extracted patient details:', extractedDetails);

  // Click on extracted patient card to open 360 profile!
  console.log('Clicking extracted patient card...');
  await page.evaluate(() => {
    const profileCard = document.querySelector('div[title="Click to view full 360° patient profile"]');
    if (profileCard) {
      profileCard.click();
    } else {
      const heading = Array.from(document.querySelectorAll('h4')).find(h => h.textContent && h.textContent.includes('Asha'));
      if (heading) heading.click();
    }
  });
  await new Promise(r => setTimeout(r, 2000));

  const profileModalShot = path.join(brainDir, 'screenshot_asha_devi_profile_modal.png');
  await page.screenshot({ path: profileModalShot, fullPage: false });
  console.log('Saved screenshot_asha_devi_profile_modal.png');

  const modalDetails = await page.evaluate(() => {
    const text = document.body.innerText;
    return {
      hasAshaDevi: text.includes('Asha Devi'),
      hasVitalsTab: text.includes('Vitals & Overview') || text.includes('Demographics'),
      hasTimeline: text.includes('Encounters') || text.includes('Prescriptions')
    };
  });
  console.log('Asha Devi 360 Modal details:', modalDetails);

  await browser.close();
  console.log('Test completed successfully!');
}

run().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
