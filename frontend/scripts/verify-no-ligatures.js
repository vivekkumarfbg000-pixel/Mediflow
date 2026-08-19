/**
 * Automated Icon Ligature Guard (Anti-Regression Enforcer)
 * Scans all TSX and TS files in frontend/src/ to ensure 100% vector SVG compliance.
 * Forbids font ligatures (material-symbols, material-icons) to prevent mobile FOUT and layout collisions.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SRC_DIR = path.resolve(__dirname, '../src');

const FORBIDDEN_PATTERNS = [
  /className=["'][^"']*material-symbols[^"']*["']/i,
  /className=["'][^"']*material-icons[^"']*["']/i,
  /<span[^>]*class(?:Name)?=["'][^"']*material-symbols/i
];

function scanDirectory(dir, violations = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDirectory(fullPath, violations);
    } else if (entry.isFile() && (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts'))) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');

      lines.forEach((line, idx) => {
        for (const pattern of FORBIDDEN_PATTERNS) {
          if (pattern.test(line)) {
            violations.push({
              file: path.relative(path.resolve(__dirname, '..'), fullPath),
              line: idx + 1,
              content: line.trim()
            });
            break;
          }
        }
      });
    }
  }

  return violations;
}

const violations = scanDirectory(SRC_DIR);

if (violations.length > 0) {
  console.error('\n================================================================');
  console.error('🚨 ZERO-TOLERANCE ANTI-REGRESSION FAILURE: FONT LIGATURES DETECTED');
  console.error('================================================================');
  console.error('Direct use of font ligatures (material-symbols-outlined / material-icons) is');
  console.error('strictly prohibited to prevent mobile FOUT, stalled fonts, and overlapping layout bugs.');
  console.error('You MUST import and use bundled vector SVGs from `lucide-react` instead.\n');
  console.error('Violations found:');
  violations.forEach(v => {
    console.error(`  - ${v.file}:${v.line} -> ${v.content}`);
  });
  console.error('\n================================================================\n');
  process.exit(1);
} else {
  console.log('✅ [Ligature Guard] 100% Vector SVG compliance verified across all frontend source files.');
}
