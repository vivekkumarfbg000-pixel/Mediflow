const fs = require('fs');
const path = 'C:\\Users\\vivek\\OneDrive\\Desktop\\Mediflow ecosystem\\frontend\\src\\components\\admin\\SaaSAdminPanel.tsx';
const content = fs.readFileSync(path, 'utf8');

const old = "</div>\n\n            {/* TAB: AI Fleet Commander Matrix */}\n            {activeTab === 'ai_fleet' && (\n              <AIFleetCommanderTab />\n            )}\n        </div>\n\n\n\n        {/* \u2500\u2500 Enterprise Tenant Telemetry & CS Inspector Modal \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */}";

const newText = "</div>\n\n            {/* TAB: AI Fleet Commander Matrix */}\n            {activeTab === 'ai_fleet' && (\n              <AIFleetCommanderTab />\n            )}\n\n        {/* \u2500\u2500 Enterprise Tenant Telemetry & CS Inspector Modal \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */}";

if (content.includes(old)) {
    fs.writeFileSync(path, content.replace(old, newText));
    console.log('Replaced!');
} else {
    console.log('Pattern not found - searching...');
    // Find the line numbers
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('AI Fleet Commander Matrix')) {
            console.log('Found at line', i+1);
            // Print context
            for (let j = Math.max(0, i-3); j < Math.min(lines.length, i+10); j++) {
                console.log(`${j+1}: ${lines[j]}`);
            }
            break;
        }
    }
}