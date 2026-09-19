const fs = require('fs');
const lines = fs.readFileSync('frontend/src/components/compounder/CompounderDashboard.tsx', 'utf8').split('\n');
let inside = false;
lines.forEach((line, i) => {
  if (line.includes('const handleConfirmEveningSlot')) {
    inside = true;
  }
  if (inside) {
    console.log(`Line ${i + 1}: ${line.trimRight()}`);
  }
  if (inside && line.includes('}') && (line.startsWith('  }') || line.startsWith('}'))) {
    inside = false;
  }
});
