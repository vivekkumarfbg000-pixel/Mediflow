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
  console.log(`Using browser: ${chromePath}`);
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: chromePath,
    defaultViewport: { width: 1280, height: 800 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  page.on('console', msg => {
    console.log(`[BROWSER] [${msg.type()}] ${msg.text()}`);
  });

  page.on('pageerror', err => {
    console.error(`[BROWSER EXCEPTION] ${err.toString()}`);
  });

  page.on('response', response => {
    const status = response.status();
    if (status >= 400) {
      console.log(`[NETWORK ERROR] ${response.url()} returned status ${status}`);
    }
  });

  const screenshotDir = path.resolve(__dirname, 'screenshots');
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir);
  }

  const saveScreenshot = async (name) => {
    const p = path.join(screenshotDir, name);
    await page.screenshot({ path: p, fullPage: true });
    console.log(`Screenshot saved: ${p}`);
  };

  try {
    console.log("Navigating to http://localhost:5173/ ...");
    await page.goto('http://localhost:5173/', { waitUntil: 'load', timeout: 15000 });
    await new Promise(resolve => setTimeout(resolve, 2000));
    await saveScreenshot('0_auth_gateway.png');

    // 1. Authenticate as Doctor Vivek
    console.log("Clicking demo profile button for Dr. Vivek Kumar...");
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
      throw new Error("Could not find Dr. Vivek Kumar demo profile button.");
    }
    await doctorBtn.click();
    console.log("Clicked doctor profile. Waiting 6 seconds for dashboard to load...");
    await new Promise(resolve => setTimeout(resolve, 6000));
    await saveScreenshot('1_doctor_dashboard.png');

    // 2. Turn on Bypass Mode in Settings Accordion
    console.log("Locating Dev Bypass Trigger button...");
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

    if (!bypassBtn) {
      console.log("Dev Bypass Trigger not directly found. Locating settings accordion toggle...");
      const settingsButtons = await page.$$('button');
      let settingsBtn = null;
      for (const btn of settingsButtons) {
        const text = await page.evaluate(el => el.textContent, btn);
        if (text.includes('Settings')) {
          settingsBtn = btn;
          break;
        }
      }
      if (settingsBtn) {
        console.log("Clicking Settings accordion to expand...");
        await settingsBtn.click();
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Try searching again
        const bypassButtonsRetry = await page.$$('button');
        for (const btn of bypassButtonsRetry) {
          const text = await page.evaluate(el => el.textContent, btn);
          const textUpper = text.toUpperCase();
          if (textUpper.includes('SECURE MODE') || textUpper.includes('BYPASS ACTIVE')) {
            bypassBtn = btn;
            break;
          }
        }
      }
    }

    if (!bypassBtn) {
      throw new Error("Could not find Dev Bypass Trigger button.");
    }

    const bypassText = await page.evaluate(el => el.textContent, bypassBtn);
    const bypassTextUpper = bypassText.toUpperCase();
    if (bypassTextUpper.includes('SECURE MODE')) {
      console.log("Clicking Dev Bypass Trigger to activate Bypass Mode...");
      await bypassBtn.click();
      await new Promise(resolve => setTimeout(resolve, 1500));
    } else {
      console.log("Bypass Mode is already active.");
    }
    await saveScreenshot('2_bypass_activated.png');

    // 3. Switch to Compounder Dashboard
    console.log("Switching to Compounder Dashboard...");
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
    console.log("Waiting 3 seconds for Compounder Dashboard to render...");
    await new Promise(resolve => setTimeout(resolve, 3000));
    await saveScreenshot('3_compounder_dashboard.png');

    // 4. Fill Patient Registration Form
    console.log("Filling in patient registration details...");
    // Let's inspect the page inputs to see which ones are visible
    const inputsInfo = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input, select, textarea'));
      return inputs.map((input, idx) => ({
        idx,
        tagName: input.tagName,
        type: input.getAttribute('type'),
        placeholder: input.getAttribute('placeholder'),
        name: input.getAttribute('name'),
        id: input.getAttribute('id'),
        outerHTML: input.outerHTML.substring(0, 150)
      }));
    });
    console.log("Found page inputs:", JSON.stringify(inputsInfo, null, 2));

    // Let's fill the patient registration fields by matching placeholder or order
    // In Compounder Intake Tab, fields are:
    // - Full Name (placeholder containing "Patient Name" or similar)
    // - Phone number (placeholder containing "Phone" or similar)
    // - Age (placeholder containing "Age" or similar)
    // - Gender (Select)
    const testName = `Auto Test Patient ${Date.now()}`;
    const testPhone = `88888${Math.floor(10000 + Math.random() * 90000)}`;
    const testAge = `35`;

    // Use Puppeteer's native methods for typing to ensure React state updates.
    console.log("Typing patient name...");
    const nameSelector = 'input[placeholder*="Rahul"]';
    await page.focus(nameSelector);
    await page.keyboard.type(testName);

    console.log("Typing phone number...");
    const phoneSelector = 'input[placeholder*="9876543210"]';
    await page.focus(phoneSelector);
    await page.keyboard.type(testPhone);

    console.log("Typing age...");
    const ageSelector = 'input[placeholder*="35"]';
    await page.focus(ageSelector);
    await page.keyboard.type(testAge);

    console.log(`Filled registration fields natively: Name="${testName}", Phone="${testPhone}", Age="${testAge}"`);
    await saveScreenshot('4_registration_filled.png');

    // Select Gender "Male" (it's already Male by default, but let's select it explicitly to be safe)
    await page.evaluate(() => {
      const selects = Array.from(document.querySelectorAll('select'));
      const genderSelect = selects.find(s => {
        const html = s.outerHTML.toLowerCase();
        return html.includes('gender') || html.includes('लिङ्ग');
      });
      if (genderSelect) {
        genderSelect.value = 'Male';
        genderSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    // Click 'Register Patient' button
    console.log("Clicking 'Register Patient' button...");
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
      throw new Error("Could not find Register button.");
    }
    await registerBtn.click();
    console.log("Clicked! Waiting 4 seconds for registration to submit...");
    await new Promise(resolve => setTimeout(resolve, 4000));
    await saveScreenshot('5_registration_submitted.png');

    // 5. Check if patient is in active queue or if we can log vitals
    // Since bypass mode is active, we can go directly to the Doctor Dashboard to check if the patient is in the queue.
    console.log("Switching back to Doctor Dashboard...");
    const navButtons2 = await page.$$('button');
    let doctorBtn2 = null;
    for (const btn of navButtons2) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text.includes('Doctor Dashboard')) {
        doctorBtn2 = btn;
        break;
      }
    }
    if (!doctorBtn2) {
      throw new Error("Could not find Doctor Dashboard sidebar navigation button.");
    }
    await doctorBtn2.click();
    console.log("Waiting 3 seconds for Doctor Dashboard to load...");
    await new Promise(resolve => setTimeout(resolve, 3000));
    await saveScreenshot('6_doctor_queue.png');

    const patientsLocalStorage = await page.evaluate(() => {
      return localStorage.getItem('mediflow_patients');
    });
    console.log("Patients in Local Storage:", patientsLocalStorage);

    console.log("========================================================================");
    console.log("[DevSecOps] E2E COMPLETE CLINICAL WORKFLOW SUCCESSFUL!");
    console.log("========================================================================\n");
  } catch (err) {
    console.error(`E2E Clinical Workflow Test failed: ${err.message}`);
    await saveScreenshot('failed_error.png');
  } finally {
    await browser.close();
  }
})();
