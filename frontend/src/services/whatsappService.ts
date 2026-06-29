import { supabase } from '../lib/supabaseClient';
import { load, save, writeAuditLog, notify } from './apiHelper';
import { PatientService } from './patientService';
import { EncounterService } from './encounterService';
import { PharmacyService } from './pharmacyService';
import { LabService } from './labService';
import { BillingService } from './billingService';
import type { 
  WhatsAppSession, 
  ChatMessage, 
  Encounter, 
  PharmacyInventoryItem,
  MedicineBillItem,
  MedicineBill,
  FinancialLedgerEntry,
  Appointment
} from '../types';

export class WhatsAppService {
  static getWhatsAppSessions(): WhatsAppSession[] {
    return load<WhatsAppSession[]>('whatsapp_sessions', []);
  }

  static saveWhatsAppSessions(sessions: WhatsAppSession[]) {
    save('whatsapp_sessions', sessions);
    notify();
  }

  static async sendWhatsAppMessagePayload(
    phone: string,
    templateName: string,
    variables: Record<string, any>
  ): Promise<boolean> {
    try {
      console.log(`[Mediflow Outgoing Dispatch] API template: ${templateName} target: ${phone}`, variables);
      await new Promise(r => setTimeout(r, 200));
      return true;
    } catch (e) {
      console.error("[Mediflow WhatsApp Bot] Outgoing dispatch error:", e);
      return false;
    }
  }

