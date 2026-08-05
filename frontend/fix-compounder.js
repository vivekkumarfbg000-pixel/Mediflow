// Fix script for CompounderDashboard.tsx
const fs = require('fs');
const path = 'src/components/compounder/CompounderDashboard.tsx';
let content = fs.readFileSync(path, 'utf-8');

// Fix 1: Restore datalist options (find empty datalist and replace)
const emptyDatalist = content.match(/<datalist id="vitals-sugar-list">\s*<\/datalist>/);
if (emptyDatalist) {
  content = content.replace(
    /<datalist id="vitals-sugar-list">\s*<\/datalist>/,
    `<datalist id="vitals-sugar-list">
                          {isOphthalmology ? (
                            ['6/6', '6/9', '6/12', '6/18', '6/24', '6/36', '6/60'].map(opt => (
                              <option key={opt} value={opt} />
                            ))
                          ) : (
                            ['70', '80', '90', '100', '110', '120', '130', '140', '150', '160', '180', '200', '220', '250'].map(opt => (
                              <option key={opt} value={opt} />
                            ))
                          )}
                        </datalist>`
  );
  console.log('Fix 1 applied: Restored datalist options');
} else {
  console.log('Fix 1: datalist pattern not found');
}

// Fix 2: Fix the closing structure for Tab 2
// Find the broken sequence and replace with correct one
// Current broken pattern near end of vitals modal:
//   </div>
//   </div>
//   ,
//   </div>
//   </div>
//   , document.body)}
//   </div>
//   : null}
//
// Should be:
//   </div>
//   </div>,
//   document.body
//   )}
//   </div>
//   </div>
//   )}
//   </div>
//   : null}

// Let's find the broken pattern by looking for ", document.body)}"
const brokenPattern = /(<\/div>\s*\n\s*<\/div>\s*\n\s*,\s*\n\s*<\/div>\s*\n\s*<\/div>\s*\n\s*,\s*document\.body\)\}\s*\n\s*<\/div>\s*\n\s*:\s*null\})/;
const match = content.match(brokenPattern);
if (match) {
  content = content.replace(brokenPattern, 
    `</div>
                </div>,
                document.body
              )}
            </div>
          </div>
          )}
        </div>
      : null}`
  );
  console.log('Fix 2 applied: Fixed Tab 2 closing structure');
} else {
  console.log('Fix 2: broken pattern not found, trying alternative...');
  
  // Try a simpler approach - just find ", document.body)}" and fix the surrounding lines
  const lines = content.split('\n');
  let docBodyLine = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(', document.body)}')) {
      docBodyLine = i;
      break;
    }
  }
  
  if (docBodyLine > 0) {
    console.log(`Found ", document.body)}" at line ${docBodyLine + 1}`);
    console.log('Context:');
    for (let i = Math.max(0, docBodyLine - 5); i <= Math.min(lines.length - 1, docBodyLine + 3); i++) {
      console.log(`  ${i + 1}: ${JSON.stringify(lines[i])}`);
    }
    
    // Find the line with just "," (the misplaced comma)
    let commaLine = -1;
    for (let i = docBodyLine - 3; i < docBodyLine; i++) {
      if (lines[i].trim() === ',') {
        commaLine = i;
        break;
      }
    }
    
    if (commaLine > 0) {
      console.log(`Found misplaced comma at line ${commaLine + 1}`);
      
      // The structure from commaLine-2 to docBodyLine+2 needs to be:
      //   </div>              <- closes glass-panel (keep)
      //   </div>,             <- closes fixed overlay + comma for createPortal
      //   document.body       <- second arg  
      //   )}                  <- close createPortal
      //   </div>              <- close col-span-4
      //   </div>              <- close grid
      //   )}                  <- close inner ternary
      //   </div>              <- close Tab2 root
      //   : null}             <- outer ternary
      
      // Replace lines from (commaLine - 1) to (docBodyLine + 2)
      const newLines = [
        '                </div>,',
        '                document.body',
        '              )}',
        '            </div>',
        '          </div>',
        '          )}',
        '        </div>',
        '      : null}'
      ];
      
      // Keep the glass-panel close (commaLine - 1), replace from commaLine to docBodyLine + 2
      lines.splice(commaLine - 1, (docBodyLine + 2) - (commaLine - 1) + 1, ...newLines);
      content = lines.join('\n');
      console.log('Fix 2 applied via line-level replacement');
    }
  } else {
    console.log('Could not find ", document.body)}" anywhere');
  }
}

fs.writeFileSync(path, content, 'utf-8');
console.log('File saved successfully');
