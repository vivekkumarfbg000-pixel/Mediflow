/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║        VITALSYNC CLINIC SERVICES & PRICE BOOK MASTER ENGINE               ║
 * ║  Ground Reality: Out-of-the-box pre-seeded Indian Medicine & Lab Catalog   ║
 * ║  Zero manual data-entry required for Tier-2/3 & Indian Clinic OPDs         ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { safeGetStorageJSON } from '../utils/storage';
import { save, load } from './apiHelper';
import { getPodContext } from './podContext';
import { LabService, MASTER_TEST_CATALOG } from './labService';
import type { DiagnosticTest } from '../types';

export interface PriceBookMedicineItem {
  id: string;
  name: string;
  genericName: string;
  category: string;
  dosage: string;
  mrp: number;
  price: number;
  unit: 'tabs' | 'caps' | 'vials' | 'ml' | 'gm' | 'strips' | 'units';
  manufacturer?: string;
  isCustom?: boolean;
}

export const MASTER_INDIAN_MEDICINES: PriceBookMedicineItem[] = [
  // ── 1. ANALGESICS & ANTIPYRETICS (Fever & Pain) ──
  { id: 'pb-med-1', name: 'Dolo 650mg Tablet', genericName: 'Paracetamol IP 650mg', category: 'Analgesic / Antipyretic', dosage: '650mg', mrp: 32, price: 30, unit: 'tabs', manufacturer: 'Micro Labs' },
  { id: 'pb-med-2', name: 'Calpol 650mg Tablet', genericName: 'Paracetamol IP 650mg', category: 'Analgesic / Antipyretic', dosage: '650mg', mrp: 32, price: 30, unit: 'tabs', manufacturer: 'GSK' },
  { id: 'pb-med-3', name: 'Calpol 500mg Tablet', genericName: 'Paracetamol IP 500mg', category: 'Analgesic / Antipyretic', dosage: '500mg', mrp: 18, price: 16, unit: 'tabs', manufacturer: 'GSK' },
  { id: 'pb-med-4', name: 'Combiflam Tablet', genericName: 'Ibuprofen 400mg + Paracetamol 325mg', category: 'Pain & Inflammation', dosage: '400mg+325mg', mrp: 45, price: 42, unit: 'tabs', manufacturer: 'Sanofi' },
  { id: 'pb-med-5', name: 'Zerodol-P Tablet', genericName: 'Aceclofenac 100mg + Paracetamol 325mg', category: 'Pain & Inflammation', dosage: '100mg+325mg', mrp: 68, price: 62, unit: 'tabs', manufacturer: 'Ipca' },
  { id: 'pb-med-6', name: 'Zerodol-SP Tablet', genericName: 'Aceclofenac 100mg + Paracetamol 325mg + Serratiopeptidase 15mg', category: 'Anti-Inflammatory / Pain', dosage: '100+325+15mg', mrp: 115, price: 105, unit: 'tabs', manufacturer: 'Ipca' },
  { id: 'pb-med-7', name: 'Meftal-Spas Tablet', genericName: 'Mefenamic Acid 250mg + Dicyclomine 10mg', category: 'Antispasmodic', dosage: '250mg+10mg', mrp: 52, price: 48, unit: 'tabs', manufacturer: 'Blue Cross' },
  { id: 'pb-med-8', name: 'Meftal 500mg Tablet', genericName: 'Mefenamic Acid 500mg', category: 'Analgesic / Antipyretic', dosage: '500mg', mrp: 38, price: 35, unit: 'tabs', manufacturer: 'Blue Cross' },
  { id: 'pb-med-9', name: 'Ultracet Tablet', genericName: 'Tramadol 37.5mg + Paracetamol 325mg', category: 'Severe Pain', dosage: '37.5+325mg', mrp: 210, price: 195, unit: 'tabs', manufacturer: 'Janssen' },
  { id: 'pb-med-10', name: 'Voveran 50mg Tablet', genericName: 'Diclofenac Sodium 50mg', category: 'Pain & Inflammation', dosage: '50mg', mrp: 40, price: 36, unit: 'tabs', manufacturer: 'Novartis' },
  { id: 'pb-med-11', name: 'Crocin 650 Advance Tablet', genericName: 'Paracetamol IP 650mg Fast-Release', category: 'Analgesic / Antipyretic', dosage: '650mg', mrp: 34, price: 32, unit: 'tabs', manufacturer: 'GSK' },

  // ── 2. ANTIBIOTICS & ANTIMICROBIALS ──
  { id: 'pb-med-12', name: 'Augmentin 625 Duo Tablet', genericName: 'Amoxicillin 500mg + Clavulanic Acid 125mg', category: 'Antibiotic', dosage: '625mg', mrp: 205, price: 190, unit: 'tabs', manufacturer: 'GSK' },
  { id: 'pb-med-13', name: 'Clavam 625 Tablet', genericName: 'Amoxicillin 500mg + Clavulanic Acid 125mg', category: 'Antibiotic', dosage: '625mg', mrp: 205, price: 190, unit: 'tabs', manufacturer: 'Alkem' },
  { id: 'pb-med-14', name: 'Moxikind-CV 625 Tablet', genericName: 'Amoxicillin 500mg + Clavulanate Potassium 125mg', category: 'Antibiotic', dosage: '625mg', mrp: 185, price: 170, unit: 'tabs', manufacturer: 'Mankind' },
  { id: 'pb-med-15', name: 'Azee 500mg Tablet', genericName: 'Azithromycin IP 500mg', category: 'Antibiotic / Macrolide', dosage: '500mg', mrp: 125, price: 115, unit: 'tabs', manufacturer: 'Cipla' },
  { id: 'pb-med-16', name: 'Azithral 500mg Tablet', genericName: 'Azithromycin IP 500mg', category: 'Antibiotic / Macrolide', dosage: '500mg', mrp: 130, price: 120, unit: 'tabs', manufacturer: 'Alembic' },
  { id: 'pb-med-17', name: 'Taxim-O 200mg Tablet', genericName: 'Cefixime IP 200mg', category: 'Antibiotic / Cephalosporin', dosage: '200mg', mrp: 110, price: 100, unit: 'tabs', manufacturer: 'Alkem' },
  { id: 'pb-med-18', name: 'Zifi 200mg Tablet', genericName: 'Cefixime IP 200mg', category: 'Antibiotic / Cephalosporin', dosage: '200mg', mrp: 112, price: 102, unit: 'tabs', manufacturer: 'FDC' },
  { id: 'pb-med-19', name: 'Mahacef 200mg Tablet', genericName: 'Cefixime IP 200mg', category: 'Antibiotic / Cephalosporin', dosage: '200mg', mrp: 105, price: 95, unit: 'tabs', manufacturer: 'Mankind' },
  { id: 'pb-med-20', name: 'Monocef-O 200mg Tablet', genericName: 'Cefpodoxime Proxetil 200mg', category: 'Antibiotic / Cephalosporin', dosage: '200mg', mrp: 175, price: 160, unit: 'tabs', manufacturer: 'Aristo' },
  { id: 'pb-med-21', name: 'Ceftum 500mg Tablet', genericName: 'Cefuroxime Axetil 500mg', category: 'Antibiotic / Cephalosporin', dosage: '500mg', mrp: 480, price: 450, unit: 'tabs', manufacturer: 'GSK' },
  { id: 'pb-med-22', name: 'Ciplox 500mg Tablet', genericName: 'Ciprofloxacin 500mg', category: 'Antibiotic / Fluoroquinolone', dosage: '500mg', mrp: 46, price: 40, unit: 'tabs', manufacturer: 'Cipla' },
  { id: 'pb-med-23', name: 'Zenflox 200mg Tablet', genericName: 'Ofloxacin 200mg', category: 'Antibiotic / Fluoroquinolone', dosage: '200mg', mrp: 68, price: 60, unit: 'tabs', manufacturer: 'Mankind' },
  { id: 'pb-med-24', name: 'Norflox-TZ Tablet', genericName: 'Norfloxacin 400mg + Tinidazole 600mg', category: 'Antibacterial / Antiprotozoal', dosage: '400mg+600mg', mrp: 88, price: 80, unit: 'tabs', manufacturer: 'Cipla' },
  { id: 'pb-med-25', name: 'Metrogyl 400mg Tablet', genericName: 'Metronidazole 400mg', category: 'Antiamoebic / Antiprotozoal', dosage: '400mg', mrp: 25, price: 22, unit: 'tabs', manufacturer: 'J.B. Chemicals' },
  { id: 'pb-med-26', name: 'Novamox 500mg Capsule', genericName: 'Amoxicillin Trihydrate 500mg', category: 'Antibiotic / Penicillin', dosage: '500mg', mrp: 72, price: 65, unit: 'caps', manufacturer: 'Cipla' },
  { id: 'pb-med-27', name: 'Doxicip 100mg Capsule', genericName: 'Doxycycline Hydrochloride 100mg', category: 'Antibiotic / Tetracycline', dosage: '100mg', mrp: 45, price: 40, unit: 'caps', manufacturer: 'Cipla' },

  // ── 3. GASTROINTESTINAL & PPI (Antacids, Gastritis, GERD) ──
  { id: 'pb-med-28', name: 'Pan 40 Tablet', genericName: 'Pantoprazole Sodium 40mg', category: 'Gastrointestinal / PPI', dosage: '40mg', mrp: 145, price: 130, unit: 'tabs', manufacturer: 'Alkem' },
  { id: 'pb-med-29', name: 'Pantocid 40 Tablet', genericName: 'Pantoprazole Sodium 40mg', category: 'Gastrointestinal / PPI', dosage: '40mg', mrp: 160, price: 145, unit: 'tabs', manufacturer: 'Sun Pharma' },
  { id: 'pb-med-30', name: 'Pantop 40 Tablet', genericName: 'Pantoprazole Sodium 40mg', category: 'Gastrointestinal / PPI', dosage: '40mg', mrp: 140, price: 125, unit: 'tabs', manufacturer: 'Aristo' },
  { id: 'pb-med-31', name: 'Pan-D Capsule', genericName: 'Pantoprazole 40mg + Domperidone 30mg SR', category: 'Antacid / Antiemetic', dosage: '40mg+30mg', mrp: 195, price: 180, unit: 'caps', manufacturer: 'Alkem' },
  { id: 'pb-med-32', name: 'Pantocid-D Capsule', genericName: 'Pantoprazole 40mg + Domperidone 30mg SR', category: 'Antacid / Antiemetic', dosage: '40mg+30mg', mrp: 210, price: 190, unit: 'caps', manufacturer: 'Sun Pharma' },
  { id: 'pb-med-33', name: 'Omez 20mg Capsule', genericName: 'Omeprazole 20mg', category: 'Gastrointestinal / PPI', dosage: '20mg', mrp: 62, price: 55, unit: 'caps', manufacturer: 'Dr. Reddy\'s' },
  { id: 'pb-med-34', name: 'Omez-D Capsule', genericName: 'Omeprazole 20mg + Domperidone 10mg', category: 'Antacid / Antiemetic', dosage: '20mg+10mg', mrp: 98, price: 88, unit: 'caps', manufacturer: 'Dr. Reddy\'s' },
  { id: 'pb-med-35', name: 'Razo 20mg Tablet', genericName: 'Rabeprazole Sodium 20mg', category: 'Gastrointestinal / PPI', dosage: '20mg', mrp: 175, price: 160, unit: 'tabs', manufacturer: 'Dr. Reddy\'s' },
  { id: 'pb-med-36', name: 'Rabekind-DSR Capsule', genericName: 'Rabeprazole 20mg + Domperidone 30mg SR', category: 'Antacid / Antiemetic', dosage: '20mg+30mg', mrp: 190, price: 175, unit: 'caps', manufacturer: 'Mankind' },
  { id: 'pb-med-37', name: 'Aciloc 150mg Tablet', genericName: 'Ranitidine 150mg', category: 'H2 Blocker / Antacid', dosage: '150mg', mrp: 42, price: 38, unit: 'tabs', manufacturer: 'Cadila' },
  { id: 'pb-med-38', name: 'Gelusil MPS Liquid (200ml)', genericName: 'Aluminium Hydroxide + Magnesium + Simethicone', category: 'Antacid Syrup', dosage: '200ml', mrp: 125, price: 115, unit: 'ml', manufacturer: 'Pfizer' },
  { id: 'pb-med-39', name: 'Digene Gel Mint (200ml)', genericName: 'Magnesium Hydroxide + Simethicone', category: 'Antacid Syrup', dosage: '200ml', mrp: 135, price: 125, unit: 'ml', manufacturer: 'Abbott' },
  { id: 'pb-med-40', name: 'Sucrafil Suspension (200ml)', genericName: 'Sucralfate 1000mg / 10ml', category: 'Ulcer Protectant', dosage: '200ml', mrp: 240, price: 220, unit: 'ml', manufacturer: 'Fourrts' },
  { id: 'pb-med-41', name: 'Duphalac Oral Solution (150ml)', genericName: 'Lactulose Solution USP 10g / 15ml', category: 'Laxative', dosage: '150ml', mrp: 290, price: 270, unit: 'ml', manufacturer: 'Abbott' },
  { id: 'pb-med-42', name: 'Ondem 4mg Tablet', genericName: 'Ondansetron 4mg Fast-Dissolve', category: 'Antiemetic (Nausea/Vomiting)', dosage: '4mg', mrp: 55, price: 50, unit: 'tabs', manufacturer: 'Alkem' },
  { id: 'pb-med-43', name: 'Vomikind 4mg Tablet', genericName: 'Ondansetron 4mg', category: 'Antiemetic', dosage: '4mg', mrp: 45, price: 40, unit: 'tabs', manufacturer: 'Mankind' },

  // ── 4. ANTIDIABETIC AGENTS ──
  { id: 'pb-med-44', name: 'Glycomet 500 SR Tablet', genericName: 'Metformin Hydrochloride 500mg SR', category: 'Antidiabetic', dosage: '500mg SR', mrp: 24, price: 22, unit: 'tabs', manufacturer: 'USV' },
  { id: 'pb-med-45', name: 'Glycomet 1000 SR Tablet', genericName: 'Metformin Hydrochloride 1000mg SR', category: 'Antidiabetic', dosage: '1000mg SR', mrp: 48, price: 44, unit: 'tabs', manufacturer: 'USV' },
  { id: 'pb-med-46', name: 'Glycomet-GP 1 Tablet', genericName: 'Glimepiride 1mg + Metformin 500mg SR', category: 'Antidiabetic Combination', dosage: '1mg+500mg', mrp: 98, price: 90, unit: 'tabs', manufacturer: 'USV' },
  { id: 'pb-med-47', name: 'Glycomet-GP 2 Tablet', genericName: 'Glimepiride 2mg + Metformin 500mg SR', category: 'Antidiabetic Combination', dosage: '2mg+500mg', mrp: 145, price: 135, unit: 'tabs', manufacturer: 'USV' },
  { id: 'pb-med-48', name: 'Janumet 50mg/500mg Tablet', genericName: 'Sitagliptin 50mg + Metformin 500mg', category: 'Antidiabetic DPP4i', dosage: '50mg+500mg', mrp: 350, price: 330, unit: 'tabs', manufacturer: 'MSD' },
  { id: 'pb-med-49', name: 'Galvus Met 50mg/500mg Tablet', genericName: 'Vildagliptin 50mg + Metformin 500mg', category: 'Antidiabetic DPP4i', dosage: '50mg+500mg', mrp: 280, price: 260, unit: 'tabs', manufacturer: 'Novartis' },
  { id: 'pb-med-50', name: 'Jardiance 10mg Tablet', genericName: 'Empagliflozin 10mg', category: 'Antidiabetic SGLT2i', dosage: '10mg', mrp: 540, price: 510, unit: 'tabs', manufacturer: 'Boehringer' },
  { id: 'pb-med-51', name: 'Forxiga 10mg Tablet', genericName: 'Dapagliflozin 10mg', category: 'Antidiabetic SGLT2i', dosage: '10mg', mrp: 620, price: 580, unit: 'tabs', manufacturer: 'AstraZeneca' },
  { id: 'pb-med-52', name: 'Teneliglip-M 20/500 Tablet', genericName: 'Teneligliptin 20mg + Metformin 500mg', category: 'Antidiabetic DPP4i', dosage: '20mg+500mg', mrp: 110, price: 100, unit: 'tabs', manufacturer: 'Mankind' },
  { id: 'pb-med-53', name: 'Amaryl 1mg Tablet', genericName: 'Glimepiride 1mg', category: 'Antidiabetic Sulfonylurea', dosage: '1mg', mrp: 75, price: 68, unit: 'tabs', manufacturer: 'Sanofi' },
  { id: 'pb-med-54', name: 'Amaryl 2mg Tablet', genericName: 'Glimepiride 2mg', category: 'Antidiabetic Sulfonylurea', dosage: '2mg', mrp: 120, price: 110, unit: 'tabs', manufacturer: 'Sanofi' },

  // ── 5. CARDIOVASCULAR & ANTIHYPERTENSIVES ──
  { id: 'pb-med-55', name: 'Telma 40mg Tablet', genericName: 'Telmisartan IP 40mg', category: 'Antihypertensive / ARB', dosage: '40mg', mrp: 140, price: 128, unit: 'tabs', manufacturer: 'Glenmark' },
  { id: 'pb-med-56', name: 'Telma-H Tablet', genericName: 'Telmisartan 40mg + Hydrochlorothiazide 12.5mg', category: 'Antihypertensive Combination', dosage: '40mg+12.5mg', mrp: 175, price: 160, unit: 'tabs', manufacturer: 'Glenmark' },
  { id: 'pb-med-57', name: 'Telma-AM Tablet', genericName: 'Telmisartan 40mg + Amlodipine 5mg', category: 'Antihypertensive Combination', dosage: '40mg+5mg', mrp: 185, price: 170, unit: 'tabs', manufacturer: 'Glenmark' },
  { id: 'pb-med-58', name: 'Telmikind 40mg Tablet', genericName: 'Telmisartan IP 40mg', category: 'Antihypertensive / ARB', dosage: '40mg', mrp: 85, price: 78, unit: 'tabs', manufacturer: 'Mankind' },
  { id: 'pb-med-59', name: 'Amlong 5mg Tablet', genericName: 'Amlodipine Besylate 5mg', category: 'Antihypertensive / CCB', dosage: '5mg', mrp: 55, price: 50, unit: 'tabs', manufacturer: 'Micro Labs' },
  { id: 'pb-med-60', name: 'Cilacar 10mg Tablet', genericName: 'Cilnidipine 10mg', category: 'Antihypertensive / CCB', dosage: '10mg', mrp: 135, price: 125, unit: 'tabs', manufacturer: 'J.B. Chemicals' },
  { id: 'pb-med-61', name: 'Ecosprin 75mg Tablet', genericName: 'Aspirin Gastro-Resistant 75mg', category: 'Antiplatelet / Cardiac', dosage: '75mg', mrp: 12, price: 10, unit: 'tabs', manufacturer: 'USV' },
  { id: 'pb-med-62', name: 'Ecosprin 150mg Tablet', genericName: 'Aspirin Gastro-Resistant 150mg', category: 'Antiplatelet / Cardiac', dosage: '150mg', mrp: 15, price: 13, unit: 'tabs', manufacturer: 'USV' },
  { id: 'pb-med-63', name: 'Clopilet 75mg Tablet', genericName: 'Clopidogrel Bisulfate 75mg', category: 'Antiplatelet / Cardiac', dosage: '75mg', mrp: 140, price: 128, unit: 'tabs', manufacturer: 'Sun Pharma' },
  { id: 'pb-med-64', name: 'Atorva 10mg Tablet', genericName: 'Atorvastatin Calcium IP 10mg', category: 'Lipid Lowering / Statin', dosage: '10mg', mrp: 85, price: 78, unit: 'tabs', manufacturer: 'Zydus' },
  { id: 'pb-med-65', name: 'Atorva 20mg Tablet', genericName: 'Atorvastatin Calcium IP 20mg', category: 'Lipid Lowering / Statin', dosage: '20mg', mrp: 165, price: 150, unit: 'tabs', manufacturer: 'Zydus' },
  { id: 'pb-med-66', name: 'Rosuvas 10mg Tablet', genericName: 'Rosuvastatin Calcium 10mg', category: 'Lipid Lowering / Statin', dosage: '10mg', mrp: 195, price: 180, unit: 'tabs', manufacturer: 'Ranbaxy / Sun' },
  { id: 'pb-med-67', name: 'Metolar XR 50mg Tablet', genericName: 'Metoprolol Succinate 50mg Extended Release', category: 'Beta Blocker / Cardiac', dosage: '50mg ER', mrp: 125, price: 115, unit: 'tabs', manufacturer: 'Cipla' },
  { id: 'pb-med-68', name: 'Concor 5mg Tablet', genericName: 'Bisoprolol Fumarate 5mg', category: 'Beta Blocker / Cardiac', dosage: '5mg', mrp: 120, price: 110, unit: 'tabs', manufacturer: 'Merck' },

  // ── 6. RESPIRATORY, ANTI-ALLERGIC & COUGH ──
  { id: 'pb-med-69', name: 'Montair-LC Tablet', genericName: 'Montelukast 10mg + Levocetirizine 5mg', category: 'Antiallergic / Antiasthmatic', dosage: '10mg+5mg', mrp: 180, price: 165, unit: 'tabs', manufacturer: 'Cipla' },
  { id: 'pb-med-70', name: 'Montek-LC Tablet', genericName: 'Montelukast 10mg + Levocetirizine 5mg', category: 'Antiallergic', dosage: '10mg+5mg', mrp: 175, price: 160, unit: 'tabs', manufacturer: 'Sun Pharma' },
  { id: 'pb-med-71', name: 'Allegra 120mg Tablet', genericName: 'Fexofenadine Hydrochloride 120mg', category: 'Antihistamine Non-Sedating', dosage: '120mg', mrp: 140, price: 130, unit: 'tabs', manufacturer: 'Sanofi' },
  { id: 'pb-med-72', name: 'Allegra 180mg Tablet', genericName: 'Fexofenadine Hydrochloride 180mg', category: 'Antihistamine Non-Sedating', dosage: '180mg', mrp: 195, price: 180, unit: 'tabs', manufacturer: 'Sanofi' },
  { id: 'pb-med-73', name: 'Cetzine 10mg Tablet', genericName: 'Cetirizine Hydrochloride 10mg', category: 'Antihistamine', dosage: '10mg', mrp: 35, price: 30, unit: 'tabs', manufacturer: 'GSK' },
  { id: 'pb-med-74', name: 'Levocet 5mg Tablet', genericName: 'Levocetirizine Dihydrochloride 5mg', category: 'Antihistamine', dosage: '5mg', mrp: 48, price: 42, unit: 'tabs', manufacturer: 'Hetero' },
  { id: 'pb-med-75', name: 'Avil 25mg Tablet', genericName: 'Pheniramine Maleate 25mg', category: 'Antihistamine', dosage: '25mg', mrp: 12, price: 10, unit: 'tabs', manufacturer: 'Sanofi' },
  { id: 'pb-med-76', name: 'Ascoril-LS Syrup (100ml)', genericName: 'Levosalbutamol + Ambroxol + Guaiphenesin', category: 'Cough Expectorant (Wet Cough)', dosage: '100ml', mrp: 120, price: 110, unit: 'ml', manufacturer: 'Glenmark' },
  { id: 'pb-med-77', name: 'Chericof Syrup (100ml)', genericName: 'Dextromethorphan + Chlorpheniramine + Phenylephrine', category: 'Cough Suppressant (Dry Cough)', dosage: '100ml', mrp: 115, price: 105, unit: 'ml', manufacturer: 'Sun Pharma' },
  { id: 'pb-med-78', name: 'Grilinctus Syrup (100ml)', genericName: 'Dextromethorphan + Chlorpheniramine + Guaifenesin', category: 'Cough Syrup', dosage: '100ml', mrp: 118, price: 108, unit: 'ml', manufacturer: 'Franco-Indian' },
  { id: 'pb-med-79', name: 'Asthalin Inhaler (200 MDI)', genericName: 'Salbutamol 100mcg / puff', category: 'Bronchodilator Inhaler', dosage: '200 doses', mrp: 160, price: 150, unit: 'units', manufacturer: 'Cipla' },
  { id: 'pb-med-80', name: 'Foracort 200 Inhaler (120 MDI)', genericName: 'Formoterol 6mcg + Budesonide 200mcg', category: 'Asthma Inhaler Controller', dosage: '120 doses', mrp: 480, price: 450, unit: 'units', manufacturer: 'Cipla' },
  { id: 'pb-med-81', name: 'Deriphyllin 150mg Tablet', genericName: 'Etofylline 115mg + Theophylline 35mg', category: 'Bronchodilator', dosage: '150mg', mrp: 35, price: 30, unit: 'tabs', manufacturer: 'Zydus' },
  { id: 'pb-med-82', name: 'Mucinac 600mg Effervescent Tablet', genericName: 'N-Acetylcysteine 600mg', category: 'Mucolytic / Antioxidant', dosage: '600mg', mrp: 285, price: 260, unit: 'tabs', manufacturer: 'Cipla' },

  // ── 7. VITAMINS, MINERALS & SUPPLEMENTS ──
  { id: 'pb-med-83', name: 'Shelcal 500mg Tablet', genericName: 'Calcium Carbonate 500mg + Vitamin D3 250 IU', category: 'Bone Health / Calcium', dosage: '500mg+250IU', mrp: 135, price: 122, unit: 'tabs', manufacturer: 'Torrent' },
  { id: 'pb-med-84', name: 'Cipcal 500mg Tablet', genericName: 'Calcium 500mg + Vitamin D3', category: 'Bone Health / Calcium', dosage: '500mg+250IU', mrp: 125, price: 115, unit: 'tabs', manufacturer: 'Cipla' },
  { id: 'pb-med-85', name: 'D-Rise 60K Capsule', genericName: 'Cholecalciferol IP 60,000 IU', category: 'Vitamin D3 High Dose', dosage: '60000 IU', mrp: 145, price: 130, unit: 'caps', manufacturer: 'USV' },
  { id: 'pb-med-86', name: 'Calcirol Sachet (1g)', genericName: 'Cholecalciferol 60,000 IU Granules', category: 'Vitamin D3 Sachet', dosage: '1g sachet', mrp: 55, price: 50, unit: 'units', manufacturer: 'Cadila' },
  { id: 'pb-med-87', name: 'Becosules Capsule', genericName: 'Vitamin B-Complex with Vitamin C', category: 'Multivitamin B-Complex', dosage: 'Capsule', mrp: 52, price: 46, unit: 'caps', manufacturer: 'Pfizer' },
  { id: 'pb-med-88', name: 'Neurobion Forte Tablet', genericName: 'Vitamin B1, B6, B12 Complex', category: 'Neurotrophic B-Vitamins', dosage: 'Tablet', mrp: 42, price: 38, unit: 'tabs', manufacturer: 'Procter & Gamble' },
  { id: 'pb-med-89', name: 'Nurokind-LC Tablet', genericName: 'Mecobalamin 1500mcg + L-Carnitine + Folic Acid', category: 'Neuropathy Supplement', dosage: 'Tablet', mrp: 215, price: 195, unit: 'tabs', manufacturer: 'Mankind' },
  { id: 'pb-med-90', name: 'Supradyn Daily Tablet', genericName: 'Multivitamin with Minerals & Trace Elements', category: 'Daily Multivitamin', dosage: 'Tablet', mrp: 60, price: 54, unit: 'tabs', manufacturer: 'Bayer' },
  { id: 'pb-med-91', name: 'Limcee 500mg Chewable Tablet', genericName: 'Vitamin C 500mg (Ascorbic Acid)', category: 'Vitamin C / Immunity', dosage: '500mg', mrp: 30, price: 26, unit: 'tabs', manufacturer: 'Abbott' },
  { id: 'pb-med-92', name: 'Orofer-XT Tablet', genericName: 'Ferrous Ascorbate 100mg + Folic Acid 1.5mg', category: 'Hematinic / Iron Supplement', dosage: '100mg+1.5mg', mrp: 185, price: 168, unit: 'tabs', manufacturer: 'Emcure' },
  { id: 'pb-med-93', name: 'Folvite 5mg Tablet', genericName: 'Folic Acid 5mg', category: 'Folic Acid Supplement', dosage: '5mg', mrp: 75, price: 68, unit: 'tabs', manufacturer: 'Pfizer' },
  { id: 'pb-med-94', name: 'Thyronorm 50mcg Tablet', genericName: 'Thyroxine Sodium IP 50mcg', category: 'Thyroid Hormone', dosage: '50mcg', mrp: 145, price: 135, unit: 'tabs', manufacturer: 'Abbott' },
  { id: 'pb-med-95', name: 'Thyronorm 100mcg Tablet', genericName: 'Thyroxine Sodium IP 100mcg', category: 'Thyroid Hormone', dosage: '100mcg', mrp: 175, price: 160, unit: 'tabs', manufacturer: 'Abbott' },

  // ── 8. ANTI-INFECTIVES & DERMA / TOPICALS ──
  { id: 'pb-med-96', name: 'Forcan 150mg Tablet', genericName: 'Fluconazole 150mg', category: 'Antifungal', dosage: '150mg', mrp: 35, price: 30, unit: 'tabs', manufacturer: 'Cipla' },
  { id: 'pb-med-97', name: 'Canditral 200mg Capsule', genericName: 'Itraconazole 200mg', category: 'Antifungal', dosage: '200mg', mrp: 260, price: 240, unit: 'caps', manufacturer: 'Glenmark' },
  { id: 'pb-med-98', name: 'Zentel 400mg Tablet', genericName: 'Albendazole 400mg Chewable', category: 'Anthelmintic (Deworming)', dosage: '400mg', mrp: 15, price: 12, unit: 'tabs', manufacturer: 'GSK' },
  { id: 'pb-med-99', name: 'Bandy-Plus Tablet', genericName: 'Ivermectin 6mg + Albendazole 400mg', category: 'Deworming Combination', dosage: '6mg+400mg', mrp: 28, price: 25, unit: 'tabs', manufacturer: 'Mankind' },
  { id: 'pb-med-100', name: 'Betadine 5% Ointment (20g)', genericName: 'Povidone Iodine 5% w/w', category: 'Antiseptic Topical', dosage: '20g', mrp: 85, price: 78, unit: 'gm', manufacturer: 'Win-Medicare' },
  { id: 'pb-med-101', name: 'Soframycin Skin Cream (30g)', genericName: 'Framycetin Sulphate 1% w/w', category: 'Antibiotic Topical', dosage: '30g', mrp: 65, price: 58, unit: 'gm', manufacturer: 'Sanofi' },
  { id: 'pb-med-102', name: 'Volini Gel (30g)', genericName: 'Diclofenac Diethylamine + Methyl Salicylate', category: 'Pain Relief Gel', dosage: '30g', mrp: 110, price: 100, unit: 'gm', manufacturer: 'Sun Pharma' },
  { id: 'pb-med-103', name: 'Otrivin Adult Nasal Spray (10ml)', genericName: 'Xylometazoline Hydrochloride 0.1%', category: 'Nasal Decongestant', dosage: '10ml', mrp: 98, price: 90, unit: 'ml', manufacturer: 'GSK' },
  { id: 'pb-med-104', name: 'Electral Sachet (21.8g)', genericName: 'Oral Rehydration Salts (WHO Formula)', category: 'ORS Electrolytes', dosage: '21.8g sachet', mrp: 23, price: 21, unit: 'units', manufacturer: 'FDC' },
];

