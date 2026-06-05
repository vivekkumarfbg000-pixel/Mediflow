import https from 'https';

const getJSON = (path) => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: path,
      method: 'GET',
      headers: {
        'User-Agent': 'Node.js-script'
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
};

async function main() {
  try {
    const runId = 26972479589;
    const jobsData = await getJSON(`/repos/vivekkumarfbg000-pixel/Mediflow/actions/runs/${runId}/jobs`);
    const deployJob = jobsData.jobs.find(j => j.name.includes('deploy'));
    if (!deployJob) {
      console.log('deploy job not found');
      return;
    }
    console.log(`Found job: ${deployJob.name} (ID: ${deployJob.id})`);
    
    // Fetch logs (returns text)
    const options = {
      hostname: 'api.github.com',
      path: `/repos/vivekkumarfbg000-pixel/Mediflow/actions/jobs/${deployJob.id}/logs`,
      method: 'GET',
      headers: {
        'User-Agent': 'Node.js-script'
      }
    };
    const req = https.request(options, (res) => {
      if (res.statusCode === 307 || res.statusCode === 302) {
        // Follow redirect to download logs
        const redirectUrl = res.headers.location;
        console.log('Redirecting to log URL...');
        https.get(redirectUrl, (logRes) => {
          let logData = '';
          logRes.on('data', (chunk) => { logData += chunk; });
          logRes.on('end', () => {
            console.log('\n--- LOGS ---');
            console.log(logData.slice(-2000)); // last 2000 characters
          });
        });
      } else {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          console.log('Error fetching logs:', res.statusCode, data);
        });
      }
    });
    req.on('error', console.error);
    req.end();
  } catch (e) {
    console.error('Error:', e);
  }
}

main();
