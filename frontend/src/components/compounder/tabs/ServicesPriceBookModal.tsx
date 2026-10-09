import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, Search, Pill, FlaskConical, Edit3, Check, Plus, Tag, RefreshCw, 
  Sparkles, CheckCircle2, AlertCircle, TrendingUp, ShieldCheck 
} from 'lucide-react';
import { PriceBookService, type PriceBookMedicineItem } from '../../../services/priceBookService';
import type { DiagnosticTest } from '../../../types';
import { getPodContext } from '../../../services/podContext';

interface ServicesPriceBookModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ServicesPriceBookModal: React.FC<ServicesPriceBookModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'medicines' | 'labs'>('medicines');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [medicines, setMedicines] = useState<PriceBookMedicineItem[]>([]);
  const [labs, setLabs] = useState<DiagnosticTest[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editMrp, setEditMrp] = useState<number>(0);
  const [editPrice, setEditPrice] = useState<number>(0);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newMedName, setNewMedName] = useState('');
  const [newMedGeneric, setNewMedGeneric] = useState('');
  const [newMedCategory, setNewMedCategory] = useState('Antibiotic');
  const [newMedDosage, setNewMedDosage] = useState('500mg');
  const [newMedMrp, setNewMedMrp] = useState<number>(100);
  const [newMedPrice, setNewMedPrice] = useState<number>(90);

  const podId = useMemo(() => getPodContext().podId, []);

  const reloadData = () => {
    setMedicines(PriceBookService.getMedicineCatalog(podId));
    setLabs(PriceBookService.getLabCatalog(podId));
  };

  useEffect(() => {
    if (isOpen) {
      reloadData();
    }
  }, [isOpen, podId]);

  useEffect(() => {
    const handleStateChange = (e: any) => {
      if (e?.detail?.entity === 'medicine_price_book' || e?.detail?.entity === 'lab_rate_card') {
        reloadData();
      }
    };
    window.addEventListener('mediflow-state-change', handleStateChange);
    return () => window.removeEventListener('mediflow-state-change', handleStateChange);
  }, [podId]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    medicines.forEach(m => {
      if (m.category) set.add(m.category);
    });
    return ['ALL', ...Array.from(set)];
  }, [medicines]);

  const filteredMedicines = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return medicines.filter(m => {
      const matchCat = selectedCategory === 'ALL' || m.category === selectedCategory;
      const matchQ = !q || 
        (m.name || '').toLowerCase().includes(q) || 
        (m.genericName || '').toLowerCase().includes(q) || 
        (m.category || '').toLowerCase().includes(q);
      return matchCat && matchQ;
    });
  }, [medicines, searchQuery, selectedCategory]);

  const filteredLabs = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return labs.filter(t => {
      return !q || 
        (t.name || '').toLowerCase().includes(q) || 
        (t.category || '').toLowerCase().includes(q) || 
        (t.loincCode || '').toLowerCase().includes(q);
    });
  }, [labs, searchQuery]);

  const handleStartEdit = (item: PriceBookMedicineItem) => {
    setEditingId(item.id);
    setEditMrp(item.mrp);
    setEditPrice(item.price);
  };

  const handleSaveEdit = (item: PriceBookMedicineItem) => {
    PriceBookService.updateMedicineRate({
      id: item.id,
      name: item.name,
      mrp: Number(editMrp) || item.mrp,
      price: Number(editPrice) || item.price,
      category: item.category,
      dosage: item.dosage
    }, podId);

    setEditingId(null);
    reloadData();

    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: { title: 'Rate Updated! 🏷️', message: `${item.name} set to ₹${editPrice} (MRP: ₹${editMrp}).`, type: 'success' }
    }));
  };

  const handleSaveLabPrice = (loincCode: string, testName: string, newPrice: number) => {
    PriceBookService.updateLabTestRate(loincCode, testName, newPrice, podId);
    reloadData();
    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: { title: 'Lab Rate Updated! 🧪', message: `${testName} rate updated to ₹${newPrice}.`, type: 'success' }
    }));
  };

  const handleCreateNewMedicine = () => {
    if (!newMedName.trim()) return;
    PriceBookService.updateMedicineRate({
      name: newMedName.trim(),
      mrp: Number(newMedMrp) || 100,
      price: Number(newMedPrice) || 90,
      category: newMedCategory,
      dosage: newMedDosage
    }, podId);

    setNewMedName('');
    setNewMedGeneric('');
    setShowAddModal(false);
    reloadData();

    window.dispatchEvent(new CustomEvent('mediflow-toast', {
      detail: { title: 'Medicine Added! 💊', message: `${newMedName} added to Clinic Price Book.`, type: 'success' }
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl max-h-[92vh] flex flex-col bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center border border-teal-500/20 font-bold">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  Clinic Setup → Services & Price Book
                </h2>
                <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  Pre-Seeded Catalog
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Out-of-the-box benchmark MRPs for 150+ high-velocity medicines & 30+ diagnostic tests. 1-click editable.
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation & Search Bar */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Tabs */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl w-fit">
              <button
                onClick={() => setActiveTab('medicines')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'medicines'
                    ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <Pill className="w-3.5 h-3.5" />
                Medicines & MRPs ({medicines.length})
              </button>
              <button
                onClick={() => setActiveTab('labs')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'labs'
                    ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <FlaskConical className="w-3.5 h-3.5" />
                Lab Investigations ({labs.length})
              </button>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-teal-600 hover:bg-teal-500 text-white shadow-sm transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Medicine
              </button>
            </div>
          </div>

          {/* Search & Filter */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder={activeTab === 'medicines' ? 'Search 150+ medicines, generics (e.g., Augmentin, Dolo, Pan-40)...' : 'Search lab tests (e.g., CBC, LFT, Sugar, Thyroid)...'}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Category Pills (Medicines only) */}
            {activeTab === 'medicines' && (
              <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none max-w-full sm:max-w-md">
                {categories.slice(0, 6).map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`whitespace-nowrap px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                      selectedCategory === cat
                        ? 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/30'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {activeTab === 'medicines' ? (
            filteredMedicines.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm">
                No medicines found matching "{searchQuery}".
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {filteredMedicines.map(med => {
                  const isEditing = editingId === med.id;
                  return (
                    <div 
                      key={med.id}
                      className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 hover:border-teal-500/40 transition-all flex items-center justify-between gap-3 group"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white truncate">
                            {med.name}
                          </h4>
                          {med.dosage && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-mono">
                              {med.dosage}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {med.genericName}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-teal-600 dark:text-teal-400 font-medium">
                            {med.category}
                          </span>
                          {med.manufacturer && (
                            <span className="text-[10px] text-slate-400">
                              • {med.manufacturer}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Pricing block */}
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <div className="space-y-1">
                            <label className="text-[9px] uppercase font-bold text-slate-400 block">MRP ₹</label>
                            <input 
                              type="number"
                              value={editMrp}
                              onChange={e => setEditMrp(Number(e.target.value))}
                              className="w-16 px-1.5 py-1 text-xs bg-slate-100 dark:bg-slate-700 rounded border border-slate-300 dark:border-slate-600 font-bold"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] uppercase font-bold text-teal-500 block">Price ₹</label>
                            <input 
                              type="number"
                              value={editPrice}
                              onChange={e => setEditPrice(Number(e.target.value))}
                              className="w-16 px-1.5 py-1 text-xs bg-teal-50 dark:bg-teal-950/40 rounded border border-teal-500 text-teal-700 dark:text-teal-300 font-bold"
                            />
                          </div>
                          <button
                            onClick={() => handleSaveEdit(med)}
                            className="p-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 transition-colors self-end"
                            title="Save rate"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="text-[11px] text-slate-400 line-through">
                              MRP ₹{med.mrp}
                            </div>
                            <div className="text-sm font-bold text-teal-600 dark:text-teal-400">
                              ₹{med.price}
                            </div>
                          </div>
                          <button
                            onClick={() => handleStartEdit(med)}
                            className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors opacity-70 group-hover:opacity-100"
                            title="Edit price"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            filteredLabs.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm">
                No lab tests found matching "{searchQuery}".
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {filteredLabs.map(test => (
                  <div 
                    key={test.loincCode}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 hover:border-teal-500/40 transition-all flex items-center justify-between gap-3 group"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white truncate">
                          {test.name}
                        </h4>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-mono">
                          {test.loincCode}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                        <span>{test.category}</span>
                        {test.normalRange && <span>• Ref: {test.normalRange}</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">₹</span>
                        <input 
                          type="number"
                          defaultValue={test.price || 0}
                          onBlur={e => {
                            const val = Number(e.target.value);
                            if (val !== test.price) {
                              handleSaveLabPrice(test.loincCode, test.name, val);
                            }
                          }}
                          className="w-20 pl-5 pr-2 py-1 text-xs font-bold bg-slate-50 dark:bg-slate-700/60 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white focus:ring-1 focus:ring-teal-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Prescription AI matches these rates automatically during scan.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-colors"
          >
            Done
          </button>
        </div>

      </div>

      {/* Add Custom Medicine Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-teal-500" />
                Add Custom Medicine to Price Book
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">Brand Name (e.g. Dolo 650mg)</label>
                <input
                  type="text"
                  placeholder="Medicine Brand Name"
                  value={newMedName}
                  onChange={e => setNewMedName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">Generic Name / Composition</label>
                <input
                  type="text"
                  placeholder="e.g. Paracetamol IP 650mg"
                  value={newMedGeneric}
                  onChange={e => setNewMedGeneric(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">Category</label>
                  <input
                    type="text"
                    value={newMedCategory}
                    onChange={e => setNewMedCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">Dosage / Form</label>
                  <input
                    type="text"
                    value={newMedDosage}
                    onChange={e => setNewMedDosage(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">MRP ₹</label>
                  <input
                    type="number"
                    value={newMedMrp}
                    onChange={e => setNewMedMrp(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold"
                  />
                </div>
                <div>
                  <label className="block text-teal-600 dark:text-teal-400 font-semibold mb-1">Clinic Selling Price ₹</label>
                  <input
                    type="number"
                    value={newMedPrice}
                    onChange={e => setNewMedPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-teal-50/50 dark:bg-teal-950/30 border border-teal-500/40 text-teal-700 dark:text-teal-300 font-bold"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-3 py-1.5 rounded-xl text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateNewMedicine}
                disabled={!newMedName.trim()}
                className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-teal-600 hover:bg-teal-500 text-white disabled:opacity-50"
              >
                Save to Catalog
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
