const fs = require('fs');
const path = require('path');
const p = path.resolve('frontend/src/components/pharmacy/PharmacyDashboard.tsx');
let content = fs.readFileSync(p, 'utf8');

const regex1 = /onClick=\{\(\) => \{\s*api\.dispenseMedicineBillAsync\(bill\.id\)\.then\(\(\) => \{\s*window\.dispatchEvent\(new CustomEvent\('mediflow-toast', \{\s*detail: \{ message: `₹\$\{\(bill\.totalAmount \|\| 0\)\.toFixed\(0\)\} collected via CASH\. Stock deducted\.`, type: 'success', title: 'Payment Received' \}\s*\}\)\);\s*syncData\(\);\s*\}\}\s*className="flex-1 px-2\.5 py-1\.5 bg-amber-600 hover:bg-amber-500 text-slate-850 font-black rounded-lg uppercase tracking-wider text-\[9px\] cursor-pointer"/gm;

const replacement1 = `onClick={() => {
                                api.dispenseMedicineBillAsync(bill.id).then(() => {
                                  window.dispatchEvent(new CustomEvent('mediflow-toast', {
                                    detail: { message: \`₹\${(bill.totalAmount || 0).toFixed(0)} collected via CASH. Stock deducted.\`, type: 'success', title: 'Payment Received' }
                                  }));
                                  syncData();
                                }).catch(() => {
                                  window.dispatchEvent(new CustomEvent('mediflow-toast', {
                                    detail: { message: 'Transaction Halted: Another staff member just dispensed this item, resulting in insufficient stock.', type: 'error', title: 'Dispensation Failed 🚨' }
                                  }));
                                });
                              }}
                              className="flex-1 px-2.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-slate-850 font-black rounded-lg uppercase tracking-wider text-[9px] cursor-pointer"`;

const regex2 = /onClick=\{\(\) => \{\s*api\.dispenseMedicineBillAsync\(bill\.id\)\.then\(\(\) => \{\s*window\.dispatchEvent\(new CustomEvent\('mediflow-toast', \{\s*detail: \{ message: `₹\$\{\(bill\.totalAmount \|\| 0\)\.toFixed\(0\)\} collected via UPI\. Stock deducted\.`, type: 'success', title: 'UPI Payment Received' \}\s*\}\)\);\s*syncData\(\);\s*\}\}\s*className="flex-1 px-2\.5 py-1\.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-lg uppercase tracking-wider text-\[9px\] cursor-pointer"/gm;

const replacement2 = `onClick={() => {
                                api.dispenseMedicineBillAsync(bill.id).then(() => {
                                  window.dispatchEvent(new CustomEvent('mediflow-toast', {
                                    detail: { message: \`₹\${(bill.totalAmount || 0).toFixed(0)} collected via UPI. Stock deducted.\`, type: 'success', title: 'UPI Payment Received' }
                                  }));
                                  syncData();
                                }).catch(() => {
                                  window.dispatchEvent(new CustomEvent('mediflow-toast', {
                                    detail: { message: 'Transaction Halted: Another staff member just dispensed this item, resulting in insufficient stock.', type: 'error', title: 'Dispensation Failed 🚨' }
                                  }));
                                });
                              }}
                              className="flex-1 px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-lg uppercase tracking-wider text-[9px] cursor-pointer"`;

content = content.replace(regex1, replacement1);
content = content.replace(regex2, replacement2);
fs.writeFileSync(p, content);
console.log('Done replacing PharmacyDashboard.tsx');