export class PriceBookService {
  /**
   * Retrieves the live medicine catalog merged with clinic-level rate adjustments
   */
  static getMedicineCatalog(podId?: string): PriceBookMedicineItem[] {
    const currentPod = podId || getPodContext().podId || 'default';
    const storageKey = `vitalsync_medicine_price_book_${currentPod}`;
    const customRateCard = safeGetStorageJSON<Record<string, Partial<PriceBookMedicineItem>>>(storageKey, {}) || {};
    const fallbackRateCard = safeGetStorageJSON<Record<string, Partial<PriceBookMedicineItem>>>('vitalsync_medicine_price_book', {}) || {};
    const mergedCard = { ...fallbackRateCard, ...customRateCard };

    // Custom added clinic medicines that may not exist in MASTER
    const customAddedKey = `vitalsync_custom_medicines_${currentPod}`;
    const customAdded = safeGetStorageJSON<PriceBookMedicineItem[]>(customAddedKey, []) || [];

    const baseCatalog = MASTER_INDIAN_MEDICINES.map(m => {
      const overrideKey = m.name.toLowerCase();
      const override = mergedCard[m.id] || mergedCard[overrideKey];
      if (override) {
        return {
          ...m,
          mrp: typeof override.mrp === 'number' ? override.mrp : m.mrp,
          price: typeof override.price === 'number' ? override.price : m.price,
          category: override.category || m.category,
          dosage: override.dosage || m.dosage,
          unit: override.unit || m.unit
        };
      }
      return { ...m };
    });

    const combined = [...baseCatalog];
    customAdded.forEach(cItem => {
      if (!combined.some(b => b.name.toLowerCase() === cItem.name.toLowerCase())) {
        combined.push({ ...cItem, isCustom: true });
      }
    });

    return combined;
  }

