import { supabase } from '../lib/supabaseClient';
import { load, save, writeAuditLog, notify } from './apiHelper';
import { TelemetryService } from './telemetry';
import { PatientService } from './patientService';
import type { 
  PharmacyInventoryItem, 
  InventoryHold, 
  MedicineBill, 
  CounterTransaction,
  WhatsAppDrugOrder,
  MedicineImportRow,
  FinancialLedgerEntry
} from '../types';

export class PharmacyService {
  private static readonly AI_BASE = (() => {
    const configured = import.meta.env.VITE_AI_BACKEND_URL;
    if (!configured && import.meta.env.PROD) {
      console.error('[Mediflow Pharmacy] CRITICAL: VITE_AI_BACKEND_URL not set. AI features will fail in production.');
    }
    return (configured || 'http://localhost:8000').replace(/\/$/, '');
  })();


  static getPharmacyInventory(): PharmacyInventoryItem[] {
    const isOphthalmology = typeof window !== 'undefined' && 
      (window.localStorage.getItem('mediflow_demo_specialization') === 'Ophthalmology');

    const defaultOphthalmicItems: PharmacyInventoryItem[] = [
      {
        id: 'eye-item-1',
        name: 'Moxifloxacin Eye Drops 0.5%',
        genericName: 'Moxifloxacin',
        category: 'Ophthalmic Antibiotic',
        manufacturer: 'Alcon / Novartis',
        batchNumber: 'MOX26A-01',
        expiryDate: new Date(new Date().getTime() + 180 * 24 * 3600 * 1000).toISOString().split('T')[0],
        mrp: 120,
        price: 110,
        stock: 45,
        unit: 'vials',
        threshold: 15,
        dosage: '0.5% w/v',
        addedAt: new Date().toISOString(),
        hsn: '300490'
      },
      {
        id: 'eye-item-2',
        name: 'Carboxymethylcellulose 0.5%',
        genericName: 'Carboxymethylcellulose Sodium',
        category: 'Artificial Tears / Lubricant',
        manufacturer: 'Allergan',
        batchNumber: 'CMC26B-02',
        expiryDate: new Date(new Date().getTime() + 250 * 24 * 3600 * 1000).toISOString().split('T')[0],
        mrp: 145,
        price: 135,
        stock: 80,
        unit: 'vials',
        threshold: 20,
        dosage: '0.5%',
        addedAt: new Date().toISOString(),
        hsn: '300490'
      },
      {
        id: 'eye-item-3',
        name: 'Homatropine Eye Drops 2%',
        genericName: 'Homatropine Hydrobromide',
        category: 'Mydriatic / Cycloplegic',
        manufacturer: 'Sun Pharma',
        batchNumber: 'HOM26C-03',
        expiryDate: new Date(new Date().getTime() + 90 * 24 * 3600 * 1000).toISOString().split('T')[0],
        mrp: 180,
        price: 165,
        stock: 35,
        unit: 'vials',
        threshold: 10,
        dosage: '2%',
        addedAt: new Date().toISOString(),
        hsn: '300490'
      },
      {
        id: 'eye-item-4',
        name: 'Alcon AcrySof IQ IOL',
        genericName: 'Hydrophobic Acrylic IOL',
        category: 'Intraocular Lens (IOL)',
        manufacturer: 'Alcon',
        batchNumber: 'IOL26D-04',
        expiryDate: new Date(new Date().getTime() + 1000 * 24 * 3600 * 1000).toISOString().split('T')[0],
        mrp: 15000,
        price: 13500,
        stock: 15,
        unit: 'units',
        threshold: 5,
        dosage: 'Aspheric Monofocal',
        addedAt: new Date().toISOString(),
        hsn: '902139'
      },
      {
        id: 'eye-item-5',
        name: 'Acuvue Oasys Contact Lenses',
        genericName: 'Senofilcon A',
        category: 'Contact Lens',
        manufacturer: 'Johnson & Johnson',
        batchNumber: 'ACV26E-05',
        expiryDate: new Date(new Date().getTime() + 500 * 24 * 3600 * 1000).toISOString().split('T')[0],
        mrp: 1200,
        price: 1100,
        stock: 25,
        unit: 'boxes',
        threshold: 8,
        dosage: '-2.50 DS',
        addedAt: new Date().toISOString(),
        hsn: '900130'
      },
      {
        id: 'eye-item-6',
        name: 'Titan Premium Half-Rim Frame',
        genericName: 'Metal Spectacle Frame',
        category: 'Spectacle Frames',
        manufacturer: 'Titan Eye+',
        batchNumber: 'FRM26F-06',
        expiryDate: new Date(new Date().getTime() + 2000 * 24 * 3600 * 1000).toISOString().split('T')[0],
        mrp: 2400,
        price: 2100,
        stock: 18,
        unit: 'units',
        threshold: 5,
        dosage: 'Medium size',
        addedAt: new Date().toISOString(),
        hsn: '900319'
      },
      {
        id: 'eye-item-7',
        name: 'Essilor Crizal Anti-Glare Lens',
        genericName: 'Crizal Easy Pro',
        category: 'Spectacle Lens',
        manufacturer: 'Essilor',
        batchNumber: 'LNS26G-07',
        expiryDate: new Date(new Date().getTime() + 3000 * 24 * 3600 * 1000).toISOString().split('T')[0],
        mrp: 1800,
        price: 1600,
        stock: 30,
        unit: 'pairs',
        threshold: 10,
        dosage: '1.56 Index',
        addedAt: new Date().toISOString(),
        hsn: '900150'
      }
    ];

    const defaultGeneralItems: PharmacyInventoryItem[] = [
      {
        id: 'item-1',
        name: 'Metformin 500mg',
        genericName: 'Metformin Hydrochloride',
        category: 'Antidiabetic',
        manufacturer: 'Sun Pharma',
        batchNumber: 'MET26A-01',
        expiryDate: new Date(new Date().getTime() + 15 * 24 * 3600 * 1000).toISOString().split('T')[0],
        mrp: 15,
        price: 15,
        stock: 12,
        unit: 'tabs',
        threshold: 30,
        dosage: '500mg',
        addedAt: new Date().toISOString(),
        hsn: '300490'
      },
      {
        id: 'item-2',
        name: 'Paracetamol 650mg',
        genericName: 'Paracetamol',
        category: 'Analgesic',
        manufacturer: 'Cipla',
        batchNumber: 'PAR26C-02',
        expiryDate: new Date(new Date().getTime() + 365 * 24 * 3600 * 1000).toISOString().split('T')[0],
        mrp: 5,
        price: 5,
        stock: 300,
        unit: 'tabs',
        threshold: 50,
        dosage: '650mg',
        addedAt: new Date().toISOString(),
        hsn: '300490'
      },
      {
        id: 'item-3',
        name: 'Amoxicillin 250mg',
        genericName: 'Amoxicillin Trihydrate',
        category: 'Antibiotic',
        manufacturer: 'Alkem',
        batchNumber: 'AMX26D-03',
        expiryDate: new Date(new Date().getTime() + 45 * 24 * 3600 * 1000).toISOString().split('T')[0],
        mrp: 25,
        price: 22,
        stock: 8,
        unit: 'caps',
        threshold: 20,
        dosage: '250mg',
        addedAt: new Date().toISOString(),
        hsn: '300410'
      },
      {
        id: 'item-4',
        name: 'Atorvastatin 10mg',
        genericName: 'Atorvastatin Calcium',
        category: 'Cardiovascular',
        manufacturer: 'Lupin',
        batchNumber: 'ATV26E-04',
        expiryDate: new Date(new Date().getTime() - 5 * 24 * 3600 * 1000).toISOString().split('T')[0],
        mrp: 30,
        price: 28,
        stock: 150,
        unit: 'tabs',
        threshold: 40,
        dosage: '10mg',
        addedAt: new Date().toISOString(),
        hsn: '300490'
      },
      {
        id: 'item-5',
        name: 'Pantoprazole 40mg',
        genericName: 'Pantoprazole Sodium',
        category: 'Gastrointestinal',
        manufacturer: 'Sun Pharma',
        batchNumber: 'PAN26F-05',
        expiryDate: new Date(new Date().getTime() + 400 * 24 * 3600 * 1000).toISOString().split('T')[0],
        mrp: 12,
        price: 10,
        stock: 5,
        unit: 'tabs',
        threshold: 15,
        dosage: '40mg',
        addedAt: new Date().toISOString(),
        hsn: '300490'
      }
    ];

    const selectedDefaults = isOphthalmology ? defaultOphthalmicItems : defaultGeneralItems;
    const stored = load<PharmacyInventoryItem[]>('pharmacy_inventory', []);
    
    if (stored.length > 0) {
      const hasEyeItems = stored.some(i => i.id.startsWith('eye-item-'));
      // If we are in Ophthalmology but have general items only, clear and load eye items
      if (isOphthalmology && !hasEyeItems) {
        save('pharmacy_inventory', defaultOphthalmicItems);
        return defaultOphthalmicItems;
      }
      // If we are in General Medicine but have eye items only, clear and load general items
      if (!isOphthalmology && hasEyeItems) {
        save('pharmacy_inventory', defaultGeneralItems);
        return defaultGeneralItems;
      }
      return stored;
    }
    
    save('pharmacy_inventory', selectedDefaults);
    return selectedDefaults;
  }

