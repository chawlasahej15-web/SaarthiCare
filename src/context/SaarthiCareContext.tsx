import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { localDateKey, timeFromHourMinute } from '../lib/date';
import { useAuth } from './AuthContext';
import { isFirebaseConfigured } from '../lib/firebase';
import { subscribeToSaarthiCare } from '../services/firebaseRepository';
import { createCareNoteRecord, createMedicationRecord, createAppointmentRecord, createSecureInvitation, recordDoseConfirmation, saveNotificationPreferences, setAppointmentCancelled, setMedicationActive, updateSecureMemberPermissions } from '../services/firebaseActions';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { makeId } from '../lib/utils';
import type { AddAppointmentInput, AddMedicationInput, SaarthiCareState, CareMember, CareNote, DoseLog, MemberPermissions, NotificationPreference, Role } from '../types';

interface SaarthiCareContextValue {
  state: SaarthiCareState;
  toast: string;
  remoteReady: boolean;
  remoteError: string;
  dismissToast: () => void;
  markDose: (doseId: string) => boolean;
  skipDose: (doseId: string) => boolean;
  addMedication: (input: AddMedicationInput) => void;
  toggleMedication: (medicationId: string) => void;
  addAppointment: (input: AddAppointmentInput) => void;
  cancelAppointment: (appointmentId: string) => void;
  inviteMember: (name: string, email: string, role: 'caregiver' | 'family') => Promise<string>;
  updateMemberPermissions: (targetUid: string, permissions: MemberPermissions) => Promise<void>;
  addCareNote: (title: string, body: string) => void;
  setRole: (role: Role) => void;
  setPreference: (key: keyof NotificationPreference, value: boolean) => void;
  setTextScale: (scale: SaarthiCareState['textScale']) => void;
}

const STORAGE_KEY = 'saarthicare-local-cache-v1';
const SaarthiCareContext = createContext<SaarthiCareContextValue | undefined>(undefined);

function loadState(): SaarthiCareState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved) as SaarthiCareState;
  } catch {
    // Ignore corrupt local cache; live account data is loaded from Firestore.
  }
  return {
    patientId: '', patientName: '', patientEmail: '', patientAge: 0, patientInitials: '',
    activeRole: 'owner', currentUserName: '', currentUserEmail: '', currentUserId: '',
    medications: [], doseLogs: [], appointments: [], members: [], notes: [], activity: [],
    preferences: { emailMedicationReminders: true, emailMissedDoseAlerts: true, emailAppointmentReminders: true, pushNotifications: false },
    textScale: 'normal',
  };
}

function makeTodayLog(medicationId: string, time: string): DoseLog {
  return { id: makeId('dose'), medicationId, scheduledAt: timeFromHourMinute(time), status: 'pending' };
}

