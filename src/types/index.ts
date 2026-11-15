export type Role = 'patient' | 'caregiver' | 'family' | 'owner';
export type DoseStatus = 'pending' | 'taken' | 'skipped' | 'missed';

export interface MemberPermissions {
  manageMedications: boolean;
  manageAppointments: boolean;
  writeCareNotes: boolean;
  inviteMembers: boolean;
}

export interface CareMember {
  id: string;
  name: string;
  email: string;
  role: Role;
  relationship: string;
  initials: string;
  color: string;
  status: 'active' | 'pending';
  permissions: MemberPermissions;
}

export interface Medication {
  id: string;
  name: string;
  dosage: string;
  instructions: string;
  frequency: string;
  times: string[];
  startDate: string;
  endDate?: string;
  prescribingDoctor: string;
  active: boolean;
  category: 'tablet' | 'capsule' | 'liquid' | 'other';
}

export interface DoseLog {
  id: string;
  medicationId: string;
  scheduledAt: string;
  status: DoseStatus;
  confirmedBy?: string;
  confirmedAt?: string;
  note?: string;
}

export interface Appointment {
  id: string;
  doctorName: string;
  specialty: string;
  dateTime: string;
  location: string;
  notes: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  createdBy: string;
}

export interface CareNote {
  id: string;
  author: string;
  authorRole: Role;
  createdAt: string;
  title: string;
  body: string;
}

export interface ActivityItem {
  id: string;
  actor: string;
  action: string;
  detail: string;
  createdAt: string;
  type: 'medication' | 'appointment' | 'note' | 'member' | 'dose';
}

export interface NotificationPreference {
  emailMedicationReminders: boolean;
  emailMissedDoseAlerts: boolean;
  emailAppointmentReminders: boolean;
  pushNotifications: boolean;
}

export interface SaarthiCareState {
  patientId: string;
  patientName: string;
  patientEmail: string;
  patientAge: number;
  patientInitials: string;
  activeRole: Role;
  currentUserName: string;
  currentUserEmail: string;
  currentUserId: string;
  medications: Medication[];
  doseLogs: DoseLog[];
  appointments: Appointment[];
  members: CareMember[];
  notes: CareNote[];
  activity: ActivityItem[];
  preferences: NotificationPreference;
  textScale: 'normal' | 'large' | 'largest';
}

export interface AddMedicationInput {
  name: string;
  dosage: string;
  instructions: string;
  frequency: string;
  times: string[];
  prescribingDoctor: string;
  category: Medication['category'];
}

export interface AddAppointmentInput {
  doctorName: string;
  specialty: string;
  dateTime: string;
  location: string;
  notes: string;
}
