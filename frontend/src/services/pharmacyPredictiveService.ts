import { load, save } from './apiHelper';
import { WhatsAppTemplateEngine } from './whatsappTemplateEngine';
import { WhatsAppService } from './whatsappService';

export interface PurchaseOrderDraft {
  id: string;
  distributorName: string;
  medicineName: string;
  suggestedQuantity: number;
  urgency: 'routine' | 'critical';
  reason: string;
  generatedAt: string;
}

export class PharmacyPredictiveService {
  /**
   * Calculates the projected burn rate of inventory based on recent prescriptions.
   * Autonomously generates a Purchase Order (PO) Draft if inventory falls below the 7-day safety buffer.
   */
  public static async calculateInventoryBurnRate(): Promise<PurchaseOrderDraft[]> {
    const allInventory = load<any[]>('pharmacy_inventory', []);
    const allPrescriptions = load<any[]>('saas_prescriptions', []);
    
    // Only look at prescriptions from the last 7 days to determine active run-rate
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const activePrescriptions = allPrescriptions.filter(rx => rx.createdAt >= sevenDaysAgo);

    const burnRates: Record<string, number> = {};

    // 1. Calculate Daily Burn Rate per medicine
    for (const rx of activePrescriptions) {
      if (!rx.medications) continue;
      for (const med of rx.medications) {
        const key = med.medicineName.toLowerCase();
        // Extract frequency (e.g. "1-0-1" = 2 per day)
        const parts = (med.frequency || '1-0-0').split('-');
        let dailyDose = 0;
        parts.forEach((p: string) => dailyDose += (parseInt(p) || 0));
        
        burnRates[key] = (burnRates[key] || 0) + dailyDose;
      }
    }

    const generatedPOs: PurchaseOrderDraft[] = [];

    // 2. Cross-reference Burn Rate with Current Stock
    for (const item of allInventory) {
      const key = (item.medicineName || '').toLowerCase();
      const dailyBurn = (burnRates[key] || 0) / 7; // Average daily burn over last 7 days
      
      if (dailyBurn > 0) {
        const daysRemaining = Math.floor((item.currentStock || 0) / dailyBurn);
        
        // 3. Trigger 7-Day Safety Buffer Restock
        if (daysRemaining <= 7) {
          const po: PurchaseOrderDraft = {
            id: crypto.randomUUID(),
            distributorName: 'Default Local Distributor', // Real OS maps to local distributor CRM
            medicineName: item.medicineName,
            suggestedQuantity: Math.ceil(dailyBurn * 30), // Restock for 30 days
            urgency: daysRemaining <= 2 ? 'critical' : 'routine',
            reason: `Predicted depletion in ${daysRemaining} days (Burn rate: ${dailyBurn.toFixed(1)}/day).`,
            generatedAt: new Date().toISOString()
          };
          generatedPOs.push(po);
        }
      }
    }

    // 4. Save PO Drafts (for Pharmacy Dashboard consumption)
    const existingPOs = load<PurchaseOrderDraft[]>('pharmacy_po_drafts', []);
    const updatedPOs = [...existingPOs, ...generatedPOs];
    save('pharmacy_po_drafts', updatedPOs);

    // 5. Notify Pharmacy/Admin if critical shortages are imminent
    const criticalShortages = generatedPOs.filter(p => p.urgency === 'critical');
    if (criticalShortages.length > 0) {
      const adminPhone = "+919999999999"; // Read from clinic_sops
      let alertMsg = `🚨 *VITALSYNC AI INVENTORY ALERT*\n\n`;
      alertMsg += `The following medicines will run out of stock in < 48 hours based on doctor prescription rates:\n`;
      criticalShortages.forEach(p => {
         alertMsg += `• ${p.medicineName} (${p.reason})\n`;
      });
      alertMsg += `\nAuto-Purchase Orders have been drafted in the Pharmacy Dashboard.`;
      
      WhatsAppService.pushWhatsAppMessageFromBot(adminPhone, alertMsg);
    }

    return generatedPOs;
  }
}
