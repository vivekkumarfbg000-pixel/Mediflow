# Mediflow Connected Care Ecosystem

A full-stack connected care platform for clinic operations, partner network onboarding, lab billing, pharmacy workflows, and AI-assisted invoice capture.

## Project Structure

- `frontend/` — React + Vite dashboard and role-based user interface
- `backend/` — FastAPI AI assistant backend for OCR, voice transcription, and lab analysis
- `supabase/` — database schema, migrations, and edge function code
- `.github/workflows/ci.yml` — CI pipeline for build, validation, Docker image creation, and frontend test execution

## Local Development

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` to access the dashboard.

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The backend listens on `http://localhost:8000`.

## Frontend Testing

Run frontend validation and tests locally:

```bash
cd frontend
npm test
```

This command runs the frontend production build as the primary smoke test gate.

## Docker

Build the backend container:

```bash
docker build -t mediflow-backend ./backend
```

Run the backend container with allowed origins:

```bash
docker run -p 8000:8000 -e ALLOWED_ORIGINS="http://localhost:5173,http://localhost:3000" mediflow-backend
```

## Environment Variables

### Backend

- `ALLOWED_ORIGINS`
  - Comma-separated list of allowed CORS origins for the FastAPI backend.
  - Example: `http://localhost:5173,http://localhost:3000`
- `SUPABASE_URL`
  - Your Supabase project URL.
- `SUPABASE_SERVICE_ROLE_KEY`
  - Supabase service role key used by the backend.
- `SUPABASE_KEY`
  - Optional fallback name for the same Supabase key.
- `PHARMACY_ENTITY_ID`
  - Optional pharmacy entity UUID used by the scheduler fallback.
- `POD_ID`
  - Optional pod UUID used by the scheduler fallback.
- `CURRENT_MONTH`
  - Optional month label used by seasonal forecast generation.
- `REGIONAL_WEATHER`
  - Optional weather context string used by seasonal forecast generation.
- `MEDIFLOW_API_URL`
  - Optional backend URL for scheduler callbacks when not running locally.

### Frontend

- `VITE_SUPABASE_URL`
  - Your Supabase project URL.
- `VITE_SUPABASE_ANON_KEY`
  - Your Supabase anonymous API key.

## Hugging Face Docker Space Deployment

The backend is configured to run as a Docker Space on port `8000`.

### GitHub Secrets

Add these secrets to your GitHub repository:

- `HF_TOKEN`
  - Hugging Face write access token used by the deploy workflow.
- `HF_SPACE_REPO`
  - Your Space repo id, for example `your-username/your-space-name`.

### Hugging Face Space Secrets

Add these runtime secrets in the Space Settings tab:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ALLOWED_ORIGINS`
  - Set this to your frontend URL(s), for example your local dev URL plus the deployed frontend domain.
- `PHARMACY_ENTITY_ID` if you want the seasonal forecast job to use a specific pharmacy record.
- `POD_ID` if you want the seasonal forecast job to use a specific pod record.
- `CURRENT_MONTH` if you want to override the default month used by the forecast endpoint.
- `REGIONAL_WEATHER` if you want to override the default weather description used by the forecast endpoint.

### First Deploy Check

1. Confirm the GitHub Actions workflow `.github/workflows/deploy-backend-to-hf-space.yml` is enabled.
2. Confirm `HF_TOKEN` and `HF_SPACE_REPO` are set in GitHub repository secrets.
3. Trigger the workflow with a push to `main` or from the manual dispatch button.
4. Open the Hugging Face Space logs and confirm the app starts on port `8000`.
5. Visit the Space `health` endpoint at `/health` and confirm it returns `{"status":"ok"}`.
6. If the app fails, check the Space build logs first for missing secrets or Dockerfile errors.

## CI/CD

The CI workflow in `.github/workflows/ci.yml` performs these steps:

1. Check out repository code
2. Install frontend dependencies
3. Build the backend Docker image
4. Run frontend tests (`npm test`)
5. Verify frontend compilation and production bundle with `npm run build`
6. Execute the end-to-end pilot validation script

## Notes

- Dashboard access is guarded by RBAC using `RequireRole` for Compounder, Doctor, Lab Technician, and Pharmacy Counter views.
- The Compounder dashboard includes an `Invoice Generator` entry point that opens the invoice OCR workflow.
- The backend relies on `ALLOWED_ORIGINS` to secure CORS for local and deployed origins.
