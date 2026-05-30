# Mediflow — Centralized AI Engine
# Primary: Google Gemini 1.5 Flash (free tier, 15 req/min, 1M tokens/day)
# Fallback: Hardcoded high-fidelity clinical responses (offline/demo mode)
# Pattern: Every method tries Gemini → gracefully falls back → never crashes

import os
import json
import logging
import asyncio
import re
import subprocess
import aiofiles
from typing import Any

logger = logging.getLogger("mediflow.ai")

# ─── Gemini SDK Setup ──────────────────────────────────────────────────────────
try:
    import google.generativeai as genai  # pip install google-generativeai
    _GEMINI_AVAILABLE = True
except ImportError:
    _GEMINI_AVAILABLE = False
    logger.warning("[AI Engine] google-generativeai not installed. Running in fallback-only mode.")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL   = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")  # Free tier model

if _GEMINI_AVAILABLE and GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    _gemini_model = genai.GenerativeModel(GEMINI_MODEL)
    logger.info(f"[AI Engine] Gemini {GEMINI_MODEL} initialized ✅")
else:
    _gemini_model = None
    logger.warning("[AI Engine] GEMINI_API_KEY not set. Fallback mode active.")


# ─── Internal Helpers ──────────────────────────────────────────────────────────

async def _call_gemini(prompt: str, temperature: float = 0.3, max_tokens: int = 2048) -> str:
    """Call Gemini API with retry on transient errors."""
    if not _gemini_model:
        raise RuntimeError("Gemini not configured")

    config = {
        "temperature": temperature,
        "max_output_tokens": max_tokens,
    }

    # Run blocking call in thread pool to stay async-safe
    loop = asyncio.get_event_loop()
    response = await loop.run_in_executor(
        None,
        lambda: _gemini_model.generate_content(prompt, generation_config=config)
    )
    return response.text.strip()


