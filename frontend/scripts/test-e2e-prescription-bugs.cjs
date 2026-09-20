const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

async function testPrescriptionWorkflow() {
  console.log('🚀 Launching E2E Verification for AI Prescription Workflow Fixes...');

  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const testImagePath = 'C:\\Users\\vivek\\.gemini\\antigravity-ide\\brain\\282aa24d-9d87-4928-a732-b2aba27e97ec\\.user_uploaded\\media_1789866763311.png';
  const screenshotPath = 'C:\\Users\\vivek\\.gemini\\antigravity-ide\\brain\\282aa24d-9d87-4928-a732-b2aba27e97ec\\verified_prescription_workflow.png';

  if (!fs.existsSync(testImagePath)) {
    throw new Error('Test prescription image not found at: ' + testImagePath);
  }

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    defaultViewport: { width: 1440, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();

    // Catch console logs (filter spam)
    page.on('console', msg => {
      const txt = msg.text();
      if ((txt.includes('OCR') || txt.includes('Encounter') || txt.includes('Appointment') || txt.includes('Billing') || txt.includes('Asha')) && !txt.includes('RealtimeSync') && !txt.includes('Realtime Appointment update')) {
        console.log('[Browser]', txt);
      }
    });

    console.log('1. Navigating to Mediflow dev server...');
    await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded', timeout: 30000 });

    console.log('2. Setting demo compounder session in localStorage...');
    await page.evaluate(() => {
      localStorage.setItem('mediflow_dev_bypass', 'true');
      const demoProfile = {
        id: 'compounder-dev-001',
        entity_id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001',
        role: 'compounder',
        display_name: 'Rahul Sharma (Compounder)',
        email: 'compounder@vitalsync.internal',
        consultation_fee: 500
      };
      localStorage.setItem('vitalsync_cached_profile', JSON.stringify(demoProfile));
      localStorage.setItem('vitalsync_active_role', 'compounder');
      localStorage.setItem('vitalsync_active_pod', JSON.stringify({
        id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001',
        clinicCode: 'VS-V01R',
        name: 'VitalSync Smart PolyClinic',
        location: 'Line Bazar, Purnea, Bihar',
        status: 'active',
        isSovereignPod: true
      }));
    });

    await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
    await new Promise(r => setTimeout(r, 2000));

    console.log('3. Navigating to Prescription Scanner tab in Compounder Desk...');
    const clickedTabName = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const scanTab = buttons.find(b => b.textContent && (b.textContent.includes('Prescription Scan') || b.textContent.includes('Rx Scan') || b.textContent.includes('Scan & OCR')));
      if (scanTab) {
        scanTab.click();
        return scanTab.textContent.trim();
      }
      return null;
    });
    console.log('  Clicked tab:', clickedTabName || 'Tab not found directly');

    await new Promise(r => setTimeout(r, 2000));

    console.log('4. Uploading prescription test image...');
    await page.waitForSelector('input[type="file"]', { timeout: 10000 });
    const fileInput = await page.$('input[type="file"]');
    if (!fileInput) {
      throw new Error('File input element not found in DOM!');
    }
    await fileInput.uploadFile(testImagePath);
    console.log('  Image uploaded. Waiting for OCR extraction...');

    // Wait strictly for Asha Devi card in extracted clinical profile panel
    console.log('  Image uploaded. Waiting for OCR extraction & Asha Devi card...');
    await page.waitForFunction(
      () => {
        const card = document.querySelector('div.lg\\:col-span-5');
        return card && (card.innerText.includes('Asha Devi') || card.innerText.includes('Asha'));
      },
      { timeout: 60000 }
    );
    console.log('  ✅ OCR extraction completed & Asha Devi profile rendered!');

    await new Promise(r => setTimeout(r, 2000));

    // VERIFICATION 1: Extracted Patient Name
    const bodyContent = await page.evaluate(() => document.body.innerText);
    const hasAshaDevi = bodyContent.includes('Asha Devi');
    console.log(`  Patient Name Extracted 'Asha Devi': ${hasAshaDevi ? '✅ PASS' : '❌ FAIL'}`);

    // VERIFICATION 2: Bug 2 - Phone Number Handling (No hardcoded 9876543210 in extracted card)
    console.log('5. Verifying Bug 2 Fix: Mobile number handling in Extracted Patient Card...');
    const cardInfo = await page.evaluate(() => {
      const card = document.querySelector('div.lg\\:col-span-5') || document.body;
      const cardText = card.innerText || '';
      const input = card.querySelector('input[type="tel"]') || card.querySelector('input[placeholder*="mobile"]');
      return {
        cardHasHardcoded: cardText.includes('+91 9876543210') || cardText.includes('9876543210'),
        hasMobileInput: !!input,
        inputValue: input ? input.value : null
      };
    });

    console.log(`  Extracted Card has fake hardcoded '9876543210': ${cardInfo.cardHasHardcoded ? '❌ FAIL' : '✅ PASS (Clean state)'}`);
    console.log(`  Extracted Card displays interactive mobile input: ${cardInfo.hasMobileInput ? '✅ PASS' : 'ℹ️ Display mode'}`);

    if (cardInfo.hasMobileInput) {
      await page.evaluate(() => {
        const card = document.querySelector('div.lg\\:col-span-5') || document.body;
        const input = card.querySelector('input[type="tel"]') || card.querySelector('input[placeholder*="mobile"]');
        if (input) {
          const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          nativeSetter.call(input, '9876501234');
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
      await new Promise(r => setTimeout(r, 500));
      await page.evaluate(() => {
        const card = document.querySelector('div.lg\\:col-span-5') || document.body;
        const btns = Array.from(card.querySelectorAll('button'));
        const saveBtn = btns.find(b => b.textContent && b.textContent.trim() === 'Save');
        if (saveBtn) saveBtn.click();
      });
      console.log('  ✅ Entered 9876501234 and clicked Save.');
      await new Promise(r => setTimeout(r, 1000));
    }

    // VERIFICATION 3: Bug 3 - Appointment Booked for Today
    console.log('6. Verifying Bug 3 Fix: Appointment booked in today\'s OPD queue...');
    const apptCheck = await page.evaluate(() => {
      try {
        const appts = window.api ? window.api.getAppointments() : [];
        const patients = window.api ? window.api.getPatients() : [];
        const ashaPat = patients.find(p => p.name && p.name.includes('Asha'));
        const ashaAppt = appts.find(a => 
          (a.patientName && a.patientName.includes('Asha')) || 
          (a.patient_name && a.patient_name.includes('Asha')) ||
          (ashaPat && (a.patientId === ashaPat.id || a.patient_id === ashaPat.id))
        );
        return {
          totalAppts: appts.length,
          foundAshaPatient: !!ashaPat,
          ashaPatientId: ashaPat ? ashaPat.id : null,
          foundAshaAppt: !!ashaAppt,
          ashaApptToken: ashaAppt ? (ashaAppt.tokenNumber || ashaAppt.token_number) : null,
          ashaApptStatus: ashaAppt ? ashaAppt.status : null,
          ashaApptPaymentStatus: ashaAppt ? (ashaAppt.paymentStatus || ashaAppt.payment_status) : null
        };
      } catch (e) {
        return { error: e.message };
      }
    });
    console.log('  Appointment check result:', apptCheck);
    if (apptCheck.foundAshaAppt) {
      console.log(`  ✅ PASS: Appointment booked for Asha Devi! Token: ${apptCheck.ashaApptToken}, Status: ${apptCheck.ashaApptStatus}`);
    } else {
      console.log('  ❌ FAIL: Appointment not found in today\'s queue!');
    }

    // VERIFICATION 4: Bug 1 - Proceed to Billing selects Asha Devi
    console.log('7. Verifying Bug 1 Fix: Proceed to Billing & Token Issue...');
    const clickedProceed = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => b.textContent && (b.textContent.includes('Proceed to Billing') || b.textContent.includes('Billing & Token')));
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });

    if (clickedProceed) {
      console.log('  Clicked Proceed to Billing button. Waiting for Billing POS to render...');
      await new Promise(r => setTimeout(r, 2500));

      const billingCheck = await page.evaluate(() => {
        const bodyText = document.body.innerText;
        return {
          hasAshaDevi: bodyText.includes('Asha Devi'),
          hasWalkInFallback: bodyText.includes('Walk-in Patient (Assisted Review)')
        };
      });

      console.log(`  Billing POS contains 'Asha Devi': ${billingCheck.hasAshaDevi ? '✅ PASS' : '❌ FAIL'}`);
      console.log(`  Billing POS fallback 'Walk-in Patient (Assisted Review)': ${billingCheck.hasWalkInFallback ? '⚠️ Fallback active' : '✅ NO Fallback (Exact patient bound!)'}`);

      // Take screenshot of Billing POS showing patient Asha Devi
      await page.screenshot({ path: screenshotPath, fullPage: false });
      console.log(`  📸 Screenshot saved to: ${screenshotPath}`);
    } else {
      console.log('  ❌ Could not find Proceed to Billing button!');
    }

    console.log('\n🎉 ALL VERIFICATION CHECKS COMPLETED!');
  } catch (err) {
    console.error('❌ Verification script error:', err);
  } finally {
    await browser.close();
  }
}

testPrescriptionWorkflow();
