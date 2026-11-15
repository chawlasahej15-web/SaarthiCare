import {
  collection, doc, getDoc, onSnapshot, query, where,
  type DocumentData, type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { initials } from '../lib/utils';
import type { Appointment, SaarthiCareState, CareMember, CareNote, DoseLog, Medication, NotificationPreference, Role } from '../types';

function toIso(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === 'object' && 'toDate' in value) {
    const maybeTimestamp = value as { toDate?: () => Date };
    if (typeof maybeTimestamp.toDate === 'function') return maybeTimestamp.toDate().toISOString();
  }
  return new Date().toISOString();
}

function stringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function boolValue(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function mapMedication(id: string, data: DocumentData): Medication {
  return {
    id, name: stringValue(data.name, 'Medication'), dosage: stringValue(data.dosage),
    instructions: stringValue(data.instructions), frequency: stringValue(data.frequency),
    times: Array.isArray(data.times) ? data.times.filter((time: unknown): time is string => typeof time === 'string') : [],
    startDate: toIso(data.startDate).slice(0, 10), endDate: typeof data.endDate === 'string' ? data.endDate : undefined,
    prescribingDoctor: stringValue(data.prescribingDoctor), active: boolValue(data.active, true),
    category: ['tablet', 'capsule', 'liquid', 'other'].includes(String(data.category)) ? data.category : 'other',
  };
}

function mapDoseLog(id: string, data: DocumentData): DoseLog {
  const validStatus = ['pending', 'taken', 'skipped', 'missed'].includes(String(data.status));
  return { id, medicationId: stringValue(data.medicationId), scheduledAt: toIso(data.scheduledAt), status: validStatus ? data.status : 'pending', confirmedBy: stringValue(data.confirmedBy) || undefined, confirmedAt: data.confirmedAt ? toIso(data.confirmedAt) : undefined, note: stringValue(data.note) || undefined };
}

function mapAppointment(id: string, data: DocumentData): Appointment {
  return { id, doctorName: stringValue(data.doctorName), specialty: stringValue(data.specialty), dateTime: toIso(data.dateTime), location: stringValue(data.location), notes: stringValue(data.notes), status: ['scheduled', 'completed', 'cancelled'].includes(String(data.status)) ? data.status : 'scheduled', createdBy: stringValue(data.createdByName, 'Care circle') };
}

function mapMember(id: string, data: DocumentData): CareMember {
  const role = ['patient', 'caregiver', 'family', 'owner'].includes(String(data.role)) ? data.role as Role : 'family';
  const name = stringValue(data.displayName, stringValue(data.name, 'Care circle member'));
  const permissions = data.permissions && typeof data.permissions === 'object' ? data.permissions as Record<string, unknown> : {};
  return {
    id: stringValue(data.uid, id), name, email: stringValue(data.email), role,
    relationship: stringValue(data.relationship, role === 'owner' ? 'Profile owner' : role === 'caregiver' ? 'Caregiver' : 'Family member'),
    initials: initials(name), color: role === 'caregiver' ? 'avatar-peach' : role === 'family' ? 'avatar-lilac' : 'avatar-teal',
    status: data.status === 'pending' ? 'pending' : 'active',
    permissions: { manageMedications: boolValue(permissions.manageMedications), manageAppointments: boolValue(permissions.manageAppointments), writeCareNotes: boolValue(permissions.writeCareNotes), inviteMembers: boolValue(permissions.inviteMembers) },
  };
}

function mapCareNote(id: string, data: DocumentData): CareNote {
  const role = ['patient', 'caregiver', 'family', 'owner'].includes(String(data.authorRole)) ? data.authorRole as Role : 'family';
  return { id, author: stringValue(data.authorName, 'Care circle member'), authorRole: role, createdAt: toIso(data.createdAt), title: stringValue(data.title), body: stringValue(data.body) };
}

export function subscribeToSaarthiCare(uid: string, displayName: string, email: string, onState: (state: SaarthiCareState) => void, onError: (error: Error) => void): Unsubscribe {
  if (!db) throw new Error('Firebase Firestore is not configured.');
  const firestore = db;
  let patientId = '';
  let membershipRole: Role = 'owner';
  let memberPreferences: NotificationPreference = { emailMedicationReminders: true, emailMissedDoseAlerts: true, emailAppointmentReminders: true, pushNotifications: false };
  let profile: DocumentData = {};
  type CollectionName =
  | 'medications'
  | 'doseLogs'
  | 'appointments'
  | 'careCircleMembers'
  | 'careNotes'
  | 'auditLogs';

type Row = { id: string; data: DocumentData };

const rows: Record<CollectionName, Row[]> = { medications: [], doseLogs: [], appointments: [], careCircleMembers: [], careNotes: [], auditLogs: [] };
  const loaded = new Set<string>();
  let innerUnsubs: Unsubscribe[] = [];

  const emit = () => {
    if (!patientId || !loaded.has('profile') || !loaded.has('users')) return;
    const name = stringValue(profile.displayName, displayName || 'Patient');
    const userMember = rows.careCircleMembers.find((row) => row.data.uid === uid)?.data;
    if (userMember) {
      membershipRole = ['patient', 'caregiver', 'family', 'owner'].includes(String(userMember.role)) ? userMember.role as Role : 'family';
      const preferences = userMember.notificationPreferences as Record<string, unknown> | undefined;
      if (preferences) memberPreferences = {
        emailMedicationReminders: boolValue(preferences.emailMedicationReminders, true),
        emailMissedDoseAlerts: boolValue(preferences.emailMissedDoseAlerts, true),
        emailAppointmentReminders: boolValue(preferences.emailAppointmentReminders, true),
        pushNotifications: boolValue(preferences.pushNotifications),
      };
    }
    const mappedMembers = rows.careCircleMembers.map((row) => mapMember(row.id, row.data));
    const userRecord = (profile.userRecord ?? {}) as DocumentData;
    const activity = rows.auditLogs.map((row) => ({
      id: row.id, actor: stringValue(row.data.actorName, 'Care circle member'), action: stringValue(row.data.action), detail: stringValue(row.data.detail), createdAt: toIso(row.data.createdAt),
      type: (['medication', 'appointment', 'note', 'member', 'dose'].includes(String(row.data.type)) ? row.data.type : 'note') as SaarthiCareState['activity'][number]['type'],
    })).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    onState({
      patientId, patientName: name, patientEmail: stringValue(profile.email, email), patientAge: Number(profile.age ?? 70), patientInitials: initials(name),
      activeRole: membershipRole, currentUserName: displayName || stringValue(userRecord.displayName, email.split('@')[0] ?? 'Member'), currentUserEmail: email, currentUserId: uid,
      medications: rows.medications.map((row) => mapMedication(row.id, row.data)),
      doseLogs: rows.doseLogs.map((row) => mapDoseLog(row.id, row.data)),
      appointments: rows.appointments.map((row) => mapAppointment(row.id, row.data)),
      members: mappedMembers,
      notes: rows.careNotes.map((row) => mapCareNote(row.id, row.data)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      activity,
      preferences: memberPreferences,
      textScale: (localStorage.getItem('saarthicare-text-scale') as SaarthiCareState['textScale'] | null) ?? 'normal',
    });
  };

  const membershipQuery = query(collection(db, 'careCircleMembers'), where('uid', '==', uid), where('status', '==', 'active'));
  const unsubscribeMembership = onSnapshot(membershipQuery, async (snapshot) => {
    const membership = snapshot.docs[0];
    if (!membership) { onError(new Error('No active care circle found for this account. Create a patient profile or redeem an invitation.')); return; }
    const nextPatientId = stringValue(membership.data().patientId);
    if (!nextPatientId) { onError(new Error('Care circle membership is missing a patient profile reference.')); return; }
    if (patientId === nextPatientId && innerUnsubs.length) return;
    innerUnsubs.forEach((unsubscribe) => unsubscribe());
    innerUnsubs = [];
    patientId = nextPatientId;
    membershipRole = membership.data().role as Role;
    loaded.clear();
    const userRef = doc(firestore, 'users', uid);
    const profileRef = doc(firestore, 'patientProfiles', patientId);
    innerUnsubs.push(onSnapshot(userRef, (userSnapshot) => {
      profile.userRecord = userSnapshot.data() ?? {};
      loaded.add('users'); emit();
    }, (error) => onError(error)));
    innerUnsubs.push(onSnapshot(profileRef, (profileSnapshot) => {
      if (!profileSnapshot.exists()) { onError(new Error('The patient profile could not be found.')); return; }
      profile = { ...profile, ...profileSnapshot.data() };
      loaded.add('profile'); emit();
    }, (error) => onError(error)));
    const collections = ['medications', 'doseLogs', 'appointments', 'careCircleMembers', 'careNotes', 'auditLogs'] as const;
    for (const collectionName of collections) {
      const q = query(collection(firestore, collectionName), where('patientId', '==', patientId));
      innerUnsubs.push(onSnapshot(q, (collectionSnapshot) => {
        rows[collectionName] = collectionSnapshot.docs.map((entry) => ({ id: entry.id, data: entry.data() }));
        loaded.add(collectionName); emit();
      }, (error) => onError(error)));
    }
  }, (error) => onError(error));

  return () => { unsubscribeMembership(); innerUnsubs.forEach((unsubscribe) => unsubscribe()); };
}

export async function readUserDoc(uid: string): Promise<DocumentData | undefined> {
  if (!db) return undefined;
  const snapshot = await getDoc(doc(db, 'users', uid));
  return snapshot.data();
}
