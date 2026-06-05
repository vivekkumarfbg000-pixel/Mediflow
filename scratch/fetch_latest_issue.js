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
    const issues = await getJSON('/repos/vivekkumarfbg000-pixel/Mediflow/issues?per_page=1');
    if (issues && issues.length > 0) {
      const issue = issues[0];
      console.log(`Issue Title: ${issue.title}`);
      console.log(`Issue Number: ${issue.number}`);
      console.log(`Issue URL: ${issue.html_url}`);
      console.log(`\n--- ISSUE BODY (LOGS) ---\n`);
      console.log(issue.body);
    } else {
      console.log('No issues found or empty list');
    }
  } catch (e) {
    console.error('Error:', e);
  }
}

main();
