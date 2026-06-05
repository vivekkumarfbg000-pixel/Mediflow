import https from 'https';

const getJSON = (path) => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: path,
      method: 'GET',
      headers: { 'User-Agent': 'Node.js-script' }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.end();
  });
};

async function main() {
  try {
    const runId = 26977022217;
    const jobsData = await getJSON(`/repos/vivekkumarfbg000-pixel/Mediflow/actions/runs/${runId}/jobs`);
    console.log(`Jobs count: ${jobsData.total_count}`);
    if (jobsData.jobs) {
      jobsData.jobs.forEach(job => {
        console.log(`\n- Job: ${job.name}`);
        console.log(`  Status: ${job.status} | Conclusion: ${job.conclusion}`);
        if (job.steps) {
          job.steps.forEach(step => {
            const flag = step.conclusion === 'failure' ? '  ❌' : '  ✅';
            console.log(`${flag} Step: ${step.name} | Conclusion: ${step.conclusion}`);
          });
        }
      });
    }
  } catch (e) {
    console.error('Error:', e);
  }
}

main();
