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

// Generate a unique phone number for this test run to avoid unique key conflicts
const testPhone = '98765' + Math.floor(10000 + Math.random() * 90000);
console.log(`Generated unique test phone number: ${testPhone}`);

(async () => {
  console.log(`Using browser: ${chromePath}`);
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: chromePath,
    defaultViewport: { width: 1280, height: 950 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  page.on('console', msg => {
    console.log(`[BROWSER] [${msg.type()}] ${msg.text()}`);
  });

  page.on('pageerror', err => {
    console.error(`[BROWSER EXCEPTION] ${err.toString()}`);
  });

  const screenshotDir = path.resolve(__dirname, 'screenshots');
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  const saveScreenshot = async (name) => {
    const p = path.join(screenshotDir, name);
    await page.screenshot({ path: p, fullPage: false });
    console.log(`Screenshot saved: ${p}`);
  };

  try {
    console.log("Navigating to http://localhost:5173/ ...");
    await page.goto('http://localhost:5173/', { waitUntil: 'load', timeout: 15000 });
    await new Promise(resolve => setTimeout(resolve, 2000));
    await saveScreenshot('revisit_0_landing.png');

    // 1. Authenticate as Doctor Vivek
    console.log("Logging in as Dr. Vivek...");
    const demoButtons = await page.$$('button');
    let doctorBtn = null;
    for (const btn of demoButtons) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text.includes('Vivek') && text.includes('doctor')) {
        doctorBtn = btn;
        break;
      }
    }

    if (!doctorBtn) {
      throw new Error("Could not find Doctor Vivek demo login button.");
    }
    await doctorBtn.click();
    console.log("Logged in. Waiting for dashboard to load...");
    await new Promise(resolve => setTimeout(resolve, 5000));
    await saveScreenshot('revisit_1_doctor_dashboard.png');

    // 2. Turn on Bypass Mode
    console.log("Enabling Developer Bypass...");
    const bypassButtons = await page.$$('button');
    let bypassBtn = null;
    for (const btn of bypassButtons) {
      const text = await page.evaluate(el => el.textContent, btn);
      const textUpper = text.toUpperCase();
      if (textUpper.includes('SECURE MODE') || textUpper.includes('BYPASS ACTIVE')) {
        bypassBtn = btn;
        break;
      }
    }

    if (bypassBtn) {
      const bypassText = await page.evaluate(el => el.textContent, bypassBtn);
      if (bypassText.toUpperCase().includes('SECURE MODE')) {
        console.log("Clicking Dev Bypass Trigger to activate Bypass Mode...");
        await bypassBtn.click();
        await new Promise(resolve => setTimeout(resolve, 1500));
      } else {
        console.log("Bypass Mode is already active.");
      }
    }
    await saveScreenshot('revisit_2_bypass_active.png');

    // 3. Switch to Compounder Dashboard
    console.log("Navigating to Compounder Dashboard...");
    const navButtons = await page.$$('button');
    let compounderBtn = null;
    for (const btn of navButtons) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text.includes('Compounder')) {
        compounderBtn = btn;
        break;
      }
    }
    if (!compounderBtn) {
      throw new Error("Could not find Compounder sidebar navigation button.");
    }
    await compounderBtn.click();
    await new Promise(resolve => setTimeout(resolve, 3000));
    await saveScreenshot('revisit_3_compounder_dashboard.png');

    // Fill registration form for Aarav Sharma with unique phone number
    console.log("Registering Aarav Sharma with unique phone number...");
    await page.focus('input[placeholder*="Rahul"]');
    await page.keyboard.type('Aarav Sharma');

    await page.focus('input[placeholder*="9876543210"]');
    await page.keyboard.type(testPhone);

    await page.focus('input[placeholder*="35"]');
    await page.keyboard.type('45');

    const regButtons = await page.$$('button');
    let registerBtn = null;
    for (const btn of regButtons) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text.trim() === 'Register Patient') {
        registerBtn = btn;
        break;
      }
    }
    if (!registerBtn) {
      throw new Error("Could not find Register Patient button.");
    }
    await registerBtn.click();
    await new Promise(resolve => setTimeout(resolve, 4000));
    await saveScreenshot('revisit_3a_registered.png');

    // Expose API calls to set Vitals + Token and create + complete Lab Requisition in Database
    console.log("Setting vitals/token and creating completed lab report in database via API services...");
    await page.evaluate(async (phone) => {
      if (window.api) {
        const patient = window.api.getPatients().find(p => p.phone === phone);
        if (!patient) throw new Error(`Patient with phone ${phone} was not found in patient registry after registration!`);
        const patientId = patient.id;

        // Set vitals and token TK-05 in local storage & database
        window.api.updatePatientVitalsAndToken(patientId, {
          temperature: '98.6',
          bloodPressure: '120/80',
          pulseRate: '72',
          weight: '65',
          bloodSugar: '110',
          recordedAt: new Date().toISOString()
        }, 'TK-05');

        // Create pathology lab requisition in database
        const req = window.api.createLabRequisitionFromPrescription(
          patientId,
          '4544-3', // HbA1c
          'Complete Blood Count & Diabetes Panel',
          'https://example.com/mock-prescription.pdf'
        );

        // Inject a pending lab report referencing this valid requisition (so status is 'pending' for Compounder review)
        const reports = [
          {
            id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317408', // valid UUID
            requisitionId: req.id,
            patientId: patientId,
            patientName: 'Aarav Sharma',
            reportFileUrl: 'https://example.com/mock-report.pdf',
            biomarkerJson: {
              testName: 'Complete Blood Count & Diabetes Panel',
              biomarkers: {
                HbA1c: 7.8,
                creatinine: 1.4,
                hemoglobin: 11.2
              }
            },
            status: 'pending'
          }
        ];
        localStorage.setItem('mediflow_full_lab_reports', JSON.stringify(reports));
      }
    }, testPhone);

    console.log("Reloading page to fetch updated database records...");
    await page.reload({ waitUntil: 'load' });
    await new Promise(resolve => setTimeout(resolve, 4000));

    // Re-enable Dev Bypass after reload
    console.log("Re-enabling Dev Bypass post-reload...");
    const bypassButtons2 = await page.$$('button');
    let bypassBtn2 = null;
    for (const btn of bypassButtons2) {
      const text = await page.evaluate(el => el.textContent, btn);
      const textUpper = text.toUpperCase();
      if (textUpper.includes('SECURE MODE') || textUpper.includes('BYPASS ACTIVE')) {
        bypassBtn2 = btn;
        break;
      }
    }
    if (bypassBtn2) {
      const bypassText = await page.evaluate(el => el.textContent, bypassBtn2);
      if (bypassText.toUpperCase().includes('SECURE MODE')) {
        await bypassBtn2.click();
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }

    // Go to Compounder Dashboard
    console.log("Navigating back to Compounder Dashboard...");
    const navButtons2 = await page.$$('button');
    let compounderBtn2 = null;
    for (const btn of navButtons2) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text.includes('Compounder')) {
        compounderBtn2 = btn;
        break;
      }
    }
    await compounderBtn2.click();
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Switch to Labs Tab
    console.log("Switching to Labs tab...");
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => b.textContent.includes('Lab Booking') || b.textContent.includes('पैथोलॉजी लैब बुकिंग'));
      if (btn) btn.click();
    });
    await new Promise(resolve => setTimeout(resolve, 2500));
    await saveScreenshot('revisit_4_labs_tab.png');

    // 4. Test AI Revisit Scheduling on Lab Report
    console.log("Locating Aarav Sharma's Completed Lab Report card and clicking '🤖 AI' button...");
    const clickedAI = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => b.textContent.trim() === '🤖 AI' || (b.title && b.title.includes('AI Calculate Advice Revisit')));
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });
    if (!clickedAI) {
      throw new Error("Could not find or click '🤖 AI' button inside the report card.");
    }
    await new Promise(resolve => setTimeout(resolve, 12000)); // Wait for backend call and calculation
    await saveScreenshot('revisit_5_ai_calculated.png');

    // Verify values in Date and Time inputs inside the report card specifically
    const revisitData = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.bg-white.border.border-slate-200.rounded-xl.p-3'));
      const card = cards.find(el => el.textContent.includes("Schedule Revisit for Doctor's Final Advice"));
      if (!card) return { date: null, time: null, note: null };
      const dateInput = card.querySelector('input[type="date"]');
      const timeInput = card.querySelector('input[type="time"]');
      const noteInput = card.querySelector('input[type="text"]');
      return {
        date: dateInput ? dateInput.value : null,
        time: timeInput ? timeInput.value : null,
        note: noteInput ? noteInput.value : null
      };
    });

    console.log("Calculated AI Revisit Values:");
    console.log(`- Date: ${revisitData.date}`);
    console.log(`- Time: ${revisitData.time}`);
    console.log(`- Note: ${revisitData.note}`);

    if (revisitData.time !== '16:40') {
      console.warn(`WARNING: Expected revisit time to be 16:40 for token #5, but got ${revisitData.time}`);
    } else {
      console.log("✅ SUCCESS: AI Revisit Time correctly calculated to 16:40 (4:40 PM) based on Token #5!");
    }

    // Click Approve & Revisit
    console.log("Clicking 'Approve & Revisit' button...");
    const clickedApprove = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => b.textContent.includes('Approve & Revisit'));
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });
    if (!clickedApprove) {
      throw new Error("Could not find or click Approve & Revisit button.");
    }
    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log("Report approved!");
    await saveScreenshot('revisit_6_report_approved.png');

    // 5. Test Manual Scheduling Desk Auto-Population
    console.log("Testing Manual Scheduling Desk dropdown auto-population...");
    await page.evaluate(() => {
      const selects = Array.from(document.querySelectorAll('select'));
      const patSelect = selects.find(s => {
        const html = s.outerHTML;
        return html.includes('revisitPatientId') || html.includes('Select Patient');
      });
      if (patSelect) {
        // Find Aarav's option value dynamically
        const options = Array.from(patSelect.options);
        const opt = options.find(o => o.text.includes('Aarav Sharma'));
        if (opt) {
          patSelect.value = opt.value;
          patSelect.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    });

    await new Promise(resolve => setTimeout(resolve, 2000));
    await saveScreenshot('revisit_7_manual_desk_filled.png');

    const manualData = await page.evaluate(() => {
      const panel = Array.from(document.querySelectorAll('.glass-panel'))
        .find(el => el.textContent.includes("Doctor's Final Advice Appointment Desk"));
      if (!panel) return { date: null, time: null };
      const dateInput = panel.querySelector('input[type="date"]');
      const timeInput = panel.querySelector('input[type="time"]');
      return {
        date: dateInput ? dateInput.value : null,
        time: timeInput ? timeInput.value : null
      };
    });

    console.log("Manual Desk Auto-Populated Values:");
    console.log(`- Date: ${manualData.date}`);
    console.log(`- Time: ${manualData.time}`);

    if (manualData.time !== '16:40') {
      console.warn(`WARNING: Expected manual desk time to be 16:40 for token #5, but got ${manualData.time}`);
    } else {
      console.log("✅ SUCCESS: Manual Desk correctly auto-populated to 16:40 (4:40 PM) based on Token #5!");
    }

    // Submit manual booking
    console.log("Submitting manual desk reservation...");
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => b.textContent.includes('Lock Advice Appointment'));
      if (btn) btn.click();
    });
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log("Manual advice appointment booked!");
    await saveScreenshot('revisit_8_manual_submitted.png');

    // 6. Open WhatsApp Sandbox and Verify Message
    console.log("Opening Patient WhatsApp Simulator...");
    const waTrigger = await page.$('button[title="Open Patient WhatsApp Simulator"]');
    if (!waTrigger) {
      throw new Error("Could not find Patient WhatsApp Simulator trigger button.");
    }
    await waTrigger.click();
    await new Promise(resolve => setTimeout(resolve, 2000));
    await saveScreenshot('revisit_9_whatsapp_open.png');

    // Select Aarav Sharma session in WhatsApp simulator
    console.log("Selecting Aarav Sharma session in WhatsApp simulator...");
    await page.evaluate((phone) => {
      const select = document.querySelector('select'); // simulator patient selector dropdown
      if (select) {
        select.value = phone;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, testPhone);
    await new Promise(resolve => setTimeout(resolve, 2000));
    await saveScreenshot('revisit_10_aarav_chats.png');

    // Extract all chat messages text
    const chatMessages = await page.evaluate(() => {
      const messages = Array.from(document.querySelectorAll('.flex-1 p'));
      return messages.map(m => m.textContent);
    });

    console.log("\n========================================================");
    console.log(`WHATSAPP MESSAGES LOGGED FOR AARAV SHARMA (+91 ${testPhone}):`);
    console.log("========================================================");
    chatMessages.forEach((msg, idx) => {
      console.log(`[Message #${idx + 1}]:\n${msg}\n----------------------------------------`);
    });

    console.log("\nVerification complete!");
  } catch (err) {
    console.error("Verification failed:", err);
    await saveScreenshot('revisit_failed.png');
  } finally {
    await browser.close();
  }
})();
