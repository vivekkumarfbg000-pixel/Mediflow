const fs = require('fs');
const content = fs.readFileSync('frontend/src/components/compounder/CompounderDashboard.tsx', 'utf8');

let braces = 0;
let brackets = 0;
let parens = 0;
let lineNum = 1;

for (let i = 0; i < content.length; i++) {
  const char = content[i];
  if (char === '\n') lineNum++;

  if (char === '{') braces++;
  else if (char === '}') braces--;
  else if (char === '[') brackets++;
  else if (char === ']') brackets--;
  else if (char === '(') parens++;
  else if (char === ')') parens--;

  if (braces < 0) {
    console.log(`Mismatched } at line ${lineNum}`);
    braces = 0;
  }
  if (brackets < 0) {
    console.log(`Mismatched ] at line ${lineNum}`);
    brackets = 0;
  }
  if (parens < 0) {
    console.log(`Mismatched ) at line ${lineNum}`);
    parens = 0;
  }
}

console.log('Final counts:', { braces, brackets, parens });