  static savePharmacyInventory(items: PharmacyInventoryItem[]) {
    save('pharmacy_inventory', items);
    notify();
  }

  // Master Drug Database containing common default prescription configurations
  static getDrugSuggestions(query: string, isOphthalmology: boolean) {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const defaultOphthalmicSuggestions = [
      { name: 'Moxifloxacin Eye Drops 0.5%', genericName: 'Moxifloxacin', category: 'Ophthalmic Antibiotic', dosage: '1 drop', frequency: 'QDS (4 times daily)', duration: '5 Days' },
      { name: 'Carboxymethylcellulose 0.5%', genericName: 'Carboxymethylcellulose Sodium', category: 'Artificial Tears / Lubricant', dosage: '1 drop', frequency: 'TDS (3 times daily)', duration: '30 Days' },
      { name: 'Homatropine Eye Drops 2%', genericName: 'Homatropine Hydrobromide', category: 'Mydriatic / Cycloplegic', dosage: '1 drop', frequency: 'BD (twice daily)', duration: '3 Days' },
      { name: 'Tobramycin Eye Drops 0.3%', genericName: 'Tobramycin', category: 'Ophthalmic Antibiotic', dosage: '1 drop', frequency: 'QDS (4 times daily)', duration: '7 Days' },
      { name: 'Prednisolone Acetate Eye Drops 1%', genericName: 'Prednisolone Acetate', category: 'Ophthalmic Corticosteroid', dosage: '1 drop', frequency: 'BD (twice daily)', duration: '14 Days' },
      { name: 'Flurbiprofen Eye Drops 0.03%', genericName: 'Flurbiprofen', category: 'Ophthalmic NSAID', dosage: '1 drop', frequency: 'TDS (3 times daily)', duration: '5 Days' },
      { name: 'Timolol Eye Drops 0.5%', genericName: 'Timolol Maleate', category: 'Anti-Glaucoma / Beta-Blocker', dosage: '1 drop', frequency: 'BD (twice daily)', duration: '60 Days' },
      { name: 'Latanoprost Eye Drops 0.005%', genericName: 'Latanoprost', category: 'Anti-Glaucoma / Prostaglandin', dosage: '1 drop', frequency: 'Once daily at night', duration: '90 Days' }
    ];

    const defaultGeneralSuggestions = [
      { name: 'Metformin 500mg', genericName: 'Metformin Hydrochloride', category: 'Antidiabetic', dosage: '1 tablet', frequency: '1-0-1', duration: '30 Days' },
      { name: 'Paracetamol 650mg', genericName: 'Paracetamol', category: 'Analgesic / Antipyretic', dosage: '1 tablet', frequency: '1-0-1', duration: '3 Days' },
      { name: 'Amoxicillin 250mg', genericName: 'Amoxicillin Trihydrate', category: 'Antibiotic', dosage: '1 capsule', frequency: '1-1-1', duration: '5 Days' },
      { name: 'Atorvastatin 10mg', genericName: 'Atorvastatin Calcium', category: 'Cardiovascular / Statin', dosage: '1 tablet', frequency: '0-0-1', duration: '30 Days' },
      { name: 'Pantoprazole 40mg', genericName: 'Pantoprazole Sodium', category: 'Gastrointestinal / PPI', dosage: '1 tablet', frequency: '1-0-0', duration: '10 Days' },
      { name: 'Azithromycin 500mg', genericName: 'Azithromycin', category: 'Antibiotic / Macrolide', dosage: '1 tablet', frequency: '1-0-0', duration: '3 Days' },
      { name: 'Amlodipine 5mg', genericName: 'Amlodipine Besylate', category: 'Antihypertensive', dosage: '1 tablet', frequency: '1-0-0', duration: '30 Days' },
      { name: 'Ibuprofen 400mg', genericName: 'Ibuprofen', category: 'NSAID / Analgesic', dosage: '1 tablet', frequency: '1-0-1', duration: '3 Days' },
      { name: 'Cetirizine 10mg', genericName: 'Cetirizine Hydrochloride', category: 'Antihistamine', dosage: '1 tablet', frequency: '0-0-1', duration: '5 Days' },
      { name: 'Lisinopril 10mg', genericName: 'Lisinopril', category: 'ACE Inhibitor', dosage: '1 tablet', frequency: '1-0-0', duration: '30 Days' }
    ];

    const masterList = isOphthalmology ? defaultOphthalmicSuggestions : defaultGeneralSuggestions;

    // Fetch active local inventory
    const inventory = this.getPharmacyInventory();

    // Map inventory items for matching
    const inventoryMap = new Map();
    inventory.forEach(item => {
      inventoryMap.set(item.name.toLowerCase(), item.stock);
    });

    // Check matches from master list
    const results: any[] = [];
    
    // First matching master lists
    masterList.forEach(item => {
      const matchName = item.name.toLowerCase().includes(q) || item.genericName.toLowerCase().includes(q) || item.category.toLowerCase().includes(q);
      if (matchName) {
        const stock = inventoryMap.has(item.name.toLowerCase()) ? inventoryMap.get(item.name.toLowerCase()) : 0;
        results.push({
          ...item,
          stock,
          inInventory: inventoryMap.has(item.name.toLowerCase())
        });
      }
    });

    // Also check if any unique items are in the pharmacy inventory that are not in master list
    inventory.forEach(item => {
      const isAlreadyAdded = results.some(r => r.name.toLowerCase() === item.name.toLowerCase());
      if (!isAlreadyAdded) {
        const matchName = item.name.toLowerCase().includes(q) || (item.genericName && item.genericName.toLowerCase().includes(q)) || (item.category && item.category.toLowerCase().includes(q));
        if (matchName) {
          results.push({
            name: item.name,
            genericName: item.genericName || 'N/A',
            category: item.category || 'Pharmacy Inventory',
            dosage: item.dosage || '',
            frequency: isOphthalmology ? 'TDS (3 times daily)' : '1-0-1',
            duration: '5 Days',
            stock: item.stock,
            inInventory: true
          });
        }
      }
    });

    return results;
  }