  /**
   * Updates or overrides a medicine's MRP and Selling Price for the active clinic pod
   */
  static updateMedicineRate(
    item: { id?: string; name: string; mrp: number; price: number; category?: string; dosage?: string },
    podId?: string
  ): void {
    const currentPod = podId || getPodContext().podId || 'default';
    const storageKey = `vitalsync_medicine_price_book_${currentPod}`;
    const customRateCard = safeGetStorageJSON<Record<string, Partial<PriceBookMedicineItem>>>(storageKey, {}) || {};

    const key = (item.id || item.name).toLowerCase();
    customRateCard[key] = {
      mrp: item.mrp,
      price: item.price,
      ...(item.category ? { category: item.category } : {}),
      ...(item.dosage ? { dosage: item.dosage } : {})
    };

    save(storageKey, customRateCard);
    save('vitalsync_medicine_price_book', customRateCard); // global fallback

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('mediflow-state-change', { detail: { entity: 'medicine_price_book' } }));
    }
  }

  /**
   * Fast lookup: Matches an extracted prescription medicine token with the master catalog
   */
  static matchMedicine(query: string, podId?: string): PriceBookMedicineItem | null {
    if (!query || !query.trim()) return null;
    const cleanQ = query.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
    if (cleanQ.length < 2) return null;

    const catalog = this.getMedicineCatalog(podId);

    // Exact match
    const exact = catalog.find(m => m.name.toLowerCase() === cleanQ || (m.genericName || '').toLowerCase() === cleanQ);
    if (exact) return exact;

    // Tokenized word-level match
    const queryTokens = cleanQ.split(/\s+/).filter(t => t.length > 2);
    let bestMatch: PriceBookMedicineItem | null = null;
    let highestScore = 0;

    for (const item of catalog) {
      const nameLower = item.name.toLowerCase();
      const genericLower = (item.genericName || '').toLowerCase();
      let score = 0;

      for (const token of queryTokens) {
        if (nameLower.includes(token)) score += 3;
        else if (genericLower.includes(token)) score += 2;
      }

      if (score > highestScore && score >= 2) {
        highestScore = score;
        bestMatch = item;
      }
    }

    return bestMatch;
  }

  /**
   * Retrieves the live Diagnostic Test Rate Card from LabService
   */
  static getLabCatalog(podId?: string): DiagnosticTest[] {
    return LabService.getTestCatalog(podId);
  }

  /**
   * Updates a diagnostic test rate card price
   */
  static updateLabTestRate(loincCode: string, testName: string, price: number, podId?: string): void {
    void testName;
    LabService.updateTestPrice(loincCode, price, podId);
  }
}
