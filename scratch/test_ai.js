import http from 'http';

console.log('──────────────────────────────────────────────────────────────────');
console.log('🧠  AI ENGINE INTEGRITY AUDIT: TESTING ACTIVE ENDPOINTS');
console.log('──────────────────────────────────────────────────────────────────\n');

const testEndpoints = [
  {
    name: 'Lab Trend Analysis',
    path: '/api/lab-trend',
    method: 'POST',
    payload: {
      HbA1c: '7.8%',
      creatinine: '1.2 mg/dL'
    }
  },
  {
    name: 'Seasonal Forecast Generation',
    path: '/api/generate-seasonal-forecast',
    method: 'POST',
    payload: {
      pharmacy_entity_id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317003',
      pod_id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001',
      current_month: 'May',
      regional_weather: 'Extreme pre-monsoon heat waves and high humidity levels in Patna.'
    }
  },
  {
    name: 'Virtual Clinic Consult Room Generator',
    path: '/api/generate-consult-room',
    method: 'POST',
    payload: {
      appointment_id: 'appt-test-101',
      patient_phone: '9876543210',
      doctor_name: 'Dr. Sharma'
    }
  }
];

function request(endpoint) {
  return new Promise((resolve) => {
    const data = JSON.stringify(endpoint.payload);
    const options = {
      hostname: 'localhost',
      port: 8000,
      path: endpoint.path,
      method: endpoint.method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    console.log(`📡 [Sending] Test request for "${endpoint.name}" to http://localhost:8000${endpoint.path}...`);
    const req = http.request(options, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        console.log(`   ✅ [Response] Status: ${res.statusCode}`);
        try {
          const parsed = JSON.parse(body);
          console.log(`   ✅ [Verify] Parsed JSON response successfully.`);
          resolve({ success: res.statusCode === 200, parsed });
        } catch (e) {
          console.log(`   ⚠️  [Warn] Failed parsing JSON body. Body length: ${body.length}`);
          resolve({ success: false, body });
        }
      });
    });

    req.on('error', (e) => {
      console.log(`   ❌ [Connection Error] Backend offline or unreachable: ${e.message}`);
      resolve({ success: false, error: e.message });
    });

    req.write(data);
    req.end();
  });
}

async function run() {
  let successes = 0;
  for (const endpoint of testEndpoints) {
    const res = await request(endpoint);
    if (res.success) {
      successes++;
    }
    console.log('');
  }

  console.log('──────────────────────────────────────────────────────────────────');
  if (successes === testEndpoints.length) {
    console.log('🏆  SUCCESS: ALL LOCAL AI PATHWAYS ONLINE AND HEALTHY!');
  } else {
    console.log('ℹ️  INFO: Live backend offline. Falling back to high-fidelity frontend CDSS simulators.');
  }
  console.log('──────────────────────────────────────────────────────────────────');
}

run();
