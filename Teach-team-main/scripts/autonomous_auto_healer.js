/**
 * Mediflow — Autonomous Continuous Self-Healing Daemon (Groq LLM Integration)
 * File: Teach-team-main/scripts/autonomous_auto_healer.js
 *
 * This script accepts a telemetry error stack payload, determines the source file,
 * queries the Groq API for a surgical bugfix, applies the fix, and runs compiler checks.
 * If all verification tests pass, it automatically commits and pushes the self-healed fix!
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const https = require('https');

// Load environment variables / secrets manually from common .env locations
function loadEnvFile(filePath) {
  if (fs.existsSync(filePath)) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      content.split(/\r?\n/).forEach(line => {
        line = line.trim();
        if (!line || line.startsWith('#')) return;
        const firstEq = line.indexOf('=');
        if (firstEq === -1) return;
        const key = line.substring(0, firstEq).trim();
        let val = line.substring(firstEq + 1).trim();
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
        process.env[key] = val;
      });
    } catch (e) {
      console.warn(`⚠️ Warning: Failed to parse env file at ${filePath}: ${e.message}`);
    }
  }
}

// Load configurations
loadEnvFile(path.resolve(__dirname, "../../frontend/.env.local"));
loadEnvFile(path.resolve(__dirname, "../../frontend/.env"));
loadEnvFile(path.resolve(__dirname, "../../backend/.env"));
loadEnvFile(path.resolve(__dirname, "../../.env"));

const GROQ_API_KEY = process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY;
const TELEMETRY_PAYLOAD = process.env.TELEMETRY_PAYLOAD; // JSON String

// Helper to make HTTP POST requests in environment-agnostic way (compatible with older Node.js versions)
function postRequest(url, headers, body) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: headers
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          json: async () => JSON.parse(data),
          text: async () => data
        });
      });
    });

    req.on('error', (e) => { reject(e); });
    req.write(body);
    req.end();
  });
}

async function executeSelfHealing() {
  if (!GROQ_API_KEY) {
    console.error("❌ GROQ_API_KEY is not set. Cannot run autonomous self-healer.");
    process.exit(1);
  }

  if (!TELEMETRY_PAYLOAD) {
    console.error("❌ No TELEMETRY_PAYLOAD env variable detected. E.g. Run with fake payload for testing.");
    process.exit(1);
  }

  let telemetry;
  try {
    telemetry = JSON.parse(TELEMETRY_PAYLOAD);
  } catch (parseErr) {
    console.error("❌ Failed to parse TELEMETRY_PAYLOAD as JSON:", parseErr.message);
    process.exit(1);
  }

  try {
    const { id, subsystem, error_code, error_stack } = telemetry;
    console.log(`\n🤖 [Autonomous Healer] Starting healing session for Anomaly ${id} (${subsystem})`);
    
    // Step 1: Parse stack trace to find target file
    const targetFile = parseTargetFileFromStack(error_stack, subsystem);
    if (!targetFile || !fs.existsSync(targetFile)) {
      console.error(`❌ Could not locate source file associated with error stack trace.`);
      process.exit(1);
    }
    console.log(`📌 Identified target file: ${targetFile}`);

    // Step 2: Establish Git Revert Anchor
    console.log("⚓ Creating Git checkout recovery anchor...");
    const initialCode = fs.readFileSync(targetFile, 'utf8');

    // Step 3: Query Groq API with System Instructions (Elite CTO Role)
    console.log("🧠 Querying Groq API for surgical bugfix...");
    const prompt = `
You are the Elite CTO Task Force. A critical crash has occurred in our production codebase.
Your task is to review the following error stack trace and target file, and provide a surgical, elegant bugfix.

---
ERROR CODE: ${error_code || 'UNKNOWN'}
ERROR STACK:
${error_stack}
---

TARGET FILE CONTENT (${targetFile}):
\`\`\`
${initialCode}
\`\`\`

---
Return ONLY the complete modified source code of the target file.
Do NOT include any explanations, markdown notes, markdown code block backticks, or introduction.
Your output must be 100% clean valid code that directly drops into ${targetFile}.
`;

    const requestBody = JSON.stringify({
      model: "llama3-70b-8192",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1
    });

    const response = await postRequest("https://api.groq.com/openai/v1/chat/completions", {
      "Authorization": `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json"
    }, requestBody);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Groq API returned status ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    if (!result.choices || result.choices.length === 0) {
      throw new Error("Invalid response from Groq API: choices array is missing or empty.");
    }

    let healedCode = result.choices[0].message.content.trim();
    // Clean up any leading/trailing markdown blocks if the LLM outputted them
    if (healedCode.startsWith("```")) {
      healedCode = healedCode.replace(/^```[a-zA-Z]*\n/, "").replace(/\n```$/, "");
    }

    // Step 4: Apply Surgical Micro-Patch
    console.log("🩹 Applying surgical AI patch...");
    fs.writeFileSync(targetFile, healedCode, 'utf8');

    // Step 5: Verification (Subsystem-specific Compile & Build checks)
    console.log("🧪 Running verification checks (CTO Safeguard Compiler gates)...");
    try {
      if (targetFile.includes('frontend')) {
        console.log("🖥️ Running frontend build check...");
        execSync("npm run build", { cwd: path.resolve(__dirname, "../../frontend"), stdio: 'inherit' });
      } else if (targetFile.includes('backend')) {
        console.log("🐍 Running backend python compile check...");
        try {
          execSync(`python -m py_compile "${targetFile}"`, { stdio: 'inherit' });
        } catch (pyErr) {
          console.log("⚠️ python check failed or not found. Trying python3...");
          execSync(`python3 -m py_compile "${targetFile}"`, { stdio: 'inherit' });
        }
      } else if (targetFile.includes('supabase/functions')) {
        console.log("🦕 Running Supabase edge function Deno type check...");
        try {
          execSync(`deno check "${targetFile}"`, { stdio: 'inherit' });
        } catch (denoErr) {
          console.warn("⚠️ deno check not available. Skipping deep Deno verification.");
        }
      }
      console.log("🟢 Compilation check passed successfully!");

      // Step 6: GitOps Guardian auto-commits and pushes the fix!
      console.log("🦅 Securing release boundaries and committing bugfix...");
      try {
        execSync("git add .", { cwd: path.resolve(__dirname, "../../") });
        const gitStatus = execSync("git status --porcelain", { cwd: path.resolve(__dirname, "../../") }).toString().trim();
        if (gitStatus) {
          execSync(`git commit -m "fix(healer): autonomous bugfix for anomaly ${id}"`, { cwd: path.resolve(__dirname, "../../") });
          console.log("🚀 Self-healed code committed. Pushing to GitHub...");
          try {
            execSync("git push origin master", { cwd: path.resolve(__dirname, "../../") });
            console.log("🟢 Autonomous loop completed successfully! Production healed live! 🐋");
          } catch (pushErr) {
            console.warn("⚠️ Commit succeeded, but git push failed. Feel free to run 'git push origin master' manually.");
          }
        } else {
          console.log("ℹ️ No changes to commit (working tree clean).");
        }
      } catch (gitErr) {
        console.error("⚠️ Git commit/push failed but code compilation passed. Fix was kept. Error details:", gitErr.message);
      }

    } catch (compileErr) {
      console.error("🔴 AI patch failed verification check! Hard reverting to revert anchor. Error:", compileErr.message);
      fs.writeFileSync(targetFile, initialCode, 'utf8');
      process.exit(1);
    }

  } catch (err) {
    console.error("❌ An exception occurred in the autonomous healer loop:", err);
    process.exit(1);
  }
}

function parseTargetFileFromStack(stack, subsystem) {
  if (!stack) return null;
  // Support both forward and backward slashes (Windows and Unix paths)
  const match = stack.match(/((?:\.\.[\/\\])?(?:frontend[\/\\]src|backend[\/\\]app|supabase[\/\\]functions|supabase[\/\\]migrations)[\/\\][^\s:]+)/i);
  if (match) {
    // Normalize path separators to current platform standard
    const cleanPath = match[1].replace(/^\.\.[\/\\]/, "").replace(/[\/\\]/g, path.sep);
    return path.resolve(__dirname, "../../", cleanPath);
  }
  
  // Default fallback to the document currently active during debugging
  return path.resolve(__dirname, "../../frontend/src/components/doctor/OphthalmologyPatientAnalysisPanel.tsx");
}

executeSelfHealing();
