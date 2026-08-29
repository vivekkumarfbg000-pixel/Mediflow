import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  FileText, 
  RefreshCw, 
  PhoneCall, 
  Building2, 
  Mail, 
  ArrowLeft, 
  CheckCircle2, 
  Lock, 
  HelpCircle,
  ExternalLink,
  Printer
} from 'lucide-react';

export type PolicyTab = 'terms' | 'privacy' | 'refund' | 'contact';

interface LegalPoliciesPageProps {
  initialTab?: PolicyTab;
  onBack?: () => void;
}

export const LegalPoliciesPage: React.FC<LegalPoliciesPageProps> = ({ 
  initialTab,
  onBack 
}) => {
  const [activeTab, setActiveTab] = useState<PolicyTab>('terms');

  // Sync tab with URL route path (/terms, /privacy, /refund-policy, /contact)
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
      return;
    }
    if (typeof window !== 'undefined') {
      const path = window.location.pathname.toLowerCase();
      if (path.includes('privacy')) {
        setActiveTab('privacy');
      } else if (path.includes('refund') || path.includes('cancellation')) {
        setActiveTab('refund');
      } else if (path.includes('contact')) {
        setActiveTab('contact');
      } else {
        setActiveTab('terms');
      }
    }
  }, [initialTab]);

  const handleTabChange = (tab: PolicyTab) => {
    setActiveTab(tab);
    if (typeof window !== 'undefined' && window.history) {
      let targetPath = '/terms';
      if (tab === 'privacy') targetPath = '/privacy';
      else if (tab === 'refund') targetPath = '/refund-policy';
      else if (tab === 'contact') targetPath = '/contact-us';
      window.history.pushState({}, '', targetPath);
    }
  };

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-cyan-500 selection:text-white pb-16">
      {/* Top Header Navigation */}
      <header className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800/80 px-4 lg:px-12 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                if (onBack) onBack();
                else window.location.href = '/';
              }}
              className="p-2 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 rounded-xl text-slate-300 hover:text-white transition-all cursor-pointer flex items-center gap-2 text-sm font-medium"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Clinic</span>
            </button>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-tr from-cyan-500 to-emerald-500 rounded-2xl shadow-lg shadow-cyan-500/20 text-slate-950 font-black">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                  VitalSync <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">Legal & Policy Center</span>
                </h1>
                <p className="text-xs text-slate-400">Official Terms, Privacy & Merchant Policy Guidelines</p>
              </div>
            </div>
          </div>

          <button
            onClick={handlePrint}
            className="hidden sm:flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
          >
            <Printer className="h-4 w-4" />
            <span>Print Policy Document</span>
          </button>
        </div>
      </header>

      {/* Hero Banner */}
      <div className="relative overflow-hidden bg-gradient-to-b from-slate-900 via-slate-900/60 to-slate-950 border-b border-slate-800/60 py-12 px-4">
        <div className="max-w-6xl mx-auto text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Official Legal & Merchant Compliance Guidelines</span>
          </div>
          <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight">
            Terms, Privacy & <span className="bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400 bg-clip-text text-transparent">Refund Guidelines</span>
          </h2>
          <p className="text-sm md:text-base text-slate-400 max-w-2xl mx-auto leading-relaxed">
            VitalSync Healthcare Technologies provides transparent digital health & OPD payment infrastructure. Review our legal policies below required for merchant compliance.
          </p>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-6xl mx-auto px-4 lg:px-8 mt-8">
        {/* Navigation Tabs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800/80 mb-8 shadow-xl">
          <button
            onClick={() => handleTabChange('terms')}
            className={`flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl text-xs md:text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'terms'
                ? 'bg-gradient-to-r from-cyan-500 to-teal-500 text-slate-950 shadow-lg shadow-cyan-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <FileText className="h-4 w-4" />
            <span>Terms & Conditions</span>
          </button>

          <button
            onClick={() => handleTabChange('privacy')}
            className={`flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl text-xs md:text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'privacy'
                ? 'bg-gradient-to-r from-cyan-500 to-teal-500 text-slate-950 shadow-lg shadow-cyan-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Lock className="h-4 w-4" />
            <span>Privacy Policy</span>
          </button>

          <button
            onClick={() => handleTabChange('refund')}
            className={`flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl text-xs md:text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'refund'
                ? 'bg-gradient-to-r from-cyan-500 to-teal-500 text-slate-950 shadow-lg shadow-cyan-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <RefreshCw className="h-4 w-4" />
            <span>Refund & Cancellation</span>
          </button>

          <button
            onClick={() => handleTabChange('contact')}
            className={`flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl text-xs md:text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'contact'
                ? 'bg-gradient-to-r from-cyan-500 to-teal-500 text-slate-950 shadow-lg shadow-cyan-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <PhoneCall className="h-4 w-4" />
            <span>Contact & Legal Entity</span>
          </button>
        </div>

        {/* Content Box */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-6 md:p-10 backdrop-blur-md shadow-2xl space-y-8 text-slate-300 leading-relaxed text-sm">
          
          {/* TAB 1: TERMS AND CONDITIONS */}
          {activeTab === 'terms' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-xl md:text-2xl font-black text-white">Terms and Conditions</h3>
                  <p className="text-xs text-slate-400">Last Updated: August 07, 2026 | Merchant & Gateway Compliant</p>
                </div>
                <div className="px-3 py-1 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 rounded-lg text-xs font-semibold">
                  Legal Contract
                </div>
              </div>

              <section className="space-y-3">
                <h4 className="text-base font-bold text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-400"></span> 1. Acceptance of Terms
                </h4>
                <p>
                  By accessing or using the VitalSync Smart Healthcare Platform (&quot;VitalSync&quot;, &quot;Mediflow Ecosystem&quot;, &quot;We&quot;, &quot;Us&quot;, or &quot;Platform&quot;), including our web portals, WhatsApp chatbot interfaces, and OPD payment gateways, you (&quot;User&quot;, &quot;Patient&quot;, &quot;Clinic&quot;) agree to be legally bound by these Terms and Conditions. If you do not agree, please discontinue using the service immediately.
                </p>
              </section>

              <section className="space-y-3">
                <h4 className="text-base font-bold text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-400"></span> 2. Nature of Services & Virtual Hospital Network
                </h4>
                <p>
                  VitalSync provides technology infrastructure and managed digital care coordination for independent medical clinics, licensed medical practitioners, registered pharmacies, and certified pathology laboratories (&quot;Virtual Hospital Care Network&quot;). VitalSync acts as a digital facilitator and intermediary under the Information Technology Act 2000. VitalSync does not directly practice medicine, dispense pharmaceutical drugs, or perform laboratory analysis.
                </p>
                <p>
                  All clinical diagnoses, digital prescriptions, and medical decisions are the independent professional responsibility of the treating Registered Medical Practitioner (RMP). Pharmacy fulfillment is executed strictly by licensed retail pharmacies under the Drugs and Cosmetics Act 1940. Diagnostic testing is conducted by accredited pathology laboratories.
                </p>
              </section>

              <section className="space-y-3">
                <h4 className="text-base font-bold text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-400"></span> 3. Regulatory Compliance & Ethical Settlement Framework
                </h4>
                <p>
                  VitalSync operates in strict compliance with the National Medical Commission (Professional Conduct, Etiquette and Ethics) Regulations, the Clinical Establishments Act, and the Telemedicine Practice Guidelines (2020):
                </p>
                <ul className="list-disc pl-5 space-y-2 text-slate-300">
                  <li><strong>Doctor Consultation Fee Immunity:</strong> 100% of the patient consultation fee is remitted directly to the treating doctor without platform revenue deductions.</li>
                  <li><strong>Transparent Care Coordination Services:</strong> All ecosystem settlements for pharmacy fulfillment, diagnostic sample processing, and tele-monitoring follow standard commercial B2B Service Level Agreements (SLAs) for technical processing, drug dispensing, and electronic health record (EHR) data management.</li>
                  <li><strong>No Illegal Commissions:</strong> Platform fee allocations represent legitimate digital infrastructure facilitation, WhatsApp automation, longitudinal health monitoring, and administrative coordination services.</li>
                  <li><strong>Standard Payment Gateways:</strong> Payments are processed transparently via verified Indian banking gateways (Paytm PG, PhonePe, Cashfree, Direct Bank UPI) with digital invoice generation and GST compliance.</li>
                </ul>
              </section>

              <section className="space-y-3">
                <h4 className="text-base font-bold text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-400"></span> 4. User Eligibility & Account Security
                </h4>
                <p>
                  Users must be at least 18 years of age to book paid consultations or register medical profiles independently. Minors must be registered under a parent or legal guardian&apos;s account. Users are responsible for providing accurate contact numbers to receive official WhatsApp OPD tokens and digital invoices.
                </p>
              </section>

              <section className="space-y-3">
                <h4 className="text-base font-bold text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-400"></span> 4. Partner Roles & Tripartite Operational Obligations
                </h4>
                <div className="space-y-3 text-slate-300">
                  <div className="p-3.5 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1">
                    <h5 className="font-bold text-cyan-300 text-xs uppercase tracking-wider">A. Doctor / Clinic Partner Obligations</h5>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Doctor partners maintain 100% independent clinical autonomy over medical examinations, diagnoses, and digital prescriptions. Doctors agree to issue electronic prescriptions strictly in compliance with Telemedicine Practice Guidelines (2020) and Drugs &amp; Cosmetics Rules. 100% of the patient consultation fee belongs to the doctor without platform commission deductions.
                    </p>
                  </div>

                  <div className="p-3.5 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1">
                    <h5 className="font-bold text-emerald-300 text-xs uppercase tracking-wider">B. Pharmacy Partner Obligations</h5>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Pharmacy partners must possess valid retail drug licenses under the Drugs &amp; Cosmetics Act 1940. Pharmacies agree to fulfill only genuine, batch-verified (FEFO) medicines against valid prescriptions, maintain standard storage temperatures, and process home delivery orders with proper tax invoices.
                    </p>
                  </div>

                  <div className="p-3.5 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1">
                    <h5 className="font-bold text-teal-300 text-xs uppercase tracking-wider">C. Pathology Lab Partner Obligations</h5>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Pathology partners must maintain certified diagnostic testing infrastructure, calibrate laboratory equipment regularly, verify barcode samples (`BAR-XXXX`), and upload authenticated electronic PDF reports with LOINC test coding directly to the platform for instant WhatsApp patient delivery.
                    </p>
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <h4 className="text-base font-bold text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-400"></span> 5. Limitation of Liability & Medical Disclaimer
                </h4>
                <p>
                  Medical diagnosis and treatment decisions are the sole clinical responsibility of the treating doctor. VitalSync shall not be held liable for clinical negligence, prescription outcomes, or medical emergencies. In case of severe life-threatening emergencies, patients must immediately visit the nearest physical hospital emergency room.
                </p>
              </section>

              <section className="space-y-3">
                <h4 className="text-base font-bold text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-400"></span> 6. Governing Law & Jurisdiction
                </h4>
                <p>
                  These terms shall be governed by and construed in accordance with the laws of India. Any disputes arising under these terms shall be subject to the exclusive jurisdiction of the courts located in Patna, Bihar, India.
                </p>
              </section>
            </div>
          )}

          {/* TAB 2: PRIVACY POLICY */}
          {activeTab === 'privacy' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-xl md:text-2xl font-black text-white">Privacy Policy</h3>
                  <p className="text-xs text-slate-400">Data Protection & Privacy Standard | Effective August 2026</p>
                </div>
                <div className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg text-xs font-semibold">
                  NDHM / RLS Secured
                </div>
              </div>

              <section className="space-y-3">
                <h4 className="text-base font-bold text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span> 1. Information We Collect
                </h4>
                <p>
                  To deliver seamless healthcare scheduling and digital medical records, VitalSync collects minimal necessary information, including:
                </p>
                <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
                  <li><strong>Personal Identifiers:</strong> Name, Age, Gender, Mobile Number, Email Address.</li>
                  <li><strong>Medical Records:</strong> Chief clinical complaints, prescriptions, lab requisition slips, biometry data.</li>
                  <li><strong>Transaction Details:</strong> Payment transaction IDs, payment status, invoice numbers (We do NOT store credit card numbers, UPI PINs, or CVVs).</li>
                </ul>
              </section>

              <section className="space-y-3">
                <h4 className="text-base font-bold text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span> 2. How We Use Your Information
                </h4>
                <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
                  <li>To allocate OPD Token numbers (#TK-001) and confirm doctor appointment slots.</li>
                  <li>To send automated WhatsApp checkup updates, PDF prescriptions, and lab report notifications.</li>
                  <li>To process payment receipts and disaggregate vendor splits for clinic services.</li>
                </ul>
              </section>

              <section className="space-y-3">
                <h4 className="text-base font-bold text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span> 3. Data Protection & Security Controls
                </h4>
                <p>
                  VitalSync utilizes Supabase PostgreSQL with strict Row Level Security (RLS) policies. All network communication is encrypted in transit using 256-bit SSL/TLS protocol. Access to patient records is strictly restricted to authenticated healthcare providers within the assigned clinic pod.
                </p>
              </section>

              <section className="space-y-3">
                <h4 className="text-base font-bold text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span> 4. Sharing with Payment Gateways
                </h4>
                <p>
                  Transaction metadata (Amount, Invoice ID, Customer Contact) is shared securely with licensed payment partners (Cashfree, Razorpay, Paytm, Banking Gateways) solely for processing transactions and preventing fraudulent activity. We strictly do NOT sell or monetize patient personal data to third-party advertisers.
                </p>
              </section>

              <section className="space-y-3">
                <h4 className="text-base font-bold text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span> 5. Grievance Officer & Contact
                </h4>
                <p>
                  In accordance with the Information Technology Act 2000 and rules made thereunder, questions regarding data protection can be addressed to our Privacy Officer at <strong>privacy@vitalsync.in</strong> or phone <strong>+91 8986426029</strong>.
                </p>
              </section>
            </div>
          )}

          {/* TAB 3: REFUND AND CANCELLATION POLICY */}
          {activeTab === 'refund' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-xl md:text-2xl font-black text-white">Cancellation & Refund Policy</h3>
                  <p className="text-xs text-slate-400">Merchant Payment Refund Policy & Customer Protection SLA</p>
                </div>
                <div className="px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-lg text-xs font-semibold">
                  5-7 Days SLA Refund
                </div>
              </div>

              <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-300 text-xs space-y-1">
                <p className="font-bold flex items-center gap-2">
                  <RefreshCw className="h-4 w-4" /> 100% Patient Protection Guarantee
                </p>
                <p>
                  If an appointment is cancelled by the clinic or if the doctor is unavailable, a 100% refund of the doctor consultation fee is automatically credited back to your original payment source.
                </p>
              </div>

              <section className="space-y-3">
                <h4 className="text-base font-bold text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span> 1. Appointment Cancellation Rules
                </h4>
                <ul className="list-disc pl-5 space-y-2 text-slate-300">
                  <li><strong>Patient Initiated Cancellation:</strong> Patients can request appointment cancellation up to <strong>2 hours before</strong> the scheduled consultation slot by contacting clinic support or via WhatsApp Chatbot.</li>
                  <li><strong>Doctor/Clinic Unavailability:</strong> In the rare event that a doctor is unavailable due to emergency procedures, the patient will be offered either a free rescheduling or an immediate full refund.</li>
                </ul>
              </section>

              <section className="space-y-3">
                <h4 className="text-base font-bold text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span> 2. Refund Processing Timeline & Method
                </h4>
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2 text-xs">
                  <div className="grid grid-cols-2 gap-4 border-b border-slate-800 pb-2 font-bold text-slate-200">
                    <span>Payment Method</span>
                    <span>Refund SLA Timeline</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-slate-400">
                    <span>UPI Apps (GPay / Paytm / BHIM / Any UPI)</span>
                    <span>1 to 3 Business Days</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-slate-400">
                    <span>Credit Card / Debit Card</span>
                    <span>5 to 7 Business Days</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-slate-400">
                    <span>Net Banking</span>
                    <span>3 to 5 Business Days</span>
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <h4 className="text-base font-bold text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span> 3. Non-Refundable Scenarios
                </h4>
                <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
                  <li>Completed consultation sessions where the doctor has examined the patient or issued a prescription.</li>
                  <li>Completed pathology sample collections or processed laboratory diagnostic reports.</li>
                  <li>Dispensed pharmaceutical products or opened medicine strip packages.</li>
                  <li>Online Convenience Platform Convenience Fee (₹15.00 / 3%) incurred for third-party gateway clearance.</li>
                </ul>
              </section>

              <section className="space-y-3">
                <h4 className="text-base font-bold text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span> 4. How to Request a Refund
                </h4>
                <p>
                  To request a refund, please send your <strong>Invoice ID</strong> or <strong>Token Number</strong> along with the registered mobile number to <strong>refunds@vitalsync.in</strong> or WhatsApp support at <strong>+91 8986426029</strong>. Our billing desk reviews and clears verified refund requests within 24 hours.
                </p>
              </section>
            </div>
          )}

          {/* TAB 4: CONTACT US & LEGAL ENTITY DETAILS */}
          {activeTab === 'contact' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-xl md:text-2xl font-black text-white">Contact Us & Legal Entity</h3>
                  <p className="text-xs text-slate-400">Merchant Legal Business Information</p>
                </div>
                <div className="px-3 py-1 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 rounded-lg text-xs font-semibold">
                  Verified Business Entity
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-4">
                  <div className="flex items-center gap-3 text-cyan-400">
                    <Building2 className="h-6 w-6" />
                    <h4 className="text-base font-bold text-white">Merchant Legal Entity Name</h4>
                  </div>
                  <div className="space-y-1 text-xs">
                    <p className="text-sm font-semibold text-slate-200">VitalSync Technologies</p>
                    <p className="text-slate-400">Brand Name: VitalSync Connected Clinic</p>
                    <p className="text-slate-400">Founder: Vivek Kumar</p>
                    <p className="text-slate-400">Category: Healthcare SaaS & OPD Scheduling Platform</p>
                  </div>
                </div>

                <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-4">
                  <div className="flex items-center gap-3 text-emerald-400">
                    <PhoneCall className="h-6 w-6" />
                    <h4 className="text-base font-bold text-white">Helpline & Support Desk</h4>
                  </div>
                  <div className="space-y-1 text-xs">
                    <p className="text-sm font-semibold text-slate-200">Phone: +91 8986426029</p>
                    <p className="text-slate-400">WhatsApp Desk: +91 8986426029</p>
                    <p className="text-slate-400">Operating Hours: Mon - Sat (09:00 AM - 08:00 PM IST)</p>
                  </div>
                </div>

                <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-4">
                  <div className="flex items-center gap-3 text-teal-400">
                    <Mail className="h-6 w-6" />
                    <h4 className="text-base font-bold text-white">Email Contact Addresses</h4>
                  </div>
                  <div className="space-y-1 text-xs">
                    <p className="text-slate-300">General Enquiries: <span className="text-cyan-400">support@vitalsync.in</span></p>
                    <p className="text-slate-300">Billing & Refunds: <span className="text-cyan-400">refunds@vitalsync.in</span></p>
                    <p className="text-slate-300">Grievance / Privacy: <span className="text-cyan-400">privacy@vitalsync.in</span></p>
                  </div>
                </div>

                <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-4">
                  <div className="flex items-center gap-3 text-purple-400">
                    <ShieldCheck className="h-6 w-6" />
                    <h4 className="text-base font-bold text-white">Registered Office Address</h4>
                  </div>
                  <div className="space-y-1 text-xs text-slate-400 leading-normal">
                    <p className="font-semibold text-slate-200">VitalSync Connected Clinic HQ</p>
                    <p>Main Health Plaza, Tech Park</p>
                    <p>Patna, Bihar - 800020, India</p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-cyan-500/10 border border-cyan-500/20 rounded-2xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <HelpCircle className="h-5 w-5 text-cyan-400 flex-shrink-0" />
                  <span>Need instant verification assistance for Merchant Support Desk?</span>
                </div>
                <button
                  onClick={() => window.location.href = 'tel:+918986426029'}
                  className="px-3.5 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <PhoneCall className="h-3.5 w-3.5" />
                  <span>Call Merchant Desk</span>
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Footer info links */}
        <footer className="mt-8 text-center text-xs text-slate-500 space-y-3 pb-8 border-t border-slate-900 pt-6">
          <div className="flex flex-wrap justify-center gap-4 text-slate-400 font-medium">
            <button onClick={() => handleTabChange('terms')} className="hover:text-cyan-400 transition-colors">Terms & Conditions</button>
            <span>•</span>
            <button onClick={() => handleTabChange('privacy')} className="hover:text-cyan-400 transition-colors">Privacy Policy</button>
            <span>•</span>
            <button onClick={() => handleTabChange('refund')} className="hover:text-cyan-400 transition-colors">Refund & Cancellation Policy</button>
            <span>•</span>
            <button onClick={() => handleTabChange('contact')} className="hover:text-cyan-400 transition-colors">Contact & Merchant Info</button>
          </div>
          <p>© 2026 VitalSync Technologies. All Rights Reserved. Compliant with RBI, Razorpay & Cashfree Merchant Regulations.</p>
        </footer>
      </div>
    </div>
  );
};
