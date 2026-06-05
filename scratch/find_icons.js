const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.tsx') || file.endsWith('.ts') || file.endsWith('.css')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk('frontend/src');
files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (line.includes('hub') || line.includes('grid_view') || line.includes('biotech') || line.includes('medication') || line.includes('chat_bubble') || line.includes('wallet') || line.includes('terminal')) {
      let matches = 0;
      for (let offset = -8; offset <= 8; offset++) {
        const nIdx = idx + offset;
        if (nIdx >= 0 && nIdx < lines.length) {
          const nLine = lines[nIdx];
          if (nLine.includes('hub') || nLine.includes('grid_view') || nLine.includes('biotech') || nLine.includes('medication') || nLine.includes('chat_bubble') || nLine.includes('wallet') || nLine.includes('terminal') || nLine.includes('material-symbols-outlined')) {
            matches++;
          }
        }
      }
      if (matches >= 4) {
        console.log(`${file}:${idx + 1}: ${line.trim()}`);
      }
    }
  });
});
