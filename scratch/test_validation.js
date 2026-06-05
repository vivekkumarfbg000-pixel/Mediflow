import https from 'https';

const yaml_content_1 = `---
title: Mediflow Proactive Monitor
emoji: 🛡️
colorFrom: green
colorTo: blue
sdk: gradio
sdk_version: 4.44.1
python_version: 3.11
app_file: app.py
pinned: false
---`;

const yaml_content_2 = `---
title: Mediflow Proactive Monitor
emoji: 🛡️
colorFrom: green
colorTo: blue
sdk: gradio
sdk_version: 4.44.1
python_version: 3.12
app_file: app.py
pinned: false
---`;

const yaml_content_3 = `---
title: Mediflow Proactive Monitor
emoji: 🛡️
colorFrom: green
colorTo: blue
sdk: gradio
sdk_version: 4.44.1
app_file: app.py
pinned: false
---`;

function testValidate(content, name) {
  return new Promise((resolve) => {
    console.log(`\nTesting ${name}:`);
    const req = https.request({
      hostname: 'huggingface.co',
      path: '/api/validate-yaml',
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
        'Content-Length': Buffer.byteLength(content)
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        console.log(`Status Code: ${res.statusCode}`);
        console.log(`Content-Type: ${res.headers['content-type']}`);
        console.log(`Response: ${data.slice(0, 500)}`);
        resolve();
      });
    });
    req.on('error', (e) => {
      console.error(`Error: ${e.message}`);
      resolve();
    });
    req.write(content);
    req.end();
  });
}

async function main() {
  await testValidate(yaml_content_1, 'python_version: 3.11');
  await testValidate(yaml_content_2, 'python_version: 3.12');
  await testValidate(yaml_content_3, 'Without python_version');
}

main();