  static async processIncomingWhatsAppMessage(phone: string, text: string): Promise<void> {
    try {
      const cleaned = text.trim().toLowerCase();
      const sessions = this.getWhatsAppSessions();
      const sessionIndex = sessions.findIndex(s => s.patientPhone === phone);
      
      if (sessionIndex === -1) {
        this.initiateWhatsAppSession(phone);
        return;
      }

      const session = sessions[sessionIndex];
      const sessionData = session.sessionData || {};
      
      const currentHistory = sessionData.chatHistory || [];
      currentHistory.push({ sender: 'patient', text, time: new Date().toISOString() });
      sessionData.chatHistory = currentHistory;
      this.saveWhatsAppSessions(sessions);

      let nextState = session.currentState;
      let replyMessage = "";

      switch (session.currentState) {
        case 'AWAITING_WELCOME':
          if (cleaned === '1' || cleaned.includes('start') || cleaned.includes('yes') || cleaned.includes('ok')) {
            nextState = 'AWAITING_CONSENT';
            replyMessage = `📋 *Clinical Data Sync Consent Request* \n\nVitalSync digital ecosystem ko clinical records sync karne ki permission dene ke liye please **CONSENT** reply kijiye. \n\nIsse aapke e-prescriptions, pharmacy bill invoices aur lab reports automatically is WhatsApp chat par aane lagenge.`;
          } else {
            replyMessage = "Namaste! VitalSync Automated Assistant online. Shuru karne ke liye **1** or **START** type kijiye.";
          }
          break;

        case 'AWAITING_CONSENT':
          if (cleaned.includes('consent') || cleaned === '1' || cleaned === 'yes') {
            nextState = 'AWAITING_WELCOME_ACK';
            sessionData.consentGranted = true;
            sessionData.consentTime = new Date().toISOString();
            
            const patient = PatientService.getPatients().find(p => p.phone === phone);
            if (patient) {
              await supabase.from('patient_consents').insert({
                patient_id: patient.id,
                data_sharing_consent: true,
                consented_at: new Date().toISOString()
              });
            }

            replyMessage = `🎉 *Consent Recorded Successfully!* \n\nAapka profile secure clinical sync loop se link ho gaya hai. \n\n*Gateways Active:*\n1. Digital e-Prescriptions (e-Rx) 💊\n2. Realtime Pathology Reports 🧪\n3. UPI Integrated Invoices 💳\n\nType **A** to check active appointments, **I** for invoices, or type a general query to chat with AI:`;
          } else {
            replyMessage = "Invalid input. Records sync activate karne ke liye please **CONSENT** reply kijiye.";
          }
          break;

        case 'AWAITING_WELCOME_ACK':
          if (cleaned === 'a' || cleaned === '1') {
            nextState = 'COMPLETED';
            replyMessage = "📅 *Active Appointments/Consultations:*\n- Dr. Vivek (Consultation chamber 1): Ready for scheduling.\n\nType **REFILL** to order medicines, **REPORT** to get your latest lab result, or chat with AI.";
          } else if (cleaned === 'i' || cleaned === '2') {
            nextState = 'COMPLETED';
            replyMessage = "💳 *Dues & Invoices Summary:*\n- No outstanding dues found on your active token.\n\nType **REFILL** to order medicines, **REPORT** to get your latest lab result, or chat with AI.";
          } else {
            nextState = 'COMPLETED';
            replyMessage = "Clinical loop setup finished. Aap type karke general queries pooch sakte hain ya **REFILL** reply karke medicine order kar sakte hain.";
          }
          break;

        case 'AWAITING_PAYMENT':
          if (cleaned.includes('pay') || cleaned.includes('clear') || cleaned === '1' || cleaned === 'done') {
            const patient = PatientService.getPatients().find(p => p.phone === phone);
            if (patient) {
              const invoices = BillingService.getUnifiedInvoices();
              const patientInvoices = invoices.filter(i => i.patientId === patient.id && i.paymentStatus === 'pending');
              
              if (patientInvoices.length > 0) {
                patientInvoices.forEach(inv => {
                  BillingService.clearInvoice(inv.id);
                });
                
                nextState = 'COMPLETED';
                replyMessage = "✅ *Payment Received!* \n\nAapka care pod invoice settle ho gaya hai. Vitals telemetry aur e-Rx status local counter par clear kar diya gaya hai. Thank you!";
              } else {
                nextState = 'COMPLETED';
                replyMessage = "No unpaid invoices found on your profile. Safe to proceed!";
              }
            } else {
              nextState = 'COMPLETED';
              replyMessage = "Patient not resolved. Checkout failed.";
            }
          } else {
            replyMessage = "Aapka invoice update pending hai. Please pay to clear your check-out parameters. UPI Payload is active in the preceding card.";
          }
          break;

        case 'MEDICINE_ORDERING':
          {
            const stage = sessionData.medicineOrderStage || 'INITIAL';
            const activeInventory = PharmacyService.getPharmacyInventory();

            if (stage === 'CHOOSING_DELIVERY') {
              const draftBill = sessionData.draftMedicineBill as MedicineBill;
              if (cleaned === '1') {
                draftBill.deliveryType = 'pickup';
                draftBill.deliveryCharge = 0;
                draftBill.totalAmount = draftBill.subtotal + draftBill.gstAmount;
                draftBill.upiQrPayload = `upi://pay?pa=vitalsync@icici&pn=VitalSync&am=${draftBill.totalAmount.toFixed(2)}&cu=INR&tn=VS-PHARMA-${draftBill.id.substring(4, 8)}`;
                
                sessionData.medicineOrderStage = 'INITIAL';
                nextState = 'MEDICINE_AWAITING_PAYMENT';
                
                PharmacyService.saveMedicineBill(draftBill);

                replyMessage = `🚶 *Counter Pickup Confirmed!* \n\n*Invoice Summary:*\n- Subtotal: ₹${draftBill.subtotal.toFixed(2)}\n- GST: ₹${draftBill.gstAmount.toFixed(2)}\n- Delivery Charge: ₹0.00\n---------------------------------------\n*Total Amount Payable: ₹${draftBill.totalAmount.toFixed(2)}*\n\nSettle karne ke liye is link par click karein:\n${draftBill.upiQrPayload}\n\nPayment karne ke baad please **PAY** reply kijiye!`;
              } else if (cleaned === '2') {
                draftBill.deliveryType = 'shiprocket';
                draftBill.deliveryCharge = 45;
                draftBill.totalAmount = draftBill.subtotal + draftBill.gstAmount + 45;
                draftBill.upiQrPayload = `upi://pay?pa=vitalsync@icici&pn=VitalSync&am=${draftBill.totalAmount.toFixed(2)}&cu=INR&tn=VS-DELIVERY-${draftBill.id.substring(4, 8)}`;
                
                sessionData.medicineOrderStage = 'AWAITING_ADDRESS';
                
                replyMessage = `🚚 *Shiprocket Delivery Selected!* \n\nPlease delivery address type kijiye (For example: 'Sector-C, Kankarbagh, Patna'):`;
              } else {
                replyMessage = "Invalid option. Please choose:\n*1* - Counter Pickup (₹0.00)\n*2* - Shiprocket Home Delivery (₹45.00)";
              }
            } else if (stage === 'AWAITING_ADDRESS') {
              const draftBill = sessionData.draftMedicineBill as MedicineBill;
              draftBill.deliveryAddress = text;
              
              sessionData.medicineOrderStage = 'INITIAL';
              nextState = 'MEDICINE_AWAITING_PAYMENT';
              
              PharmacyService.saveMedicineBill(draftBill);

              replyMessage = `📍 *Delivery Address Saved!* \n"${text}"\n\n*Invoice Summary (Cheapest Shipping applied):*\n- Medicine Subtotal: ₹${draftBill.subtotal.toFixed(2)}\n- GST: ₹${draftBill.gstAmount.toFixed(2)}\n- Shiprocket Delivery Charge: ₹45.00\n---------------------------------------\n*Total Amount Payable: ₹${draftBill.totalAmount.toFixed(2)}*\n\nSettle karne ke liye is link par click karein:\n${draftBill.upiQrPayload}\n\nPayment karne ke baad please **PAY** reply kijiye!`;
            } else {
              let matchedItem: PharmacyInventoryItem | undefined;
              let qty = 10;

              for (const item of activeInventory) {
                if (cleaned.toLowerCase().includes(item.name.toLowerCase()) || cleaned.toLowerCase().includes(item.genericName.toLowerCase())) {
                  matchedItem = item;
                  break;
                }
              }

              const numMatch = cleaned.match(/\d+/);
              if (numMatch) {
                qty = Number(numMatch[0]);
              }

              if (matchedItem) {
                const patientObj = PatientService.getPatients().find(p => p.phone === phone);
                const billId = `bill-${Date.now()}`;
                
                const itemTotal = matchedItem.price * qty;
                const gst = matchedItem.hsn === '300410' ? 0.12 : 0.05;
                const gstAmt = itemTotal * gst;
                
                const billItem: MedicineBillItem = {
                  inventoryItemId: matchedItem.id,
                  name: matchedItem.name,
                  genericName: matchedItem.genericName,
                  dosage: matchedItem.dosage,
                  batchNumber: matchedItem.batchNumber,
                  expiryDate: matchedItem.expiryDate,
                  quantity: qty,
                  mrp: matchedItem.mrp,
                  sellingPrice: matchedItem.price,
                  discountPercent: 0,
                  gstPercent: gst * 100,
                  lineTotal: itemTotal
                };

                const draftBill: MedicineBill = {
                  id: billId,
                  patientId: patientObj?.id || 'pat-demo',
                  patientName: patientObj?.name || 'WhatsApp Patient',
                  patientPhone: phone,
                  items: [billItem],
                  subtotal: itemTotal,
                  loyaltyDiscountPercent: 0,
                  loyaltyDiscountAmount: 0,
                  itemDiscountAmount: 0,
                  gstAmount: gstAmt,
                  totalAmount: itemTotal + gstAmt,
                  paymentMode: 'whatsapp_pay',
                  status: 'draft',
                  source: 'whatsapp',
                  createdAt: new Date().toISOString()
                };

                sessionData.draftMedicineBill = draftBill;
                sessionData.medicineOrderStage = 'CHOOSING_DELIVERY';

                replyMessage = `💊 *Live Patna Inventory Matched!* \n• Dawa: *${matchedItem.name}* (Batch: ${matchedItem.batchNumber})\n• Qty: *${qty} ${matchedItem.unit}*\n• Price per Unit: ₹${matchedItem.price.toFixed(2)}\n• Subtotal: ₹${itemTotal.toFixed(2)} (+₹${gstAmt.toFixed(2)} GST)\n\n*Logistics Option Select Karein:*\n\n*1* - Counter Pickup (₹0.00 standard pickup)\n*2* - Shiprocket Home Delivery (₹45.00 Cheapest logistics option)`;
              } else {
                replyMessage = `Aapka medicine query *"${text}"* match nahi hua. ⚠️ Hamare live catalog mein Paracetamol, Metformin, Amoxicillin, Atorvastatin aur Pantoprazole available hain. \n\nKaunsi medicine chahiye? Please correct brand/generic name type kijiye (e.g. "Metformin 30 tabs"):`;
              }
            }
          }
          break;

        case 'MEDICINE_AWAITING_PAYMENT':
          {
            const draftBill = sessionData.draftMedicineBill as MedicineBill;
            if (cleaned.includes('pay') || cleaned.includes('clear') || cleaned === '1') {
              if (draftBill) {
                draftBill.status = 'paid';
                PharmacyService.saveMedicineBill(draftBill);
                PharmacyService.dispenseMedicineBill(draftBill.id);

                if (draftBill.deliveryType === 'shiprocket') {
                  nextState = 'COMPLETED';
                  const shipId = `SR-${Math.floor(100000 + Math.random() * 900000)}`;
                  replyMessage = `🟢 *Payment Cleared!* \n\nShiprocket logistics partner se order arrange kar diya hai. \n🚀 *Tracking ID: ${shipId}*\n\nMedicines 24-48 hours mein deliver ho jayengi. VitalSync digital ecosystem choose karne ke liye shukriya! 📦`;
                } else {
                  nextState = 'MEDICINE_READY_FOR_PICKUP';
                  replyMessage = `🟢 *Payment Cleared!* \n\nMedicines counter collection ke liye packing department mein bhej di gayi hain. \n\nShow this invoice ref to compounder at clinic counter: \n🔖 *Ref ID: #${draftBill.id.substring(4, 10).toUpperCase()}*`;
                }
              } else {
                nextState = 'COMPLETED';
                replyMessage = "Something went wrong with the payment transaction. Please request compounder to assist at Patna counter.";
              }
            } else {
              replyMessage = `Dues pending hain. Please ₹${draftBill?.totalAmount.toFixed(2)} settle kijiye. UPI payload:\n${draftBill?.upiQrPayload}\n\nClear karne ke baad *PAY* reply karein.`;
            }
          }
          break;

        case 'MEDICINE_READY_FOR_PICKUP':
          if (cleaned.includes('done') || cleaned.includes('clear') || cleaned === '1') {
            nextState = 'COMPLETED';
            replyMessage = "Medicine successfully collected from Patna Counter! Status updated to COMPLETED. Health is wealth! 🩺🟢";
          } else {
            replyMessage = "Dawa collect karne ke baad Patna counter compounder screen clear karenge ya aap 'DONE' reply kijiye.";
          }
          break;

        case 'COMPLETED': {
          const currentPat = PatientService.getPatients().find(p => p.phone === phone);
          const awaitingAction = sessionData.awaitingProactiveAction;

          if (cleaned === 'yes' && awaitingAction === 'refill') {
            sessionData.awaitingProactiveAction = null;
            replyMessage = "Refill confirm ho gaya hai! 📦 Compounder ne verify kar diya hai aur Patna Pharmacy se dawa ka packet aapke address ke liye nikal raha hai. Aap is chat par track kar sakte hain. Dhanyawad!";
          } else if (cleaned === 'home' && awaitingAction === 'lab') {
            sessionData.awaitingProactiveAction = 'lab_slot';
            replyMessage = "Please select a slot:\n1. 8:00 AM\n2. 10:00 AM\n3. 4:00 PM.";
          } else if ((cleaned === 'book' || cleaned === '1') && awaitingAction === 'followup') {
            sessionData.awaitingProactiveAction = 'virtual_slot';
            nextState = 'BOOKING_VIRTUAL';
            replyMessage = `📅 *Virtual Consultation Booking* \n\nDr. Vivek has unlocked a virtual follow-up consult slot for you. \n\nPlease select your preferred slot:\n*1* - Morning Slot (10:00 AM - 11:30 AM)\n*2* - Afternoon Slot (2:00 PM - 3:30 PM)\n*3* - Evening Slot (5:00 PM - 6:30 PM)\n\nReply with **1**, **2**, or **3** to book.`;
          } else if (awaitingAction === 'lab_slot' && ['1', '2', '3'].includes(cleaned)) {
            sessionData.awaitingProactiveAction = null;
            const slotMap: Record<string, string> = { '1': '8:00 AM', '2': '10:00 AM', '3': '4:00 PM' };
            const selectedSlot = slotMap[cleaned] || '8:00 AM';

            const invoices = BillingService.getUnifiedInvoices();
            const patientInvoice = invoices.find(i => i.patientId === currentPat?.id);
            const invoiceId = patientInvoice ? patientInvoice.id : `inv-${crypto.randomUUID().substring(0, 8)}`;
            if (patientInvoice) {
              patientInvoice.totalAmount = (patientInvoice.totalAmount || 0) + 100;
              save('unified_invoices', invoices);

              supabase.from('unified_invoices').update({
                total_amount: patientInvoice.totalAmount
              }).eq('id', patientInvoice.id);
            }

            const ledgerEntries = load<FinancialLedgerEntry[]>('financial_ledgers', []);
            const doorstepSplits: FinancialLedgerEntry[] = [
              {
                id: `tx-tech-${crypto.randomUUID().substring(0, 8)}`,
                invoiceId: invoiceId,
                sourceEntityId: 'clinic-admin-entity',
                destinationEntityId: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317003',
                transactionType: 'lab_commission',
                grossAmount: 100,
                commissionRate: 0.70,
                netPayout: 70,
                paymentStatus: 'cleared',
                settledAt: new Date().toISOString(),
                createdAt: new Date().toISOString()
              },
              {
                id: `tx-lab-${crypto.randomUUID().substring(0, 8)}`,
                invoiceId: invoiceId,
                sourceEntityId: 'clinic-admin-entity',
                destinationEntityId: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317003',
                transactionType: 'lab_commission',
                grossAmount: 100,
                commissionRate: 0.20,
                netPayout: 20,
                paymentStatus: 'cleared',
                settledAt: new Date().toISOString(),
                createdAt: new Date().toISOString()
              },
              {
                id: `tx-plat-${crypto.randomUUID().substring(0, 8)}`,
                invoiceId: invoiceId,
                sourceEntityId: 'clinic-admin-entity',
                destinationEntityId: 'platform-admin-entity',
                transactionType: 'platform_fee',
                grossAmount: 100,
                commissionRate: 0.10,
                netPayout: 10,
                paymentStatus: 'cleared',
                settledAt: new Date().toISOString(),
                createdAt: new Date().toISOString()
              }
            ];

            ledgerEntries.unshift(...doorstepSplits);
            save('financial_ledgers', ledgerEntries);

            const dbSplits = doorstepSplits.map(s => ({
              invoice_id: s.invoiceId.includes('-') && s.invoiceId.length === 36 ? s.invoiceId : null,
              source_entity_id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317002',
              destination_entity_id: s.destinationEntityId === 'platform-admin-entity' ? 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317002' : s.destinationEntityId,
              transaction_type: s.transactionType,
              gross_amount: s.grossAmount,
              commission_rate: s.commissionRate * 100,
              net_payout: s.netPayout,
              payment_status: 'cleared',
              settled_at: new Date().toISOString()
            }));

            supabase.from('financial_ledgers').insert(dbSplits).then(({ error }) => {
              if (error) console.error('Error inserting doorstep splits in Supabase:', error);
            });

            replyMessage = `Home sample collection confirm ho gaya hai! 🔬 Hamare lab technician (Lalit Prasad) kal subah ${selectedSlot} par ghar aakar sample collect karenge. Dhyaan rahe ki test se 8 ghante pehle tak fasting rakhni hai. Slot lock ho gaya hai! 🟢\n\n*Premium Collection Fee breakdown*:\n- Total: ₹100.00 Collection Fee added\n- Lab Tech fuel/incentive bonus: ₹70.00\n- Lab Partner split: ₹20.00\n- Platform commission: ₹10.00`;
          } else if (cleaned.includes('refill') || cleaned.includes('medicine') || cleaned.includes('reorder') || cleaned.includes('order') || cleaned.includes('dawai')) {
            nextState = 'MEDICINE_ORDERING';
            sessionData.medicineOrderStage = 'INITIAL';
            replyMessage = "Ji bilkul! Kaunsi dawaiyaan chahiye aapko? Please unka name aur total quantity type karke bhejein (For example: 'Metformin 30 tabs'):";
          } else if (cleaned.includes('book') || cleaned.includes('virtual') || cleaned.includes('video') || cleaned.includes('tele') || cleaned.includes('consult')) {
            sessionData.awaitingProactiveAction = 'virtual_slot';
            nextState = 'BOOKING_VIRTUAL';
            replyMessage = `📅 *Virtual Consultation Booking* \n\nDr. Vivek has unlocked a virtual follow-up consult slot for you. \n\nPlease select your preferred slot:\n*1* - Morning Slot (10:00 AM - 11:30 AM)\n*2* - Afternoon Slot (2:00 PM - 3:30 PM)\n*3* - Evening Slot (5:00 PM - 6:30 PM)\n\nReply with **1**, **2**, or **3** to book.`;
          } else if (cleaned.includes('report') || cleaned.includes('pathology') || cleaned.includes('test')) {
            const approvedReports = LabService.getPathologyReports().filter(r => r.patientId === currentPat?.id && r.status === 'approved');
            if (approvedReports.length > 0) {
              const rep = approvedReports[0];
              const barcode = `MED-${rep.loincCode}-${rep.id.toUpperCase()}`;
              replyMessage = `*Aapki pathology report aa gayi hai!* 🔬\n\nPatient Name: ${rep.patientName}\nTest: ${rep.testName}\nLOINC Code: ${rep.loincCode}\nStatus: Approved 🟢\n\n*Report Summary*:\n'${rep.results}'\n\n*Security Barcode*: ${barcode}`;
            } else {
              replyMessage = "Aapka koi approved pathology report abhi on file nahi hai. Lab technician ke results update karne ka wait kijiye.";
            }
          } else if (cleaned.includes('summary') || cleaned.includes('soap') || cleaned.includes('schedule') || cleaned.includes('revisit')) {
            const completedEncounters = EncounterService.getEncounters()
              .filter(e => e.patientId === currentPat?.id && e.status === 'completed')
              .sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

            if (completedEncounters.length > 0) {
              const enc = completedEncounters[0];
              const drugTable = enc.medications.map(m => `• ${m.medicineName} (${m.dosage}) - Freq: ${m.frequency} for ${m.duration}`).join('\n');
              
              replyMessage = `*Prescription aur Doctor's Notes Summary* 🩺\n\n*Doctor Notes*:\n'${enc.clinicalNotes}'\n\n*Dawa ka Schedule*:\n${drugTable || "Koi active dawa nahi likhi gayi hai."}\n\n*Follow-Up Advice*:\nDoctor Vivek ne aapko **14 din** ke baad follow-up ke liye Patna branch mein bulaya hai. Hum aapko time par remind kar denge! 😊`;
            } else {
              replyMessage = "Aapke profile par koi completed consultation encounter nahi mila.";
            }
          } else if (['stop consent', 'stop', 'revoke'].includes(cleaned)) {
            nextState = 'AWAITING_WELCOME';
            replyMessage = "Aapka clinical consent cancel kar diya gaya hai aur profile lock ho gayi hai. Wapas shuru karne ke liye '1' reply kijiye.";
          } else {
            const clearedInvoices = BillingService.getUnifiedInvoices()
              .filter(i => i.patientId === currentPat?.id && i.paymentStatus === 'cleared')
              .sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            
            const lastPaidInvoice = clearedInvoices[0];
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
            const hasPaidInLastWeek = lastPaidInvoice && new Date(lastPaidInvoice.createdAt) >= oneWeekAgo;

            if (!hasPaidInLastWeek) {
              replyMessage = `*VitalSync AI Support Restricted* 🤖\n\nClinical AI Advice general health queries and RAG advisory are only accessible for **1 week (7 days)** after clearing your consultation/care fees. \n\n*Note*: Operational transactional features (such as booking appointments, virtual slot bookings, and medicine refills) remain **always active** for your profile. Please clear your recent dues or consult to unlock another week of rich clinical AI advice! 🟢`;
            } else {
              let chronicAdvice = "";
              if (currentPat?.chronicConditions.some(c => c.toLowerCase().includes('diabetes') || c.toLowerCase().includes('sugar'))) {
                chronicAdvice = "\n\n*Important RAG Note (Sugar patients ke liye)*: Aapka average 3-month sugar level (HbA1c 7.2%) thoda jyada hai. Meetha aur carbohydrate kam kijiye, LOINC: 4544-3 test har 3 mahine mein karayein, aur agar creatinine level 1.2 mg/dL se jyada ho toh heavy pain-killers (Ibuprofen) bilkul na lein.";
              } else {
                chronicAdvice = "\n\n*RAG Clinical Guidelines Note*: Paani khoob pijiye, low-sodium diet lijiye, aur rozana apna checkup logs maintain kijiye.";
              }

              replyMessage = `*VitalSync AI-RAG support team* 🤖\n\nAapke query '${text}' ke liye niche advice di gayi hai:\n\n*Advice*: Aaram kijiye, hydration maintain rakhein, aur daily BP/sugar monitor kijiye. Bina doctor ke pooche koi brand-name dawa mat lijiye. Agar tabiyat jyada kharab ho toh turant consult kijiye!${chronicAdvice}\n\n_Disclaimer: Yeh RAG advisory clinical guidelines (ADA/KDIGO) par based hai. Please checkup se pehle doctor se salah zaroor lein._`;
            }
          }
        }
        break;

        case 'BOOKING_VIRTUAL': {
          const currentPat = PatientService.getPatients().find(p => p.phone === phone);
          const awaitingAction = sessionData.awaitingProactiveAction;

          if (awaitingAction === 'virtual_slot' && ['1', '2', '3'].includes(cleaned)) {
            sessionData.awaitingProactiveAction = null;
            const slotMap: Record<string, string> = {
              '1': 'Morning Slot (10:00 AM - 11:30 AM)',
              '2': 'Afternoon Slot (2:00 PM - 3:30 PM)',
              '3': 'Evening Slot (5:00 PM - 6:30 PM)'
            };
            const selectedSlotText = slotMap[cleaned] || 'Morning Slot (10:00 AM - 11:30 AM)';

            if (currentPat) {
              const apptId = `appt-virt-${Date.now()}`;
              const newAppt: Appointment = {
                id: apptId,
                patientId: currentPat.id,
                doctorId: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317101', // Dr. Vivek
                status: 'ready_for_consult',
                createdAt: new Date().toISOString(),
                isVirtual: true,
                virtualDate: new Date(Date.now() + 24 * 3600 * 1000).toISOString().split('T')[0], // Tomorrow
                virtualTime: selectedSlotText,
                virtualMeetingUrl: `https://meet.jit.si/vitalsync-consult-${apptId}`,
                virtualTimeAllocated: false
              };
              BillingService.saveAppointment(newAppt);

              const runInsert = async () => {
                try {
                  const { error } = await supabase.from('appointments').insert({
                    id: apptId,
                    patient_id: currentPat.id,
                    doctor_id: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317101',
                    status: 'ready_for_consult',
                    created_at: new Date().toISOString()
                  });
                  if (error) console.error('Error creating virtual appt in Supabase:', error);
                } catch (err) {
                  console.error('Error connecting to Supabase:', err);
                }
              };
              runInsert();
            }

            nextState = 'COMPLETED';
            replyMessage = `🎉 *Virtual Appointment Booked!* \n\nSlot: *${selectedSlotText}* (Tomorrow)\n\nWe have notified Dr. Vivek. He will allocate your exact consultation timing shortly and we will notify you here with the virtual meeting link. \n\nThank you! 🩺`;
          } else {
            replyMessage = `Invalid slot selection. Please reply with **1**, **2**, or **3** to book your virtual follow-up.`;
          }
        }
        break;

        case 'FAILED_DELIVERY':
          if (cleaned) {
            nextState = 'AWAITING_WELCOME';
            replyMessage = "Re-establishing connection loop. Dobara shuru karne ke liye '1' reply kijiye.";
          }
          break;

        default:
          replyMessage = "Namaste! VitalSync Automated Assistant online. Main aapki kya sahayata kar sakta hoon?";
          break;
      }

      if (replyMessage) {
        const currentHistory = sessionData.chatHistory || [];
        currentHistory.push({ sender: 'bot', text: replyMessage, time: new Date().toISOString() });
        sessionData.chatHistory = currentHistory;
      }

      this.updateWhatsAppState(phone, nextState, sessionData);

      if (replyMessage) {
        this.sendWhatsAppMessagePayload(phone, 'mediflow_conversational_reply', { replyText: replyMessage });
      }

    } catch (e: any) {
      console.error("[Mediflow WhatsApp Bot] Error processing incoming conversational message:", e);
      writeAuditLog('SYSTEM_ERROR', {
        action: 'processIncomingWhatsAppMessage',
        error: e.message || e
      }, null);
    }
  }

