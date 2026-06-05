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
          reject(new Error(`Failed to parse JSON: ${data.slice(0, 100)}`));
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
};

async function main() {
  try {
    console.log(`\n======================================================`);
    console.log(`FETCHING LATEST ACTION RUNS FOR vivekkumarfbg000-pixel/Mediflow`);
    console.log(`======================================================`);
    const data = await getJSON(`/repos/vivekkumarfbg000-pixel/Mediflow/actions/runs?per_page=5`);
    if (data.workflow_runs && data.workflow_runs.length > 0) {
      data.workflow_runs.forEach(run => {
        console.log(`- Run ID: ${run.id}`);
        console.log(`  Name: ${run.name}`);
        console.log(`  Event: ${run.event}`);
        console.log(`  Status: ${run.status}`);
        console.log(`  Conclusion: ${run.conclusion}`);
        console.log(`  URL: ${run.html_url}`);
        console.log(`  Created: ${run.created_at}`);
        console.log(`------------------------------------------------------`);
      });
    } else {
      console.log('No runs found or API error:', data);
    }
  } catch (e) {
    console.error('Error:', e);
  }
}

main();
