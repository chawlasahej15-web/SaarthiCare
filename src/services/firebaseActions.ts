import { addDoc, collection, doc, getDocs, query, serverTimestamp, Timestamp, updateDoc, where, writeBatch } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../lib/firebase';
import type { AddAppointmentInput, AddMedicationInput, MemberPermissions, NotificationPreference } from '../types';

function requireFirestore() {
  if (!db) throw new Error('Firebase Firestore is not configured.');
  return db;
}
function requireFunctions() {
  if (!functions) throw new Error('Firebase Cloud Functions are not configured.');
  return functions;
}

export async function createMedicationRecord(patientId: string, uid: string, patientName: string, input: AddMedicationInput) {
  const firestore = requireFirestore();
  const batch = writeBatch(firestore);
  const medicationRef = doc(collection(firestore, 'medications'));
  const scheduleRef = doc(collection(firestore, 'medicationSchedules'));
  batch.set(medicationRef, {
    patientId, name: input.name, dosage: input.dosage, instructions: input.instructions,
    frequency: input.frequency, times: input.times, prescribingDoctor: input.prescribingDoctor,
    category: input.category, active: true, startDate: new Date().toISOString().slice(0, 10),
    createdBy: uid, createdAt: serverTimestamp(),
  });
  batch.set(scheduleRef, {
    patientId, medicationId: medicationRef.id, medicationName: input.name, patientName,
    times: input.times, startDate: new Date().toISOString().slice(0, 10), active: true, createdBy: uid, createdAt: serverTimestamp(),
  });
  await batch.commit();
}

export async function setMedicationActive(patientId: string, medicationId: string, active: boolean) {
  const firestore = requireFirestore();
  const batch = writeBatch(firestore);
  batch.update(doc(firestore, 'medications', medicationId), { active, updatedAt: serverTimestamp() });
  const schedules = await getDocs(query(collection(firestore, 'medicationSchedules'), where('patientId', '==', patientId), where('medicationId', '==', medicationId)));
  schedules.docs.forEach((schedule) => batch.update(schedule.ref, { active, updatedAt: serverTimestamp() }));
  await batch.commit();
}

export async function recordDoseConfirmation(doseId: string, status: 'taken' | 'skipped') {
  const callable = httpsCallable(requireFunctions(), 'confirmDose');
  await callable({ doseId, status });
}

export async function createAppointmentRecord(patientId: string, uid: string, userName: string, input: AddAppointmentInput) {
  await addDoc(collection(requireFirestore(), 'appointments'), {
    patientId, doctorName: input.doctorName, specialty: input.specialty,
    dateTime: Timestamp.fromDate(new Date(input.dateTime)), location: input.location,
    notes: input.notes, status: 'scheduled', createdBy: uid, createdByName: userName,
    createdAt: serverTimestamp(),
  });
}

export async function setAppointmentCancelled(appointmentId: string) {
  await updateDoc(doc(requireFirestore(), 'appointments', appointmentId), { status: 'cancelled', updatedAt: serverTimestamp() });
}

export async function createCareNoteRecord(patientId: string, uid: string, userName: string, role: string, title: string, body: string) {
  await addDoc(collection(requireFirestore(), 'careNotes'), {
    patientId, authorUid: uid, authorName: userName, authorRole: role, title, body,
    createdAt: serverTimestamp(),
  });
}

export async function createSecureInvitation(patientId: string, role: 'caregiver' | 'family', inviteeEmail?: string) {
  const callable = httpsCallable<{ patientId: string; role: 'caregiver' | 'family'; inviteeEmail?: string }, { code: string; expiresAt: string }>(requireFunctions(), 'createInvitation');
  const response = await callable({ patientId, role, inviteeEmail });
  return response.data;
}

export async function saveNotificationPreferences(patientId: string, preferences: NotificationPreference) {
  const callable = httpsCallable(requireFunctions(), 'updateNotificationPreferences');
  await callable({ patientId, preferences });
}

export async function updateSecureMemberPermissions(patientId: string, targetUid: string, permissions: MemberPermissions) {
  const callable = httpsCallable(requireFunctions(), 'updateMemberPermissions');
  await callable({ patientId, targetUid, permissions });
}
