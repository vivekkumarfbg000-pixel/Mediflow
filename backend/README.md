---
title: Mediflow AI Backend
emoji: 🏥
colorFrom: blue
colorTo: green
sdk: docker
pinned: false
---

# Mediflow AI Backend — FastAPI

This is the AI inference and processing backend for the Mediflow Connected Care Ecosystem.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health probe (returns `{"status": "ok"}`) |
| POST | `/api/voice-scribe` | Transcribe + summarize clinical audio recording |
| POST | `/api/ocr-scan` | OCR scan of lab reports / supplier invoices |
| POST | `/api/lab-trend` | Analyze lab biomarker trends |
| POST | `/api/generate-seasonal-forecast` | AI-powered pharmacy demand forecasting |
| POST | `/api/generate-consult-room` | Generate Jitsi video consult room + WhatsApp dispatch |
| POST | `/api/whatsapp-send` | Send WhatsApp messages via Meta Cloud API |

## Required Environment Variables (set in HF Spaces Secrets)

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (bypasses RLS for backend workers) |
| `ALLOWED_ORIGINS` | Comma-separated list of allowed CORS origins (e.g. `https://mediflow.vercel.app`) |

## Architecture

```
Vercel (React Frontend)
    ↕ VITE_AI_BACKEND_URL
Hugging Face Spaces (FastAPI)
    ↕ SUPABASE_SERVICE_ROLE_KEY
Supabase Cloud (Postgres + Auth)
```

## Local Development

```bash
# Install dependencies
pip install -r requirements.txt

# Run
uvicorn app.main:app --reload --port 8000

# Test health
curl http://localhost:8000/health
```

## Docker (for local testing of HF Spaces build)

```bash
docker build -t mediflow-backend .
docker run -p 8000:8000 \
  -e SUPABASE_URL=https://your-project.supabase.co \
  -e SUPABASE_SERVICE_ROLE_KEY=your-key \
  -e ALLOWED_ORIGINS=http://localhost:5173 \
  mediflow-backend
```
