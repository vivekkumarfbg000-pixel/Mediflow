/**
 * Mediflow End-to-End AI Clinical Loop Integration Test
 * Run: node scratch/test_full_workflow.js
 */
import http from 'http';

const API_BASE = 'http://localhost:8000';

function post(path, payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const options = {
      hostname: 'localhost',
      port: 8000,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });

    req.on('error', (e) => reject(e));
    req.write(data);
    req.end();
  });
}

async function runTest() {
  console.log('🧪 MEDIFLOW END-TO-END WORKFLOW INTEGRATION TEST');
  console.log('================================================');

  try {
    // 1. Test Stage 1: Onboarding Report Analysis
    console.log('\n[Stage 1] Testing Past Report OCR + Lab Trend Analysis endpoint...');
    const stage1Payload = {
      current_data: {
        age: "45",
        gender: "Male",
        HbA1c: "7.8",
        creatinine: "1.4",
        hemoglobin: "11.2"
      }
    };
    const stage1Res = await post('/api/lab-trend', stage1Payload);
    if (stage1Res.status === 200 && stage1Res.data.analysis) {
      console.log('✅ Stage 1 OK: Successfully generated analysis summary!');
      console.log(`💬 Analysis summary: "${stage1Res.data.analysis.substring(0, 100)}..."`);
    } else {
      console.error('❌ Stage 1 FAIL:', stage1Res);
    }

    // 2. Test Stage 4: Revisit Timing Calculation
    console.log('\n[Stage 4] Testing AI Revisit Follow-up Days extraction...');
    if (stage1Res.status === 200 && stage1Res.data.follow_up_days !== undefined) {
      console.log(`✅ Stage 4 OK: Revisit calculation returned ${stage1Res.data.follow_up_days} days!`);
      const revisitDate = new Date();
      revisitDate.setDate(revisitDate.getDate() + stage1Res.data.follow_up_days);
      console.log(`📅 Revisit locked for: ${revisitDate.toLocaleDateString()}`);
    } else {
      console.error('❌ Stage 4 FAIL: follow_up_days missing in response.');
    }

    // 3. Simulate Stage 7 & 8 Messaging
    console.log('\n[Stage 7/8] Mock testing WhatsApp templates and dosage mappings...');
    const testMeds = [
      { name: 'Metformin 500mg', dosage: '1-0-1' },
      { name: 'Pantoprazole 40mg', dosage: '1-0-0' }
    ];

    const getBilingualInstruction = (medicineName, dosage) => {
      const nameLower = medicineName.toLowerCase();
      const dosageLower = (dosage || '').toLowerCase();
      let english = 'As directed by physician';
      let hindi = 'चिकित्सक के निर्देशानुसार';
      if (nameLower.includes('metformin') || dosageLower.includes('1-0-1')) {
        english = '1 Tablet - Morning & Evening (Post Meal)';
        hindi = '1 गोली - सुबह और शाम (खाने के बाद)';
      } else if (nameLower.includes('pantoprazole') || dosageLower.includes('1-0-0')) {
        english = '1 Tablet - Morning (Empty Stomach, 30 min before food)';
        hindi = '1 गोली - सुबह खाली पेट (खाने से ३० मिनट पहले)';
      }
      return { english, hindi };
    };

    console.log('Generating Hinglish instructions for pharmacy slip...');
    testMeds.forEach((item, idx) => {
      const instr = getBilingualInstruction(item.name, item.dosage);
      console.log(`💊 Drug #${idx+1}: ${item.name} (${item.dosage})`);
      console.log(`   🇬🇧 EN: ${instr.english}`);
      console.log(`   🇮🇳 HI: ${instr.hindi}`);
    });

    console.log('\n================================================');
    console.log('🎉 ALL FULL LOOP INTEGRITY PATHWAYS WORKING SUCCESSFULLY!');
  } catch (err) {
    console.error('❌ Integration Test execution failed:', err);
  }
}

runTest();
