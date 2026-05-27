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

### Frontend

- `VITE_SUPABASE_URL`
  - Your Supabase project URL.
- `VITE_SUPABASE_ANON_KEY`
  - Your Supabase anonymous API key.

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