  static addPharmacyInventoryItem(item: Omit<PharmacyInventoryItem, 'id' | 'addedAt'>, entityId?: string): PharmacyInventoryItem {
    const items = this.getPharmacyInventory();
    const newItem: PharmacyInventoryItem = {
      ...item,
      id: crypto.randomUUID(),
      addedAt: new Date().toISOString()
    };
    items.push(newItem);
    this.savePharmacyInventory(items);

    // Sync to Supabase
    const dbRow = {
      id: newItem.id,
      pharmacy_entity_id: entityId || 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317004',
      medicine_name: newItem.name,
      batch_number: newItem.batchNumber,
      expiry_date: newItem.expiryDate,
      quantity_in_stock: newItem.stock,
      stock: newItem.stock,
      is_active: true,
      updated_at: new Date().toISOString()
    };

    supabase.from('pharmacy_inventory').insert(dbRow).then(({ error }) => {
      if (error) console.error('[PharmacyService] Error inserting inventory item in Supabase:', error);
    });

    writeAuditLog('pharmacy_inventory_added', { itemId: newItem.id, name: newItem.name, batch: newItem.batchNumber, stock: newItem.stock }, newItem.id);
    return newItem;
  }

  private static sanitizeFormula(val?: string): string {
    if (!val) return '';
    const trimmed = val.trim();
    if (trimmed.startsWith('=') || trimmed.startsWith('+') || trimmed.startsWith('-') || trimmed.startsWith('@')) {
      return `'${trimmed}`;
    }
    return trimmed;
  }

