// VitalSync Clinic OS — ABDM ABHA ID Integration Service (Mock / Sandbox)
import { api } from './api';

export interface AbhaCreationResponse {
  success: boolean;
  txnId?: string;
  message: string;
}

export interface AbhaVerificationResponse {
  success: boolean;
  abhaId?: string;
  abhaAddress?: string;
  message: string;
}

export class AbhaService {
  /**
   * Phase 1: Request Aadhaar OTP from NHA Sandbox
   * @param aadhaarNumber 12-digit Aadhaar
   */
  static async requestAadhaarOtp(aadhaarNumber: string): Promise<AbhaCreationResponse> {
    console.log(`[ABDM Sandbox] Requesting OTP for Aadhaar: ${aadhaarNumber}`);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    if (aadhaarNumber.length !== 12) {
      return { success: false, message: 'Invalid Aadhaar Number length. Must be 12 digits.' };
    }

    // Mock successful transaction ID
    return {
      success: true,
      txnId: `txn-${Math.random().toString(36).substring(2, 10)}`,
      message: 'OTP sent to Aadhaar-linked mobile number.'
    };
  }

  /**
   * Phase 2: Verify OTP and Generate/Retrieve ABHA ID
   * @param txnId Transaction ID from requestAadhaarOtp
   * @param otp 6-digit OTP
   */
  static async verifyOtpAndLink(txnId: string, otp: string, patientName: string): Promise<AbhaVerificationResponse> {
    console.log(`[ABDM Sandbox] Verifying OTP ${otp} for txn ${txnId}`);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    if (otp !== '123456' && otp !== '000000') { // 123456 is our mock success OTP
      return { success: false, message: 'Invalid or expired OTP. Please try again.' };
    }

    // Generate a realistic looking ABHA ID
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const firstName = patientName.split(' ')[0].toLowerCase().replace(/[^a-z]/g, '');
    const abhaNumber = `14-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`;
    const abhaAddress = `${firstName}${randomSuffix}@abdm`;

    return {
      success: true,
      abhaId: abhaNumber,
      abhaAddress: abhaAddress,
      message: 'ABHA ID successfully linked and generated.'
    };
  }
}
