const fs = require('fs');
const path = 'C:\\Users\\vivek\\OneDrive\\Desktop\\Mediflow ecosystem\\frontend\\src\\components\\admin\\SaaSAdminPanel.tsx';
const content = fs.readFileSync(path, 'utf8');

const lines = content.split('\n');

// Remove the premature </div> at line 2912 (0-indexed: 2911)
// And fix the blank lines
// Line 2912:         </div>
// Line 2913: 
// Line 2914: 
// Line 2915: 
// Line 2916:         {/* ...

// We need to remove line 2912 and keep only 2 blank lines instead of 3

lines.splice(2911, 1); // Remove the </div> line (0-indexed)

// Also need to remove one extra blank line to maintain consistent spacing
// After removing line 2912, the blank lines shift. 
// Original: 2913, 2914, 2915 are blank, 2916 is the modal comment
// We want 2 blank lines between the tab and the modal comment

// Let's find the modal comment line
for (let i = 2910; i < lines.length; i++) {
    if (lines[i].includes('Enterprise Tenant Telemetry')) {
        // Ensure there are exactly 2 blank lines before it
        let blankCount = 0;
        for (let j = i - 1; j >= 0 && lines[j].trim() === ''; j--) {
            blankCount++;
        }
        if (blankCount > 2) {
            // Remove extra blank lines
            const toRemove = blankCount - 2;
            lines.splice(i - toRemove, toRemove);
        }
        break;
    }
}

fs.writeFileSync(path, lines.join('\n'));
console.log('Fixed!');