  static initiateWhatsAppSession(phone: string): WhatsAppSession {
    const sessions = this.getWhatsAppSessions();
    const existing = sessions.find(s => s.patientPhone === phone);
    const welcomeText = "Hello! Welcome to VitalSync Healthcare. 🏥 To securely synchronize your clinical e-prescriptions, lab report cards, and invoices, please grant permission.";
    
    const initialChat: ChatMessage[] = [
      {
        sender: 'bot',
        text: welcomeText,
        time: new Date().toISOString()
      }
    ];

    if (existing) {
      existing.currentState = 'AWAITING_WELCOME';
      existing.lastInteraction = new Date().toISOString();
      existing.sessionData = {
        ...existing.sessionData,
        chatHistory: initialChat,
        consentGranted: false,
        consentTime: null
      };
      this.saveWhatsAppSessions(sessions);
      
      supabase.from('whatsapp_sessions').update({
        current_state: 'AWAITING_WELCOME',
        last_interaction: new Date().toISOString(),
        session_data: existing.sessionData
      }).eq('patient_phone', phone).then(({ error }) => {
        if (error) console.error('Error updating whatsapp session in Supabase:', error);
        else {
          writeAuditLog('whatsapp_session_initiated', { phone }, existing.id);
          this.sendWhatsAppMessagePayload(phone, 'mediflow_welcome', { welcome: true });
        }
      });

      return existing;
    }

    const newId = crypto.randomUUID();
    const newSession: WhatsAppSession = {
      id: newId,
      patientPhone: phone,
      currentState: 'AWAITING_WELCOME',
      lastInteraction: new Date().toISOString(),
      sessionData: {
        chatHistory: initialChat,
        consentGranted: false,
        consentTime: null
      }
    };
    sessions.push(newSession);
    this.saveWhatsAppSessions(sessions);

    supabase.from('patient_registry').select('id').eq('phone', phone).single().then(({ data: patient }) => {
      supabase.from('whatsapp_sessions').upsert({
        patient_phone: phone,
        patient_id: patient?.id || null,
        current_state: 'AWAITING_WELCOME',
        last_interaction: new Date().toISOString(),
        session_data: newSession.sessionData
      }, { onConflict: 'patient_phone' }).then(({ error }) => {
        if (error) console.error('Error creating whatsapp session in Supabase:', error);
        else {
          writeAuditLog('whatsapp_session_created', { phone }, newId);
          this.sendWhatsAppMessagePayload(phone, 'mediflow_welcome', { welcome: true });
        }
      });
    });

    return newSession;
  }

