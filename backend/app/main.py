from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import subprocess
import json
import os
import aiofiles

app = FastAPI(title="Mediflow Backend", version="1.0.0")

# ── CORS ─────────────────────────────────────────────────────────────────────
# Allow the Vite dev server and any production domains to call this API.
# Override ALLOWED_ORIGINS env variable in production (comma-separated URLs).
_raw_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3000")
allowed_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Models
class VoiceScribeResponse(BaseModel):
    summary: str
    language: str = "Hinglish"

class OCRScanResponse(BaseModel):
    extracted_text: str
    structured_data: dict

class LabTrendResponse(BaseModel):
    analysis: str
    recommendations: list[str]

class WhatsAppSendResponse(BaseModel):
    success: bool
    detail: str = None

# Helper functions (placeholder implementations)
async def transcribe_audio(file_path: str) -> str:
    # Call local Whisper model (assumed installed as CLI `whisper`)
    try:
        result = subprocess.run(["whisper", file_path, "--model", "base.en"], capture_output=True, text=True, check=True)
        return result.stdout
    except subprocess.CalledProcessError as e:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {e.stderr}")

async def summarize_text(text: str) -> str:
    # Call local Llama.cpp binary (assumed `llama-cli`)
    try:
        proc = subprocess.Popen(["llama-cli", "-m", "mediflow_model.bin", "-p", text], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        out, err = proc.communicate(timeout=30)
        if proc.returncode != 0:
            raise HTTPException(status_code=500, detail=f"LLM summarization error: {err}")
        return out.strip()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

async def ocr_image(file_path: str) -> str:
    # Placeholder: use Tesseract OCR
    try:
        result = subprocess.run(["tesseract", file_path, "stdout"], capture_output=True, text=True, check=True)
        return result.stdout
    except subprocess.CalledProcessError as e:
        raise HTTPException(status_code=500, detail=f"OCR failed: {e.stderr}")

async def parse_lab_results(text: str) -> dict:
    # Very naive parser: split lines
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    data = {}
    for ln in lines:
        if ":" in ln:
            key, val = ln.split(":", 1)
            data[key.strip()] = val.strip()
    return data

async def analyze_trend(lab_data: dict) -> dict:
    # Mock analysis
    analysis = "Lab values within normal range."
    recommendations = []
    for k, v in lab_data.items():
        if "high" in v.lower():
            recommendations.append(f"Review {k} as it appears elevated.")
    return {"analysis": analysis, "recommendations": recommendations}

async def send_whatsapp_message(phone: str, message: str) -> bool:
    # Placeholder: simulate sending via environment variables or configured later
    # In production, this would call the WhatsApp Cloud API.
    print(f"[WhatsApp Sim] Sending to {phone}: {message}")
    return True

# Endpoints
@app.post("/api/voice-scribe", response_model=VoiceScribeResponse)
async def voice_scribe(file: UploadFile = File(...)):
    # Save uploaded file temporarily
    upload_path = f"./tmp/{file.filename}"
    os.makedirs(os.path.dirname(upload_path), exist_ok=True)
    async with aiofiles.open(upload_path, "wb") as out_file:
        content = await file.read()
        await out_file.write(content)
    # Transcribe and summarize
    transcript = await transcribe_audio(upload_path)
    summary = await summarize_text(transcript)
    # Clean up
    try:
        os.remove(upload_path)
    except OSError:
        pass
    return VoiceScribeResponse(summary=summary)

@app.post("/api/ocr-scan", response_model=OCRScanResponse)
async def ocr_scan(file: UploadFile = File(...)):
    upload_path = f"./tmp/{file.filename}"
    os.makedirs(os.path.dirname(upload_path), exist_ok=True)
    async with aiofiles.open(upload_path, "wb") as out_file:
        content = await file.read()
        await out_file.write(content)
    extracted = await ocr_image(upload_path)
    structured = await parse_lab_results(extracted)
    try:
        os.remove(upload_path)
    except OSError:
        pass
    return OCRScanResponse(extracted_text=extracted, structured_data=structured)

@app.post("/api/lab-trend", response_model=LabTrendResponse)
async def lab_trend(lab_data: dict):
    analysis = await analyze_trend(lab_data)
    return LabTrendResponse(analysis=analysis["analysis"], recommendations=analysis["recommendations"])

@app.post("/api/whatsapp-send", response_model=WhatsAppSendResponse)
async def whatsapp_send(payload: dict):
    phone = payload.get("phone")
    message = payload.get("message")
    if not phone or not message:
        raise HTTPException(status_code=400, detail="Missing phone or message")
    success = await send_whatsapp_message(phone, message)
    return WhatsAppSendResponse(success=success, detail="Message dispatched" if success else "Failed")

# Health check
@app.get("/health")
async def health_check():
    return JSONResponse(content={"status": "ok"})
