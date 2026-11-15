import type { CareMember, Role } from '../types';

// Client-side convenience only. Firestore rules and trusted Cloud Functions enforce production access.
export function canManageMedications(member: CareMember | undefined): boolean {
  return Boolean(member && (member.role === 'owner' || member.permissions.manageMedications));
}

export function canManageAppointments(member: CareMember | undefined): boolean {
  return Boolean(member && (member.role === 'owner' || member.permissions.manageAppointments));
}

export function canWriteCareNotes(member: CareMember | undefined): boolean {
  return Boolean(member && (member.role === 'owner' || member.permissions.writeCareNotes));
}

export function roleLabel(role: Role): string {
  return ({ patient: 'Patient', caregiver: 'Caregiver', family: 'Family member', owner: 'Profile owner' })[role];
}