  static updateWhatsAppState(phone: string, state: WhatsAppSession['currentState'], data: Record<string, any> = {}): void {
    try {
      const sessions = this.getWhatsAppSessions();
      const idx = sessions.findIndex(s => s.patientPhone === phone);
      if (idx !== -1) {
        sessions[idx].currentState = state;
        sessions[idx].lastInteraction = new Date().toISOString();
        sessions[idx].sessionData = { ...sessions[idx].sessionData, ...data, currentState: state };
        this.saveWhatsAppSessions(sessions);

        supabase.from('whatsapp_sessions').select('session_data').eq('patient_phone', phone).single().then(({ data: dbSess }) => {
          const mergedData = { ...(dbSess?.session_data || {}), ...data, currentState: state };
          
          const allowed = ['AWAITING_WELCOME', 'AWAITING_CONFIRMATION', 'AWAITING_PAYMENT', 'BOOKING_VIRTUAL', 'COMPLETED', 'INACTIVE'];
          let dbState: string = state;
          if (!allowed.includes(state)) {
            if (state === 'AWAITING_CONSENT') dbState = 'AWAITING_WELCOME';
            else if (state === 'AWAITING_WELCOME_ACK') dbState = 'AWAITING_CONFIRMATION';
            else if (state === 'MEDICINE_ORDERING') dbState = 'BOOKING_VIRTUAL';
            else if (state === 'MEDICINE_AWAITING_PAYMENT') dbState = 'AWAITING_PAYMENT';
            else if (state === 'MEDICINE_READY_FOR_PICKUP') dbState = 'COMPLETED';
            else if (state === 'FAILED_DELIVERY') dbState = 'INACTIVE';
            else dbState = 'AWAITING_WELCOME';
          }

          supabase.from('whatsapp_sessions').update({
            current_state: dbState,
            last_interaction: new Date().toISOString(),
            session_data: mergedData
          }).eq('patient_phone', phone).then(({ error }) => {
            if (error) console.error('Error updating whatsapp state in Supabase:', error);
            else writeAuditLog('whatsapp_session_state_updated', { phone, state: dbState }, sessions[idx].id);
          });
        });
      }
    } catch (e) {
      console.error("[Mediflow WhatsApp Bot] Error in updateWhatsAppState:", e);
    }
  }

