const fs = require('fs');
const path = require('path');

// Resolve TypeScript from frontend/node_modules
const ts = require(path.resolve(__dirname, '../frontend/node_modules/typescript'));

const webhookPath = path.resolve(__dirname, '../supabase/functions/meta-webhook/index.ts');
if (!fs.existsSync(webhookPath)) {
  console.error('❌ FATAL: meta-webhook index.ts not found at:', webhookPath);
  process.exit(1);
}

const code = fs.readFileSync(webhookPath, 'utf8');

const ambientDeclarations = `
declare const Deno: any;
declare const fetch: any;
declare const Request: any;
declare const Response: any;
declare const URL: any;
declare const Headers: any;
declare const FormData: any;
declare const Blob: any;
declare const crypto: any;
declare const btoa: any;
declare const atob: any;
declare const setTimeout: any;
declare const clearTimeout: any;
declare const AbortController: any;
declare const Uint8Array: any;
declare const TextEncoder: any;
declare const TextDecoder: any;
declare const console: any;
declare const Array: any;
declare const JSON: any;
declare const Date: any;
declare const Math: any;
declare const String: any;
declare const Number: any;
declare const Boolean: any;
declare const parseInt: any;
declare const parseFloat: any;
declare const isNaN: any;
declare const encodeURIComponent: any;
declare const decodeURIComponent: any;
declare const Error: any;
declare const Intl: any;
declare const Promise: any;
declare const Map: any;
declare const Set: any;
declare const RegExp: any;
declare const Proxy: any;
`;

const ambientLines = ambientDeclarations.trim().split('\n').length;
const sourceFile = ts.createSourceFile('index.ts', ambientDeclarations + code, ts.ScriptTarget.Latest, true);

const host = {
  getSourceFile: f => f === 'index.ts' ? sourceFile : undefined,
  writeFile: () => {},
  getDefaultLibFileName: () => 'lib.d.ts',
  useCaseSensitiveFileNames: () => false,
  getCanonicalFileName: f => f,
  getCurrentDirectory: () => '',
  getNewLine: () => '\n',
  fileExists: f => f === 'index.ts',
  readFile: () => ''
};

const program = ts.createProgram(['index.ts'], {
  noEmit: true,
  target: ts.ScriptTarget.Latest,
  lib: ['lib.es2022.d.ts', 'lib.dom.d.ts']
}, host);

const diagnostics = program.getSemanticDiagnostics(sourceFile);

const criticalCodes = new Set([
  2304, // Cannot find name
  2552, // Cannot find name (suggested)
  2451, // Cannot redeclare block-scoped variable
  2300, // Duplicate identifier
  2588, // Cannot assign to 'x' because it is a constant
  2448, // Block-scoped variable 'x' used before its declaration (TDZ)
  2444  // Circular definition
]);

let criticalErrors = [];

diagnostics.forEach(d => {
  if (criticalCodes.has(d.code)) {
    const pos = sourceFile.getLineAndCharacterOfPosition(d.start);
    const msg = typeof d.messageText === 'string' ? d.messageText : d.messageText?.messageText;
    const adjustedLine = pos.line - ambientLines;
    
    // Ignore TypeScript type-only definitions like Record
    if (msg.includes("'Record'") || msg.includes("'Proxy'")) {
      return;
    }

    criticalErrors.push({
      line: adjustedLine > 0 ? adjustedLine : pos.line,
      char: pos.character + 1,
      code: d.code,
      message: msg
    });
  }
});

console.log('================================================================');
console.log('🏛️  VITALSYNC AST EDGE RUNTIME INVARIANT VERIFIER');
console.log('================================================================\n');

if (criticalErrors.length > 0) {
  console.error(`❌ INVARIANT VIOLATION: Found ${criticalErrors.length} critical AST runtime errors in meta-webhook:\n`);
  criticalErrors.forEach(err => {
    console.error(`   • Line ${err.line}:${err.char} - [TS${err.code}]: ${err.message}`);
  });
  console.error('\n🚨 DEPLOYMENT BLOCKED by Directive 101: Zero-Lexical-Shadowing Protocol.');
  process.exit(1);
} else {
  console.log('✅ PASS: 0 undeclared variables.');
  console.log('✅ PASS: 0 duplicate declarations.');
  console.log('✅ PASS: 0 constant variable reassignments.');
  console.log('✅ PASS: 0 Temporal Dead Zone (TDZ) lexical collisions.');
  console.log('\n🛡️  meta-webhook is 100% compliant with Directive 101.');
  process.exit(0);
}
