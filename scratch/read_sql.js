const fs = require('fs');
const path = require('path');

function searchFile(filePath, query) {
  const absolutePath = path.resolve(filePath);
  if (!fs.existsSync(absolutePath)) {
    console.error(`File does not exist: ${absolutePath}`);
    return;
  }
  
  const contentBuffer = fs.readFileSync(absolutePath);
  let content = contentBuffer.toString('utf16le');
  if (!content.includes('CREATE') && !content.includes('create')) {
    content = contentBuffer.toString('utf8');
  }
  
  const lines = content.split(/\r?\n/);
  console.log(`Searching for "${query}" in ${filePath}:`);
  lines.forEach((line, idx) => {
    if (line.toLowerCase().includes(query.toLowerCase())) {
      console.log(`${idx + 1}: ${line.trim()}`);
    }
  });
}

searchFile('supabase/combined_upgrade.sql', 'FUNCTION');
