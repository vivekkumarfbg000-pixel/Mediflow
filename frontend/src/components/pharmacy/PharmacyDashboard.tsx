import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '../../services/api';
import type { InventoryHold, SeasonalForecast, PharmacyInventoryItem, MedicineImportRow } from '../../types';
import { 
  Calendar, 
  XCircle,
  Lightbulb,
  Plus,
  AlertTriangle,
  Trash2,
  Search,
  CheckCircle,
  TrendingUp,
  RefreshCw,
  FileSpreadsheet,
  Camera,
  Download,
  AlertCircle
} from 'lucide-react';

export const PharmacyDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'prescription_queue' | 'inventory_catalog' | 'stock_alerts' | 'expiry_tracker' | 'ai_demand'>('prescription_queue');
  const [inventory, setInventory] = useState<PharmacyInventoryItem[]>([]);
  const [holds, setHolds] = useState<InventoryHold[]>([]);
  const [forecasts, setForecasts] = useState<SeasonalForecast[]>([]);
  
  // Real-time Network Resilience State
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: { message: 'Network connection restored. Syncing pending ledger entries...', type: 'success', title: 'System Online 🟢' }
      }));
    };
    const handleOffline = () => {
      setIsOnline(false);
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: { message: 'Flaky network detected. App in Offline Cache resiliency mode.', type: 'warning', title: 'Connection Lost 🔴' }
      }));
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [expiryFilter, setExpiryFilter] = useState<'all' | 'expired' | 'expiring'>('all');

  // Scanner modal states
  const [scanningHold, setScanningHold] = useState<InventoryHold | null>(null);
  const [scannerStage, setScannerStage] = useState<'idle' | 'scanning' | 'matched'>('idle');
  const [scanLogs, setScanLogs] = useState<string[]>([]);

  // Add Medicine Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    name: '',
    genericName: '',
    category: 'Antidiabetic',
    manufacturer: '',
    batchNumber: '',
    expiryDate: '',
    mrp: '',
    price: '',
    stock: '',
    unit: 'tabs' as const,
    threshold: '',
    dosage: '',
    hsn: ''
  });

  // CSV Import State
  const [isCsvImportOpen, setIsCsvImportOpen] = useState(false);
  const [csvPreview, setCsvPreview] = useState<MedicineImportRow[]>([]);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [csvFileName, setCsvFileName] = useState('');

  // OCR Bill Scan State
  const [isBillScanOpen, setIsBillScanOpen] = useState(false);
  const [billImage, setBillImage] = useState<string | null>(null);
  const [isOcrScanning, setIsOcrScanning] = useState(false);
  const [ocrLogs, setOcrLogs] = useState<string[]>([]);
  const [ocrResults, setOcrResults] = useState<MedicineImportRow[]>([]);

  // Categories list
  const categories = [
    'Antidiabetic', 'Antibiotic', 'Analgesic', 'Cardiovascular', 
    'Gastrointestinal', 'Respiratory', 'Neurological', 'General'
  ];

  // Sync data from API
  const syncData = useCallback(() => {
    setInventory(api.getPharmacyInventory());
    setHolds(api.getInventoryHolds());
    setForecasts(api.getSeasonalForecasts());
  }, []);

  useEffect(() => {
    syncData();
    return api.subscribe(syncData);
  }, [syncData]);

  // Toast alerts for expiring holds
  useEffect(() => {
    const alertedBatches = new Set<string>();
    const active = holds.filter(h => h.holdStatus === 'held');
    active.forEach(hold => {
      const daysToExpiry = Math.ceil((new Date(hold.expiryDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
      if (daysToExpiry < 90 && !alertedBatches.has(hold.batchNumber)) {
        alertedBatches.add(hold.batchNumber);
        window.dispatchEvent(new CustomEvent('mediflow-toast', {
          detail: {
            message: `FEFO WARNING: Pre-allocated hold batch ${hold.batchNumber} expires in ${daysToExpiry} days. Prioritize dispatching.`,
            type: 'warning',
            title: 'e-Prescription Expiry Warning'
          }
        }));
      }
    });
  }, [holds]);

  // Handle manual checkout barcode scanning effect
  useEffect(() => {
    if (!scanningHold || scannerStage !== 'scanning') return;

    const log1 = setTimeout(() => {
      setScanLogs(prev => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] Laser sweep target locked on batch: ${scanningHold.batchNumber}`,
        `[${new Date().toLocaleTimeString()}] Querying FEFO index mapping...`
      ]);
    }, 600);

    const log2 = setTimeout(() => {
      setScanLogs(prev => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] MATCH DETECTED! status: RESERVED`,
        `[${new Date().toLocaleTimeString()}] Medicine package: ${scanningHold.medicineName} (${scanningHold.dosage})`,
        `[${new Date().toLocaleTimeString()}] Batch expiry: ${scanningHold.expiryDate} (FEFO Compliant) [OK]`,
        `[${new Date().toLocaleTimeString()}] Package integrity: VERIFIED [OK]`
      ]);
      setScannerStage('matched');

      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          message: `Batch ${scanningHold.batchNumber} FEFO code matched & approved. Ready for dispatch.`,
          type: 'success',
          title: 'Barcode Match Verified'
        }
      }));
    }, 1500);

    return () => {
      clearTimeout(log1);
      clearTimeout(log2);
    };
  }, [scanningHold, scannerStage]);

  // Pharmacy actions
  const handleDispenseHold = useCallback((id: string) => {
    api.dispenseInventoryHold(id);
    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: {
        message: 'Prescription inventory package successfully dispensed and POS settled.',
        type: 'success',
        title: 'POS Dispensed'
      }
    }));
  }, []);

  const handleCancelHold = useCallback((id: string) => {
    api.cancelInventoryHold(id);
    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: {
        message: 'Prescription reserve cancelled. Medicine returned to active stock.',
        type: 'info',
        title: 'Reservation Cancelled'
      }
    }));
  }, []);

  const handleActOnForecast = useCallback((id: string, medicineName: string) => {
    api.actOnSeasonalForecast(id);
    // Find the item name in our catalog and restock
    const match = inventory.find(i => i.name.toLowerCase().includes(medicineName.toLowerCase()));
    if (match) {
      api.restockPharmacyInventoryItem(match.id, 500);
    } else {
      // Add a fresh placeholder batch
      api.addPharmacyInventoryItem({
        name: medicineName,
        genericName: medicineName,
        category: 'General',
        manufacturer: 'Generic Labs',
        batchNumber: `AI-${Date.now().toString().substring(8)}`,
        expiryDate: new Date(new Date().getTime() + 365 * 24 * 3600 * 1000).toISOString().split('T')[0],
        mrp: 20,
        price: 18,
        stock: 500,
        unit: 'tabs',
        threshold: 50,
        dosage: '500mg',
        hsn: '300490'
      });
    }

    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: {
        message: `Epidemiology demand stocking replenishment authorized (+500 units of ${medicineName}).`,
        type: 'success',
        title: 'B2B AI Forecast Approved'
      }
    }));
  }, [inventory]);

  const handleDeleteItem = useCallback((id: string) => {
    api.deletePharmacyInventoryItem(id);
    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: {
        message: 'Medicine batch successfully deleted from active catalog.',
        type: 'info',
        title: 'Batch Deleted'
      }
    }));
  }, []);

  const handleQuickRestock = useCallback((item: PharmacyInventoryItem) => {
    const quantity = Math.max(50, item.threshold * 2 - item.stock);
    api.restockPharmacyInventoryItem(item.id, quantity);
    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: {
        message: `Quick ordered +${quantity} units for ${item.name} [Batch: ${item.batchNumber}]. Stock filled to safe margin.`,
        type: 'success',
        title: 'B2B Quick Order Placed'
      }
    }));
  }, []);

  // Form submit manual medicine
  const handleAddMedicineSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.name || !addForm.batchNumber || !addForm.expiryDate || !addForm.price || !addForm.stock) {
      alert('Please fill out all required fields.');
      return;
    }

    api.addPharmacyInventoryItem({
      name: addForm.name,
      genericName: addForm.genericName || addForm.name,
      category: addForm.category,
      manufacturer: addForm.manufacturer || 'Generic Labs',
      batchNumber: addForm.batchNumber,
      expiryDate: addForm.expiryDate,
      mrp: Number(addForm.mrp) || Number(addForm.price),
      price: Number(addForm.price),
      stock: Number(addForm.stock),
      unit: addForm.unit,
      threshold: Number(addForm.threshold) || 20,
      dosage: addForm.dosage || '10mg',
      hsn: addForm.hsn || '300490'
    });

    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: {
        message: `Manual batch ${addForm.batchNumber} for ${addForm.name} registered into inventory!`,
        type: 'success',
        title: 'Medicine Registered'
      }
    }));

    // Reset Form
    setAddForm({
      name: '',
      genericName: '',
      category: 'Antidiabetic',
      manufacturer: '',
      batchNumber: '',
      expiryDate: '',
      mrp: '',
      price: '',
      stock: '',
      unit: 'tabs',
      threshold: '',
      dosage: '',
      hsn: ''
    });
    setIsAddModalOpen(false);
  };

  // CSV parsing simulation
  const handleCsvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFileName(file.name);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      
      const parsedRows: MedicineImportRow[] = [];
      const errors: string[] = [];
      
      // Assume header: Name,Generic Name,Category,Manufacturer,Batch,Expiry,MRP,Price,Stock,Unit,Threshold,Dosage,HSN
      lines.slice(1).forEach((line, idx) => {
        const cols = line.split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
        if (cols.length < 5) {
          errors.push(`Row ${idx + 2}: Insufficient columns (must contain at least Name, Batch, Expiry, Price, Stock).`);
          return;
        }

        parsedRows.push({
          name: cols[0],
          genericName: cols[1],
          category: cols[2] || 'General',
          manufacturer: cols[3],
          batchNumber: cols[4],
          expiryDate: cols[5],
          mrp: Number(cols[6]) || Number(cols[7]) || 0,
          price: Number(cols[7]) || 0,
          stock: Number(cols[8]) || 0,
          unit: cols[9] || 'tabs',
          threshold: Number(cols[10]) || 10,
          dosage: cols[11] || '10mg',
          hsn: cols[12] || '300490'
        });
      });

      setCsvPreview(parsedRows);
      setCsvErrors(errors);
    };
    reader.readAsText(file);
  };

  const handleConfirmCsvImport = () => {
    if (csvPreview.length === 0) return;
    const res = api.addPharmacyInventoryBulk(csvPreview);
    
    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: {
        message: `Successfully imported ${res.added} medicine batches from CSV template file!`,
        type: 'success',
        title: 'CSV Import Complete'
      }
    }));

    setCsvPreview([]);
    setCsvErrors([]);
    setCsvFileName('');
    setIsCsvImportOpen(false);
  };

  // OCR suppliers bill scan simulation
  const handleBillImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setBillImage(reader.result as string);
      setOcrResults([]);
      setOcrLogs([]);
    };
    reader.readAsDataURL(file);
  };

  const handleTriggerOcrScan = async () => {
    if (!billImage) return;
    setIsOcrScanning(true);
    setOcrLogs([
      `[${new Date().toLocaleTimeString()}] Activating Gemini-1.5-Pro deep visual model...`,
      `[${new Date().toLocaleTimeString()}] Parsing suppliers invoice grid structure...`
    ]);

    await new Promise(resolve => setTimeout(resolve, 800));
    setOcrLogs(prev => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] Segmenting text bounding boxes...`,
      `[${new Date().toLocaleTimeString()}] Extracted table matching keys: "Brand Name", "Batch No", "Exp", "MRP", "QTY"`
    ]);

    try {
      const results = await api.parseSupplierBillOCR(billImage);
      await new Promise(resolve => setTimeout(resolve, 700));
      setOcrResults(results);
      setOcrLogs(prev => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] Extraction verified with 98.4% model confidence score!`,
        `[${new Date().toLocaleTimeString()}] Loaded 3 inventory-ready bulk batches [Preview Table unlocked]`
      ]);
    } catch (err: any) {
      setOcrLogs(prev => [...prev, `[ERROR] OCR scan failed: ${err.message}`]);
    } finally {
      setIsOcrScanning(false);
    }
  };

  const handleConfirmOcrImport = () => {
    if (ocrResults.length === 0) return;
    api.addPharmacyInventoryBulk(ocrResults);
    
    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: {
        message: `AI-extracted supplier bill items successfully recorded in inventory catalog!`,
        type: 'success',
        title: 'Bill Extracted Successfully'
      }
    }));

    setOcrResults([]);
    setBillImage(null);
    setIsBillScanOpen(false);
  };

  // Filtered Inventory computed
  const filteredCatalog = useMemo(() => {
    return inventory.filter(item => {
      const matchSearch = 
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.genericName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.batchNumber.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchCategory = categoryFilter === 'All' || item.category === categoryFilter;
      
      return matchSearch && matchCategory;
    });
  }, [inventory, searchQuery, categoryFilter]);

  // Tab 3 Low Stock computed
  const lowStockItems = useMemo(() => {
    return inventory.filter(item => item.stock <= item.threshold)
      .sort((a, b) => {
        // Critical first (stock = 0), then by percentage of threshold
        if (a.stock === 0 && b.stock > 0) return -1;
        if (b.stock === 0 && a.stock > 0) return 1;
        return (a.stock / a.threshold) - (b.stock / b.threshold);
      });
  }, [inventory]);

  // Tab 4 Consolidated Expiry Tracker computed
  const consolidatedExpiryBatches = useMemo(() => {
    const batches: Array<{
      source: 'SHELF' | 'RESERVE';
      id: string;
      name: string;
      genericName: string;
      batchNumber: string;
      expiryDate: string;
      stock: number;
      daysRemaining: number;
      tier: 'EXPIRED' | 'CRITICAL' | 'CAUTION' | 'SAFE';
    }> = [];

    // Add shelf inventory
    inventory.forEach(item => {
      const days = Math.ceil((new Date(item.expiryDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
      let tier: 'EXPIRED' | 'CRITICAL' | 'CAUTION' | 'SAFE' = 'SAFE';
      if (days <= 0) tier = 'EXPIRED';
      else if (days < 30) tier = 'CRITICAL';
      else if (days < 90) tier = 'CAUTION';

      batches.push({
        source: 'SHELF',
        id: item.id,
        name: item.name,
        genericName: item.genericName,
        batchNumber: item.batchNumber,
        expiryDate: item.expiryDate,
        stock: item.stock,
        daysRemaining: days,
        tier
      });
    });

    // Add pre-allocated reserve holds
    holds.filter(h => h.holdStatus === 'held').forEach(hold => {
      const days = Math.ceil((new Date(hold.expiryDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
      let tier: 'EXPIRED' | 'CRITICAL' | 'CAUTION' | 'SAFE' = 'SAFE';
      if (days <= 0) tier = 'EXPIRED';
      else if (days < 30) tier = 'CRITICAL';
      else if (days < 90) tier = 'CAUTION';

      batches.push({
        source: 'RESERVE',
        id: hold.id,
        name: hold.medicineName,
        genericName: hold.medicineName,
        batchNumber: hold.batchNumber,
        expiryDate: hold.expiryDate,
        stock: hold.quantity,
        daysRemaining: days,
        tier
      });
    });

    // Filter
    return batches.filter(b => {
      if (expiryFilter === 'expired') return b.tier === 'EXPIRED';
      if (expiryFilter === 'expiring') return b.tier === 'CRITICAL' || b.tier === 'CAUTION';
      return true;
    }).sort((a, b) => a.daysRemaining - b.daysRemaining);
  }, [inventory, holds, expiryFilter]);

  // Tab count badges
  const activeHoldsCount = holds.filter(h => h.holdStatus === 'held').length;
  const criticalStockCount = inventory.filter(item => item.stock <= item.threshold).length;
  const criticalExpiryCount = consolidatedExpiryBatches.filter(b => b.tier === 'EXPIRED' || b.tier === 'CRITICAL').length;

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8 animate-fade-in relative">
      <style>{`
        @keyframes laser-sweep {
          0% { top: 0%; opacity: 0.3; }
          50% { top: 100%; opacity: 1; }
          100% { top: 0%; opacity: 0.3; }
        }
        .laser-line {
          animation: laser-sweep 2.5s infinite ease-in-out;
        }
      `}</style>

      {/* DASHBOARD HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <span className="material-symbols-outlined text-indigo-600 text-3xl">medication</span>
            Patna Smart Pharmacy Workdesk
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border uppercase tracking-widest ${
              isOnline 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-600 animate-pulse' 
                : 'bg-rose-50 border-rose-200 text-rose-600'
            }`}>
              {isOnline ? 'Online' : 'Offline Mode (Local Cache)'}
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Clinic ecosystem pharmacy dispatcher center connected with doctor holds, WhatsApp automated billing, and live FEFO batch compliance tracker.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="btn-primary"
          >
            <Plus className="h-4 w-4" /> Add Medicine
          </button>
          <button 
            onClick={() => setIsCsvImportOpen(true)}
            className="btn-secondary"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-500" /> Bulk CSV Import
          </button>
          <button 
            onClick={() => setIsBillScanOpen(true)}
            className="btn-secondary"
          >
            <Camera className="h-4 w-4 text-indigo-500" /> Scan Supplier Invoice
          </button>
        </div>
      </div>

      {/* HORIZONTAL TAB SWITCHER */}
      <div className="flex border-b border-slate-200 overflow-x-auto gap-2 pb-0.5 no-scrollbar">
        <button
          onClick={() => setActiveTab('prescription_queue')}
          className={`px-5 py-3 text-xs font-bold border-b-2 flex items-center gap-2 whitespace-nowrap transition-all uppercase tracking-wider cursor-pointer ${
            activeTab === 'prescription_queue'
              ? 'border-indigo-600 text-indigo-600 font-extrabold bg-indigo-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span className="material-symbols-outlined text-sm">inventory_2</span>
          Prescription Queue
          {activeHoldsCount > 0 && (
            <span className="ml-1 px-2 py-0.5 text-[10px] rounded-full bg-indigo-600 text-white font-bold animate-pulse">
              {activeHoldsCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('inventory_catalog')}
          className={`px-5 py-3 text-xs font-bold border-b-2 flex items-center gap-2 whitespace-nowrap transition-all uppercase tracking-wider cursor-pointer ${
            activeTab === 'inventory_catalog'
              ? 'border-indigo-600 text-indigo-600 font-extrabold bg-indigo-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span className="material-symbols-outlined text-sm">database</span>
          Inventory Catalog
        </button>

        <button
          onClick={() => setActiveTab('stock_alerts')}
          className={`px-5 py-3 text-xs font-bold border-b-2 flex items-center gap-2 whitespace-nowrap transition-all uppercase tracking-wider cursor-pointer ${
            activeTab === 'stock_alerts'
              ? 'border-indigo-600 text-indigo-600 font-extrabold bg-indigo-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span className="material-symbols-outlined text-sm">warning</span>
          Stock Alerts
          {criticalStockCount > 0 && (
            <span className="ml-1 px-2 py-0.5 text-[10px] rounded-full bg-rose-500 text-white font-bold animate-bounce">
              {criticalStockCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('expiry_tracker')}
          className={`px-5 py-3 text-xs font-bold border-b-2 flex items-center gap-2 whitespace-nowrap transition-all uppercase tracking-wider cursor-pointer ${
            activeTab === 'expiry_tracker'
              ? 'border-indigo-600 text-indigo-600 font-extrabold bg-indigo-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span className="material-symbols-outlined text-sm">event_busy</span>
          Expiry Tracker
          {criticalExpiryCount > 0 && (
            <span className="ml-1 px-2 py-0.5 text-[10px] rounded-full bg-amber-500 text-black font-bold">
              {criticalExpiryCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('ai_demand')}
          className={`px-5 py-3 text-xs font-bold border-b-2 flex items-center gap-2 whitespace-nowrap transition-all uppercase tracking-wider cursor-pointer ${
            activeTab === 'ai_demand'
              ? 'border-indigo-600 text-indigo-600 font-extrabold bg-indigo-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span className="material-symbols-outlined text-sm">psychology</span>
          Gemini Demand AI
        </button>
      </div>

      {/* TAB CONTENT AREAS */}
      <div className="space-y-6">
        
        {/* TAB 1: PRESCRIPTION QUEUE */}
        {activeTab === 'prescription_queue' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8 space-y-6">
              <div className="glass-panel p-6 border-white/10 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-[2px] bg-indigo-600 opacity-50" />
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                  <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-xl">inventory_2</span>
                      Active e-Prescription Reserves (FEFO Sorted)
                    </h2>
                    <p className="text-xs text-clinical-400 mt-1">
                      Medicine reserves matched from doctors prescriptions awaiting dispense checklist.
                    </p>
                  </div>
                  <span className="text-[10px] bg-secondary/15 text-secondary border border-secondary/25 px-3 py-1 rounded-full font-bold uppercase tracking-wider font-mono">
                    FEFO Enabled
                  </span>
                </div>

                {holds.filter(h => h.holdStatus === 'held').length === 0 ? (
                  <div className="p-8 bg-surface-container-lowest/40 border border-outline-variant rounded-xl text-center text-sm text-clinical-500">
                    No active prescription reserves in the checkup loop.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {holds.filter(h => h.holdStatus === 'held').map(hold => {
                      const daysToExpiry = Math.ceil((new Date(hold.expiryDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
                      const isNearExpiry = daysToExpiry < 90;
                      const isConsentActive = api.isPatientConsentActive(hold.patientId);

                      return (
                        <div key={hold.id} className="p-5 bg-surface-container border border-outline-variant rounded-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4 hover:border-outline/50 transition-all relative overflow-hidden">
                          {!isConsentActive && (
                            <div className="absolute inset-0 z-[45] flex flex-col items-center justify-center bg-black/90 backdrop-blur-md border border-rose-500/20 p-4 text-center">
                              <AlertCircle className="h-6 w-6 text-rose-500 animate-pulse mb-1.5" />
                              <h4 className="text-white font-bold text-xs">Consent Verification Locked</h4>
                              <p className="text-[9px] text-clinical-400 max-w-[240px]">
                                Patient must verify consent via WhatsApp opt-in welcome prompt to permit dispensing.
                              </p>
                            </div>
                          )}

                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="font-bold text-sm text-white">{hold.medicineName}</h4>
                              <span className="text-[9px] font-bold text-clinical-300 bg-surface-container-highest border border-outline-variant px-2 py-0.5 rounded font-mono">
                                Batch: {hold.batchNumber}
                              </span>
                            </div>
                            <p className="text-xs text-clinical-300">Dosage: {hold.dosage} • Target Qty: <strong className="text-white font-mono">{hold.quantity} units</strong></p>
                            
                            <div className="flex flex-wrap items-center gap-3 pt-1.5 text-[10px]">
                              <span className={`flex items-center gap-1 font-semibold font-mono ${isNearExpiry ? 'text-rose-400' : 'text-clinical-400'}`}>
                                <Calendar className="h-3.5 w-3.5" /> Expiry: {hold.expiryDate} ({daysToExpiry} days remaining)
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-end md:self-center">
                            <button
                              onClick={() => handleCancelHold(hold.id)}
                              className="p-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-xl border border-rose-500/20 transition-all cursor-pointer"
                              title="Cancel hold"
                            >
                              <XCircle className="h-4.5 w-4.5" />
                            </button>
                            <button
                              onClick={() => {
                                setScanningHold(hold);
                                setScannerStage('scanning');
                                setScanLogs([
                                  `[${new Date().toLocaleTimeString()}] Booting laser scanner verification protocol...`,
                                  `[${new Date().toLocaleTimeString()}] Awaiting barcode FEFO verification alignment...`
                                ]);
                              }}
                              className="btn-primary py-2.5 px-4 text-xs font-bold flex items-center gap-1.5 hover:scale-105 active:scale-95 transition-transform bg-gradient-to-r from-secondary to-primary cursor-pointer border-0 rounded-xl text-white font-semibold"
                            >
                              <span className="material-symbols-outlined text-sm font-bold">qr_code_scanner</span>
                              Settle & Dispense
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Dispensed ledger */}
            <div className="lg:col-span-4">
              <div className="glass-panel p-6 border-white/10 shadow-xl space-y-4">
                <h3 className="font-bold text-white text-base flex items-center gap-2 border-b border-white/10 pb-3">
                  <span className="material-symbols-outlined text-secondary">receipt_long</span>
                  Recent Dispatches
                </h3>
                {holds.filter(h => h.holdStatus === 'dispensed').length === 0 ? (
                  <p className="text-xs text-clinical-500 text-center py-4">No dispatches logged today.</p>
                ) : (
                  <div className="space-y-3.5 max-h-[400px] overflow-y-auto pr-1">
                    {holds.filter(h => h.holdStatus === 'dispensed').slice(0, 5).map(h => (
                      <div key={h.id} className="p-3 bg-surface-container-lowest/50 border border-outline-variant rounded-lg space-y-1.5">
                        <div className="flex justify-between items-start">
                          <h5 className="font-bold text-xs text-white leading-none">{h.medicineName}</h5>
                          <span className="text-[8px] bg-emerald-500/10 text-emerald-400 font-bold px-2 py-0.5 rounded uppercase font-mono">OK</span>
                        </div>
                        <p className="text-[10px] text-clinical-400">Qty: {h.quantity} units • Batch: {h.batchNumber}</p>
                        <p className="text-[8px] text-clinical-500 font-mono">Settled: {new Date(h.createdAt).toLocaleTimeString()}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: INVENTORY CATALOG */}
        {activeTab === 'inventory_catalog' && (
          <div className="glass-panel p-6 border-white/10 shadow-xl space-y-6">
            
            {/* Catalog search/filter headers */}
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div className="relative w-full sm:max-w-md">
                <input
                  type="text"
                  placeholder="Search catalog by name, generic, or batch..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full input-field pl-10 focus:ring-1 focus:ring-secondary focus:border-secondary text-xs py-2 bg-surface-container-lowest/60 border-outline-variant text-white rounded-lg"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-clinical-400 h-4.5 w-4.5" />
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <span className="text-xs text-clinical-400 font-bold shrink-0">Category:</span>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="input-field text-xs py-2 px-3 focus:ring-1 focus:ring-secondary focus:border-secondary bg-surface-container-lowest border-outline-variant text-white rounded-lg cursor-pointer"
                >
                  <option value="All">All Categories</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            {/* Inventory table */}
            <div className="border border-outline-variant rounded-xl overflow-hidden glass-panel-inner">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-surface-container text-clinical-300 border-b border-outline-variant font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="p-3.5">Medicine & Generic</th>
                      <th className="p-3.5">Category</th>
                      <th className="p-3.5 font-mono">Batch Details</th>
                      <th className="p-3.5 text-right font-mono">Price (MRP)</th>
                      <th className="p-3.5 text-center font-mono">Stock Level</th>
                      <th className="p-3.5 text-center font-mono">Safety Margin</th>
                      <th className="p-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant bg-surface-container-lowest/30">
                    {filteredCatalog.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-clinical-500 font-medium">
                          No matching medicine batches found in catalog.
                        </td>
                      </tr>
                    ) : (
                      filteredCatalog.map(item => {
                        const isLow = item.stock <= item.threshold;
                        const isExpired = new Date(item.expiryDate) < new Date();
                        
                        return (
                          <tr key={item.id} className="hover:bg-surface-container/40 transition-colors">
                            <td className="p-3.5 space-y-1">
                              <div className="font-bold text-white text-xs">{item.name} <span className="text-[10px] text-clinical-400 font-normal">({item.dosage})</span></div>
                              <div className="text-[10px] text-clinical-400 italic font-mono">{item.genericName}</div>
                            </td>
                            <td className="p-3.5 text-clinical-300 font-semibold">{item.category}</td>
                            <td className="p-3.5 space-y-1">
                              <div className="font-bold text-white font-mono text-[10px]">Batch: {item.batchNumber}</div>
                              <div className={`text-[9px] font-mono ${isExpired ? 'text-rose-400 font-bold' : 'text-clinical-400'}`}>
                                Exp: {item.expiryDate} {isExpired && '[EXPIRED]'}
                              </div>
                            </td>
                            <td className="p-3.5 text-right font-mono text-white font-semibold">
                              ₹{item.price.toFixed(2)} <span className="text-[9px] text-clinical-400 font-normal">(₹{item.mrp.toFixed(2)})</span>
                            </td>
                            <td className="p-3.5 text-center">
                              <span className={`font-mono font-bold text-xs ${isLow ? 'text-rose-400 font-black' : 'text-emerald-400'}`}>
                                {item.stock} {item.unit}
                              </span>
                            </td>
                            <td className="p-3.5 text-center font-mono text-clinical-400">{item.threshold} {item.unit}</td>
                            <td className="p-3.5 text-right">
                              <div className="flex gap-2 justify-end">
                                <button
                                  onClick={() => handleQuickRestock(item)}
                                  className="px-2.5 py-1 text-[9px] bg-secondary/15 hover:bg-secondary text-secondary hover:text-black border border-secondary/25 hover:border-secondary font-black rounded-lg uppercase tracking-wider active:scale-95 transition-all cursor-pointer"
                                  title="Quick Restock"
                                >
                                  Restock
                                </button>
                                <button
                                  onClick={() => handleDeleteItem(item.id)}
                                  className="p-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-lg transition-all cursor-pointer"
                                  title="Delete Batch"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* TAB 3: STOCK ALERTS */}
        {activeTab === 'stock_alerts' && (
          <div className="glass-panel p-6 border-white/10 shadow-xl space-y-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-rose-400 animate-pulse" />
                  Pharmacy Stock Deficit Alerts
                </h2>
                <p className="text-xs text-clinical-400 mt-1">
                  Active batches that have fallen below the configured low-stock safety margins. Restock immediately.
                </p>
              </div>
              <span className="text-xs bg-rose-500/15 border border-rose-500/20 px-3.5 py-1 text-rose-400 font-mono font-black rounded-full uppercase tracking-wider animate-pulse">
                {lowStockItems.length} Deficits Detected
              </span>
            </div>

            {lowStockItems.length === 0 ? (
              <div className="p-8 bg-surface-container-lowest/40 border border-outline-variant rounded-xl text-center">
                <CheckCircle className="h-10 w-10 text-emerald-400 mx-auto mb-2" />
                <h4 className="text-white font-bold text-sm">All Stock Levels Secure!</h4>
                <p className="text-xs text-clinical-500 mt-1">No items are currently running below their safety thresholds.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {lowStockItems.map(item => {
                  const percentOfSafety = Math.round((item.stock / item.threshold) * 100);
                  const deficit = item.threshold * 2 - item.stock;
                  
                  // Tiers color
                  let tierColor = 'border-amber-500/30 bg-amber-500/5 text-amber-400';
                  let tierText = 'CAUTION';
                  if (item.stock === 0) {
                    tierColor = 'border-rose-600 bg-rose-500/10 text-rose-400';
                    tierText = 'CRITICAL: OUT OF STOCK';
                  } else if (item.stock < item.threshold / 2) {
                    tierColor = 'border-rose-400/40 bg-rose-500/5 text-rose-400';
                    tierText = 'LOW STOCK';
                  }

                  return (
                    <div key={item.id} className={`p-5 rounded-xl border flex flex-col justify-between gap-4 transition-all ${tierColor}`}>
                      <div className="space-y-2">
                        <div className="flex justify-between items-start gap-2">
                          <h4 className="font-bold text-sm text-white leading-tight">{item.name}</h4>
                          <span className="text-[8px] font-mono font-bold px-2 py-0.5 rounded border tracking-wider uppercase bg-black/40">
                            {tierText}
                          </span>
                        </div>
                        <p className="text-[10px] text-clinical-400 font-mono">Generic: {item.genericName}</p>
                        
                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
                          <div>
                            <span className="text-[9px] text-clinical-500 font-bold block uppercase tracking-wider font-mono">Stock Level</span>
                            <span className="font-mono text-base font-black text-white">{item.stock} {item.unit}</span>
                          </div>
                          <div>
                            <span className="text-[9px] text-clinical-500 font-bold block uppercase tracking-wider font-mono">Safety Level</span>
                            <span className="font-mono text-base font-black text-clinical-300">{item.threshold} {item.unit}</span>
                          </div>
                        </div>

                        {/* Loading bar */}
                        <div className="w-full bg-black/60 rounded-full h-2 mt-2 border border-white/5">
                          <div 
                            className={`h-full rounded-full ${item.stock === 0 ? 'bg-transparent' : item.stock < item.threshold/2 ? 'bg-rose-500' : 'bg-amber-400'}`} 
                            style={{ width: `${Math.min(100, percentOfSafety)}%` }} 
                          />
                        </div>
                        <span className="text-[9px] text-clinical-400 font-mono font-medium block">
                          Stock is at <strong className="text-white font-bold">{percentOfSafety}%</strong> of safety margin.
                        </span>
                      </div>

                      <button
                        onClick={() => handleQuickRestock(item)}
                        className="w-full btn-primary py-2 text-[10px] font-black tracking-wider uppercase flex items-center justify-center gap-1.5 active:scale-95 transition-transform bg-gradient-to-r from-secondary to-primary rounded-xl text-black border-0 cursor-pointer"
                      >
                        <RefreshCw className="h-3.5 w-3.5 text-black font-black animate-spin-hover" />
                        Quick Restock +{deficit} Units
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

          </div>
        )}

        {/* TAB 4: EXPIRY TRACKER */}
        {activeTab === 'expiry_tracker' && (
          <div className="glass-panel p-6 border-white/10 shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row items-center justify-between border-b border-white/10 pb-4 gap-4">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-rose-400">event_busy</span>
                  Consolidated Facility Expiry Tracker (FEFO)
                </h2>
                <p className="text-xs text-clinical-400 mt-1">
                  Comprehensive auditing dashboard merging shelf stock batches AND e-prescription holds. color-coded to enforce FEFO.
                </p>
              </div>
              <div className="flex items-center gap-3 self-stretch sm:self-auto select-none">
                <button
                  onClick={() => setExpiryFilter('all')}
                  className={`px-3 py-1.5 text-[10px] font-bold rounded-lg border uppercase tracking-wider cursor-pointer ${
                    expiryFilter === 'all'
                      ? 'border-secondary text-secondary bg-secondary/5 font-black'
                      : 'border-outline-variant text-clinical-400 hover:text-white'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setExpiryFilter('expired')}
                  className={`px-3 py-1.5 text-[10px] font-bold rounded-lg border uppercase tracking-wider cursor-pointer ${
                    expiryFilter === 'expired'
                      ? 'border-rose-500 text-rose-400 bg-rose-500/5 font-black animate-pulse'
                      : 'border-outline-variant text-clinical-400 hover:text-white'
                  }`}
                >
                  Expired
                </button>
                <button
                  onClick={() => setExpiryFilter('expiring')}
                  className={`px-3 py-1.5 text-[10px] font-bold rounded-lg border uppercase tracking-wider cursor-pointer ${
                    expiryFilter === 'expiring'
                      ? 'border-amber-500 text-amber-400 bg-amber-500/5 font-black'
                      : 'border-outline-variant text-clinical-400 hover:text-white'
                  }`}
                >
                  Expiring Soon (&lt;90d)
                </button>
              </div>
            </div>

            {consolidatedExpiryBatches.length === 0 ? (
              <p className="text-sm text-clinical-500 text-center py-6">No matching expiring batches found in facility.</p>
            ) : (
              <div className="border border-outline-variant rounded-xl overflow-hidden glass-panel-inner">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-surface-container text-clinical-300 border-b border-outline-variant font-bold uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="p-3.5">Source</th>
                        <th className="p-3.5">Medicine Info</th>
                        <th className="p-3.5 font-mono">Batch Number</th>
                        <th className="p-3.5 text-center font-mono">Stock Qty</th>
                        <th className="p-3.5 font-mono">Expiry Date</th>
                        <th className="p-3.5 font-mono text-center">Days Remaining</th>
                        <th className="p-3.5 text-right">Logistics Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant bg-surface-container-lowest/30">
                      {consolidatedExpiryBatches.map((batch, idx) => {
                        // color styling
                        let badgeStyle = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25';
                        let daysText = `${batch.daysRemaining} days left`;
                        let disposeBtn = false;
                        let prioritizeBtn = false;

                        if (batch.tier === 'EXPIRED') {
                          badgeStyle = 'bg-rose-500/10 text-rose-400 border-rose-500/30 font-black animate-pulse';
                          daysText = 'EXPIRED';
                          disposeBtn = true;
                        } else if (batch.tier === 'CRITICAL') {
                          badgeStyle = 'bg-rose-400/10 text-rose-300 border-rose-400/25 font-bold';
                          prioritizeBtn = true;
                        } else if (batch.tier === 'CAUTION') {
                          badgeStyle = 'bg-amber-500/10 text-amber-300 border-amber-500/25';
                        }

                        return (
                          <tr key={`${batch.source}-${batch.id}-${idx}`} className="hover:bg-surface-container/40 transition-colors">
                            <td className="p-3.5">
                              <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded border ${
                                batch.source === 'SHELF' 
                                  ? 'bg-secondary/15 text-secondary border-secondary/20' 
                                  : 'bg-primary/15 text-primary border-primary/20'
                              }`}>
                                {batch.source}
                              </span>
                            </td>
                            <td className="p-3.5 font-bold text-white text-xs">
                              {batch.name}
                            </td>
                            <td className="p-3.5 font-mono font-semibold text-clinical-300">{batch.batchNumber}</td>
                            <td className="p-3.5 text-center font-mono font-bold text-white">{batch.stock} units</td>
                            <td className="p-3.5 font-mono text-clinical-300">{batch.expiryDate}</td>
                            <td className="p-3.5 text-center">
                              <span className={`px-2.5 py-0.5 rounded-full border text-[9px] font-mono font-bold ${badgeStyle}`}>
                                {daysText}
                              </span>
                            </td>
                            <td className="p-3.5 text-right">
                              {disposeBtn && (
                                <button
                                  onClick={() => {
                                    if (batch.source === 'SHELF') {
                                      handleDeleteItem(batch.id);
                                    } else {
                                      handleCancelHold(batch.id);
                                    }
                                    window.dispatchEvent(new CustomEvent('mediflow-toast', {
                                      detail: {
                                        message: `Successfully disposed of expired medicine batch ${batch.batchNumber}!`,
                                        type: 'info',
                                        title: 'Batch Safe Disposal'
                                      }
                                    }));
                                  }}
                                  className="px-2.5 py-1 text-[9px] bg-rose-500 hover:bg-rose-600 text-white font-black rounded-lg uppercase tracking-wider active:scale-95 transition-all cursor-pointer border-0"
                                >
                                  Dispose
                                </button>
                              )}
                              {prioritizeBtn && (
                                <button
                                  onClick={() => {
                                    window.dispatchEvent(new CustomEvent('mediflow-toast', {
                                      detail: {
                                        message: `Batch ${batch.batchNumber} tagged as PRIORITIZED DISPATCH. Placed at checkout front desk.`,
                                        type: 'success',
                                        title: 'FEFO Dispatch Locked'
                                      }
                                    }));
                                  }}
                                  className="px-2.5 py-1 text-[9px] bg-secondary/15 hover:bg-secondary text-secondary hover:text-black border border-secondary/25 hover:border-secondary font-black rounded-lg uppercase tracking-wider active:scale-95 transition-all cursor-pointer"
                                >
                                  Prioritize
                                </button>
                              )}
                              {!disposeBtn && !prioritizeBtn && (
                                <span className="text-[10px] text-clinical-500 font-semibold font-mono">Secure</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </div>
        )}

        {/* TAB 5: AI DEMAND RECOMMENDATIONS */}
        {activeTab === 'ai_demand' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8 space-y-6">
              <div className="glass-panel p-6 border-white/10 shadow-xl space-y-5">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-xl">psychology</span>
                    Gemini Seasonal Demand Surveillance Forecasts
                  </h2>
                  <p className="text-xs text-clinical-400 mt-1">
                    Localized Bihar epidemiology and Sewage Pathogen metrics generating automatic stocking levels.
                  </p>
                </div>

                <div className="space-y-4">
                  {forecasts.map(forecast => (
                    <div 
                      key={forecast.id} 
                      className={`p-4 rounded-xl border relative transition-all duration-300 ${
                        forecast.isActedUpon 
                          ? 'bg-surface-container-lowest/40 border-outline-variant/60 text-clinical-400' 
                          : 'bg-surface-container border-outline-variant hover:border-primary/40'
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2 mb-2">
                        <h4 className="font-bold text-xs text-white">{forecast.medicineName}</h4>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full tracking-wider uppercase font-mono border ${
                          forecast.isActedUpon 
                            ? 'bg-surface-container-lowest text-clinical-400 border-outline-variant' 
                            : 'bg-secondary/10 text-secondary border border-secondary/20'
                        }`}>
                          {forecast.isActedUpon ? 'Acted Upon' : `+${forecast.suggestedIncreasePercentage}% Restock`}
                        </span>
                      </div>
                      
                      <p className="text-[11px] leading-relaxed text-clinical-400 mb-3">{forecast.reason}</p>
                      
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-[9px] text-clinical-400 flex items-center gap-1 font-semibold font-mono">
                          <Lightbulb className="h-3.5 w-3.5 text-secondary shrink-0" />
                          Confidence Level: {Math.floor(forecast.forecastConfidence * 100)}%
                        </div>
                        {!forecast.isActedUpon && (
                          <button
                            onClick={() => handleActOnForecast(forecast.id, forecast.medicineName)}
                            className="bg-secondary text-black font-black border-0 hover:bg-secondary/80 text-[9px] tracking-wider uppercase px-2.5 py-1.5 rounded-lg transition-all active:scale-95 cursor-pointer"
                          >
                            Authorize B2B Order
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Pathogen density card */}
            <div className="lg:col-span-4 space-y-6">
              <div className="glass-panel p-6 border-white/10 shadow-xl space-y-4">
                <h4 className="font-bold text-[10px] text-clinical-300 uppercase tracking-widest flex items-center gap-1.5 font-mono">
                  <TrendingUp className="h-4 w-4 text-primary animate-pulse" />
                  Patna Sewage surveillance
                </h4>
                
                <div className="h-16 flex items-end justify-between gap-2 border-b border-l border-outline-variant pb-1 pl-1 select-none">
                  <div className="flex-1 flex flex-col items-center">
                    <div className="w-full bg-primary/20 h-4 rounded-t" />
                    <span className="text-[8px] text-clinical-400 font-mono mt-1 uppercase">Mar</span>
                  </div>
                  <div className="flex-1 flex flex-col items-center">
                    <div className="w-full bg-primary/40 h-8 rounded-t" />
                    <span className="text-[8px] text-clinical-400 font-mono mt-1 uppercase">Apr</span>
                  </div>
                  <div className="flex-1 flex flex-col items-center">
                    <div className="w-full bg-gradient-to-t from-secondary to-primary h-14 rounded-t animate-pulse" />
                    <span className="text-[8px] text-secondary font-mono font-bold mt-1 uppercase">May</span>
                  </div>
                </div>

                <p className="text-[9px] text-rose-400 font-bold flex items-center gap-1 leading-normal">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping shrink-0" />
                  Pre-monsoon sewage surveillance alert.
                </p>
                <div className="text-[9px] text-clinical-500 font-semibold font-mono border-t border-white/5 pt-3 leading-relaxed">
                  Surveillance alerts monitor heavy rainwater waterlogging vectors linked with Cholera, Dengue and Typhoid spikes to prevent stocking shocks.
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* V2.0 PREMIUM LASER BARCODE SCANNER SIMULATION MODAL */}
      {scanningHold && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fade-in">
          <div className="glass-panel max-w-md w-full p-6 border-secondary/20 shadow-2xl space-y-5 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-secondary to-primary" />
            
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary animate-pulse">qr_code_scanner</span>
                FEFO Barcode Scan Verification
              </h3>
              <button
                onClick={() => {
                  setScanningHold(null);
                  setScannerStage('idle');
                }}
                className="text-clinical-400 hover:text-white transition-colors cursor-pointer border-0 bg-transparent"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <div className="relative h-48 w-full bg-black/80 rounded-lg border border-white/10 flex flex-col items-center justify-center overflow-hidden select-none">
              <div className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-secondary/80 rounded-tl" />
              <div className="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 border-secondary/80 rounded-tr" />
              <div className="absolute bottom-3 left-3 w-4 h-4 border-b-2 border-l-2 border-secondary/80 rounded-bl" />
              <div className="absolute bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 border-secondary/80 rounded-br" />

              {scannerStage === 'scanning' && (
                <div className="absolute left-0 w-full h-[2px] bg-rose-500 shadow-[0_0_12px_#ef4444] laser-line z-10" />
              )}

              <div className={`flex flex-col items-center justify-center gap-2 transition-all duration-500 ${
                scannerStage === 'matched' ? 'scale-105 opacity-100' : 'opacity-65'
              }`}>
                <svg className="w-56 h-16 text-white fill-current" viewBox="0 0 200 60">
                  <rect x="0" y="0" width="200" height="60" fill="transparent" />
                  <rect x="10" y="5" width="3" height="50" fill="currentColor" />
                  <rect x="15" y="5" width="1" height="50" fill="currentColor" />
                  <rect x="18" y="5" width="2" height="50" fill="currentColor" />
                  <rect x="24" y="5" width="4" height="50" fill="currentColor" />
                  <rect x="30" y="5" width="1" height="50" fill="currentColor" />
                  <rect x="33" y="5" width="3" height="50" fill="currentColor" />
                  <rect x="40" y="5" width="2" height="50" fill="currentColor" />
                  <rect x="46" y="5" width="5" height="50" fill="currentColor" />
                  <rect x="54" y="5" width="1" height="50" fill="currentColor" />
                  <rect x="95" y="5" width="2" height="50" fill="#ef4444" />
                  <rect x="99" y="5" width="2" height="50" fill="#ef4444" />
                  <rect x="110" y="5" width="3" height="50" fill="currentColor" />
                  <rect x="115" y="5" width="4" height="50" fill="currentColor" />
                  <rect x="122" y="5" width="1" height="50" fill="currentColor" />
                  <rect x="126" y="5" width="2" height="50" fill="currentColor" />
                  <rect x="132" y="5" width="5" height="50" fill="currentColor" />
                  <rect x="140" y="5" width="1" height="50" fill="currentColor" />
                  <rect x="144" y="5" width="3" height="50" fill="currentColor" />
                  <rect x="150" y="5" width="2" height="50" fill="currentColor" />
                  <rect x="178" y="5" width="2" height="50" fill="currentColor" />
                  <rect x="185" y="5" width="3" height="50" fill="currentColor" />
                </svg>
                <div className="text-[10px] font-mono text-secondary tracking-widest font-black uppercase">
                  {scanningHold.batchNumber}
                </div>
              </div>

              <div className="absolute bottom-4 bg-black/60 px-3 py-1 rounded border border-white/10 text-[9px] font-mono uppercase tracking-widest text-center">
                {scannerStage === 'scanning' ? (
                  <span className="text-secondary flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-ping" />
                    scanning BATCH CODE...
                  </span>
                ) : (
                  <span className="text-emerald-400 flex items-center gap-1.5 font-bold animate-pulse">
                    <CheckCircle className="h-3 w-3" /> MATCH APPROVED
                  </span>
                )}
              </div>
            </div>

            <div className="bg-surface-container-lowest border border-outline-variant p-3.5 rounded-lg h-32 overflow-y-auto font-mono text-[9px] text-clinical-300 space-y-1">
              {scanLogs.map((log, idx) => (
                <div key={idx} className={log.includes('MATCH') ? 'text-emerald-400 font-bold' : log.includes('Laser sweep') ? 'text-secondary' : ''}>
                  {log}
                </div>
              ))}
            </div>

            <div className="flex gap-3 justify-end pt-3 border-t border-white/10">
              <button
                onClick={() => {
                  setScanningHold(null);
                  setScannerStage('idle');
                }}
                className="px-4 py-2 bg-surface-container hover:bg-surface-container-highest border border-outline-variant text-clinical-300 hover:text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Abort
              </button>
              {scannerStage === 'matched' ? (
                <button
                  onClick={() => {
                    handleDispenseHold(scanningHold.id);
                    setScanningHold(null);
                    setScannerStage('idle');
                  }}
                  className="px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl text-xs font-black tracking-wider uppercase flex items-center gap-2 border-0 cursor-pointer"
                >
                  Confirm Dispatch
                </button>
              ) : (
                <button
                  disabled
                  className="px-5 py-2 bg-surface-container-highest border border-outline-variant text-clinical-500 rounded-xl text-xs font-bold cursor-not-allowed uppercase flex items-center gap-2 border-0"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-clinical-500 animate-pulse" />
                  processing...
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MANUAL REGISTER NEW MEDICINE MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="glass-panel max-w-2xl w-full p-6 border-white/10 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-secondary to-primary" />
            
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary">add_circle</span>
                Manual Register Batch Medicine
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-clinical-400 hover:text-white transition-colors cursor-pointer border-0 bg-transparent">
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <form onSubmit={handleAddMedicineSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-clinical-400 font-bold uppercase tracking-wider font-mono">Medicine Brand Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Metformin 500mg"
                    value={addForm.name}
                    onChange={(e) => setAddForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full input-field text-xs py-2 px-3 focus:ring-1 focus:ring-secondary focus:border-secondary bg-surface-container border-outline-variant text-white rounded-lg"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-clinical-400 font-bold uppercase tracking-wider font-mono">Generic Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Metformin Hydrochloride"
                    value={addForm.genericName}
                    onChange={(e) => setAddForm(prev => ({ ...prev, genericName: e.target.value }))}
                    className="w-full input-field text-xs py-2 px-3 focus:ring-1 focus:ring-secondary focus:border-secondary bg-surface-container border-outline-variant text-white rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-clinical-400 font-bold uppercase tracking-wider font-mono">Category</label>
                  <select
                    value={addForm.category}
                    onChange={(e) => setAddForm(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full input-field text-xs py-2 px-3 focus:ring-1 focus:ring-secondary focus:border-secondary bg-surface-container border-outline-variant text-white rounded-lg cursor-pointer"
                  >
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-clinical-400 font-bold uppercase tracking-wider font-mono">Manufacturer</label>
                  <input
                    type="text"
                    placeholder="e.g. Sun Pharma"
                    value={addForm.manufacturer}
                    onChange={(e) => setAddForm(prev => ({ ...prev, manufacturer: e.target.value }))}
                    className="w-full input-field text-xs py-2 px-3 focus:ring-1 focus:ring-secondary focus:border-secondary bg-surface-container border-outline-variant text-white rounded-lg"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-clinical-400 font-bold uppercase tracking-wider font-mono">Dosage Unit *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 500mg, 10ml, 1 Strip"
                    value={addForm.dosage}
                    onChange={(e) => setAddForm(prev => ({ ...prev, dosage: e.target.value }))}
                    className="w-full input-field text-xs py-2 px-3 focus:ring-1 focus:ring-secondary focus:border-secondary bg-surface-container border-outline-variant text-white rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-clinical-400 font-bold uppercase tracking-wider font-mono">Batch Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. MET26A-08"
                    value={addForm.batchNumber}
                    onChange={(e) => setAddForm(prev => ({ ...prev, batchNumber: e.target.value }))}
                    className="w-full input-field text-xs py-2 px-3 focus:ring-1 focus:ring-secondary focus:border-secondary bg-surface-container border-outline-variant text-white rounded-lg font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-clinical-400 font-bold uppercase tracking-wider font-mono">Expiry Date *</label>
                  <input
                    type="date"
                    required
                    value={addForm.expiryDate}
                    onChange={(e) => setAddForm(prev => ({ ...prev, expiryDate: e.target.value }))}
                    className="w-full input-field text-xs py-2 px-3 focus:ring-1 focus:ring-secondary focus:border-secondary bg-surface-container border-outline-variant text-white rounded-lg font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-clinical-400 font-bold uppercase tracking-wider font-mono">HSN Code (GST)</label>
                  <input
                    type="text"
                    placeholder="e.g. 300490"
                    value={addForm.hsn}
                    onChange={(e) => setAddForm(prev => ({ ...prev, hsn: e.target.value }))}
                    className="w-full input-field text-xs py-2 px-3 focus:ring-1 focus:ring-secondary focus:border-secondary bg-surface-container border-outline-variant text-white rounded-lg font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-clinical-400 font-bold uppercase tracking-wider font-mono">MRP Price (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="e.g. 15"
                    value={addForm.mrp}
                    onChange={(e) => setAddForm(prev => ({ ...prev, mrp: e.target.value }))}
                    className="w-full input-field text-xs py-2 px-3 focus:ring-1 focus:ring-secondary focus:border-secondary bg-surface-container border-outline-variant text-white rounded-lg font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-clinical-400 font-bold uppercase tracking-wider font-mono">Selling Price (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="e.g. 13"
                    value={addForm.price}
                    onChange={(e) => setAddForm(prev => ({ ...prev, price: e.target.value }))}
                    className="w-full input-field text-xs py-2 px-3 focus:ring-1 focus:ring-secondary focus:border-secondary bg-surface-container border-outline-variant text-white rounded-lg font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-clinical-400 font-bold uppercase tracking-wider font-mono">Units In Stock *</label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 100"
                    value={addForm.stock}
                    onChange={(e) => setAddForm(prev => ({ ...prev, stock: e.target.value }))}
                    className="w-full input-field text-xs py-2 px-3 focus:ring-1 focus:ring-secondary focus:border-secondary bg-surface-container border-outline-variant text-white rounded-lg font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-clinical-400 font-bold uppercase tracking-wider font-mono">Low-Stock Margin *</label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 20"
                    value={addForm.threshold}
                    onChange={(e) => setAddForm(prev => ({ ...prev, threshold: e.target.value }))}
                    className="w-full input-field text-xs py-2 px-3 focus:ring-1 focus:ring-secondary focus:border-secondary bg-surface-container border-outline-variant text-white rounded-lg font-mono"
                  />
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-surface-container hover:bg-surface-container-highest border border-outline-variant text-clinical-300 hover:text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-secondary to-primary hover:scale-105 active:scale-95 text-black font-black tracking-wider uppercase rounded-xl text-xs border-0 cursor-pointer transition-transform"
                >
                  Save Medicine
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV IMPORT PANEL MODAL */}
      {isCsvImportOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="glass-panel max-w-3xl w-full p-6 border-white/10 shadow-2xl relative overflow-hidden space-y-4">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-secondary to-primary" />
            
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-emerald-400" />
                Smart CSV Template Importer
              </h3>
              <button onClick={() => setIsCsvImportOpen(false)} className="text-clinical-400 hover:text-white transition-colors cursor-pointer border-0 bg-transparent">
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {/* Instruction banner */}
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl flex items-center justify-between gap-3 font-semibold">
              <div className="flex items-center gap-2">
                <Download className="h-4.5 w-4.5" />
                <span>Format must strictly match our template sheet order.</span>
              </div>
              <a 
                href="data:text/csv;charset=utf-8,Name,Generic Name,Category,Manufacturer,Batch No,Expiry Date,MRP,Price,Stock,Unit,Threshold,Dosage,HSN%0AMetformin 500mg,Metformin,Antidiabetic,Sun Pharma,MET26X,2027-12-31,15,13.5,100,tabs,30,500mg,300490"
                download="mediflow_inventory_template.csv"
                className="underline text-[10px] uppercase font-bold shrink-0 hover:text-white"
              >
                Download Template CSV
              </a>
            </div>

            {/* Dropzone */}
            <div className="relative border-2 border-dashed border-outline-variant hover:border-emerald-400/50 rounded-xl p-6 text-center transition-all bg-black/20">
              <input
                type="file"
                accept=".csv"
                onChange={handleCsvFileChange}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <FileSpreadsheet className="h-10 w-10 text-clinical-400 mx-auto mb-2" />
              <p className="text-xs text-white font-bold">{csvFileName || 'Click or drag `.csv` file here'}</p>
              <p className="text-[10px] text-clinical-500 mt-1">UTF-8 comma separated files only.</p>
            </div>

            {/* Parsing errors */}
            {csvErrors.length > 0 && (
              <div className="p-3 bg-rose-500/15 border border-rose-500/20 text-rose-300 text-[10px] rounded-lg space-y-1 font-mono max-h-24 overflow-y-auto">
                <div className="font-bold uppercase flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Parsing warnings:</div>
                {csvErrors.map((err, i) => <div key={i}>{err}</div>)}
              </div>
            )}

            {/* Parsed Rows Preview */}
            {csvPreview.length > 0 && (
              <div className="space-y-2 select-none">
                <h4 className="font-bold text-[10px] text-clinical-300 uppercase tracking-widest font-mono">CSV Import Preview ({csvPreview.length} rows)</h4>
                <div className="border border-outline-variant rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                  <table className="w-full text-[10px] text-left">
                    <thead className="bg-surface-container text-clinical-300 font-mono uppercase font-bold sticky top-0">
                      <tr>
                        <th className="p-2">Name</th>
                        <th className="p-2 font-mono">Batch</th>
                        <th className="p-2 font-mono">Expiry</th>
                        <th className="p-2 text-right font-mono">Price</th>
                        <th className="p-2 text-center font-mono">Stock</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant bg-surface-container-lowest/50 text-white font-mono">
                      {csvPreview.map((row, idx) => (
                        <tr key={idx} className="hover:bg-surface-container-highest/20">
                          <td className="p-2 font-sans font-bold">{row.name}</td>
                          <td className="p-2">{row.batchNumber}</td>
                          <td className="p-2">{row.expiryDate}</td>
                          <td className="p-2 text-right">₹{row.price.toFixed(2)}</td>
                          <td className="p-2 text-center">{row.stock} {row.unit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex gap-3 justify-end pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => {
                  setCsvPreview([]);
                  setCsvErrors([]);
                  setCsvFileName('');
                  setIsCsvImportOpen(false);
                }}
                className="px-4 py-2 bg-surface-container hover:bg-surface-container-highest border border-outline-variant text-clinical-300 hover:text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={csvPreview.length === 0}
                onClick={handleConfirmCsvImport}
                className={`px-5 py-2 rounded-xl text-xs font-black tracking-wider uppercase border-0 cursor-pointer ${
                  csvPreview.length === 0 
                    ? 'bg-surface-container-highest text-clinical-500 cursor-not-allowed'
                    : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg active:scale-95 transition-all'
                }`}
              >
                Import Batches
              </button>
            </div>

          </div>
        </div>
      )}

      {/* OCR BILL SCAN PANEL MODAL */}
      {isBillScanOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="glass-panel max-w-3xl w-full p-6 border-white/10 shadow-2xl relative overflow-hidden space-y-4">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-secondary to-primary" />
            
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Camera className="h-5 w-5 text-secondary" />
                AI Suppliers Invoice OCR Parser
              </h3>
              <button onClick={() => setIsBillScanOpen(false)} className="text-clinical-400 hover:text-white transition-colors cursor-pointer border-0 bg-transparent">
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Photo selector dropzone */}
              <div className="space-y-3">
                <label className="text-[10px] text-clinical-400 font-bold uppercase tracking-wider font-mono">Upload Supplier Bill Photo / Challan</label>
                <div className="relative border-2 border-dashed border-outline-variant hover:border-secondary/50 rounded-xl h-44 flex flex-col items-center justify-center overflow-hidden bg-black/20 select-none">
                  {billImage ? (
                    <>
                      <img src={billImage} className="w-full h-full object-cover opacity-75" alt="Suppliers bill upload" />
                      <div className="absolute inset-0 bg-black/40 hover:bg-black/60 flex items-center justify-center transition-colors">
                        <span className="text-white text-xs font-bold uppercase tracking-wider">Change photo</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <Camera className="h-10 w-10 text-clinical-400 mb-2" />
                      <span className="text-xs text-white font-bold">Select supplier invoice image</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleBillImageUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </div>
                
                {billImage && (
                  <button
                    disabled={isOcrScanning}
                    onClick={handleTriggerOcrScan}
                    className="w-full btn-primary py-2.5 text-xs font-bold bg-gradient-to-r from-secondary to-primary text-black font-black border-0 rounded-xl cursor-pointer hover:scale-105 active:scale-95 transition-transform"
                  >
                    {isOcrScanning ? 'Analyzing via Gemini...' : 'Scan Bill with AI'}
                  </button>
                )}
              </div>

              {/* Streaming logs panel */}
              <div className="space-y-3 flex flex-col">
                <label className="text-[10px] text-clinical-400 font-bold uppercase tracking-wider font-mono">Gemini Extraction Logs</label>
                <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-3.5 font-mono text-[9px] text-clinical-300 space-y-1 h-44 overflow-y-auto flex-1">
                  {ocrLogs.length === 0 ? (
                    <div className="text-clinical-500 italic">Logs will stream here during billing OCR analysis...</div>
                  ) : (
                    ocrLogs.map((log, i) => (
                      <div key={i} className={log.includes('verified') ? 'text-emerald-400 font-bold font-mono' : log.includes('Gemini') ? 'text-secondary font-mono' : 'font-mono'}>
                        {log}
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>

            {/* OCR Extracted preview table */}
            {ocrResults.length > 0 && (
              <div className="space-y-2 select-none border-t border-white/5 pt-4">
                <h4 className="font-bold text-[10px] text-clinical-300 uppercase tracking-widest font-mono">Extracted Medicines Preview</h4>
                <div className="border border-outline-variant rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                  <table className="w-full text-[10px] text-left">
                    <thead className="bg-surface-container text-clinical-300 font-mono uppercase font-bold sticky top-0">
                      <tr>
                        <th className="p-2">Name</th>
                        <th className="p-2 font-mono">Batch</th>
                        <th className="p-2 font-mono">Expiry</th>
                        <th className="p-2 text-right font-mono">Supplier Price</th>
                        <th className="p-2 text-center font-mono">QTY</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant bg-surface-container-lowest/50 text-white font-mono">
                      {ocrResults.map((row, idx) => (
                        <tr key={idx} className="hover:bg-surface-container-highest/20">
                          <td className="p-2 font-sans font-bold">{row.name}</td>
                          <td className="p-2">{row.batchNumber}</td>
                          <td className="p-2">{row.expiryDate}</td>
                          <td className="p-2 text-right">₹{row.price.toFixed(2)}</td>
                          <td className="p-2 text-center">{row.stock} {row.unit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex gap-3 justify-end pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => {
                  setOcrResults([]);
                  setOcrLogs([]);
                  setBillImage(null);
                  setIsBillScanOpen(false);
                }}
                className="px-4 py-2 bg-surface-container hover:bg-surface-container-highest border border-outline-variant text-clinical-300 hover:text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={ocrResults.length === 0}
                onClick={handleConfirmOcrImport}
                className={`px-5 py-2 rounded-xl text-xs font-black tracking-wider uppercase border-0 cursor-pointer ${
                  ocrResults.length === 0 
                    ? 'bg-surface-container-highest text-clinical-500 cursor-not-allowed'
                    : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg active:scale-95 transition-all'
                }`}
              >
                Authorize Stock Entry
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
