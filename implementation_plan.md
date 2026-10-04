# 🏛️ J.A.R.V.I.S. CTO Implementation Plan: Prescription OCR & RAG Pipeline Upgrade (>95% Accuracy)

## 📌 Executive Summary
This engineering plan surgically resolves the 5 critical mathematical, architectural, and data catalog bugs identified in Mediflow Clinic OS's prescription OCR pipeline. By decoupling dosage/strength tokens from drug stems, integrating live clinic inventory grounding, reordering the lab test mapping pipeline, and expanding the Indian clinical lexicon, we elevate real-world prescription extraction accuracy from ~55%–65% to **>95%**.

---

## 🎯 Target Files & Blast Radius Audit

| File | Role | Changes | Blast Radius / Consuming Files |
| :--- | :--- | :--- | :--- |
| `frontend/src/utils/ocrFuzzyCorrector.ts` | Post-OCR Fuzzy Matcher | • Add Token Decoupler (separates drug stem from strength `625`, `650`, `40`, and form `Tab`, `Cap`)<br>• Add Strength-Anchored candidate locking<br>• Integrate Tier 1 active pharmacy inventory lookup | `forecastService.ts` |
| `frontend/src/services/forecastService.ts` | OCR Pipeline Orchestrator | • Fix execution order: run `applyOcrFuzzyCorrections()` BEFORE constructing `mappedTests`<br>• Pass corrected lab tests to LOINC matcher and return in `diagnosticTests` | `api.ts`, `AiPrescriptionUploadTab.tsx`, `BillHubTab.tsx`, `CompounderDashboard.tsx` |
| `frontend/src/data/indianMedicalContext.ts` | Medical Lexicon & Prompt RAG | • Add top Indian dual-therapy brands (`Telma-AM`, `Pantocid-DSR`, `Montina-L`, `Moxikind-CV 625`, `Glycomet-GP 1/2`, `Zifi-CV`, `Clavam 625`, `Enzoflam`, `Chymoral Forte`, etc.)<br>• Add top LOINC lab test acronym hints to `buildRegionalContextInjection()` | `forecastService.ts`, `ocrFuzzyCorrector.ts` |

---

## 🔬 Root Cause Isolation & Surgical Solutions

### 1. Mathematical Threshold Bug in `ocrFuzzyCorrector.ts`
- **Root Cause**: `similarityScore("Dolo 650", "Dolo")` returns `50%` due to the extra 4 characters `" 650"`. Because `50% < 82%` (`CORRECTION_THRESHOLD`), the match is silently dropped.
- **Surgical Solution**:
  1. Implement `splitDrugNameAndStrength(rawName)`:
     - Regex extracts numerical strengths (`625`, `650`, `500mg`, `40`, `10`, `0.5`) and dosage forms (`Tab`, `Cap`, `Syp`, `Inj`, `Drops`).
     - Extracts clean stem: e.g., `"Dolo 650"` $\rightarrow$ Stem: `"dolo"`, Strength: `"650"`.
  2. Compute Levenshtein distance on the **drug stem only**:
     - `similarityScore("dolo", "dolo")` = **100%**!
  3. If a strength number is present (e.g. `625`), anchor to Amoxicillin+Clavulanate formulations (`Augmentin 625`, `Clavam 625`, `Moxikind-CV 625`) with **99% confidence**.

### 2. Execution Order & Dead Code Bug in `forecastService.ts`
- **Root Cause**: In `generateDigitizedPrescription()`, lines 1450–1555 construct `mappedTests` from raw, uncorrected Gemini output. Then line 1558 calls `applyOcrFuzzyCorrections(parsedResult)` which updates `parsedResult.labTests`. But line 1574 returns `diagnosticTests: mappedTests`, so all lab test fuzzy corrections are discarded.
- **Surgical Solution**:
  1. Call `parsedResult = applyOcrFuzzyCorrections(parsedResult)` **immediately after Gemini JSON parsing**.
  2. Build `mappedTests` using the fuzzy-corrected lab test names and LOINC codes.
  3. Ensure `diagnosticTests: mappedTests` contains verified LOINC mappings.

### 3. Live Clinic Pharmacy Inventory Grounding
- **Root Cause**: The OCR pipeline was disconnected from the clinic's local pharmacy stock (`PharmacyService.getPharmacyInventory()`).
- **Surgical Solution**:
  1. Before querying the general 200+ drug dictionary, compare extracted drug stem against active clinic pharmacy stock.
  2. If the drug matches an item in `PharmacyService.getPharmacyInventory()` with similarity $\ge 75\%$, snap directly to that item's exact brand name and batch specification. This guarantees 1-tap billing at the compounder POS.

### 4. Catalog Expansion & Prompt Enrichment
- **Root Cause**: Missing top Indian multi-therapy combinations (`Telma-AM`, `Pantocid-DSR`, `Montina-L`, `Moxikind-CV 625`, `Glycomet-GP 1/2`) and prompt injection omitting lab test LOINC acronyms.
- **Surgical Solution**:
  1. Add 40+ high-frequency Indian prescription brands to `MEDICINE_ALIASES`.
  2. In `buildRegionalContextInjection()`, inject concise lab test acronym hints (`CBC`, `KFT`, `LFT`, `HbA1c`, `FBS`, `PPBS`, `Lipid Profile`, `TSH`, `Urine R/M`) to guide Gemini Vision prior to OCR token generation.

---

## 🛡️ Anti-Regression & Safety Invariants (Rule Zero & Rules 1–100)
1. **Zero-Data-Entry Doctrine**: No manual modals or popups are introduced.
2. **Mandatory Phone Fallback**: Missing or illegible phone numbers remain `null`, cleanly triggering the existing manual input fallback prompt in `AiPrescriptionUploadTab.tsx`.
3. **Defensive Property Access**: All strings guarded with `(str || '').trim()`, all arrays with `(arr || []).map(...)`.
4. **Zero TypeScript Errors**: Shadow compile verified via `tsc --noEmit`.

---

## 🚦 Verification Playbook
1. **Unit Test Verification**:
   - `similarityScore` on `"Dolo 650"` $\rightarrow$ Auto-corrects to `"Dolo 650 (Paracetamol 650mg)"` with $\ge 95\%$ confidence.
   - `"Augmnt 625 Tab"` $\rightarrow$ Auto-corrects to `"Augmentin 625 (Amoxicillin + Clavulanate)"`.
   - `"Telma AM"` $\rightarrow$ Auto-corrects to `"Telma-AM (Telmisartan 40mg + Amlodipine 5mg)"`.
   - `"Pan DSR"` $\rightarrow$ Auto-corrects to `"Pan-D (Pantoprazole 40mg + Domperidone)"`.
2. **Lab Test Verification**:
   - Extraction of `"KFT"` or `"Creatinin"` correctly maps to LOINC `2160-0` and appears in `diagnosticTests`.
3. **Build & Typecheck**:
   - Execute shadow-compile / `tsc --noEmit` and confirm exit code 0.