  static dispatchWhatsAppLoyaltyOffer(patientId: string, offerType: string): string {
    const patients = PatientService.getPatients();
    const patient = patients.find(p => p.id === patientId);
    if (!patient) return 'Patient not found.';

    let message = '';
    if (offerType === 'discount_30') {
      message = `*VitalSync Patient Care Loyalty:* Dear ${patient.name}, as part of your ongoing care pod benefits, here is a special coupon for **30% Off on your next medicine refill** at our adjacent Pharmacy. Code: **MF-LOYAL30**`;
    } else if (offerType === 'virtual_appointment') {
      message = `*VitalSync Care Loyalty:* Dear ${patient.name}, thank you for your recent visit. To support your clinical path, a **Free Virtual Follow-up Appointment with the Doctor** is unlocked for you in 10 days. Book directly via this chat.`;
    } else {
      message = `*VitalSync Connect:* Quick Portal Link enabled for Patient ${patient.name} to view invoices and schedule pathology sample collection.`;
    }

    writeAuditLog('LOYALTY_OFFER_DISPATCHED', {
      patientId,
      patientName: patient.name,
      offerType,
      message
    });

    this.pushWhatsAppMessageFromBot(patient.phone, message);
    return message;
  }

  static pushWhatsAppMessageFromBot(phone: string, text: string): void {
    const sessions = this.getWhatsAppSessions();
    const existing = sessions.find(s => s.patientPhone === phone);
    if (existing) {
      const currentHistory = existing.sessionData.chatHistory || [];
      currentHistory.push({ sender: 'bot', text, time: new Date().toISOString() });
      existing.sessionData = {
        ...existing.sessionData,
        chatHistory: currentHistory
      };
      this.saveWhatsAppSessions(sessions);
      
      supabase.from('whatsapp_sessions').update({
        session_data: existing.sessionData,
        last_interaction: new Date().toISOString()
      }).eq('patient_phone', phone).then(({ error }) => {
        if (error) console.error('Error updating whatsapp session:', error);
        else writeAuditLog('WHATSAPP_BOT_OUTGOING_MESSAGE', { phone, message: text }, existing.id);
      });
    }
  }

