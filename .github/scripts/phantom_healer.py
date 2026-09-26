import os
import json
import requests
import google.generativeai as genai

# Configure Gemini
api_key = os.environ.get("GEMINI_API_KEY")
if not api_key:
    print("VITE_GEMINI_API_KEY is missing. Skipping AI inference.")
    exit(0)

genai.configure(api_key=api_key)
model = genai.GenerativeModel("gemini-1.5-flash")

error_prompt = os.environ.get("ERROR_PROMPT", "Unknown Error")

prompt = f"""
You are the J.A.R.V.I.S. Phantom PR Auto-Healer. 
A critical bug has occurred in the system.

Error Details:
{error_prompt}

Please analyze the error and output a bash script (starting with #!/bin/bash) 
that will use `sed` or `echo` to patch the files and fix the issue. 
Only output the raw bash script inside a markdown bash block.
"""

print("🧠 Generating autonomous fix...")
response = model.generate_content(prompt)
text = response.text

# Extract bash script
if "```bash" in text:
    script_content = text.split("```bash")[1].split("```")[0].strip()
    with open("apply_fix.sh", "w") as f:
        f.write(script_content)
    os.system("bash apply_fix.sh")
    print("✅ Autonomous fix applied to local branch.")
else:
    print("⚠️ AI failed to generate a valid bash script. Outputting analysis to jarvis_analysis.md.")
    with open("jarvis_analysis.md", "w") as f:
        f.write(text)
