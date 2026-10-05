const fs = require('fs');
const path = require('path');
const p = path.resolve('frontend/src/components/compounder/CompounderDashboard.tsx');
let content = fs.readFileSync(p, 'utf8');

const regex = /if \(mode === 'cash'\) \{\s*api\.dispenseMedicineBill\(billId\);\s*window\.dispatchEvent\(new CustomEvent\('mediflow-toast', \{\s*detail: \{\s*message: `Direct cash transaction settled at counter! Stock deducted\. Invoice printed\.`,\s*type: 'success',\s*title: 'POS Settle Complete'\s*\}\s*\}\)\);\s*setBillingItems\(\[\]\);\s*\}/gm;

const replacement = `if (mode === 'cash') {
      api.dispenseMedicineBillAsync(billId).then(() => {
        window.dispatchEvent(new CustomEvent('mediflow-toast', {
          detail: {
            message: \`Direct cash transaction settled at counter! Stock deducted. Invoice printed.\`,
            type: 'success',
            title: 'POS Settle Complete'
          }
        }));
        setBillingItems([]);
      }).catch(() => {
        window.dispatchEvent(new CustomEvent('mediflow-toast', {
          detail: {
            message: 'Transaction Halted: Another staff member just dispensed this item, resulting in insufficient stock.',
            type: 'error',
            title: 'Dispensation Failed 🚨'
          }
        }));
      });
    }`;

content = content.replace(regex, replacement);
fs.writeFileSync(p, content);
console.log('Done replacing CompounderDashboard.tsx');