  static triggerProactiveRefillNudge(phone: string): void {
    const patient = PatientService.getPatients().find(p => p.phone === phone);
    if (!patient) return;

    const completedInvoices = BillingService.getUnifiedInvoices()
      .filter(i => i.patientId === patient.id && i.paymentStatus === 'cleared');
    const totalSpent = completedInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);

    if (totalSpent < 1000) {
      console.warn(`[Mediflow DevSecOps] Proactive Refill Nudge Restrained: Patient ${patient.name} has low-value threshold (Spent: ₹${totalSpent} < ₹1000).`);
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: 'Marketing Nudge Restrained 🛡️',
          message: `Blocked auto-refill alert for ${patient.name} due to low-value threshold (Spent: ₹${totalSpent} < ₹1000).`,
          type: 'warning'
        }
      }));
      return;
    }

    const message = `Hello ${patient.name}! 😊 We noticed your generic medication dosage is running low (only 5 days left!). 💊\n\nTo ensure uninterrupted treatment, we have pre-allocated a fresh, quality-checked pack for you at our Patna Pod pharmacy counter. \n\n*Reply 'YES' to confirm and immediately dispatch your medicine refill package to your home!*`;
    
    const sessions = this.getWhatsAppSessions();
    const existing = sessions.find(s => s.patientPhone === phone);
    if (existing) {
      existing.sessionData = {
        ...existing.sessionData,
        awaitingProactiveAction: 'refill'
      };
      this.saveWhatsAppSessions(sessions);
    }
    
    this.pushWhatsAppMessageFromBot(phone, message);
    writeAuditLog('PROACTIVE_REFILL_NUDGE_SENT', { phone, patientName: patient.name }, null);
  }

  static triggerProactiveFollowUpNudge(phone: string): void {
    const patient = PatientService.getPatients().find(p => p.phone === phone);
    if (!patient) return;

    const completedInvoices = BillingService.getUnifiedInvoices()
      .filter(i => i.patientId === patient.id && i.paymentStatus === 'cleared');
    const totalSpent = completedInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);

    if (totalSpent < 1000) {
      console.warn(`[Mediflow DevSecOps] Proactive Followup Nudge Restrained: Patient ${patient.name} has low-value threshold (Spent: ₹${totalSpent} < ₹1000).`);
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: 'Marketing Nudge Restrained 🛡️',
          message: `Blocked follow-up scheduling alert for ${patient.name} due to low-value threshold (Spent: ₹${totalSpent} < ₹1000).`,
          type: 'warning'
        }
      }));
      return;
    }

    const message = `Hello ${patient.name}! 😊 Hope you are recovering well. \n\nDr. Vivek recommended a follow-up consultation in 3 days to evaluate your progress. \n\n*Reply 'BOOK' or '1' to lock a convenient Virtual Video Consultation slot immediately!*`;
    
    const sessions = this.getWhatsAppSessions();
    const existing = sessions.find(s => s.patientPhone === phone);
    if (existing) {
      existing.sessionData = {
        ...existing.sessionData,
        awaitingProactiveAction: 'followup'
      };
      this.saveWhatsAppSessions(sessions);
    }

    this.pushWhatsAppMessageFromBot(phone, message);
    writeAuditLog('PROACTIVE_FOLLOWUP_NUDGE_SENT', { phone, patientName: patient.name }, null);
  }

  static triggerProactiveLabCollectionNudge(phone: string): void {
    const patient = PatientService.getPatients().find(p => p.phone === phone);
    if (!patient) return;

    const completedInvoices = BillingService.getUnifiedInvoices()
      .filter(i => i.patientId === patient.id && i.paymentStatus === 'cleared');
    const totalSpent = completedInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);

    if (totalSpent < 1000) {
      console.warn(`[Mediflow DevSecOps] Proactive Lab Nudge Restrained: Patient ${patient.name} has low-value threshold (Spent: ₹${totalSpent} < ₹1000).`);
      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: 'Marketing Nudge Restrained 🛡️',
          message: `Blocked lab collection alert for ${patient.name} due to low-value threshold (Spent: ₹${totalSpent} < ₹1000).`,
          type: 'warning'
        }
      }));
      return;
    }

    const message = `Hi ${patient.name}! 🔬 Our records show you have a pending sugar level test (HbA1c test) ordered by Dr. Vivek. Reagents are currently locked for your slot. \n\n*Would you like our lab team to collect your blood sample from your home tomorrow morning at 8:00 AM? Reply 'HOME' to schedule.*`;
    
    const sessions = this.getWhatsAppSessions();
    const existing = sessions.find(s => s.patientPhone === phone);
    if (existing) {
      existing.sessionData = {
        ...existing.sessionData,
        awaitingProactiveAction: 'lab'
      };
      this.saveWhatsAppSessions(sessions);
    }

    this.pushWhatsAppMessageFromBot(phone, message);
    writeAuditLog('PROACTIVE_LAB_NUDGE_SENT', { phone, patientName: patient.name }, null);
  }

  static async referPatientToSpecialist(phone: string, targetDoctorId: string): Promise<void> {
    try {
      const sessions = this.getWhatsAppSessions();
      const sessionIndex = sessions.findIndex(s => s.patientPhone === phone);
      const patient = PatientService.getPatients().find(p => p.phone === phone);
      if (sessionIndex === -1 || !patient) {
        console.warn(`[Mediflow Referrals] Session or Patient not found for phone ${phone}`);
        return;
      }

      const session = sessions[sessionIndex];

      let doctorName = "Dr. Sinha";
      let specialty = "Cardiologist";
      if (targetDoctorId === 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317103') {
        doctorName = "Dr. Sinha";
        specialty = "Cardiologist";
      } else if (targetDoctorId === 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317102') {
        doctorName = "Dr. Anjali";
        specialty = "Gynecologist";
      } else if (targetDoctorId === 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317101') {
        doctorName = "Dr. Raj";
        specialty = "Pediatrician";
      }

      const nudgeMessage = `Dr. Vivek has referred you to ${specialty} ${doctorName}. Reply 'BOOK' to schedule your slot. 🩺`;

      const referralData = {
        referredByDoctorId: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317101',
        referredToDoctorId: targetDoctorId,
        specialty,
        doctorName,
        referralCommissionAmt: 50.00
      };

      const sessionData = {
        ...session.sessionData,
        referral: referralData
      };

      this.updateWhatsAppState(phone, 'AWAITING_WELCOME', sessionData);
      this.pushWhatsAppMessageFromBot(phone, nudgeMessage);
      await writeAuditLog('PATIENT_REFERRAL_INITIATED', { phone, targetDoctorId, specialty, doctorName }, patient.id);

      window.dispatchEvent(new CustomEvent('mediflow-toast', {
        detail: {
          title: 'Referral Nudge Sent! 📣',
          message: `Referral nudge sent to ${patient.name} via WhatsApp. Awaiting BOOK response.`,
          type: 'success'
        }
      }));
    } catch (err) {
      console.error('[Mediflow Referrals] Error initiating referral:', err);
    }
  }
}
