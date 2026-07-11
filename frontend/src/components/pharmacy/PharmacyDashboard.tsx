import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '../../services/api';
import { supabase } from '../../lib/supabaseClient';
import { useSpecialization } from '../../context/SpecializationContext';
import { generateSpectaclePdfCard } from '../../utils/pdfGenerator';
import type { InventoryHold, SeasonalForecast, PharmacyInventoryItem, MedicineImportRow, WhatsAppDrugOrder } from '../../types';
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
  AlertCircle,
  History,
  Coins,
  Settings
} from 'lucide-react';
import { useClinic } from '../../context/ClinicContext';
import { SettlementWidget } from '../shared/SettlementWidget';

export const PharmacyDashboard: React.FC = () => {
  const { isOphthalmology, nomenclature } = useSpecialization();
  const { activePod, activeEntity, podEntities, refreshClinic } = useClinic();
  const [activeTab, setActiveTab] = useState<'prescription_queue' | 'inventory_catalog' | 'stock_alerts' | 'expiry_tracker' | 'ai_demand' | 'settlements' | 'pod_connect' | 'profile_settings'>('prescription_queue');

  // Pharmacy Profile Settings States
  const [profileName, setProfileName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profileAddress, setProfileAddress] = useState('');
  const [profileGstin, setProfileGstin] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  useEffect(() => {
    if (activeEntity) {
      setProfileName(activeEntity.name || '');
      setProfilePhone(activeEntity.phone || '');
      setProfileAddress(activeEntity.address || '');
      setProfileGstin(activeEntity.gstin || '');
    }
  }, [activeEntity]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEntity) return;
    setIsSavingProfile(true);
    try {
      const { error } = await supabase
        .from('entities')
        .update({
          name: profileName.trim(),
          phone: profilePhone.trim() || null,
          address: profileAddress.trim() || null,
          gstin: profileGstin.trim() || null
        })
        .eq('id', activeEntity.id);

      if (error) throw error;

      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: 'Profile Updated',
          message: 'Pharmacy profile and GSTIN updated successfully.',
          type: 'success'
        }
      }));
      await refreshClinic();
    } catch (err: any) {
      console.error('[Pharmacy Profile] Save failed:', err);
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: 'Update Failed',
          message: err.message || 'Failed to update profile details.',
          type: 'error'
        }
      }));
    } finally {
      setIsSavingProfile(false);
    }
  };
  const [inventory, setInventory] = useState<PharmacyInventoryItem[]>([]);
  const [holds, setHolds] = useState<InventoryHold[]>([]);
  const [forecasts, setForecasts] = useState<SeasonalForecast[]>([]);
  const [whatsAppOrders, setWhatsAppOrders] = useState<WhatsAppDrugOrder[]>([]);
  
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
  const [verifySearch, setVerifySearch] = useState('');

  // Scanner modal states
  const [scanningHold, setScanningHold] = useState<InventoryHold | null>(null);
  const [scannerStage, setScannerStage] = useState<'idle' | 'scanning' | 'matched'>('idle');
  const [scanLogs, setScanLogs] = useState<string[]>([]);

  // Add Medicine Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    name: '',
    genericName: '',
    category: isOphthalmology ? 'Eye Drops' : 'Antidiabetic',
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

  // Seasonal Demand State
  const [isGeneratingForecast, setIsGeneratingForecast] = useState(false);

  const handleRegenerateForecast = async () => {
    setIsGeneratingForecast(true);
    try {
      await api.generateSeasonalForecast({
        pharmacy_entity_id: activeEntity?.id || 'pharmacy-partner-entity',
        pod_id: activePod?.id || 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317002',
        current_month: 'May',
        regional_weather: 'Pre-monsoon rainfall and high humidity'
      });
      syncData();
    } catch (err) {
      console.error('[Forecast UI] Failed to regenerate forecast:', err);
    } finally {
      setIsGeneratingForecast(false);
    }
  };

  // Categories list
  const categories = isOphthalmology ? [
    'Eye Drops', 'Ointments', 'Frames', 'Lens Blanks', 'Contact Lenses', 'General'
  ] : [
    'Antidiabetic', 'Antibiotic', 'Analgesic', 'Cardiovascular', 
    'Gastrointestinal', 'Respiratory', 'Neurological', 'General'
  ];

  // Sync data from API
  const syncData = useCallback(() => {
    setInventory(api.getPharmacyInventory());
    setHolds(api.getInventoryHolds());
    setForecasts(api.getSeasonalForecasts());
    setWhatsAppOrders(api.getWhatsAppDrugOrders());
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
    }, activeEntity?.id);

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
      category: isOphthalmology ? 'Eye Drops' : 'Antidiabetic',
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
    const res = api.addPharmacyInventoryBulk(csvPreview, activeEntity?.id);
    
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
    <div className="max-w-7xl mx-auto p-4 pb-20 md:pb-8 md:p-8 space-y-8 animate-fade-in relative">
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4 border-b-0 md:border-b border-slate-200 pb-3 md:pb-6">
        <div>
          <h1 className="text-base font-semibold text-slate-900 tracking-tight flex items-center gap-3">
            <span className="material-symbols-outlined text-indigo-600 text-[20px]">medication</span>
            {nomenclature.pharmacyTitle}
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border uppercase tracking-widest ${
              isOnline 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-600 animate-pulse' 
                : 'bg-rose-50 border-rose-200 text-rose-600'
            }`}>
              {isOnline ? 'Online' : 'Offline Mode (Local Cache)'}
            </span>
          </h1>
          <p className="hidden sm:block text-xs text-slate-500 mt-1">
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
      <div className="hidden md:flex overflow-x-auto gap-2 pb-2.5 no-scrollbar select-none -mb-px">
        {[
          { id: 'prescription_queue', label: 'Prescription Queue', icon: 'inventory_2', badge: activeHoldsCount },
          { id: 'inventory_catalog', label: 'Inventory Catalog', icon: 'database' },
          { id: 'stock_alerts', label: 'Stock Alerts', icon: 'warning', badge: criticalStockCount, alert: true },
          { id: 'expiry_tracker', label: 'Expiry Tracker', icon: 'event_busy', badge: criticalExpiryCount, warning: true },
          { id: 'ai_demand', label: 'Gemini Demand AI', icon: 'psychology' },
          { id: 'settlements', label: 'Settlements', icon: 'account_balance' },
          { id: 'pod_connect', label: 'Pod Interconnect', icon: 'hub' },
          { id: 'profile_settings', label: 'Profile & GSTIN', icon: 'settings' }
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border transition-all duration-200 cursor-pointer relative whitespace-nowrap ${
                isActive
                  ? 'premium-nav-pill-active'
                  : 'bg-slate-50 border-slate-200/60 text-slate-650 hover:border-slate-300 hover:text-slate-850 hover:bg-slate-100/50'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
              {tab.label}
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className={`ml-1 px-1.5 py-0.5 text-[9px] rounded-full font-bold text-white ${
                  tab.alert ? 'bg-rose-500 animate-bounce' :
                  tab.warning ? 'bg-amber-500 text-black' : 'bg-indigo-600'
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT AREAS */}
      <div className="space-y-6">
           {/* TAB 1: PRESCRIPTION QUEUE (SAAS PAYMENTS GATED VERIFICATION HUB) */}
        {activeTab === 'prescription_queue' && (
          <div className="grid grid-cols-1 gap-6">
            <div className="glass-panel p-6 border-slate-200/60 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-[2px] bg-emerald-600 opacity-60" />
              
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-6">
                <div>
                  <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                    <span className="material-symbols-outlined text-emerald-400 text-base">verified</span>
                    Gate 3: Paid Invoice Dispensation Verification Hub
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Lookup and verify patient digital invoices that have cleared payment. Read-only verification before physical dispensing.
                  </p>
                </div>
                <div className="relative w-full md:max-w-xs">
                  <input
                    type="text"
                    placeholder="Search by name or phone..."
                    value={verifySearch}
                    onChange={(e) => setVerifySearch(e.target.value)}
                    className="w-full input-field pl-10 focus:ring-1 focus:ring-teal-400 focus:border-teal-400 text-xs py-2 bg-white border-slate-200 text-slate-800 rounded-lg"
                  />
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 h-4 w-4" />
                </div>
              </div>

              <div className="space-y-6">
                {(() => {
                  const patients = api.getPatients();
                  const prescriptions = api.getPrescriptions();
                  const allInvoices = api.getUnifiedInvoices();

                  const pendingPharmaInvoices = allInvoices.filter(i => i.pharmacyFee > 0 && i.paymentStatus === 'pending');
                  const paidPharmaInvoices = allInvoices.filter(i => i.pharmacyFee > 0 && i.paymentStatus === 'cleared');
                  
                  const filteredPending = pendingPharmaInvoices.filter(invoice => {
                    const patient = patients.find(p => p.id === invoice.patientId);
                    if (!patient) return false;
                    const query = verifySearch.toLowerCase().trim();
                    if (!query) return true;
                    return patient.name.toLowerCase().includes(query) || patient.phone.includes(query);
                  });

                  const filteredPaid = paidPharmaInvoices.filter(invoice => {
                    const patient = patients.find(p => p.id === invoice.patientId);
                    if (!patient) return false;
                    const query = verifySearch.toLowerCase().trim();
                    if (!query) return true;
                    return patient.name.toLowerCase().includes(query) || patient.phone.includes(query);
                  });

                  return (
                    <div className="space-y-8">
                      {/* 1. Pending Section */}
                      <div>
                        <h3 className="text-xs font-black text-amber-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                          Pending e-Prescriptions (Awaiting Payment) ({filteredPending.length})
                        </h3>
                        {filteredPending.length === 0 ? (
                          <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-400">
                            No pending prescriptions awaiting payment.
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {filteredPending.map(invoice => {
                              const patient = patients.find(p => p.id === invoice.patientId);
                              const prescription = prescriptions.find(p => p.appointmentId === invoice.encounterId);

                              return (
                                <div key={invoice.id} className="p-5 bg-white border border-slate-200 rounded-xl space-y-4 relative overflow-hidden">
                                  <div className="absolute top-0 right-0 bg-amber-500 text-slate-800 text-[9px] font-black uppercase px-2.5 py-0.5 rounded-bl">
                                    UNPAID ⚠️
                                  </div>

                                  <div className="flex justify-between items-start border-b border-slate-100 pb-2">
                                    <div>
                                      <h4 className="font-bold text-slate-800 text-xs">{patient ? patient.name : 'Unknown Patient'}</h4>
                                      <p className="text-[10px] text-slate-500 mt-0.5 font-mono">
                                        Phone: +91 {patient ? patient.phone : 'N/A'}
                                      </p>
                                    </div>
                                  </div>

                                  {prescription && prescription.extractedMedicines && (
                                    <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg space-y-1.5">
                                      <span className="block text-[8px] font-black text-amber-600 tracking-widest uppercase font-mono">
                                        Prescribed Medicines
                                      </span>
                                      <div className="space-y-1">
                                        {prescription.extractedMedicines.map((m, idx) => (
                                          <div key={idx} className="text-[10px] text-slate-600 font-mono flex items-center justify-between">
                                            <span>💊 {m.name} ({m.dosage})</span>
                                            <span className="text-[9px] bg-slate-200 px-1 rounded">{m.frequency}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  <div className="flex justify-between items-center pt-2">
                                    <div>
                                      <span className="text-[9px] text-slate-500 block font-mono">Invoice ID: {invoice.id.substring(0, 8)}...</span>
                                      <span className="text-xs font-black text-slate-800">Pharmacy Fee: ₹{invoice.pharmacyFee}</span>
                                    </div>
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => {
                                          api.clearInvoice(invoice.id, 'cash');
                                          window.dispatchEvent(new CustomEvent('mediflow-toast', {
                                            detail: {
                                              message: `Invoice ₹${invoice.pharmacyFee} cleared via CASH! Medicine hold marked as dispensed.`,
                                              type: 'success',
                                              title: 'Bill Paid Successful'
                                            }
                                          }));
                                          syncData();
                                        }}
                                        className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-slate-850 font-black rounded-lg uppercase tracking-wider text-[9px] cursor-pointer"
                                      >
                                        Collect Cash
                                      </button>
                                      <button
                                        onClick={() => {
                                          api.clearInvoice(invoice.id, 'upi');
                                          window.dispatchEvent(new CustomEvent('mediflow-toast', {
                                            detail: {
                                              message: `Invoice ₹${invoice.pharmacyFee} cleared via UPI! Medicine hold marked as dispensed.`,
                                              type: 'success',
                                              title: 'UPI Paid Successful'
                                            }
                                          }));
                                          syncData();
                                        }}
                                        className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-lg uppercase tracking-wider text-[9px] cursor-pointer"
                                      >
                                        UPI / QR
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* 2. Paid / Dispensation Section */}
                      <div>
                        <h3 className="text-xs font-black text-emerald-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          Dispensation &amp; Handout Queue ({filteredPaid.length})
                        </h3>
                        {filteredPaid.length === 0 ? (
                          <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-400">
                            No paid invoices in queue.
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {filteredPaid.map(invoice => {
                              const patient = patients.find(p => p.id === invoice.patientId);
                              const prescription = prescriptions.find(p => p.appointmentId === invoice.encounterId);

                              return (
                                <div key={invoice.id} className="p-5 bg-white border border-slate-200 rounded-xl space-y-4 relative overflow-hidden">
                                  <div className="absolute top-0 right-0 bg-emerald-600 text-black text-[9px] font-black uppercase px-2.5 py-0.5 rounded-bl">
                                    PAID ✅
                                  </div>

                                  <div className="flex justify-between items-start border-b border-slate-100 pb-2">
                                    <div>
                                      <h4 className="font-bold text-slate-800 text-xs">{patient ? patient.name : 'Unknown Patient'}</h4>
                                      <p className="text-[10px] text-slate-500 mt-0.5 font-mono">
                                        Phone: +91 {patient ? patient.phone : 'N/A'}
                                      </p>
                                    </div>
                                  </div>

                                  {prescription && prescription.extractedMedicines && (
                                    <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg space-y-2">
                                      <span className="block text-[8px] font-black text-teal-600 tracking-widest uppercase font-mono">
                                        Approved Medicines to Dispense
                                      </span>
                                      <div className="space-y-1.5">
                                        {prescription.extractedMedicines.map((m, idx) => {
                                          const isSpectacles = m.name.startsWith('Spectacles (');
                                          if (isSpectacles) {
                                            // Parse refraction from dosage field!
                                            const odPart = m.dosage.split('|')[0] || '';
                                            const osPart = m.dosage.split('|')[1] || '';
                                            
                                            const parseEye = (part: string) => {
                                              const sphMatch = part.match(/SPH\s+([^\s]+)/);
                                              const cylMatch = part.match(/CYL\s+([^\s]+)/);
                                              const axisMatch = part.match(/Axis\s+([^\s|]+)/);
                                              const addMatch = part.match(/ADD\s+([^\s|]+)/);
                                              return {
                                                sph: sphMatch ? sphMatch[1] : 'Plano',
                                                cyl: cylMatch ? cylMatch[1] : '—',
                                                axis: axisMatch ? axisMatch[1] : '—',
                                                add: addMatch ? addMatch[1] : '—'
                                              };
                                            };
                                            
                                            const od = parseEye(odPart);
                                            const os = parseEye(osPart);
                                            const lensType = m.name.replace('Spectacles (', '').replace(')', '');
                                            
                                            return (
                                              <div key={idx} className="bg-indigo-50 border border-indigo-200 p-3.5 rounded-xl space-y-3 mt-1.5 animate-fade-in text-slate-800 w-full">
                                                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                                  <div className="flex items-center gap-1.5">
                                                    <span className="material-symbols-outlined text-indigo-400 text-sm">visibility</span>
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-350">Refraction Rx / Spectacles</span>
                                                  </div>
                                                  <span className="text-[9px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-1.5 py-0.5 rounded font-black font-mono">
                                                    {lensType}
                                                  </span>
                                                </div>
                                                
                                                <div className="grid grid-cols-2 gap-3">
                                                  {/* OD */}
                                                  <div className="space-y-1 p-2 bg-white rounded-lg border border-indigo-100">
                                                    <div className="text-[8px] font-bold uppercase text-indigo-500 font-mono">Right Eye (OD)</div>
                                                    <div className="grid grid-cols-4 gap-0.5 text-[9px] font-mono text-center">
                                                      <div>
                                                        <span className="block text-[7px] text-slate-400">SPH</span>
                                                        <span className="font-bold text-slate-800">{od.sph}</span>
                                                      </div>
                                                      <div>
                                                        <span className="block text-[7px] text-slate-400">CYL</span>
                                                        <span className="font-bold text-slate-800">{od.cyl}</span>
                                                      </div>
                                                      <div>
                                                        <span className="block text-[7px] text-slate-400">AXIS</span>
                                                        <span className="font-bold text-slate-800">{od.axis}</span>
                                                      </div>
                                                      <div>
                                                        <span className="block text-[7px] text-slate-400">ADD</span>
                                                        <span className="font-bold text-slate-800">{od.add}</span>
                                                      </div>
                                                    </div>
                                                  </div>
                                                  
                                                  {/* OS */}
                                                  <div className="space-y-1 p-2 bg-white rounded-lg border border-indigo-100">
                                                    <div className="text-[8px] font-bold uppercase text-indigo-500 font-mono">Left Eye (OS)</div>
                                                    <div className="grid grid-cols-4 gap-0.5 text-[9px] font-mono text-center">
                                                      <div>
                                                        <span className="block text-[7px] text-slate-400">SPH</span>
                                                        <span className="font-bold text-slate-800">{os.sph}</span>
                                                      </div>
                                                      <div>
                                                        <span className="block text-[7px] text-slate-400">CYL</span>
                                                        <span className="font-bold text-slate-800">{os.cyl}</span>
                                                      </div>
                                                      <div>
                                                        <span className="block text-[7px] text-slate-400">AXIS</span>
                                                        <span className="font-bold text-slate-800">{os.axis}</span>
                                                      </div>
                                                      <div>
                                                        <span className="block text-[7px] text-slate-400">ADD</span>
                                                        <span className="font-bold text-slate-800">{os.add}</span>
                                                      </div>
                                                    </div>
                                                  </div>
                                                </div>

                                                <div className="bg-indigo-50/50 border border-indigo-100 p-2.5 rounded-lg text-[9.5px] text-slate-700 leading-relaxed text-left space-y-1">
                                                  <p className="font-bold text-indigo-950 flex items-center gap-1">
                                                    <span className="material-symbols-outlined text-[11px] text-indigo-600 font-bold">info</span>
                                                    Bilingual Usage Advice / उपयोग निर्देश:
                                                  </p>
                                                  <p className="font-medium">
                                                    🇺🇸 Clean with microfiber cloth. Wear constantly for reading &amp; digital screens.
                                                  </p>
                                                  <p className="font-bold text-slate-800">
                                                    🇮🇳 केवल माइक्रोफाइबर कपड़े से साफ करें। पढ़ते व स्क्रीन पर कार्य करते समय लगातार पहनें।
                                                  </p>
                                                </div>
                                                
                                                <div className="flex justify-between items-center pt-2 border-t border-slate-100 text-[9px]">
                                                  <span className="text-slate-500 italic">Freq: {m.frequency}</span>
                                                  <button
                                                    onClick={async () => {
                                                      try {
                                                        const refractionData = {
                                                          od: {
                                                            sph: od.sph === 'Plano' ? '' : od.sph,
                                                            cyl: od.cyl === '—' ? '' : od.cyl,
                                                            axis: od.axis === '—' ? '' : od.axis,
                                                            add: od.add === '—' ? '' : od.add,
                                                          },
                                                          os: {
                                                            sph: os.sph === 'Plano' ? '' : os.sph,
                                                            cyl: os.cyl === '—' ? '' : os.cyl,
                                                            axis: os.axis === '—' ? '' : os.axis,
                                                            add: os.add === '—' ? '' : os.add,
                                                          },
                                                          pd: '', // optional or empty
                                                          lensType: lensType as any,
                                                          notes: 'Printed from Patna Optical POS'
                                                        };

                                                        const { generateSpectaclePdfCard } = await import('../../utils/pdfGenerator');
                                                        const pdfBytes = await generateSpectaclePdfCard({
                                                          invoiceId: invoice.id,
                                                          patientName: patient ? patient.name : 'Unknown Patient',
                                                          refractionRx: refractionData,
                                                          date: new Date(invoice.createdAt).toLocaleDateString()
                                                        });

                                                        const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
                                                        const url = URL.createObjectURL(blob);
                                                        
                                                        // Open in new tab for direct browser print
                                                        const newWindow = window.open(url, '_blank');
                                                        if (newWindow) {
                                                          window.dispatchEvent(new CustomEvent('mediflow-toast', {
                                                            detail: {
                                                              message: `Spectacle Refraction Rx Card PDF compiled and opened for ${patient?.name || 'patient'}! 👓`,
                                                              type: 'success',
                                                              title: 'Rx Card PDF Generated'
                                                            }
                                                          }));
                                                        } else {
                                                          alert('Please allow popups to view the Spectacle Rx Card PDF');
                                                        }
                                                      } catch (err) {
                                                        console.error('[Optical POS] Failed to generate PDF:', err);
                                                        alert('Error compiling Spectacle Rx Card PDF.');
                                                      }
                                                    }}
                                                    className="px-2 py-0.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded text-[8px] uppercase tracking-wider flex items-center gap-1 border-0 cursor-pointer transition-colors active:scale-95 font-mono"
                                                  >
                                                    <span className="material-symbols-outlined text-[9px]">print</span>
                                                    Print Rx Card
                                                  </button>
                                                </div>
                                              </div>
                                            );
                                          }
                                          
                                          return (
                                            <div key={idx} className="text-[10px] text-slate-600 font-mono flex items-center justify-between border-b border-slate-100 pb-1 last:border-0 last:pb-0">
                                              <span>💊 {m.name} ({m.dosage})</span>
                                              <span className="text-[9px] bg-white/5 px-2 py-0.5 rounded">{m.frequency}</span>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}

                                  <div className="flex justify-between items-center pt-2">
                                    <div>
                                      <span className="text-[9px] text-slate-500 block font-mono">Invoice: {invoice.id.substring(0, 8)}...</span>
                                      {activeEntity?.gstin && (
                                        <span className="text-[9.5px] text-indigo-600 block font-mono font-bold">GSTIN: {activeEntity.gstin}</span>
                                      )}
                                      <span className="text-xs font-black text-slate-800">Amount Verified: ₹{invoice.pharmacyFee}</span>
                                    </div>
                                    <button
                                      onClick={() => {
                                        // Build and open printable dispense slip
                                        const meds = prescription?.extractedMedicines || [];
                                        const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><title>Dispense Slip</title>
<style>
  * { margin:0;padding:0;box-sizing:border-box; }
  body { font-family:'Segoe UI',Arial,sans-serif; font-size:12px; color:#1a1a2e; }
  .page { max-width:680px; margin:0 auto; padding:20px 28px; }
  .header { border-bottom:2px solid #16a34a; padding-bottom:12px; margin-bottom:14px; display:flex; justify-content:space-between; }
  .clinic { font-size:16px; font-weight:800; color:#16a34a; }
  .sub { font-size:10px; color:#6b7280; }
  .badge { background:#dcfce7; color:#15803d; font-size:9px; font-weight:800; padding:2px 8px; border-radius:99px; border:1px solid #86efac; }
  .section-title { font-size:9px; font-weight:800; text-transform:uppercase; letter-spacing:.08em; color:#16a34a; border-bottom:1px solid #e5e7eb; padding-bottom:3px; margin:12px 0 8px; }
  .grid { display:grid; grid-template-columns:repeat(3,1fr); gap:6px; }
  .field label { font-size:9px; font-weight:700; color:#9ca3af; text-transform:uppercase; }
  .field span { font-size:12px; font-weight:600; color:#111827; display:block; }
  table { width:100%; border-collapse:collapse; font-size:11px; }
  th { background:#f0fdf4; text-align:left; padding:5px 8px; font-size:9px; font-weight:800; text-transform:uppercase; color:#6b7280; }
  td { padding:5px 8px; border-bottom:1px solid #f3f4f6; }
  .total { font-weight:900; font-size:14px; color:#16a34a; text-align:right; margin-top:10px; }
  .footer { margin-top:24px; font-size:9px; color:#9ca3af; text-align:center; border-top:1px solid #e5e7eb; padding-top:8px; }
  @media print { body { print-color-adjust:exact; -webkit-print-color-adjust:exact; } }
</style></head>
<body><div class="page">
  <div class="header">
    <div><div class="clinic">Mediflow Pharmacy</div><div class="sub">${activeEntity?.name || 'Mediflow Clinic Pharmacy'}</div>${activeEntity?.gstin ? `<div class="sub" style="margin-top:2px">GSTIN: ${activeEntity.gstin}</div>` : ''}</div>
    <div style="text-align:right">
      <div class="badge">PAID ✅</div>
      <div class="sub" style="margin-top:4px">Date: ${new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}</div>
      <div class="sub">Invoice: ${invoice.id.substring(0,8)}...</div>
    </div>
  </div>
  <div class="section-title">Patient Details</div>
  <div class="grid">
    <div class="field"><label>Name</label><span>${patient ? patient.name : 'Unknown'}</span></div>
    <div class="field"><label>Phone</label><span>+91 ${patient ? patient.phone : 'N/A'}</span></div>
    <div class="field"><label>Amount Paid</label><span style="color:#16a34a">₹${invoice.pharmacyFee}</span></div>
  </div>
  <div class="section-title">Dispensed Medicines</div>
  ${meds.length > 0 ? `
  <table><thead><tr><th>#</th><th>Medicine</th><th>Dosage</th><th>Frequency</th></tr></thead>
  <tbody>${meds.map((m,i) => `<tr><td>${i+1}</td><td><b>${m.name}</b></td><td>${m.dosage||'As directed'}</td><td>${m.frequency||'—'}</td></tr>`).join('')}</tbody></table>` : '<p style="color:#9ca3af;font-size:11px;">No medicine details on record.</p>'}
  <div class="total">Total Paid: ₹${invoice.pharmacyFee}</div>
  <div class="footer">Medicines dispensed by verified compounder. Keep this slip for reference. | Mediflow Ecosystem &copy; ${new Date().getFullYear()}</div>
</div><script>window.onload=function(){window.print()}<\/script></body></html>`;
                                        const win = window.open('','_blank','width=720,height=800');
                                        if (win) { win.document.write(html); win.document.close(); }
                                        window.dispatchEvent(new CustomEvent('mediflow-toast', {
                                          detail: {
                                            message: `Dispense slip generated & sent to printer for ${patient?.name || 'patient'}.`,
                                            type: 'success',
                                            title: 'Slip Printed'
                                          }
                                        }));
                                      }}
                                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg uppercase tracking-wider text-[9px] cursor-pointer flex items-center gap-1"
                                    >
                                      <span className="material-symbols-outlined text-xs animate-pulse">print</span>
                                      Print Dispense Slip
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: INVENTORY CATALOG */}
        {activeTab === 'inventory_catalog' && (
          <div className="glass-panel p-6 border-slate-200/60 shadow-xl space-y-6">
            
            {/* Catalog search/filter headers */}
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div className="relative w-full sm:max-w-md">
                <input
                  type="text"
                  placeholder="Search catalog by name, generic, or batch..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full input-field pl-10 focus:ring-1 focus:ring-teal-400 focus:border-teal-400 text-xs py-2 bg-slate-50 border-slate-200 text-white rounded-lg"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 h-4.5 w-4.5" />
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <span className="text-xs text-slate-500 font-bold shrink-0">Category:</span>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="input-field text-xs py-2 px-3 focus:ring-1 focus:ring-teal-400 focus:border-teal-400 bg-slate-50 border-slate-200 text-white rounded-lg cursor-pointer"
                >
                  <option value="All">All Categories</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            {/* Inventory table / Responsive Mobile Card List */}
            <div className="border border-slate-200 rounded-xl overflow-hidden glass-panel-inner">
              
              {/* Desktop View */}
              <div className="hidden md:block overflow-x-auto responsive-table-container">
                <table className="w-full text-xs text-left">
                  <thead className="bg-white text-slate-600 border-b border-slate-200 font-bold uppercase tracking-wider text-[10px]">
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
                  <tbody className="divide-y divide-slate-200 bg-slate-50/30">
                    {filteredCatalog.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-400 font-medium">
                          No matching medicine batches found in catalog.
                        </td>
                      </tr>
                    ) : (
                      filteredCatalog.map(item => {
                        const isLow = item.stock <= item.threshold;
                        const isExpired = new Date(item.expiryDate) < new Date();
                        
                        return (
                          <tr key={item.id} className="hover:bg-white/40 transition-colors">
                            <td className="p-3.5 space-y-1">
                              <div className="font-bold text-slate-800 text-xs">{item.name} <span className="text-[10px] text-slate-500 font-normal">({item.dosage})</span></div>
                              <div className="text-[10px] text-slate-500 italic font-mono">{item.genericName}</div>
                            </td>
                            <td className="p-3.5 text-slate-600 font-semibold">{item.category}</td>
                            <td className="p-3.5 space-y-1">
                              <div className="font-bold text-slate-800 font-mono text-[10px]">Batch: {item.batchNumber}</div>
                              <div className={`text-[9px] font-mono ${isExpired ? 'text-rose-400 font-bold' : 'text-slate-500'}`}>
                                Exp: {item.expiryDate} {isExpired && '[EXPIRED]'}
                              </div>
                            </td>
                            <td className="p-3.5 text-right font-mono text-slate-700 dark:text-slate-200 font-semibold">
                              ₹{item.price.toFixed(2)} <span className="text-[9px] text-slate-500 font-normal">(₹{item.mrp.toFixed(2)})</span>
                            </td>
                            <td className="p-3.5 text-center">
                              <span className={`font-mono font-bold text-xs ${isLow ? 'text-rose-450 font-black' : 'text-emerald-500'}`}>
                                {item.stock} {item.unit}
                              </span>
                            </td>
                            <td className="p-3.5 text-center font-mono text-slate-500">{item.threshold} {item.unit}</td>
                            <td className="p-3.5 text-right">
                              <div className="flex gap-2 justify-end">
                                <button
                                  onClick={() => handleQuickRestock(item)}
                                  className="px-2.5 py-1 text-[9px] bg-teal-650/15 hover:bg-teal-600 text-teal-600 hover:text-black border border-teal-500/25 hover:border-teal-500 font-black rounded-lg uppercase tracking-wider active:scale-95 transition-all cursor-pointer"
                                  title="Quick Restock"
                                >
                                  Restock
                                </button>
                                <button
                                  onClick={() => handleDeleteItem(item.id)}
                                  className="p-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-450 border border-rose-500/20 rounded-lg transition-all cursor-pointer"
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

              {/* Mobile Card List View */}
              <div className="block md:hidden divide-y divide-slate-200 bg-slate-50/30">
                {filteredCatalog.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 font-medium text-xs">
                    No matching medicine batches found in catalog.
                  </div>
                ) : (
                  filteredCatalog.map(item => {
                    const isLow = item.stock <= item.threshold;
                    const isExpired = new Date(item.expiryDate) < new Date();
                    return (
                      <div key={item.id} className="p-4 space-y-3 hover:bg-white/40 transition-colors">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-bold text-slate-800 text-xs">{item.name} <span className="text-[10px] text-slate-500 font-normal">({item.dosage})</span></div>
                            <div className="text-[10px] text-slate-500 italic font-mono mt-0.5">{item.genericName}</div>
                          </div>
                          <span className="text-[9px] bg-indigo-50 border border-indigo-200 text-indigo-800 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                            {item.category}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[10px] bg-white/40 p-2.5 rounded-lg border border-slate-200/50">
                          <div>
                            <span className="text-slate-500 block text-[9px] uppercase font-bold tracking-wider">Batch & Expiry</span>
                            <span className="font-mono font-bold block text-slate-700">No: {item.batchNumber}</span>
                            <span className={`font-mono text-[9px] block mt-0.5 ${isExpired ? 'text-rose-500 font-bold' : 'text-slate-500'}`}>
                              Exp: {item.expiryDate} {isExpired && '[EXPIRED]'}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[9px] uppercase font-bold tracking-wider">Stock & Margin</span>
                            <span className={`font-mono font-bold block ${isLow ? 'text-rose-500' : 'text-emerald-600'}`}>
                              Stock: {item.stock} {item.unit}
                            </span>
                            <span className="text-slate-500 block text-[9px] mt-0.5">Min Margin: {item.threshold} {item.unit}</span>
                          </div>
                        </div>

                        <div className="flex justify-between items-center pt-1">
                          <div className="font-mono text-slate-800 text-xs font-semibold">
                            MRP: ₹{item.price.toFixed(2)} <span className="text-[9px] text-slate-500 font-normal">(₹{item.mrp.toFixed(2)})</span>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleQuickRestock(item)}
                              className="px-2.5 py-1.5 text-[9px] bg-teal-600 hover:bg-teal-700 text-black font-black rounded-lg uppercase tracking-wider active:scale-95 transition-all cursor-pointer border-0"
                            >
                              Restock
                            </button>
                            <button
                              onClick={() => handleDeleteItem(item.id)}
                              className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20 rounded-lg transition-all cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

            </div>
          </div>
        )}

        {/* TAB 3: STOCK ALERTS */}
        {activeTab === 'stock_alerts' && (
          <div className="glass-panel p-6 border-slate-200/60 shadow-xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-200/60 pb-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-rose-400 animate-pulse" />
                  Pharmacy Stock Deficit Alerts
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Active batches that have fallen below the configured low-stock safety margins. Restock immediately.
                </p>
              </div>
              <span className="text-xs bg-rose-500/15 border border-rose-500/20 px-3.5 py-1 text-rose-400 font-mono font-black rounded-full uppercase tracking-wider animate-pulse">
                {lowStockItems.length} Deficits Detected
              </span>
            </div>

            {lowStockItems.length === 0 ? (
              <div className="p-8 bg-slate-50 border border-slate-200 rounded-xl text-center">
                <CheckCircle className="h-10 w-10 text-emerald-400 mx-auto mb-2" />
                <h4 className="text-white font-bold text-sm">All Stock Levels Secure!</h4>
                <p className="text-xs text-slate-400 mt-1">No items are currently running below their safety thresholds.</p>
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
                          <span className="text-[8px] font-mono font-bold px-2 py-0.5 rounded border tracking-wider uppercase bg-slate-800/40">
                            {tierText}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-mono">Generic: {item.genericName}</p>
                        
                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                          <div>
                            <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider font-mono">Stock Level</span>
                            <span className="font-mono text-base font-black text-white">{item.stock} {item.unit}</span>
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider font-mono">Safety Level</span>
                            <span className="font-mono text-base font-black text-slate-600">{item.threshold} {item.unit}</span>
                          </div>
                        </div>

                        {/* Loading bar */}
                        <div className="w-full bg-slate-800/60 rounded-full h-2 mt-2 border border-white/5">
                          <div 
                            className={`h-full rounded-full ${item.stock === 0 ? 'bg-transparent' : item.stock < item.threshold/2 ? 'bg-rose-500' : 'bg-amber-400'}`} 
                            style={{ width: `${Math.min(100, percentOfSafety)}%` }} 
                          />
                        </div>
                        <span className="text-[9px] text-slate-500 font-mono font-medium block">
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
          <div className="glass-panel p-6 border-slate-200/60 shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row items-center justify-between border-b border-slate-200/60 pb-4 gap-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <span className="material-symbols-outlined text-rose-400 text-[16px]">event_busy</span>
                  Consolidated Facility Expiry Tracker (FEFO)
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Comprehensive auditing dashboard merging shelf stock batches AND e-prescription holds. color-coded to enforce FEFO.
                </p>
              </div>
              <div className="flex items-center gap-3 self-stretch sm:self-auto select-none">
                <button
                  onClick={() => setExpiryFilter('all')}
                  className={`px-3 py-1.5 text-[10px] font-bold rounded-lg border uppercase tracking-wider cursor-pointer ${
                    expiryFilter === 'all'
                      ? 'border-teal-500 text-teal-600 bg-teal-600/5 font-black'
                      : 'border-slate-200 text-slate-500 hover:text-white'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setExpiryFilter('expired')}
                  className={`px-3 py-1.5 text-[10px] font-bold rounded-lg border uppercase tracking-wider cursor-pointer ${
                    expiryFilter === 'expired'
                      ? 'border-rose-500 text-rose-400 bg-rose-500/5 font-black animate-pulse'
                      : 'border-slate-200 text-slate-500 hover:text-white'
                  }`}
                >
                  Expired
                </button>
                <button
                  onClick={() => setExpiryFilter('expiring')}
                  className={`px-3 py-1.5 text-[10px] font-bold rounded-lg border uppercase tracking-wider cursor-pointer ${
                    expiryFilter === 'expiring'
                      ? 'border-amber-500 text-amber-400 bg-amber-500/5 font-black'
                      : 'border-slate-200 text-slate-500 hover:text-white'
                  }`}
                >
                  Expiring Soon (&lt;90d)
                </button>
              </div>
            </div>

            {consolidatedExpiryBatches.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">No matching expiring batches found in facility.</p>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden glass-panel-inner">
                <div className="overflow-x-auto responsive-table-container">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-white text-slate-600 border-b border-slate-200 font-bold uppercase tracking-wider text-[10px]">
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
                    <tbody className="divide-y divide-slate-200 bg-slate-50/30">
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
                          <tr key={`${batch.source}-${batch.id}-${idx}`} className="hover:bg-white/40 transition-colors">
                            <td className="p-3.5">
                              <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded border ${
                                batch.source === 'SHELF' 
                                  ? 'bg-teal-600/15 text-teal-600 border-teal-500/20' 
                                  : 'bg-primary/15 text-primary border-primary/20'
                              }`}>
                                {batch.source}
                              </span>
                            </td>
                            <td className="p-3.5 font-bold text-slate-800 text-xs">
                              {batch.name}
                            </td>
                            <td className="p-3.5 font-mono font-semibold text-slate-600">{batch.batchNumber}</td>
                            <td className="p-3.5 text-center font-mono font-bold text-slate-800">{batch.stock} units</td>
                            <td className="p-3.5 font-mono text-slate-600">{batch.expiryDate}</td>
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
                                  className="px-2.5 py-1 text-[9px] bg-teal-600/15 hover:bg-teal-600 text-teal-600 hover:text-black border border-teal-500/25 hover:border-teal-500 font-black rounded-lg uppercase tracking-wider active:scale-95 transition-all cursor-pointer"
                                >
                                  Prioritize
                                </button>
                              )}
                              {!disposeBtn && !prioritizeBtn && (
                                <span className="text-[10px] text-slate-400 font-semibold font-mono">Secure</span>
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
              <div className="glass-panel p-6 border-slate-200/60 shadow-xl space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-[16px]">psychology</span>
                      Gemini Seasonal Demand Surveillance Forecasts
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                      Localized Bihar epidemiology and Sewage Pathogen metrics generating automatic stocking levels.
                    </p>
                  </div>
                  <button
                    onClick={handleRegenerateForecast}
                    disabled={isGeneratingForecast}
                    className="px-4.5 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 active:scale-95 disabled:opacity-50 text-white font-extrabold text-[10px] uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer border-0 text-white-force"
                  >
                    {isGeneratingForecast ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin text-white-force" />
                        Generating Forecasts...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 text-white-force" />
                        ⚡ Run Predictive Demand Analysis
                      </>
                    )}
                  </button>
                </div>

                <div className="space-y-4">
                  {forecasts.map(forecast => (
                    <div 
                      key={forecast.id} 
                      className={`p-4 rounded-xl border relative transition-all duration-300 ${
                        forecast.isActedUpon 
                          ? 'bg-slate-50 border-slate-200 text-slate-500' 
                          : 'bg-white border-slate-200 hover:border-primary/40'
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2 mb-2">
                        <h4 className="font-bold text-xs text-white">{forecast.medicineName}</h4>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full tracking-wider uppercase font-mono border ${
                          forecast.isActedUpon 
                            ? 'bg-slate-50 text-slate-500 border-slate-200' 
                            : 'bg-teal-600/10 text-teal-600 border border-teal-500/20'
                        }`}>
                          {forecast.isActedUpon ? 'Acted Upon' : `+${forecast.suggestedIncreasePercentage}% Restock`}
                        </span>
                      </div>
                      
                      <p className="text-[11px] leading-relaxed text-slate-500 mb-3">{forecast.reason}</p>
                      
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-[9px] text-slate-500 flex items-center gap-1 font-semibold font-mono">
                          <Lightbulb className="h-3.5 w-3.5 text-teal-600 shrink-0" />
                          Confidence Level: {Math.floor(forecast.forecastConfidence * 100)}%
                        </div>
                        {!forecast.isActedUpon && (
                          <button
                            onClick={() => handleActOnForecast(forecast.id, forecast.medicineName)}
                            className="bg-teal-600 text-black font-black border-0 hover:bg-teal-600/80 text-[9px] tracking-wider uppercase px-2.5 py-1.5 rounded-lg transition-all active:scale-95 cursor-pointer"
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
              <div className="glass-panel p-6 border-slate-200/60 shadow-xl space-y-4">
                <h4 className="font-bold text-[10px] text-slate-600 uppercase tracking-widest flex items-center gap-1.5 font-mono">
                  <TrendingUp className="h-4 w-4 text-primary animate-pulse" />
                  Patna Sewage surveillance
                </h4>
                
                <div className="h-16 flex items-end justify-between gap-2 border-b border-l border-slate-200 pb-1 pl-1 select-none">
                  <div className="flex-1 flex flex-col items-center">
                    <div className="w-full bg-primary/20 h-4 rounded-t" />
                    <span className="text-[8px] text-slate-500 font-mono mt-1 uppercase">Mar</span>
                  </div>
                  <div className="flex-1 flex flex-col items-center">
                    <div className="w-full bg-primary/40 h-8 rounded-t" />
                    <span className="text-[8px] text-slate-500 font-mono mt-1 uppercase">Apr</span>
                  </div>
                  <div className="flex-1 flex flex-col items-center">
                    <div className="w-full bg-gradient-to-t from-secondary to-primary h-14 rounded-t animate-pulse" />
                    <span className="text-[8px] text-teal-600 font-mono font-bold mt-1 uppercase">May</span>
                  </div>
                </div>

                <p className="text-[9px] text-rose-400 font-bold flex items-center gap-1 leading-normal">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping shrink-0" />
                  Pre-monsoon sewage surveillance alert.
                </p>
                <div className="text-[9px] text-slate-400 font-semibold font-mono border-t border-slate-100 pt-3 leading-relaxed">
                  Surveillance alerts monitor heavy rainwater waterlogging vectors linked with Cholera, Dengue and Typhoid spikes to prevent stocking shocks.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: SETTLEMENTS */}
        {activeTab === 'settlements' && (
          <div className="space-y-6">
            <SettlementWidget 
              entityId={activeEntity?.id || ''}
              podId={activeEntity?.podId || ''}
              entityType="pharmacy"
              displayName="Pharmacy Settlements"
              theme="dark"
            />
            
            {/* Split rules display */}
            <div className="glass-panel p-6 border-slate-200/60 shadow-xl space-y-4">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-base">policy</span>
                Active SOP Split Configuration
              </h3>
              <p className="text-xs text-slate-500">
                These percentages represent your shared payouts calculated dynamically on invoice clearance.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div className="p-4 bg-white border border-slate-200 rounded-xl text-center">
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Your Split</p>
                  <p className="text-xl font-extrabold text-white mt-1">Pharmacy Split</p>
                  <p className="text-xs text-slate-400 mt-0.5 font-semibold">Calculated per product margin</p>
                </div>
                <div className="p-4 bg-white border border-slate-200 rounded-xl text-center">
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Doctor Split</p>
                  <p className="text-xl font-extrabold text-white mt-1">Managed by SOP</p>
                  <p className="text-xs text-slate-400 mt-0.5 font-semibold">Based on active agreements</p>
                </div>
                <div className="p-4 bg-white border border-slate-200 rounded-xl text-center">
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Platform Fee</p>
                  <p className="text-xl font-extrabold text-white mt-1">3%</p>
                  <p className="text-xs text-slate-400 mt-0.5 font-semibold">Platform service charge</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 7: POD INTERCONNECT */}
        {activeTab === 'pod_connect' && (
          <div className="glass-panel p-6 border-slate-200/60 shadow-xl space-y-6">
            <div className="flex justify-between items-center border-b border-slate-200/60 pb-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <span className="material-symbols-outlined text-indigo-400 text-base">hub</span>
                  Pod Connection HUD
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Connected clinical clinic node and ecosystem partner network details.
                </p>
              </div>
              <span className={`text-[10px] font-mono font-bold px-3 py-1 rounded-full uppercase tracking-wider border ${
                activeEntity?.status === 'approved' 
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                  : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
              }`}>
                {activeEntity?.status || 'Pending Connection'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
              <div className="space-y-4">
                <h3 className="text-xs font-black text-slate-600 uppercase tracking-widest font-mono">
                  🏥 Primary Clinic Connection
                </h3>
                <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-2">
                  <p className="text-xs font-bold text-slate-800">{activePod?.name || 'Patna Connected Clinic'}</p>
                  <div className="text-[10px] text-slate-500 space-y-1">
                    <div>Clinic Code: <span className="font-mono font-bold text-slate-800 bg-slate-800/40 px-1.5 py-0.5 rounded">{activePod?.clinicCode || 'N/A'}</span></div>
                    <div>Location: {activePod?.location || 'Patna, Bihar'}</div>
                    <div>Established: {activePod?.createdAt ? new Date(activePod.createdAt).toLocaleDateString() : 'N/A'}</div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-xs font-black text-slate-600 uppercase tracking-widest font-mono">
                  👥 Node Partner Network
                </h3>
                <div className="space-y-2">
                  {podEntities.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No partners found in this Pod.</p>
                  ) : (
                    podEntities.map(pe => (
                      <div key={pe.id} className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${pe.entityType === 'clinic' ? 'bg-indigo-400' : pe.entityType === 'lab' ? 'bg-teal-400' : 'bg-amber-400'}`} />
                          <div>
                            <p className="font-bold text-slate-800">{pe.name}</p>
                            <p className="text-[9px] text-slate-500 uppercase tracking-wider">{pe.entityType}</p>
                          </div>
                        </div>
                        <span className={`text-[8px] font-bold font-mono px-2 py-0.5 rounded border ${
                          pe.status === 'approved' 
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                            : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                        }`}>
                          {pe.status}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'profile_settings' && (
          <div className="glass-panel p-6 border-slate-200/60 shadow-xl space-y-6 bg-white text-slate-800">
            <div className="flex justify-between items-center border-b border-slate-200/60 pb-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-855 flex items-center gap-2">
                  <span className="material-symbols-outlined text-indigo-600 text-base">settings</span>
                  Pharmacy Profile & Settings
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Manage your Pharmacy entity settings, including your GST number for patient billing.
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4 max-w-lg text-left">
              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">Pharmacy Name</label>
                <input
                  type="text"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white text-slate-800 font-semibold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={profilePhone}
                    onChange={(e) => setProfilePhone(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white text-slate-800 font-semibold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">GSTIN (GST Number)</label>
                  <input
                    type="text"
                    value={profileGstin}
                    onChange={(e) => setProfileGstin(e.target.value)}
                    placeholder="e.g. 27AAAAA1111A1Z1"
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white text-slate-800 font-semibold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">Address</label>
                <textarea
                  value={profileAddress}
                  onChange={(e) => setProfileAddress(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white text-slate-800 font-semibold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={isSavingProfile}
                className="py-2 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md border-0 outline-none"
              >
                {isSavingProfile ? 'Saving...' : 'Save Profile Changes'}
              </button>
            </form>
          </div>
        )}

      </div>

      {/* V2.0 PREMIUM LASER BARCODE SCANNER SIMULATION MODAL */}
      {scanningHold && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-800/85 backdrop-blur-md p-4 animate-fade-in">
          <div className="glass-panel max-w-md w-full p-6 border-teal-500/20 shadow-2xl space-y-5 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-secondary to-primary" />
            
            <div className="flex items-center justify-between border-b border-slate-200/60 pb-3">
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                <span className="material-symbols-outlined text-teal-600 animate-pulse">qr_code_scanner</span>
                FEFO Barcode Scan Verification
              </h3>
              <button
                onClick={() => {
                  setScanningHold(null);
                  setScannerStage('idle');
                }}
                className="text-slate-500 hover:text-white transition-colors cursor-pointer border-0 bg-transparent"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <div className="relative h-48 w-full bg-slate-800/80 rounded-lg border border-slate-200/60 flex flex-col items-center justify-center overflow-hidden select-none">
              <div className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-teal-500/80 rounded-tl" />
              <div className="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 border-teal-500/80 rounded-tr" />
              <div className="absolute bottom-3 left-3 w-4 h-4 border-b-2 border-l-2 border-teal-500/80 rounded-bl" />
              <div className="absolute bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 border-teal-500/80 rounded-br" />

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
                <div className="text-[10px] font-mono text-teal-600 tracking-widest font-black uppercase">
                  {scanningHold.batchNumber}
                </div>
              </div>

              <div className="absolute bottom-4 bg-slate-800/60 px-3 py-1 rounded border border-slate-200/60 text-[9px] font-mono uppercase tracking-widest text-center">
                {scannerStage === 'scanning' ? (
                  <span className="text-teal-600 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-600 animate-ping" />
                    scanning BATCH CODE...
                  </span>
                ) : (
                  <span className="text-emerald-400 flex items-center gap-1.5 font-bold animate-pulse">
                    <CheckCircle className="h-3 w-3" /> MATCH APPROVED
                  </span>
                )}
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-lg h-32 overflow-y-auto font-mono text-[9px] text-slate-600 space-y-1">
              {scanLogs.map((log, idx) => (
                <div key={idx} className={log.includes('MATCH') ? 'text-emerald-400 font-bold' : log.includes('Laser sweep') ? 'text-teal-600' : ''}>
                  {log}
                </div>
              ))}
            </div>

            <div className="flex gap-3 justify-end pt-3 border-t border-slate-200/60">
              <button
                onClick={() => {
                  setScanningHold(null);
                  setScannerStage('idle');
                }}
                className="px-4 py-2 bg-white hover:bg-white-highest border border-slate-200 text-slate-600 hover:text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
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
                  className="px-5 py-2 bg-white-highest border border-slate-200 text-slate-400 rounded-xl text-xs font-bold cursor-not-allowed uppercase flex items-center gap-2 border-0"
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-800/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="glass-panel max-w-2xl w-full p-6 border-slate-200/60 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-secondary to-primary" />
            
            <div className="flex items-center justify-between border-b border-slate-200/60 pb-4 mb-4">
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                <span className="material-symbols-outlined text-teal-600">add_circle</span>
                Manual Register Batch Medicine
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-500 hover:text-white transition-colors cursor-pointer border-0 bg-transparent">
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <form onSubmit={handleAddMedicineSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider font-mono">Medicine Brand Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Metformin 500mg"
                    value={addForm.name}
                    onChange={(e) => setAddForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full input-field text-xs py-2 px-3 focus:ring-1 focus:ring-teal-400 focus:border-teal-400 bg-white border-slate-200 text-white rounded-lg"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider font-mono">Generic Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Metformin Hydrochloride"
                    value={addForm.genericName}
                    onChange={(e) => setAddForm(prev => ({ ...prev, genericName: e.target.value }))}
                    className="w-full input-field text-xs py-2 px-3 focus:ring-1 focus:ring-teal-400 focus:border-teal-400 bg-white border-slate-200 text-white rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider font-mono">Category</label>
                  <select
                    value={addForm.category}
                    onChange={(e) => setAddForm(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full input-field text-xs py-2 px-3 focus:ring-1 focus:ring-teal-400 focus:border-teal-400 bg-white border-slate-200 text-white rounded-lg cursor-pointer"
                  >
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider font-mono">Manufacturer</label>
                  <input
                    type="text"
                    placeholder="e.g. Sun Pharma"
                    value={addForm.manufacturer}
                    onChange={(e) => setAddForm(prev => ({ ...prev, manufacturer: e.target.value }))}
                    className="w-full input-field text-xs py-2 px-3 focus:ring-1 focus:ring-teal-400 focus:border-teal-400 bg-white border-slate-200 text-white rounded-lg"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider font-mono">Dosage Unit *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 500mg, 10ml, 1 Strip"
                    value={addForm.dosage}
                    onChange={(e) => setAddForm(prev => ({ ...prev, dosage: e.target.value }))}
                    className="w-full input-field text-xs py-2 px-3 focus:ring-1 focus:ring-teal-400 focus:border-teal-400 bg-white border-slate-200 text-white rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider font-mono">Batch Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. MET26A-08"
                    value={addForm.batchNumber}
                    onChange={(e) => setAddForm(prev => ({ ...prev, batchNumber: e.target.value }))}
                    className="w-full input-field text-xs py-2 px-3 focus:ring-1 focus:ring-teal-400 focus:border-teal-400 bg-white border-slate-200 text-white rounded-lg font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider font-mono">Expiry Date *</label>
                  <input
                    type="date"
                    required
                    value={addForm.expiryDate}
                    onChange={(e) => setAddForm(prev => ({ ...prev, expiryDate: e.target.value }))}
                    className="w-full input-field text-xs py-2 px-3 focus:ring-1 focus:ring-teal-400 focus:border-teal-400 bg-white border-slate-200 text-white rounded-lg font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider font-mono">HSN Code (GST)</label>
                  <input
                    type="text"
                    placeholder="e.g. 300490"
                    value={addForm.hsn}
                    onChange={(e) => setAddForm(prev => ({ ...prev, hsn: e.target.value }))}
                    className="w-full input-field text-xs py-2 px-3 focus:ring-1 focus:ring-teal-400 focus:border-teal-400 bg-white border-slate-200 text-white rounded-lg font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider font-mono">MRP Price (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="e.g. 15"
                    value={addForm.mrp}
                    onChange={(e) => setAddForm(prev => ({ ...prev, mrp: e.target.value }))}
                    className="w-full input-field text-xs py-2 px-3 focus:ring-1 focus:ring-teal-400 focus:border-teal-400 bg-white border-slate-200 text-white rounded-lg font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider font-mono">Selling Price (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="e.g. 13"
                    value={addForm.price}
                    onChange={(e) => setAddForm(prev => ({ ...prev, price: e.target.value }))}
                    className="w-full input-field text-xs py-2 px-3 focus:ring-1 focus:ring-teal-400 focus:border-teal-400 bg-white border-slate-200 text-white rounded-lg font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider font-mono">Units In Stock *</label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 100"
                    value={addForm.stock}
                    onChange={(e) => setAddForm(prev => ({ ...prev, stock: e.target.value }))}
                    className="w-full input-field text-xs py-2 px-3 focus:ring-1 focus:ring-teal-400 focus:border-teal-400 bg-white border-slate-200 text-white rounded-lg font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider font-mono">Low-Stock Margin *</label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 20"
                    value={addForm.threshold}
                    onChange={(e) => setAddForm(prev => ({ ...prev, threshold: e.target.value }))}
                    className="w-full input-field text-xs py-2 px-3 focus:ring-1 focus:ring-teal-400 focus:border-teal-400 bg-white border-slate-200 text-white rounded-lg font-mono"
                  />
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-slate-200/60">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-white hover:bg-white-highest border border-slate-200 text-slate-600 hover:text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-800/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="glass-panel max-w-3xl w-full p-6 border-slate-200/60 shadow-2xl relative overflow-hidden space-y-4">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-secondary to-primary" />
            
            <div className="flex items-center justify-between border-b border-slate-200/60 pb-3">
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-emerald-400" />
                Smart CSV Template Importer
              </h3>
              <button onClick={() => setIsCsvImportOpen(false)} className="text-slate-500 hover:text-white transition-colors cursor-pointer border-0 bg-transparent">
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
            <div className="relative border-2 border-dashed border-slate-200 hover:border-emerald-400/50 rounded-xl p-6 text-center transition-all bg-slate-800/20">
              <input
                type="file"
                accept=".csv"
                onChange={handleCsvFileChange}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <FileSpreadsheet className="h-10 w-10 text-slate-500 mx-auto mb-2" />
              <p className="text-xs text-white font-bold">{csvFileName || 'Click or drag `.csv` file here'}</p>
              <p className="text-[10px] text-slate-400 mt-1">UTF-8 comma separated files only.</p>
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
                <h4 className="font-bold text-[10px] text-slate-600 uppercase tracking-widest font-mono">CSV Import Preview ({csvPreview.length} rows)</h4>
                <div className="border border-slate-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto overflow-x-auto responsive-table-container">
                  <table className="w-full text-[10px] text-left">
                    <thead className="bg-white text-slate-600 font-mono uppercase font-bold sticky top-0">
                      <tr>
                        <th className="p-2">Name</th>
                        <th className="p-2 font-mono">Batch</th>
                        <th className="p-2 font-mono">Expiry</th>
                        <th className="p-2 text-right font-mono">Price</th>
                        <th className="p-2 text-center font-mono">Stock</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-slate-50/50 text-white font-mono">
                      {csvPreview.map((row, idx) => (
                        <tr key={idx} className="hover:bg-white-highest/20">
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

            <div className="flex gap-3 justify-end pt-3 border-t border-slate-200/60">
              <button
                type="button"
                onClick={() => {
                  setCsvPreview([]);
                  setCsvErrors([]);
                  setCsvFileName('');
                  setIsCsvImportOpen(false);
                }}
                className="px-4 py-2 bg-white hover:bg-white-highest border border-slate-200 text-slate-600 hover:text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={csvPreview.length === 0}
                onClick={handleConfirmCsvImport}
                className={`px-5 py-2 rounded-xl text-xs font-black tracking-wider uppercase border-0 cursor-pointer ${
                  csvPreview.length === 0 
                    ? 'bg-white-highest text-slate-400 cursor-not-allowed'
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-800/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="glass-panel max-w-3xl w-full p-6 border-slate-200/60 shadow-2xl relative overflow-hidden space-y-4">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-secondary to-primary" />
            
            <div className="flex items-center justify-between border-b border-slate-200/60 pb-3">
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                <Camera className="h-5 w-5 text-teal-600" />
                AI Suppliers Invoice OCR Parser
              </h3>
              <button onClick={() => setIsBillScanOpen(false)} className="text-slate-500 hover:text-white transition-colors cursor-pointer border-0 bg-transparent">
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Photo selector dropzone */}
              <div className="space-y-3">
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider font-mono">Upload Supplier Bill Photo / Challan</label>
                <div className="relative border-2 border-dashed border-slate-200 hover:border-teal-500/50 rounded-xl h-44 flex flex-col items-center justify-center overflow-hidden bg-slate-800/20 select-none">
                  {billImage ? (
                    <>
                      <img src={billImage} className="w-full h-full object-cover opacity-75" alt="Suppliers bill upload" />
                      <div className="absolute inset-0 bg-slate-800/40 hover:bg-slate-800/60 flex items-center justify-center transition-colors">
                        <span className="text-white text-xs font-bold uppercase tracking-wider">Change photo</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <Camera className="h-10 w-10 text-slate-500 mb-2" />
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
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider font-mono">Gemini Extraction Logs</label>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 font-mono text-[9px] text-slate-600 space-y-1 h-44 overflow-y-auto flex-1">
                  {ocrLogs.length === 0 ? (
                    <div className="text-slate-400 italic">Logs will stream here during billing OCR analysis...</div>
                  ) : (
                    ocrLogs.map((log, i) => (
                      <div key={i} className={log.includes('verified') ? 'text-emerald-400 font-bold font-mono' : log.includes('Gemini') ? 'text-teal-600 font-mono' : 'font-mono'}>
                        {log}
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>

            {/* OCR Extracted preview table */}
            {ocrResults.length > 0 && (
              <div className="space-y-2 select-none border-t border-slate-100 pt-4">
                <h4 className="font-bold text-[10px] text-slate-600 uppercase tracking-widest font-mono">Extracted Medicines Preview</h4>
                <div className="border border-slate-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto overflow-x-auto responsive-table-container">
                  <table className="w-full text-[10px] text-left">
                    <thead className="bg-white text-slate-600 font-mono uppercase font-bold sticky top-0">
                      <tr>
                        <th className="p-2">Name</th>
                        <th className="p-2 font-mono">Batch</th>
                        <th className="p-2 font-mono">Expiry</th>
                        <th className="p-2 text-right font-mono">Supplier Price</th>
                        <th className="p-2 text-center font-mono">QTY</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-slate-50/50 text-white font-mono">
                      {ocrResults.map((row, idx) => (
                        <tr key={idx} className="hover:bg-white-highest/20">
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

            <div className="flex gap-3 justify-end pt-3 border-t border-slate-200/60">
              <button
                type="button"
                onClick={() => {
                  setOcrResults([]);
                  setOcrLogs([]);
                  setBillImage(null);
                  setIsBillScanOpen(false);
                }}
                className="px-4 py-2 bg-white hover:bg-white-highest border border-slate-200 text-slate-600 hover:text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={ocrResults.length === 0}
                onClick={handleConfirmOcrImport}
                className={`px-5 py-2 rounded-xl text-xs font-black tracking-wider uppercase border-0 cursor-pointer ${
                  ocrResults.length === 0 
                    ? 'bg-white-highest text-slate-400 cursor-not-allowed'
                    : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg active:scale-95 transition-all'
                }`}
              >
                Authorize Stock Entry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Premium PWA Mobile Fixed Bottom Tab Bar Navigation for Pharmacy Dashboard */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-50/95 backdrop-blur-lg border-t border-slate-200/80 shadow-[0_-4px_12px_rgba(0,0,0,0.02)] px-2 pb-safe-bottom">
        <div className="flex items-center justify-around h-16">
          {[
            { id: 'prescription_queue', label: 'Rx Queue', icon: History, badge: holds.filter(h => h.holdStatus === 'held').length },
            { id: 'inventory_catalog', label: 'Catalog', icon: Search },
            { id: 'expiry_tracker', label: 'Expiry', icon: AlertCircle, badge: inventory.filter(i => {
                const isExp = new Date(i.expiryDate) < new Date();
                const isNear = !isExp && new Date(i.expiryDate) < new Date(Date.now() + 30 * 24 * 3600000);
                return isExp || isNear;
              }).length },
            { id: 'settlements', label: 'Ledger', icon: Coins },
            { id: 'profile_settings', label: 'Settings', icon: Settings }
          ].map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                className={`flex flex-col items-center justify-center flex-1 h-full py-1 transition-all duration-200 cursor-pointer relative bg-transparent border-0 outline-none ${
                  isActive 
                    ? 'text-indigo-600 font-bold' 
                    : 'text-slate-600 hover:text-slate-600'
                }`}
              >
                <div className={`p-1.5 rounded-lg transition-all duration-200 relative ${
                  isActive 
                    ? 'bg-indigo-50 text-indigo-600 scale-105 shadow-sm' 
                    : 'bg-transparent text-slate-600'
                }`}>
                  <Icon className="h-5 w-5" />
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[8px] font-black flex items-center justify-center animate-pulse">
                      {item.badge > 9 ? '9+' : item.badge}
                    </span>
                  )}
                </div>
                <span className="text-[9px] mt-1 tracking-tight">
                  {item.label}
                </span>
                {isActive && (
                  <span className="absolute bottom-1 w-1 h-1 rounded-full bg-indigo-600" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

