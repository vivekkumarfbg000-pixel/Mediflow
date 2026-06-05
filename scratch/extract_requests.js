const fs = require('fs');
const readline = require('readline');

async function processLineByLine() {
  const fileStream = fs.createReadStream('C:\\Users\\vivek\\.gemini\\antigravity-ide\\brain\\50f35e3f-d83f-418a-b497-5b8aa1653550\\.system_generated\\logs\\transcript.jsonl');

  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let index = 1;
  for await (const line of rl) {
    try {
      const obj = JSON.parse(line);
      if (obj.source === 'USER_EXPLICIT' && obj.type === 'USER_INPUT') {
        const content = obj.content;
        const match = content.match(/<USER_REQUEST>([\s\S]*?)<\/USER_REQUEST>/);
        if (match) {
          const reqText = match[1].trim();
          if (reqText) {
            console.log(`[Request #${index++}] ${reqText}`);
          }
        }
      }
    } catch (e) {
      // ignore parse errors
    }
  }
}

processLineByLine();