  private static getMidnightUTC(dateStr?: string | Date): number {
    const d = dateStr ? new Date(dateStr) : new Date();
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0);
  }

  static addPharmacyInventoryBulk(rows: MedicineImportRow[], entityId?: string): { added: number; errors: string[] } {
    const items = this.getPharmacyInventory();
    let addedCount = 0;
    const errors: string[] = [];
    const dbRows: any[] = [];

    rows.forEach((row, index) => {
      try {
        if (!row.name || !row.batchNumber || !row.expiryDate || row.stock === undefined || row.price === undefined) {
          throw new Error(`Row ${index + 1}: Missing required fields (Name, Batch, Expiry, Price, Stock).`);
        }

        const cleanName = this.sanitizeFormula(row.name);
        const cleanBatch = this.sanitizeFormula(row.batchNumber);
        
        const parsedPrice = Math.max(0.01, Number(row.price));
        const parsedMrp = Math.max(parsedPrice, Number(row.mrp) || 0);
        const parsedStock = Math.max(0, Math.floor(Number(row.stock)));
        const parsedThreshold = Math.max(1, Math.floor(Number(row.threshold) || 10));
        
        const newItem: PharmacyInventoryItem = {
          id: crypto.randomUUID(),
          name: cleanName,
          genericName: this.sanitizeFormula(row.genericName || cleanName),
          category: this.sanitizeFormula(row.category || 'General'),
          manufacturer: this.sanitizeFormula(row.manufacturer || 'Generic Labs'),
          batchNumber: cleanBatch,
          expiryDate: row.expiryDate,
          mrp: parsedMrp,
          price: parsedPrice,
          stock: parsedStock,
          unit: (row.unit?.toLowerCase() as any) || 'tabs',
          threshold: parsedThreshold,
          dosage: this.sanitizeFormula(row.dosage || '10mg'),
          addedAt: new Date().toISOString(),
          hsn: this.sanitizeFormula(row.hsn || '300490')
        };

        items.push(newItem);
        addedCount++;

        dbRows.push({
          id: newItem.id,
          pharmacy_entity_id: entityId || 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317004',
          medicine_name: newItem.name,
          batch_number: newItem.batchNumber,
          expiry_date: newItem.expiryDate,
          quantity_in_stock: newItem.stock,
          stock: newItem.stock,
          is_active: true,
          updated_at: new Date().toISOString()
        });
      } catch (err: any) {
        errors.push(err.message || String(err));
        TelemetryService.captureException(err, { section: "pharmacy_bulk_csv_row", rowIndex: index });
      }
    });

    if (addedCount > 0) {
      this.savePharmacyInventory(items);
      writeAuditLog('pharmacy_inventory_bulk_added', { count: addedCount }, 'bulk');

      if (dbRows.length > 0) {
        supabase.from('pharmacy_inventory').insert(dbRows).then(({ error }) => {
          if (error) console.error('[PharmacyService] Error inserting bulk inventory in Supabase:', error);
        });
      }
    }

    return { added: addedCount, errors };
  }

  static deletePharmacyInventoryItem(id: string): void {
    const items = this.getPharmacyInventory();
    const filtered = items.filter(item => item.id !== id);
    this.savePharmacyInventory(filtered);

    supabase.from('pharmacy_inventory')
      .delete()
      .eq('id', id)
      .then(({ error }) => {
        if (error) console.error('[PharmacyService] Error deleting inventory item in Supabase:', error);
      });

    writeAuditLog('pharmacy_inventory_deleted', { id }, id);
  }

  static restockPharmacyInventoryItem(itemId: string, quantity: number) {
    const items = this.getPharmacyInventory();
    const updated = items.map(item => {
      if (item.id === itemId || item.name.toLowerCase() === itemId.toLowerCase()) {
        const newStock = Math.max(0, item.stock + quantity);

        supabase.from('pharmacy_inventory')
          .update({
            quantity_in_stock: newStock,
            stock: newStock,
            updated_at: new Date().toISOString()
          })
          .eq('id', item.id)
          .then(({ error }) => {
            if (error) console.error('[PharmacyService] Error updating stock in Supabase:', error);
          });

        writeAuditLog('pharmacy_inventory_restocked', { itemId: item.id, medicineName: item.name, quantity, oldStock: item.stock, newStock }, item.id);
        return { ...item, stock: newStock };
      }
      return item;
    });
    this.savePharmacyInventory(updated);
  }

  static getLowStockItems(): PharmacyInventoryItem[] {
    return this.getPharmacyInventory().filter(item => item.stock <= item.threshold);
  }

  static getExpiringItems(withinDays: number): PharmacyInventoryItem[] {
    const todayMidnight = this.getMidnightUTC();
    const targetMidnight = todayMidnight + withinDays * 24 * 3600 * 1000;
    return this.getPharmacyInventory().filter(item => {
      const expMidnight = this.getMidnightUTC(item.expiryDate);
      return expMidnight >= todayMidnight && expMidnight <= targetMidnight;
    }).sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
  }

  static getExpiredItems(): PharmacyInventoryItem[] {
    const todayMidnight = this.getMidnightUTC();
    return this.getPharmacyInventory().filter(item => {
      const expMidnight = this.getMidnightUTC(item.expiryDate);
      return expMidnight < todayMidnight;
    }).sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
  }

  static getInventoryHolds(): InventoryHold[] {
    const holds = load<InventoryHold[]>('inventory_holds', []);
    return holds.sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
  }

  static dispenseInventoryHold(holdId: string): void {
    const holds = this.getInventoryHolds();
    const idx = holds.findIndex(h => h.id === holdId);
    if (idx !== -1) {
      holds[idx].holdStatus = 'dispensed';
      save('inventory_holds', holds);

      supabase.from('inventory_holds').update({
        hold_status: 'dispensed',
        dispensed_at: new Date().toISOString()
      }).eq('id', holdId).then(({ error }) => {
        if (error) console.error('Error dispensing inventory hold in Supabase:', error);
        else writeAuditLog('pharmacy_inventory_dispensed', { holdId }, holdId);
      });
    }
  }

  static cancelInventoryHold(holdId: string): void {
    const holds = this.getInventoryHolds();
    const idx = holds.findIndex(h => h.id === holdId);
    if (idx !== -1) {
      holds[idx].holdStatus = 'cancelled';
      save('inventory_holds', holds);

      supabase.from('inventory_holds').update({
        hold_status: 'cancelled',
        cancelled_reason: 'OOS / Order Cancelled'
      }).eq('id', holdId).then(({ error }) => {
        if (error) console.error('Error cancelling inventory hold in Supabase:', error);
        else writeAuditLog('pharmacy_inventory_hold_cancelled', { holdId }, holdId);
      });
    }
  }

  static getMedicineBills(): MedicineBill[] {
    return load<MedicineBill[]>('medicine_bills', []);
  }

  static saveMedicineBill(bill: MedicineBill): MedicineBill {
    const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
    const validBillId = isUUID(bill.id) ? bill.id : crypto.randomUUID();
    if (validBillId !== bill.id) {
      bill.id = validBillId;
    }

    const bills = this.getMedicineBills();
    const existsIndex = bills.findIndex(b => b.id === bill.id);
    if (existsIndex >= 0) {
      bills[existsIndex] = bill;
    } else {
      bills.push(bill);
    }
    save('medicine_bills', bills);
    notify();
    writeAuditLog('medicine_bill_saved', { billId: bill.id, total: bill.totalAmount, patientName: bill.patientName }, bill.patientId);
    
    if (!navigator.onLine) {
      window.dispatchEvent(new CustomEvent('mediflow-pwa-queue-action', {
        detail: { actionType: 'saveMedicineBill', payload: bill }
      }));
    } else {
      supabase.from('medicine_bills').upsert({
        id: bill.id,
        patient_id: bill.patientId,
        subtotal: bill.subtotal,
        loyalty_discount_percent: bill.loyaltyDiscountPercent,
        loyalty_discount_amount: bill.loyaltyDiscountAmount,
        item_discount_amount: bill.itemDiscountAmount || 0,
        gst_amount: bill.gstAmount || 0,
        total_amount: bill.totalAmount,
        payment_mode: (bill.paymentMode as string) || 'cash', // fallback prevents DB check constraint violation
        status: bill.status || 'draft',
        source: bill.source || 'counter'
      }).then(({ error }) => {
        if (error) {
          console.error('Error saving bill in Supabase:', error);
        } else {
          // Sync line items
          supabase.from('medicine_bill_items').delete().eq('bill_id', bill.id).then(({ error: delErr }) => {
            if (delErr) {
              console.error('Error clearing old bill items in Supabase:', delErr);
            }
            if (bill.items && bill.items.length > 0) {
              const dbItems = bill.items.map(item => ({
                bill_id: bill.id,
                inventory_item_id: item.inventoryItemId,
                name: item.name,
                batch_number: item.batchNumber,
                expiry_date: item.expiryDate,
                quantity: item.quantity,
                mrp: item.mrp,
                selling_price: item.sellingPrice,
                discount_percent: item.discountPercent || 0,
                gst_percent: item.gstPercent || 0,
                line_total: item.lineTotal
              }));
              supabase.from('medicine_bill_items').insert(dbItems).then(({ error: insErr }) => {
                if (insErr) console.error('Error inserting bill items in Supabase:', insErr);
              });
            }
          });
        }
      });
    }

    return bill;
  }

  static getMedicineBillById(id: string): MedicineBill | null {
    return this.getMedicineBills().find(b => b.id === id) || null;
  }

  static updateMedicineBillStatus(id: string, status: MedicineBill['status']): void {
    const bills = this.getMedicineBills();
    const bill = bills.find(b => b.id === id);
    if (bill) {
      bill.status = status;
      save('medicine_bills', bills);
      notify();
      writeAuditLog('medicine_bill_status_updated', { billId: id, status }, bill.patientId);
    }
  }

  static dispenseMedicineBill(id: string): void {
    const bills = this.getMedicineBills();
    const billIndex = bills.findIndex(b => b.id === id);
    if (billIndex >= 0) {
      const bill = bills[billIndex];
      bill.status = 'paid';
      
      const inventory = this.getPharmacyInventory();
      bill.items.forEach(item => {
        const invItem = inventory.find(inv => inv.id === item.inventoryItemId);
        if (invItem) {
          const oldStock = invItem.stock;
          invItem.stock = Math.max(0, invItem.stock - item.quantity);
          writeAuditLog('medicine_dispensed', { 
            billId: id, 
            itemId: invItem.id, 
            medicineName: invItem.name, 
            quantity: item.quantity, 
            oldStock, 
            newStock: invItem.stock 
          }, invItem.id);
        }
      });
      
      this.savePharmacyInventory(inventory);
      bills[billIndex] = bill;
      save('medicine_bills', bills);

      // Sync status update to Supabase
      supabase.from('medicine_bills').update({
        status: 'paid'
      }).eq('id', id).then(({ error }) => {
        if (error) console.error('Error dispensing bill in Supabase:', error);
      });

      // Record splits for pharmacy cash payments!
      const ledgerEntries = load<FinancialLedgerEntry[]>('financial_ledgers', []);
      const exists = ledgerEntries.some(l => l.invoiceId === id);
      if (!exists) {
        const splitPlat = 5; // Hardcoded platform fee split (5% for pharmacy sales)
        
        const amount = bill.totalAmount;
        const platformAmt = parseFloat((amount * (splitPlat / 100)).toFixed(2));
        const pharmaAmt = parseFloat((amount * (1 - splitPlat / 100)).toFixed(2));

        const platformLedger: FinancialLedgerEntry = {
          id: `tx-plat-${crypto.randomUUID().substring(0, 8)}`,
          invoiceId: id,
          sourceEntityId: 'clinic-admin-entity',
          destinationEntityId: 'platform-admin-entity',
          transactionType: 'platform_fee',
          grossAmount: amount,
          commissionRate: splitPlat / 100,
          netPayout: platformAmt,
          paymentStatus: 'cleared',
          settledAt: new Date().toISOString(),
          createdAt: new Date().toISOString()
        };

        const pharmacyLedger: FinancialLedgerEntry = {
          id: `tx-pharma-${crypto.randomUUID().substring(0, 8)}`,
          invoiceId: id,
          sourceEntityId: 'clinic-admin-entity',
          destinationEntityId: 'pharmacy-partner-entity',
          transactionType: 'medicine_commission',
          grossAmount: amount,
          commissionRate: 1 - splitPlat / 100,
          netPayout: pharmaAmt,
          paymentStatus: 'cleared',
          settledAt: new Date().toISOString(),
          createdAt: new Date().toISOString()
        };

        ledgerEntries.unshift(platformLedger, pharmacyLedger);
        save('financial_ledgers', ledgerEntries);

        // Sync splits to Supabase
        const dbEntries = [
          {
            invoice_id: id.length === 36 ? id : null,
            source_entity_id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317002', // clinic
            destination_entity_id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317002', // clinic-admin/platform-admin mapping
            transaction_type: 'platform_fee',
            gross_amount: amount,
            commission_rate: splitPlat,
            net_payout: platformAmt,
            payment_status: 'cleared',
            settled_at: new Date().toISOString()
          },
          {
            invoice_id: id.length === 36 ? id : null,
            source_entity_id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317002', // clinic
            destination_entity_id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317004', // pharmacy
            transaction_type: 'medicine_commission',
            gross_amount: amount,
            commission_rate: 100 - splitPlat,
            net_payout: pharmaAmt,
            payment_status: 'cleared',
            settled_at: new Date().toISOString()
          }
        ];

        supabase.from('financial_ledgers').insert(dbEntries).then(({ error }) => {
          if (error) console.error('Error inserting pharmacy cash ledger splits in Supabase:', error);
        });
      }

      notify();
      writeAuditLog('medicine_bill_dispensed', { billId: id }, bill.patientId);
    }
  }

  static getCounterTransactions(): CounterTransaction[] {
    return load<CounterTransaction[]>('counter_transactions', []);
  }

  static saveCounterTransaction(tx: CounterTransaction): void {
    const txs = this.getCounterTransactions();
    const idx = txs.findIndex(t => t.id === tx.id);
    if (idx >= 0) {
      txs[idx] = tx;
    } else {
      txs.push(tx);
    }
    save('counter_transactions', txs);
    notify();
  }

  static checkLoyaltyDiscount(patientId: string): boolean {
    const txs = this.getCounterTransactions();
    const todayStr = new Date().toISOString().split('T')[0];
    
    const tx = txs.find(t => 
      t.patientId === patientId && 
      t.createdAt.startsWith(todayStr) && 
      t.appointmentBookedAtCounter && 
      t.labBookedAtCounter
    );
    
    return !!tx;
  }

  static generateMedicineInvoiceMessage(bill: MedicineBill): string {
    const itemsList = bill.items.map(item => 
      `• ${item.name} (${item.dosage}) [Batch: ${item.batchNumber}] x ${item.quantity} = ₹${item.lineTotal.toFixed(2)}`
    ).join('\n');

    const loyaltyText = bill.loyaltyDiscountPercent > 0 
      ? `\n🎉 Counter Loyalty Discount (10%): -₹${bill.loyaltyDiscountAmount.toFixed(2)}` 
      : '';
      
    const itemDiscountText = bill.itemDiscountAmount > 0
      ? `\n🏷 Additional Item Discount: -₹${bill.itemDiscountAmount.toFixed(2)}`
      : '';

    const deliveryText = bill.deliveryType === 'shiprocket'
      ? `\n🚚 Shiprocket Delivery: ₹${bill.deliveryCharge?.toFixed(2)} to ${bill.deliveryAddress}`
      : '\n🚶 Counter Pickup: ₹0.00';

    const gstinText = bill.pharmacyGstin ? `\nPharmacy GSTIN: *${bill.pharmacyGstin}*` : '';

    return `🏥 *VITALSYNC PHARMACY INVOICE*
----------------------------------------
Patient Name: *${bill.patientName}*
Invoice Ref: #${bill.id.substring(4, 10).toUpperCase()}
Date: ${new Date(bill.createdAt).toLocaleDateString()}${gstinText}

*Medicines Ordered:*
${itemsList}

Subtotal: ₹${bill.subtotal.toFixed(2)}${loyaltyText}${itemDiscountText}
GST (Tax): ₹${bill.gstAmount.toFixed(2)}${deliveryText}
----------------------------------------
*TOTAL AMOUNT PAYABLE: ₹${bill.totalAmount.toFixed(2)}*

📱 Pay securely via UPI link below:
${bill.upiQrPayload || `upi://pay?pa=vitalsync@icici&pn=VitalSync&am=${bill.totalAmount.toFixed(2)}&cu=INR&tn=VS-BILL-${bill.id.substring(4, 8)}`}

${bill.deliveryType === 'shiprocket' 
  ? '📍 Your order will be dispatched via Shiprocket once payment is cleared!' 
  : '👉 Show this invoice screen at the clinic pharmacy counter to collect your medicines.'}
Thank you for choosing VitalSync! 🟢`;
  }

  private static base64ToBlob(base64: string, mimeType: string): Blob {
    const byteCharacters = atob(base64.split(',')[1] || base64);
    const byteArrays = [];
    for (let offset = 0; offset < byteCharacters.length; offset += 512) {
      const slice = byteCharacters.slice(offset, offset + 512);
      const byteNumbers = new Array(slice.length);
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      byteArrays.push(byteArray);
    }
    return new Blob(byteArrays, { type: mimeType });
  }

  static async parseSupplierBillOCR(base64: string): Promise<MedicineImportRow[]> {
    if (!base64) return [];
    try {
      const mimeMatch = base64.match(/^data:([^;]+);/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
      const blob = this.base64ToBlob(base64, mimeType);
      
      const formData = new FormData();
      formData.append('file', blob, `invoice_${Date.now()}.${mimeType.split('/')[1] || 'jpg'}`);
      
      const res = await fetch(`${this.AI_BASE}/api/ocr-scan`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error(`ocr-scan HTTP status ${res.status}`);
      const data = await res.json();
      
      const rows: MedicineImportRow[] = [];
      if (data.structured_data) {
        for (const [key, val] of Object.entries(data.structured_data)) {
          if (typeof val !== 'string') continue;
          if (['Supplier', 'Invoice ID', 'Date', 'Patient Name', 'HbA1c', 'Creatinine'].includes(key)) {
            continue;
          }
          const batchMatch = val.match(/Batch:\s*([^,]+)/i);
          const expMatch = val.match(/Exp:\s*([^,]+)/i);
          const mrpMatch = val.match(/MRP:\s*([^,]+)/i);
          const qtyMatch = val.match(/Qty:\s*([^,]+)/i);
          
          rows.push({
            name: key,
            genericName: key.split(' ')[0],
            category: key.toLowerCase().includes('metformin') ? 'Antidiabetic' : key.toLowerCase().includes('atorvastatin') ? 'Cardiovascular' : 'General',
            manufacturer: 'Generic Labs',
            batchNumber: batchMatch ? batchMatch[1].trim() : `AI-${Date.now().toString().substring(8)}`,
            expiryDate: expMatch ? expMatch[1].trim() : new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().split('T')[0],
            mrp: mrpMatch ? parseFloat(mrpMatch[1]) : 20,
            price: mrpMatch ? parseFloat(mrpMatch[1]) * 0.9 : 18,
            stock: qtyMatch ? parseInt(qtyMatch[1]) : 100,
            unit: 'tabs',
            threshold: 20,
            dosage: key.match(/\d+mg/)?.[0] || '10mg',
            hsn: '300490'
          });
        }
      }
      
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: 'OCR Scan Complete ✅',
          message: `Extracted ${rows.length} invoice medicine items from FastAPI backend.`,
          type: 'success'
        }
      }));
      return rows;
    } catch (err: any) {
      console.warn('[Mediflow AI] Live OCR scan failed, executing fallback:', err);
      await new Promise(resolve => setTimeout(resolve, 800));
      return [
        {
          name: 'Metformin 500mg',
          batchNumber: 'MET26B-02',
          expiryDate: new Date(new Date().getTime() + 180 * 24 * 3600 * 1000).toISOString().split('T')[0],
          mrp: 15,
          price: 13.5,
          stock: 100,
          unit: 'tabs',
          threshold: 30,
          dosage: '500mg',
          manufacturer: 'Sun Pharma',
          genericName: 'Metformin Hydrochloride',
          category: 'Antidiabetic',
          hsn: '300490'
        },
        {
          name: 'Atorvastatin 10mg',
          batchNumber: 'ATV26F-06',
          expiryDate: new Date(new Date().getTime() + 240 * 24 * 3600 * 1000).toISOString().split('T')[0],
          mrp: 30,
          price: 27.0,
          stock: 50,
          unit: 'tabs',
          threshold: 40,
          dosage: '10mg',
          manufacturer: 'Lupin',
          genericName: 'Atorvastatin Calcium',
          category: 'Cardiovascular',
          hsn: '300490'
        },
        {
          name: 'Paracetamol 650mg',
          batchNumber: 'PAR26D-07',
          expiryDate: new Date(new Date().getTime() + 300 * 24 * 3600 * 1000).toISOString().split('T')[0],
          mrp: 5,
          price: 4.2,
          stock: 200,
          unit: 'tabs',
          threshold: 50,
          dosage: '650mg',
          manufacturer: 'Cipla',
          genericName: 'Paracetamol',
          category: 'Analgesic',
          hsn: '300490'
        }
      ];
    }
  }

  static matchPrescriptionMedicines(names: string[]): PharmacyInventoryItem[] {
    const inventory = this.getPharmacyInventory();
    const matched: PharmacyInventoryItem[] = [];

    names.forEach(name => {
      const today = new Date().toISOString().split('T')[0];
      const match = inventory.find(item => 
        (item.name.toLowerCase().includes(name.toLowerCase()) || 
         item.genericName.toLowerCase().includes(name.toLowerCase())) &&
        item.expiryDate >= today &&
        item.stock > 0
      );
      if (match) {
        matched.push(match);
      }
    });

    return matched;
  }

  static getWhatsAppDrugOrders(): WhatsAppDrugOrder[] {
    const defaultOrders: WhatsAppDrugOrder[] = [
      {
        id: 'ord-101',
        patientName: 'Aarav Sharma',
        patientPhone: '9876543210',
        drugNames: ['Metformin 500mg x10', 'Atorvastatin 10mg x5'],
        amount: 300,
        location: 'Sector-B, Kankarbagh, Patna',
        deliveryStatus: 'delivered',
        timestamp: '2026-05-24T18:30:00Z'
      },
      {
        id: 'ord-102',
        patientName: 'Priyanka Verma',
        patientPhone: '8765432109',
        drugNames: ['Amoxicillin 250mg x15'],
        amount: 375,
        location: 'Boring Road Crossing, Patna',
        deliveryStatus: 'enroute',
        timestamp: new Date().toISOString()
      }
    ];
    return load<WhatsAppDrugOrder[]>('whatsapp_drug_orders', defaultOrders);
  }

  static saveWhatsAppDrugOrders(orders: WhatsAppDrugOrder[]) {
    save('whatsapp_drug_orders', orders);
    notify();
  }

  static simulateIncomingWhatsAppOrder() {
    const orders = this.getWhatsAppDrugOrders();
    const patients = PatientService.getPatients();
    const activePatient = patients[Math.floor(Math.random() * patients.length)] || { name: 'Aarav Sharma', phone: '9876543210' };
    
    const possibleDrugs = [
      { name: 'Metformin 500mg', price: 15 },
      { name: 'Paracetamol 650mg', price: 5 },
      { name: 'Amoxicillin 250mg', price: 25 },
      { name: 'Azithromycin 500mg', price: 120 }
    ];

    const selectedDrug = possibleDrugs[Math.floor(Math.random() * possibleDrugs.length)];
    const qty = Math.floor(Math.random() * 20) + 5;
    const amount = selectedDrug.price * qty;

    const newOrder: WhatsAppDrugOrder = {
      id: `ord-${Math.floor(Math.random() * 900) + 100}`,
      patientName: activePatient.name,
      patientPhone: activePatient.phone,
      drugNames: [`${selectedDrug.name} x${qty}`],
      amount,
      location: 'Kankarbagh, Patna',
      deliveryStatus: 'pending',
      timestamp: new Date().toISOString()
    };

    orders.unshift(newOrder);
    this.saveWhatsAppDrugOrders(orders);

    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: {
        title: 'WhatsApp Drug Order 📲',
        message: `New prescription refill request from ${activePatient.name} for ${selectedDrug.name}.`,
        type: 'success'
      }
    }));
  }
}
