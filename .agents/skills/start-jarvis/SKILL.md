---
name: start-jarvis
description: Starts the J.A.R.V.I.S. Daemon Bridge and the local dev server. Use this when the user asks to "start jarvis".
---

# Start JARVIS

When the user says "start jarvis" or a similar command, you MUST start the following two services concurrently using `run_command` with `IsDaemon: true` and `BypassSandbox: true`:

1. **J.A.R.V.I.S. Daemon Bridge:**
   - **Cwd:** The root workspace directory (e.g., `c:\Users\vivek\OneDrive\Desktop\vitalsync-Mediflow ecosystem`).
   - **Command:** `node frontend/scripts/daemon-bridge.cjs`

2. **Frontend Dev Server (localhost):**
   - **Cwd:** The `frontend` subdirectory of the workspace.
   - **Command:** `npm run dev`

Make sure to wait briefly before assuming they are started and acknowledge to the user that J.A.R.V.I.S. is online.
