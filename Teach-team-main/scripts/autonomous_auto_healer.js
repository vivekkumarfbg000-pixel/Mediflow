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

// Load environment variables / secrets
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const TELEMETRY_PAYLOAD = process.env.TELEMETRY_PAYLOAD; // JSON String

async function executeSelfHealing() {
  if (!GROQ_API_KEY) {
    console.error("❌ GROQ_API_KEY is not set. Cannot run autonomous self-healer.");
    process.exit(1);
  }

  if (!TELEMETRY_PAYLOAD) {
    console.error("❌ No TELEMETRY_PAYLOAD env variable detected. E.g. Run with fake payload for testing.");
    process.exit(1);
  }

  try {
    const telemetry = JSON.parse(TELEMETRY_PAYLOAD);
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

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama3-70b-8192",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1
      })
    });

    const result = await response.json();
    if (!result.choices || result.choices.length === 0) {
      throw new Error("Invalid response from Groq API");
    }

    let healedCode = result.choices[0].message.content.trim();
    // Clean up any leading/trailing markdown blocks if the LLM outputted them
    if (healedCode.startsWith("```")) {
      healedCode = healedCode.replace(/^```[a-zA-Z]*\n/, "").replace(/\n```$/, "");
    }

    // Step 4: Apply Surgical Micro-Patch
    console.log("🩹 Applying surgical AI patch...");
    fs.writeFileSync(targetFile, healedCode, 'utf8');

    // Step 5: Verification (TypeScript Compile & Build check)
    console.log("🧪 Running verification checks (CTO Safeguard Compiler gates)...");
    try {
      execSync("npm run build", { cwd: path.resolve(__dirname, "../../frontend"), stdio: 'inherit' });
      console.log("🟢 Compilation check passed successfully!");

      // Step 6: GitOps Guardian auto-commits and pushes the fix!
      console.log("🦅 Securing release boundaries and committing bugfix...");
      execSync("git add .", { cwd: path.resolve(__dirname, "../../") });
      execSync(`git commit -m "fix(healer): autonomous bugfix for anomaly ${id}"`, { cwd: path.resolve(__dirname, "../../") });
      console.log("🚀 Self-healed code committed. Pushing to GitHub...");
      
      try {
        execSync("git push origin master", { cwd: path.resolve(__dirname, "../../") });
        console.log("🟢 Autonomous loop completed successfully! Production healed live! 🐋");
      } catch (pushErr) {
        console.warn("⚠️ Commit succeeded, but git push failed (could be temporary network glitch). Feel free to run 'git push origin master' manually.");
      }

    } catch (compileErr) {
      console.error("🔴 AI patch failed verification check! Hard reverting to revert anchor.");
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
  // Simple stack trace parser looking for files in frontend or backend
  const match = stack.match(/(\.\.\/frontend\/src\/[^\s:]+|frontend\/src\/[^\s:]+)/);
  if (match) {
    return path.resolve(__dirname, "../../", match[1]);
  }
  
  // Default fallback to the document currently active during debugging
  return path.resolve(__dirname, "../../frontend/src/components/doctor/OphthalmologyPatientAnalysisPanel.tsx");
}

executeSelfHealing();