export function SaarthiCareProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState<SaarthiCareState>(loadState);
  const [toast, setToast] = useState('');
  const [remoteReady, setRemoteReady] = useState(!isFirebaseConfigured);
  const [remoteError, setRemoteError] = useState('');
  const cloudMode = Boolean(isFirebaseConfigured && user);

  useEffect(() => {
    if (cloudMode) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* Cache is optional; Firestore remains the source of truth. */ }
  }, [state, cloudMode]);

  useEffect(() => {
    if (!isFirebaseConfigured || !user) { setRemoteReady(true); setRemoteError(''); return; }
    setRemoteReady(false); setRemoteError('');
    const unsubscribe = subscribeToSaarthiCare(user.uid, user.displayName ?? '', user.email ?? '', (remoteState) => { setState(remoteState); setRemoteReady(true); setRemoteError(''); }, (error) => { setRemoteError(error.message); setRemoteReady(true); });
    return unsubscribe;
  }, [user?.uid]);

  const notify = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 3200);
  }, []);

  const update = useCallback((recipe: (previous: SaarthiCareState) => SaarthiCareState) => {
    setState((previous) => recipe(previous));
  }, []);

  const markDose = useCallback((doseId: string) => {
    if (cloudMode) {
      const dose = state.doseLogs.find((item) => item.id === doseId);
      if (!dose || dose.status !== 'pending') return false;
      void recordDoseConfirmation(doseId, 'taken').then(() => notify('Dose marked as taken. Your care circle has been updated.')).catch((error: unknown) => notify(error instanceof Error ? error.message : 'Could not confirm this dose.'));
      return true;
    }
    let changed = false;
    update((previous) => {
      const dose = previous.doseLogs.find((item) => item.id === doseId);
      if (!dose || dose.status !== 'pending') return previous;
      changed = true;
      const now = new Date().toISOString();
      const medication = previous.medications.find((item) => item.id === dose.medicationId);
      return {
        ...previous,
        doseLogs: previous.doseLogs.map((item) => item.id === doseId ? { ...item, status: 'taken', confirmedBy: previous.currentUserName, confirmedAt: now } : item),
        activity: [{ id: makeId('act'), actor: previous.currentUserName, action: 'confirmed a dose', detail: `${medication?.name ?? 'Medication'} · ${new Date(dose.scheduledAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`, createdAt: now, type: 'dose' }, ...previous.activity],
      };
    });
    if (changed) notify('Dose marked as taken. Your care circle has been updated.');
    return changed;
  }, [cloudMode, notify, state.doseLogs, update]);

  const skipDose = useCallback((doseId: string) => {
    if (cloudMode) {
      const dose = state.doseLogs.find((item) => item.id === doseId);
      if (!dose || dose.status !== 'pending') return false;
      void recordDoseConfirmation(doseId, 'skipped').then(() => notify('Dose marked as skipped.')).catch((error: unknown) => notify(error instanceof Error ? error.message : 'Could not update this dose.'));
      return true;
    }
    let changed = false;
    update((previous) => {
      const dose = previous.doseLogs.find((item) => item.id === doseId);
      if (!dose || dose.status !== 'pending') return previous;
      changed = true;
      const now = new Date().toISOString();
      return {
        ...previous,
        doseLogs: previous.doseLogs.map((item) => item.id === doseId ? { ...item, status: 'skipped', confirmedBy: previous.currentUserName, confirmedAt: now } : item),
        activity: [{ id: makeId('act'), actor: previous.currentUserName, action: 'marked a dose as skipped', detail: previous.medications.find((item) => item.id === dose.medicationId)?.name ?? 'Medication', createdAt: now, type: 'dose' }, ...previous.activity],
      };
    });
    if (changed) notify('Dose marked as skipped.');
    return changed;
  }, [cloudMode, notify, state.doseLogs, update]);

  const addMedication = useCallback((input: AddMedicationInput) => {
    if (cloudMode && user) {
      void createMedicationRecord(state.patientId, user.uid, state.patientName, input).then(() => notify(`${input.name} added to the medication list.`)).catch((error: unknown) => notify(error instanceof Error ? error.message : 'Could not save medication.'));
      return;
    }
    const medicationId = makeId('med');
    const now = new Date().toISOString();
    update((previous) => ({
      ...previous,
      medications: [{ ...input, id: medicationId, startDate: localDateKey(new Date()), active: true }, ...previous.medications],
      doseLogs: [...previous.doseLogs, ...input.times.map((time) => makeTodayLog(medicationId, time))],
      activity: [{ id: makeId('act'), actor: previous.currentUserName, action: 'added a medication', detail: `${input.name} · ${input.dosage}`, createdAt: now, type: 'medication' }, ...previous.activity],
    }));
    notify(`${input.name} added to the medication list.`);
  }, [cloudMode, notify, state.patientId, state.patientName, update, user]);

  const toggleMedication = useCallback((medicationId: string) => {
    if (cloudMode) {
      const medication = state.medications.find((item) => item.id === medicationId);
      if (!medication) return;
      void setMedicationActive(state.patientId, medicationId, !medication.active).then(() => notify('Medication status updated.')).catch((error: unknown) => notify(error instanceof Error ? error.message : 'Could not update medication.'));
      return;
    }
    update((previous) => {
      const medication = previous.medications.find((item) => item.id === medicationId);
      if (!medication) return previous;
      const active = !medication.active;
      return {
        ...previous,
        medications: previous.medications.map((item) => item.id === medicationId ? { ...item, active } : item),
        activity: [{ id: makeId('act'), actor: previous.currentUserName, action: active ? 'reactivated a medication' : 'paused a medication', detail: medication.name, createdAt: new Date().toISOString(), type: 'medication' }, ...previous.activity],
      };
    });
    notify('Medication status updated.');
  }, [cloudMode, notify, state.medications, state.patientId, update]);

  const addAppointment = useCallback((input: AddAppointmentInput) => {
    if (cloudMode && user) {
      void createAppointmentRecord(state.patientId, user.uid, state.currentUserName, input).then(() => notify('Appointment added to the care calendar.')).catch((error: unknown) => notify(error instanceof Error ? error.message : 'Could not save appointment.'));
      return;
    }
    const now = new Date().toISOString();
    update((previous) => ({
      ...previous,
      appointments: [{ ...input, id: makeId('appt'), dateTime: new Date(input.dateTime).toISOString(), status: 'scheduled', createdBy: previous.currentUserName }, ...previous.appointments],
      activity: [{ id: makeId('act'), actor: previous.currentUserName, action: 'scheduled an appointment', detail: `${input.doctorName} · ${new Date(input.dateTime).toLocaleDateString()}`, createdAt: now, type: 'appointment' }, ...previous.activity],
    }));
    notify('Appointment added to the care calendar.');
  }, [cloudMode, notify, state.currentUserName, state.patientId, update, user]);

  const cancelAppointment = useCallback((appointmentId: string) => {
    if (cloudMode) {
      void setAppointmentCancelled(appointmentId).then(() => notify('Appointment cancelled.')).catch((error: unknown) => notify(error instanceof Error ? error.message : 'Could not cancel appointment.'));
      return;
    }
    update((previous) => ({
      ...previous,
      appointments: previous.appointments.map((item) => item.id === appointmentId ? { ...item, status: 'cancelled' } : item),
    }));
    notify('Appointment cancelled.');
  }, [cloudMode, notify, update]);

  const inviteMember = useCallback(async (name: string, email: string, role: 'caregiver' | 'family') => {
    if (cloudMode) {
      const invite = await createSecureInvitation(state.patientId, role, email);
      notify(`Secure invitation created. Expires ${new Date(invite.expiresAt).toLocaleDateString()}.`);
      return invite.code;
    }
    const code = `CC-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const member: CareMember = {
      id: makeId('member'), name, email, role, relationship: role === 'caregiver' ? 'Invited caregiver' : 'Invited family member',
      initials: name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join(''),
      color: role === 'caregiver' ? 'avatar-peach' : 'avatar-lilac', status: 'pending',
      permissions: { manageMedications: role === 'caregiver', manageAppointments: role === 'caregiver', writeCareNotes: role === 'caregiver', inviteMembers: false },
    };
    update((previous) => ({ ...previous, members: [...previous.members, member], activity: [{ id: makeId('act'), actor: previous.currentUserName, action: 'invited a care circle member', detail: `${name} · ${role}`, createdAt: new Date().toISOString(), type: 'member' }, ...previous.activity] }));
    notify('Invitations require a signed-in Firebase account.');
    return code;
  }, [cloudMode, notify, state.patientId, update]);

  const updateMemberPermissions = useCallback(async (targetUid: string, permissions: MemberPermissions) => {
    if (cloudMode) {
      await updateSecureMemberPermissions(state.patientId, targetUid, permissions);
      notify('Member permissions updated.');
      return;
    }
    const member = state.members.find((item) => item.id === targetUid);
    if (!member || member.role === 'owner') return;
    update((previous) => ({
      ...previous,
      members: previous.members.map((item) => item.id === targetUid ? { ...item, permissions } : item),
      activity: [{ id: makeId('act'), actor: previous.currentUserName, action: 'updated member permissions', detail: member.name, createdAt: new Date().toISOString(), type: 'member' }, ...previous.activity],
    }));
    notify('Member permissions updated.');
  }, [cloudMode, notify, state.members, state.patientId, update]);

  const addCareNote = useCallback((title: string, body: string) => {
    if (cloudMode && user) {
      void createCareNoteRecord(state.patientId, user.uid, state.currentUserName, state.activeRole, title, body).then(() => notify('Care note shared with the circle.')).catch((error: unknown) => notify(error instanceof Error ? error.message : 'Could not save note.'));
      return;
    }
    const note: CareNote = { id: makeId('note'), author: state.currentUserName, authorRole: state.activeRole, createdAt: new Date().toISOString(), title, body };
    update((previous) => ({ ...previous, notes: [note, ...previous.notes], activity: [{ id: makeId('act'), actor: previous.currentUserName, action: 'added a care note', detail: title, createdAt: note.createdAt, type: 'note' }, ...previous.activity] }));
    notify('Care note shared with the circle.');
  }, [cloudMode, notify, state.activeRole, state.currentUserName, state.patientId, update, user]);

  const setRole = useCallback((role: Role) => {
    if (cloudMode) return;
    const member = state.members.find((item) => item.role === role) ?? state.members[0];
    update((previous) => ({ ...previous, activeRole: role, currentUserName: member?.name ?? previous.patientName, currentUserEmail: member?.email ?? previous.patientEmail, currentUserId: member?.id ?? previous.currentUserId }));
    notify(`Previewing the ${role} experience.`);
  }, [cloudMode, notify, state.members, update]);

  const setPreference = useCallback((key: keyof NotificationPreference, value: boolean) => {
    const next = { ...state.preferences, [key]: value };
    if (cloudMode) {
      void saveNotificationPreferences(state.patientId, next).then(() => notify('Notification preference saved.')).catch((error: unknown) => notify(error instanceof Error ? error.message : 'Could not save preference.'));
      return;
    }
    update((previous) => ({ ...previous, preferences: next }));
  }, [cloudMode, notify, state.patientId, state.preferences, update]);

  const setTextScale = useCallback((textScale: SaarthiCareState['textScale']) => { localStorage.setItem('saarthicare-text-scale', textScale); update((previous) => ({ ...previous, textScale })); }, [update]);

  const dismissToast = useCallback(() => setToast(''), []);

  const value = useMemo(() => ({ state, toast, remoteReady, remoteError, dismissToast, markDose, skipDose, addMedication, toggleMedication, addAppointment, cancelAppointment, inviteMember, updateMemberPermissions, addCareNote, setRole, setPreference, setTextScale }), [state, toast, remoteReady, remoteError, dismissToast, markDose, skipDose, addMedication, toggleMedication, addAppointment, cancelAppointment, inviteMember, updateMemberPermissions, addCareNote, setRole, setPreference, setTextScale]);
  if (cloudMode && !remoteReady) return <div className="auth-loading">Loading your secure care workspace…</div>;
  if (cloudMode && remoteError) return <div className="auth-loading"><div className="cloud-error"><h2>We couldn’t open this care circle.</h2><p>{remoteError}</p><button onClick={() => { if (auth) void signOut(auth); }}>Sign out</button></div></div>;
  return <SaarthiCareContext.Provider value={value}>{children}</SaarthiCareContext.Provider>;
}

export function useSaarthiCare(): SaarthiCareContextValue {
  const value = useContext(SaarthiCareContext);
  if (!value) throw new Error('useSaarthiCare must be used inside SaarthiCareProvider');
  return value;
}
