import { supabase } from '../lib/supabaseClient';
import { load, save, writeAuditLog, notify } from './apiHelper';
import type { ClinicStaff } from '../types';

export class StaffService {
  static getClinicStaff(): ClinicStaff[] {
    return load<ClinicStaff[]>('clinic_staff', []);
  }

  static registerClinicStaff(name: string, role: 'compounder' | 'receptionist' | 'admin'): void {
    const newStaff: ClinicStaff = {
      id: crypto.randomUUID(),
      entityId: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317002',
      staffName: name,
      role,
      isActive: true,
      createdAt: new Date().toISOString()
    };
    const staffList = this.getClinicStaff();
    staffList.push(newStaff);
    save('clinic_staff', staffList);
    notify();

    supabase.from('clinic_staff').insert({
      id: newStaff.id,
      entity_id: newStaff.entityId,
      staff_name: newStaff.staffName,
      role: newStaff.role,
      is_active: newStaff.isActive,
      created_at: newStaff.createdAt
    }).then(({ error }) => {
      if (error) console.error('Error inserting clinic staff into Supabase:', error);
      else {
        writeAuditLog('clinic_staff_registered', { staffId: newStaff.id, name, role }, newStaff.id);
      }
    });
  }

  static toggleStaffActive(staffId: string, isActive: boolean): void {
    const staffList = this.getClinicStaff();
    const idx = staffList.findIndex(s => s.id === staffId);
    if (idx !== -1) {
      staffList[idx].isActive = isActive;
      save('clinic_staff', staffList);
      notify();

      supabase.from('clinic_staff').update({
        is_active: isActive
      }).eq('id', staffId).then(({ error }) => {
        if (error) console.error('Error updating clinic staff in Supabase:', error);
        else {
          writeAuditLog('clinic_staff_shift_toggled', { staffId, isActive }, staffId);
        }
      });
    }
  }

  static getActiveStaffId(): string | null {
    return localStorage.getItem('active_staff_id');
  }

  static setActiveStaffId(staffId: string | null): void {
    if (staffId) {
      localStorage.setItem('active_staff_id', staffId);
    } else {
      localStorage.removeItem('active_staff_id');
    }
    notify();
  }
}
