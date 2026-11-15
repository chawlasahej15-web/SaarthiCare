import { describe, expect, it } from 'vitest';
import { canManageAppointments, canManageMedications, canWriteCareNotes, roleLabel } from '../src/services/permissions';
import type { CareMember } from '../src/types';

const family: CareMember = { id: 'f', name: 'Rohan', email: 'rohan@example.test', role: 'family', relationship: 'Son', initials: 'RM', color: 'avatar-lilac', status: 'active', permissions: { manageMedications: false, manageAppointments: false, writeCareNotes: false, inviteMembers: false } };
const caregiver: CareMember = { ...family, id: 'c', role: 'caregiver', permissions: { manageMedications: true, manageAppointments: true, writeCareNotes: true, inviteMembers: false } };

describe('role capability helpers', () => {
  it('keeps a read-only family member from management actions by default', () => {
    expect(canManageMedications(family)).toBe(false);
    expect(canManageAppointments(family)).toBe(false);
    expect(canWriteCareNotes(family)).toBe(false);
  });
  it('respects caregiver permissions', () => {
    expect(canManageMedications(caregiver)).toBe(true);
    expect(canManageAppointments(caregiver)).toBe(true);
    expect(canWriteCareNotes(caregiver)).toBe(true);
  });
  it('maps internal roles to readable labels', () => {
    expect(roleLabel('family')).toBe('Family member');
  });
});
