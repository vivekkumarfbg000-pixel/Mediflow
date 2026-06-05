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
    const runId = 26970315474;
    const run = await getJSON(`/repos/vivekkumarfbg000-pixel/Mediflow/actions/runs/${runId}`);
    console.log('Run details:');
    console.log('ID:', run.id);
    console.log('Name:', run.name);
    console.log('Status:', run.status);
    console.log('Conclusion:', run.conclusion);
    console.log('Commit Msg:', run.head_commit?.message);
    
    // Fetch jobs
    const jobsData = await getJSON(`/repos/vivekkumarfbg000-pixel/Mediflow/actions/runs/${runId}/jobs`);
    console.log('\nJobs count:', jobsData.total_count);
    if (jobsData.jobs) {
      jobsData.jobs.forEach(job => {
        console.log(`- Job: ${job.name}, Status: ${job.status}, Conclusion: ${job.conclusion}`);
        if (job.steps) {
          job.steps.forEach(step => {
            console.log(`  - Step: ${step.name}, Status: ${step.status}, Conclusion: ${step.conclusion}`);
          });
        }
      });
    }
  } catch (e) {
    console.error('Error:', e);
  }
}

main();
