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
    const runId = 26970044941;
    console.log(`\n======================================================`);
    console.log(`FETCHING RUN DETAILS FOR: ${runId}`);
    console.log(`======================================================`);
    const run = await getJSON(`/repos/vivekkumarfbg000-pixel/Mediflow/actions/runs/${runId}`);
    console.log(JSON.stringify(run, null, 2));
  } catch (e) {
    console.error('Error:', e);
  }
}

main();