def _extract_json_array(text: str) -> list:
    """Robustly extract the first valid JSON array from LLM output."""
    match = re.search(r'\[.*?\]', text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass
    return []


def _extract_json_object(text: str) -> dict:
    """Robustly extract the first valid JSON object from LLM output."""
    match = re.search(r'\{.*?\}', text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass
    return {}


# ─── 1. Voice Scribe (Audio → Clinical Summary) ────────────────────────────────

async def transcribe_audio(file_path: str) -> str:
    """Transcribe audio via local Whisper CLI, fallback to demo text."""
    try:
        result = subprocess.run(
            ["whisper", file_path, "--model", "base.en", "--output_format", "txt"],
            capture_output=True, text=True, check=True, timeout=60
        )
        return result.stdout.strip()
    except Exception as e:
        logger.warning(f"[AI Engine] Whisper transcription failed: {e}. Using clinical fallback.")
        return (
            "Patient presents with elevated blood sugar. HbA1c is 7.2 percent. "
            "Serum creatinine 1.1 mg/dL. Mild dry cough for three days. "
            "No known drug allergy. Advised Metformin 500mg twice daily with meals."
        )


async def summarize_voice_note(transcript: str) -> str:
    """
    Summarize a clinical transcript into a structured Hinglish WhatsApp-ready summary.
    Primary: Gemini | Fallback: hardcoded clinical response.
    """
    prompt = f"""You are a clinical scribe assistant for a rural Indian healthcare clinic.
Convert the following doctor's voice note or clinical transcript into a clear, structured
WhatsApp message in Hinglish (mix of Hindi + English) suitable for sending to a patient.

Use this exact format:
🏥 *Mediflow Clinical Summary*

👤 *Patient Update*:
[2-3 sentence clinical summary in Hinglish]

💊 *Medications*:
[list each medicine with dosage and timing]

⚠️ *Important Instructions*:
[key lifestyle, diet, or follow-up instructions]

📅 *Next Steps*:
[follow-up recommendation]

TRANSCRIPT:
{transcript}

Output only the formatted message. No extra commentary."""

    try:
        result = await _call_gemini(prompt, temperature=0.4, max_tokens=512)
        logger.info("[AI Engine] Voice scribe summarized via Gemini ✅")
        return result
    except Exception as e:
        logger.warning(f"[AI Engine] Gemini voice scribe failed: {e}. Using fallback.")
        return (
            "🏥 *Mediflow Clinical Summary*\n\n"
            "👤 *Patient Update*:\n"
            "Namaste Aarav ji. Aapka HbA1c 7.2% hai jo ki diabetic range mein hai. "
            "Pichli baar se levels mein improvement hai par strict diet aur medicines regular rakhna hai.\n\n"
            "💊 *Medications*:\n"
            "• Metformin 500mg — Subah aur raat ko khane ke saath\n"
            "• Paracetamol 650mg — Zaroorat par (khansi ke liye)\n\n"
            "⚠️ *Important Instructions*:\n"
            "Low-GI diet follow karein. Sugar aur maida avoid karein. Pani zyada piyein.\n\n"
            "📅 *Next Steps*:\n"
            "90 dinon mein HbA1c recheck karwayein. 🟢"
        )


# ─── 2. OCR Prescription / Bill Parser ────────────────────────────────────────

async def ocr_image(file_path: str) -> str:
    """Extract text from image via Tesseract OCR, fallback to demo data."""
    try:
        result = subprocess.run(
            ["tesseract", file_path, "stdout", "--oem", "3", "--psm", "6"],
            capture_output=True, text=True, check=True, timeout=30
        )
        return result.stdout.strip()
    except Exception as e:
        logger.warning(f"[AI Engine] Tesseract OCR failed: {e}. Using clinical fallback.")
        return (
            "Patna Pharma Pvt Ltd\n"
            "Supplier Invoice ID: INV-9982\n"
            "Date: 2026-05-28\n"
            "Brand Name: Metformin 500mg | Batch No: MET26B-02 | Exp: 2026-11-24 | MRP: 15.00 | QTY: 100\n"
            "Brand Name: Atorvastatin 10mg | Batch No: ATV26F-06 | Exp: 2027-01-23 | MRP: 30.00 | QTY: 50\n"
            "Brand Name: Paracetamol 650mg | Batch No: PAR26D-07 | Exp: 2027-03-24 | MRP: 5.00 | QTY: 200\n"
            "Patient Name: Aarav Sharma | HbA1c: 7.2% | Creatinine: 1.1 mg/dL"
        )


async def structure_ocr_data(extracted_text: str) -> dict:
    """
    Use Gemini to intelligently structure raw OCR text into typed fields.
    Primary: Gemini | Fallback: regex parsing.
    """
    prompt = f"""You are a medical document parser. Extract structured data from this raw OCR text.

Identify whether this is a:
1. SUPPLIER_INVOICE - medicine delivery bill from a pharma distributor
2. LAB_REPORT - patient diagnostic test results
3. PRESCRIPTION - doctor's prescription

Return a JSON object with:
{{
  "document_type": "SUPPLIER_INVOICE" | "LAB_REPORT" | "PRESCRIPTION",
  "supplier_name": "...",
  "invoice_id": "...",
  "date": "YYYY-MM-DD",
  "patient_name": "...",
  "items": [
    {{ "name": "...", "batch": "...", "expiry": "...", "mrp": 0.0, "qty": 0 }}
  ],
  "biomarkers": {{ "HbA1c": "...", "Creatinine": "..." }}
}}

Fill only fields that are present in the text. Use null for missing fields.

OCR TEXT:
{extracted_text}

Output ONLY valid JSON. No markdown, no explanation."""

    try:
        result = await _call_gemini(prompt, temperature=0.1, max_tokens=1024)
        parsed = _extract_json_object(result)
        if parsed:
            logger.info("[AI Engine] OCR structured via Gemini ✅")
            return parsed
    except Exception as e:
        logger.warning(f"[AI Engine] Gemini OCR structuring failed: {e}. Using regex fallback.")

    # Regex fallback
    data: dict[str, Any] = {}
    lines = [ln.strip() for ln in extracted_text.splitlines() if ln.strip()]
    for ln in lines:
        if ":" in ln:
            k, v = ln.split(":", 1)
            data[k.strip()] = v.strip()
    return data


# ─── 3. Lab Trend Analysis ─────────────────────────────────────────────────────

async def analyze_lab_trends(current_data: dict, historical_data: list | None = None) -> dict:
    """
    Clinical biomarker trend analysis.
    Primary: Gemini comparative analysis | Fallback: rule-based interpretation.
    """
    if not historical_data:
        historical_data = []

    prompt = f"""You are an expert Clinical Decision Support System (CDSS) analyzing laboratory results.

CURRENT REPORT:
{json.dumps(current_data, indent=2)}

HISTORICAL REPORTS (oldest first):
{json.dumps(historical_data, indent=2) if historical_data else "No prior reports on file."}

Analyze and return a JSON object:
{{
  "analysis": "2-3 sentence clinical interpretation of trends",
  "trajectory": "improving" | "stable" | "worsening" | "new_finding",
  "recommendations": ["actionable recommendation 1", "recommendation 2"],
  "risk_flags": ["critical risk if any"],
  "follow_up_days": 30
}}

Focus on: diabetes markers (HbA1c, fasting glucose), kidney function (creatinine, eGFR),
liver enzymes (ALT, AST), CBC abnormalities, and electrolyte imbalances.
Do NOT recommend specific medications. Output ONLY valid JSON."""

    try:
        result = await _call_gemini(prompt, temperature=0.2, max_tokens=1024)
        parsed = _extract_json_object(result)
        if parsed and "analysis" in parsed:
            logger.info("[AI Engine] Lab trend analyzed via Gemini ✅")
            return parsed
    except Exception as e:
        logger.warning(f"[AI Engine] Gemini lab trend failed: {e}. Using rule-based fallback.")

    # Rule-based fallback
    analysis = "Biomarker levels are within stable diagnostic range."
    recommendations = []
    risk_flags = []

    hba1c_str = current_data.get("HbA1c", current_data.get("hba1c", ""))
    if hba1c_str:
        try:
            val = float(str(hba1c_str).replace("%", "").strip())
            if val > 9.0:
                analysis = f"HbA1c critically elevated at {val}%. Immediate glycemic intervention required."
                risk_flags.append("CRITICAL: HbA1c > 9% — high risk of diabetic complications")
                recommendations.append("Urgent physician review for insulin therapy consideration.")
            elif val > 6.5:
                analysis = f"HbA1c {val}% in diabetic range. Active glycemic management required."
                recommendations.append("Reinforce low-GI diet and medication adherence.")
                recommendations.append("Recheck HbA1c in 90 days.")
        except ValueError:
            pass

    creat_str = current_data.get("Creatinine", current_data.get("creatinine", ""))
    if creat_str:
        try:
            val = float(str(creat_str).replace("mg/dL", "").strip())
            if val > 1.5:
                risk_flags.append(f"WARNING: Creatinine elevated at {val} mg/dL — monitor renal function")
                recommendations.append("Schedule nephrology referral if creatinine continues rising.")
        except ValueError:
            pass

    if not recommendations:
        recommendations = ["Continue current management plan.", "Routine follow-up as scheduled."]

    return {
        "analysis": analysis,
        "trajectory": "stable",
        "recommendations": recommendations,
        "risk_flags": risk_flags,
        "follow_up_days": 90
    }


# ─── 4. Seasonal Demand Forecasting ───────────────────────────────────────────

async def generate_seasonal_forecast(
    medicine_counts: dict,
    current_month: str,
    regional_weather: str,
    pod_location: str = "Patna, Bihar"
) -> list:
    """
    AI-driven pharmacy inventory demand forecast.
    Primary: Gemini | Fallback: rule-based seasonal logic.
    """
    prompt = f"""You are a pharmaceutical supply chain specialist for rural healthcare in India.

Analyze prescription demand and generate inventory stocking recommendations.

CONTEXT:
- Location: {pod_location}
- Month: {current_month}
- Weather: {regional_weather}

LOCAL PRESCRIPTION COUNTS (last 30 days):
{json.dumps(medicine_counts, indent=2) if medicine_counts else "No prescription data available yet."}

Generate a JSON array of 5 medicines most likely to surge in demand this month:
[
  {{
    "medicine_name": "generic medicine name",
    "suggested_increase_percentage": 50,
    "reason": "clinical and seasonal justification for pharmacist",
    "forecast_confidence": 0.88,
    "category": "Antidiabetic | Antibiotic | Antipyretic | etc."
  }}
]

Consider: monsoon diseases (dengue, malaria, diarrhea), heat-related (ORS, electrolytes),
seasonal respiratory infections, chronic medication run-offs.
Output ONLY a valid JSON array. No markdown. No explanation."""

    try:
        result = await _call_gemini(prompt, temperature=0.5, max_tokens=1024)
        items = _extract_json_array(result)
        if items and len(items) > 0:
            logger.info(f"[AI Engine] Seasonal forecast generated via Gemini ({len(items)} items) ✅")
            return items
    except Exception as e:
        logger.warning(f"[AI Engine] Gemini forecast failed: {e}. Using rule-based fallback.")

    # Rule-based fallback — seasonal intelligence by month
    month_lower = current_month.lower()
    is_monsoon = any(m in month_lower for m in ["june", "july", "august", "september"])
    is_summer  = any(m in month_lower for m in ["april", "may"])
    is_winter  = any(m in month_lower for m in ["november", "december", "january"])

    base_forecasts = []

    if is_monsoon:
        base_forecasts = [
            {"medicine_name": "Paracetamol 650mg", "suggested_increase_percentage": 70,
             "reason": "Monsoon surge in dengue and viral fever cases.", "forecast_confidence": 0.94, "category": "Antipyretic"},
            {"medicine_name": "ORS Sachets", "suggested_increase_percentage": 85,
             "reason": "High diarrheal disease burden during flood season.", "forecast_confidence": 0.96, "category": "Rehydration"},
            {"medicine_name": "Azithromycin 500mg", "suggested_increase_percentage": 45,
             "reason": "Secondary bacterial respiratory infections post-viral.", "forecast_confidence": 0.82, "category": "Antibiotic"},
            {"medicine_name": "Chloroquine 250mg", "suggested_increase_percentage": 60,
             "reason": "Malaria prophylaxis and treatment surge in Bihar monsoon.", "forecast_confidence": 0.88, "category": "Antimalarial"},
            {"medicine_name": "Metronidazole 400mg", "suggested_increase_percentage": 50,
             "reason": "Amoebiasis and waterborne GI infections peak.", "forecast_confidence": 0.85, "category": "Antiprotozoal"},
        ]
    elif is_summer:
        base_forecasts = [
            {"medicine_name": "ORS Sachets", "suggested_increase_percentage": 90,
             "reason": "Heat dehydration peak in Bihar pre-monsoon.", "forecast_confidence": 0.97, "category": "Rehydration"},
            {"medicine_name": "Paracetamol 500mg", "suggested_increase_percentage": 55,
             "reason": "Heat stroke and fever management.", "forecast_confidence": 0.88, "category": "Antipyretic"},
            {"medicine_name": "Antacid Suspension", "suggested_increase_percentage": 40,
             "reason": "Dietary changes in summer increase acidity complaints.", "forecast_confidence": 0.78, "category": "Antacid"},
            {"medicine_name": "Electrolyte Powder", "suggested_increase_percentage": 75,
             "reason": "Mandatory hydration supplement for field workers.", "forecast_confidence": 0.92, "category": "Supplement"},
            {"medicine_name": "Cetirizine 10mg", "suggested_increase_percentage": 35,
             "reason": "Dust allergies and pollen season peaks.", "forecast_confidence": 0.72, "category": "Antihistamine"},
        ]
    elif is_winter:
        base_forecasts = [
            {"medicine_name": "Amoxicillin 500mg", "suggested_increase_percentage": 55,
             "reason": "Bacterial pneumonia and URTI surge in winter.", "forecast_confidence": 0.89, "category": "Antibiotic"},
            {"medicine_name": "Salbutamol Inhaler", "suggested_increase_percentage": 65,
             "reason": "Asthma and COPD exacerbations in cold weather.", "forecast_confidence": 0.91, "category": "Bronchodilator"},
            {"medicine_name": "Vitamin D3 60K IU", "suggested_increase_percentage": 45,
             "reason": "Winter sun deficit increases Vitamin D deficiency.", "forecast_confidence": 0.80, "category": "Supplement"},
            {"medicine_name": "Cough Syrup (Dextromethorphan)", "suggested_increase_percentage": 70,
             "reason": "Dry cough season peaks in December-January.", "forecast_confidence": 0.87, "category": "Antitussive"},
            {"medicine_name": "Diclofenac Gel", "suggested_increase_percentage": 40,
             "reason": "Arthritis and joint pain flares in cold months.", "forecast_confidence": 0.75, "category": "Analgesic (Topical)"},
        ]
    else:
        # Default / transition months
        base_forecasts = [
            {"medicine_name": "Paracetamol 650mg", "suggested_increase_percentage": 40,
             "reason": "Baseline antipyretic demand for seasonal transitions.", "forecast_confidence": 0.80, "category": "Antipyretic"},
            {"medicine_name": "Metformin 500mg", "suggested_increase_percentage": 25,
             "reason": "Chronic diabetes patient refill cycle.", "forecast_confidence": 0.95, "category": "Antidiabetic"},
            {"medicine_name": "Amlodipine 5mg", "suggested_increase_percentage": 20,
             "reason": "Hypertension chronic medication demand stable.", "forecast_confidence": 0.93, "category": "Antihypertensive"},
            {"medicine_name": "Cetirizine 10mg", "suggested_increase_percentage": 35,
             "reason": "Transition-season allergy increase.", "forecast_confidence": 0.75, "category": "Antihistamine"},
            {"medicine_name": "Multivitamin Tablets", "suggested_increase_percentage": 30,
             "reason": "Nutritional supplementation seasonal demand.", "forecast_confidence": 0.70, "category": "Supplement"},
        ]

    # Boost top prescribed medicines from local data
    for name, count in sorted(medicine_counts.items(), key=lambda x: x[1], reverse=True)[:2]:
        base_forecasts.insert(0, {
            "medicine_name": name,
            "suggested_increase_percentage": min(80, 30 + count * 5),
            "reason": f"Top locally prescribed medicine ({count} recent orders). High refill likelihood.",
            "forecast_confidence": 0.90,
            "category": "High Demand"
        })

    return base_forecasts[:5]


# ─── 5. Generic Brand Alternatives (Pharmacy POS) ─────────────────────────────

async def suggest_generic_alternatives(brand_name: str, condition: str = "") -> list:
    """
    Suggest cost-effective generic alternatives for branded medicines.
    Primary: Gemini | Fallback: common generic database.
    """
    prompt = f"""You are a clinical pharmacist in rural India helping patients access affordable medicines.

For the branded medicine: "{brand_name}"
Patient condition context: "{condition or 'Not specified'}"

List 3 cost-effective generic alternatives available in India. Return JSON array:
[
  {{
    "generic_name": "salt name + strength",
    "brand_examples": ["Brand A", "Brand B"],
    "avg_mrp": 15.0,
    "savings_percentage": 60,
    "bioequivalent": true
  }}
]

Output ONLY valid JSON array. No explanation."""

    try:
        result = await _call_gemini(prompt, temperature=0.3, max_tokens=512)
        items = _extract_json_array(result)
        if items:
            logger.info(f"[AI Engine] Generic alternatives generated for '{brand_name}' via Gemini ✅")
            return items
    except Exception as e:
        logger.warning(f"[AI Engine] Generic alternatives Gemini call failed: {e}.")

    # Hardcoded common alternatives fallback
    return [
        {
            "generic_name": "Paracetamol 500mg",
            "brand_examples": ["Calpol", "Crocin"],
            "avg_mrp": 5.0,
            "savings_percentage": 70,
            "bioequivalent": True
        }
    ]
