import { useState } from 'react';
import { Navbar } from './components/shared/Navbar';
import type { UserRole } from './components/shared/Navbar';
import { CompounderDashboard } from './components/compounder/CompounderDashboard';
import { DoctorDashboard } from './components/doctor/DoctorDashboard';
import { LabDashboard } from './components/lab/LabDashboard';
import { PharmacyDashboard } from './components/pharmacy/PharmacyDashboard';
import { BillingDashboard } from './components/billing/BillingDashboard';

function App() {
  const [currentRole, setCurrentRole] = useState<UserRole>('compounder');

  const renderDashboard = () => {
    switch (currentRole) {
      case 'compounder':
        return <CompounderDashboard />;
      case 'doctor':
        return <DoctorDashboard />;
      case 'lab':
        return <LabDashboard />;
      case 'pharmacy':
        return <PharmacyDashboard />;
      case 'billing':
        return <BillingDashboard />;
      default:
        return <CompounderDashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-clinical-950 text-clinical-100 flex flex-col font-sans select-none">
      {/* Shared Ecosystem Navigation Header */}
      <Navbar currentRole={currentRole} onChangeRole={setCurrentRole} />

      {/* Primary Dashboard viewport wrapper */}
      <main className="flex-1 pb-16">
        <div className="animate-fade-in">
          {renderDashboard()}
        </div>
      </main>

      {/* Ecosystem Footer Status bar */}
      <footer className="border-t border-clinical-800/80 bg-clinical-950/80 backdrop-blur-md py-4 text-center text-[10px] text-clinical-500 font-semibold uppercase tracking-wider sticky bottom-0">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Mediflow Clinical Network Pod • Patna Zone 1</span>
          <span className="flex items-center gap-1.5 text-accent-500 bg-accent-500/10 px-2.5 py-0.5 rounded-full border border-accent-500/25">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-500 animate-pulse-subtle"></span>
            Ecosystem Core Active
          </span>
        </div>
      </footer>
    </div>
  );
}

export default App;
