import { createHash, randomBytes } from 'node:crypto';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getMessaging } from 'firebase-admin/messaging';
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';
import { defineSecret } from 'firebase-functions/params';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { Resend } from 'resend';
import { z } from 'zod';

initializeApp();
const db = getFirestore();
const resendApiKey = defineSecret('RESEND_API_KEY');
const invitationInput = z.object({ patientId: z.string().min(1).max(128), role: z.enum(['caregiver', 'family']), inviteeEmail: z.string().email().max(320).optional() });
const redeemInput = z.object({ code: z.string().trim().min(8).max(32) });
const doseInput = z.object({ doseId: z.string().min(1).max(180), status: z.enum(['taken', 'skipped']) });
const preferenceInput = z.object({ preferences: z.object({ emailMedicationReminders: z.boolean(), emailMissedDoseAlerts: z.boolean(), emailAppointmentReminders: z.boolean(), pushNotifications: z.boolean().optional() }) });
const memberPermissionsSchema = z.object({ manageMedications: z.boolean(), manageAppointments: z.boolean(), writeCareNotes: z.boolean(), inviteMembers: z.boolean() });
const memberPermissionsInput = z.object({ patientId: z.string().min(1).max(128), targetUid: z.string().min(1).max(128), permissions: memberPermissionsSchema });

const defaultPermissions = {
  owner: { manageMedications: true, manageAppointments: true, writeCareNotes: true, inviteMembers: true },
  patient: { manageMedications: true, manageAppointments: true, writeCareNotes: true, inviteMembers: false },
  caregiver: { manageMedications: true, manageAppointments: true, writeCareNotes: true, inviteMembers: false },
  family: { manageMedications: false, manageAppointments: false, writeCareNotes: false, inviteMembers: false },
};

function hashCode(code: string): string {
  return createHash('sha256').update(code.trim().toUpperCase()).digest('hex');
}

async function requireActiveOwner(patientId: string, uid: string) {
  const membership = await db.doc(`careCircleMembers/${patientId}_${uid}`).get();
  if (!membership.exists || membership.data()?.status !== 'active' || membership.data()?.role !== 'owner') {
    throw new HttpsError('permission-denied', 'Only the profile owner can manage care-circle access.');
  }
}

async function requireCanInvite(patientId: string, uid: string) {
  const membership = await db.doc(`careCircleMembers/${patientId}_${uid}`).get();
  const data = membership.data();
  if (!membership.exists || data?.status !== 'active' || (data.role !== 'owner' && data.permissions?.inviteMembers !== true)) {
    throw new HttpsError('permission-denied', 'You do not have permission to invite care-circle members.');
  }
}


const bootstrapInput = z.object({ displayName: z.string().trim().min(2).max(80) });

export const bootstrapPatientProfile = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in to create your patient profile.');
  const parsed = bootstrapInput.safeParse(request.data);
  if (!parsed.success) throw new HttpsError('invalid-argument', 'A valid display name is required.');
  const uid = request.auth.uid;
  const profileRef = db.doc(`patientProfiles/${uid}`);
  const memberRef = db.doc(`careCircleMembers/${uid}_${uid}`);
  await db.runTransaction(async (transaction) => {
    const [profile, member] = await Promise.all([transaction.get(profileRef), transaction.get(memberRef)]);
    if (profile.exists || member.exists) return;
    transaction.create(profileRef, {
      ownerUid: uid,
      displayName: parsed.data.displayName,
      email: request.auth.token.email ?? null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.create(memberRef, {
      patientId: uid,
      uid,
      role: 'owner',
      status: 'active',
      permissions: defaultPermissions.owner,
      displayName: parsed.data.displayName,
      email: request.auth.token.email ?? null,
      notificationPreferences: { emailMedicationReminders: true, emailMissedDoseAlerts: true, emailAppointmentReminders: true },
      joinedAt: FieldValue.serverTimestamp(),
    });
  });
  return { patientId: uid };
});

export const createInvitation = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in before creating an invitation.');
  const parsed = invitationInput.safeParse(request.data);
  if (!parsed.success) throw new HttpsError('invalid-argument', 'A patient profile and valid invite role are required.');
  const { patientId, role } = parsed.data;
  await requireCanInvite(patientId, request.auth.uid);

  const code = randomBytes(6).toString('hex').toUpperCase();
  const expiresAt = Timestamp.fromMillis(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await db.collection('invitations').add({
    patientId,
    invitedRole: role,
    inviteeEmail: parsed.data.inviteeEmail?.trim().toLowerCase() ?? null,
    codeHash: hashCode(code),
    createdByUid: request.auth.uid,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt,
    status: 'active',
    usedAt: null,
    usedByUid: null,
  });
  return { code, expiresAt: expiresAt.toDate().toISOString() };
});

export const updateMemberPermissions = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in to manage care-circle permissions.');
  const parsed = memberPermissionsInput.safeParse(request.data);
  if (!parsed.success) throw new HttpsError('invalid-argument', 'A valid member and permission set are required.');
  const { patientId, targetUid, permissions } = parsed.data;
  await requireActiveOwner(patientId, request.auth.uid);
  const memberRef = db.doc(`careCircleMembers/${patientId}_${targetUid}`);
  const target = await memberRef.get();
  if (!target.exists || target.data()?.status !== 'active' || target.data()?.role === 'owner') {
    throw new HttpsError('failed-precondition', 'Only active non-owner members can be updated.');
  }
  await memberRef.update({ permissions, permissionsUpdatedAt: FieldValue.serverTimestamp(), permissionsUpdatedBy: request.auth.uid });
  await db.collection('auditLogs').add({
    patientId, actorUid: request.auth.uid,
    actorName: request.auth.token.name ?? request.auth.token.email ?? 'Profile owner',
    action: 'updated member permissions', detail: String(target.data()?.displayName ?? target.data()?.email ?? targetUid),
    type: 'member', createdAt: FieldValue.serverTimestamp(),
  });
  return { saved: true };
});

export const redeemInvitation = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in before joining a care circle.');
  const parsed = redeemInput.safeParse(request.data);
  if (!parsed.success) throw new HttpsError('invalid-argument', 'Enter a valid invitation code.');
  const uid = request.auth.uid;
  const rateLimitRef = db.doc(`invitationRateLimits/${uid}`);
  await db.runTransaction(async (transaction) => {
    const current = await transaction.get(rateLimitRef);
    const resetAt = current.data()?.resetAt as Timestamp | undefined;
    const isExpiredWindow = !resetAt || resetAt.toMillis() < Date.now();
    const attempts = isExpiredWindow ? 0 : Number(current.data()?.attempts ?? 0);
    if (attempts >= 10) throw new HttpsError('resource-exhausted', 'Too many attempts. Please try again later.');
    transaction.set(rateLimitRef, { attempts: attempts + 1, resetAt: isExpiredWindow ? Timestamp.fromMillis(Date.now() + 60 * 60 * 1000) : resetAt }, { merge: true });
  });

  const lookup = await db.collection('invitations').where('codeHash', '==', hashCode(parsed.data.code)).limit(1).get();
  if (lookup.empty) throw new HttpsError('not-found', 'That invitation code is not valid.');
  const invitationRef = lookup.docs[0]!.ref;
  let patientId = '';
  let invitedRole: 'caregiver' | 'family' = 'family';
  let invitationExpired = false;
  await db.runTransaction(async (transaction) => {
    const invite = await transaction.get(invitationRef);
    if (!invite.exists) throw new HttpsError('not-found', 'That invitation code is not valid.');
    const data = invite.data()!;
    if (data.status !== 'active' || data.usedAt) throw new HttpsError('failed-precondition', 'This invitation has already been used.');
    const invitedEmail = String(data.inviteeEmail ?? '').toLowerCase();
    const accountEmail = String(request.auth!.token.email ?? '').toLowerCase();
    if (invitedEmail && invitedEmail !== accountEmail) throw new HttpsError('permission-denied', 'This invitation was created for a different email address.');
    if ((data.expiresAt as Timestamp).toMillis() < Date.now()) {
      transaction.update(invitationRef, { status: 'expired' });
      invitationExpired = true;
      return;
    }
    patientId = String(data.patientId);
    invitedRole = data.invitedRole as 'caregiver' | 'family';
    const memberRef = db.doc(`careCircleMembers/${patientId}_${uid}`);
    const existing = await transaction.get(memberRef);
    if (existing.exists) throw new HttpsError('already-exists', 'You are already part of this care circle.');
    transaction.create(memberRef, {
      patientId, uid, role: invitedRole, status: 'active', permissions: defaultPermissions[invitedRole],
      displayName: request.auth.token.name ?? request.auth.token.email ?? 'Care circle member',
      email: request.auth.token.email ?? null,
      notificationPreferences: { emailMedicationReminders: true, emailMissedDoseAlerts: true, emailAppointmentReminders: true },
      joinedAt: FieldValue.serverTimestamp(), invitedByUid: data.createdByUid,
    });
    transaction.update(invitationRef, { status: 'used', usedAt: FieldValue.serverTimestamp(), usedByUid: uid });
  });
  if (invitationExpired) throw new HttpsError('deadline-exceeded', 'This invitation has expired.');
  return { patientId, role: invitedRole };
});


export const confirmDose = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in to confirm a dose.');
  const parsed = doseInput.safeParse(request.data);
  if (!parsed.success) throw new HttpsError('invalid-argument', 'A valid dose and status are required.');
  const doseRef = db.doc(`doseLogs/${parsed.data.doseId}`);
  let patientId = '';
  await db.runTransaction(async (transaction) => {
    const doseSnapshot = await transaction.get(doseRef);
    if (!doseSnapshot.exists) throw new HttpsError('not-found', 'Dose record not found.');
    const dose = doseSnapshot.data()!;
    patientId = String(dose.patientId);
    const memberRef = db.doc(`careCircleMembers/${patientId}_${request.auth!.uid}`);
    const member = await transaction.get(memberRef);
    const permissions = member.data()?.permissions ?? {};
    const mayConfirm = member.exists && member.data()?.status === 'active'
      && (['owner', 'patient'].includes(String(member.data()?.role)) || permissions.manageMedications === true);
    if (!mayConfirm) throw new HttpsError('permission-denied', 'You do not have permission to confirm this dose.');
    if (dose.status !== 'pending') throw new HttpsError('failed-precondition', 'This dose has already been updated.');
    transaction.update(doseRef, {
      status: parsed.data.status,
      confirmedBy: request.auth!.uid,
      confirmedAt: FieldValue.serverTimestamp(),
    });
    const auditRef = db.collection('auditLogs').doc();
    transaction.create(auditRef, {
      patientId,
      actorUid: request.auth!.uid,
      actorName: request.auth!.token.name ?? request.auth!.token.email ?? 'Care circle member',
      action: parsed.data.status === 'taken' ? 'confirmed a dose' : 'marked a dose as skipped',
      detail: String(dose.medicationName ?? 'Medication'),
      type: 'dose',
      createdAt: FieldValue.serverTimestamp(),
    });
  });
  return { patientId, status: parsed.data.status };
});

export const updateNotificationPreferences = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in to update preferences.');
  const parsed = preferenceInput.safeParse(request.data);
  if (!parsed.success) throw new HttpsError('invalid-argument', 'Notification preferences are invalid.');
  const patientId = String(request.data.patientId ?? '');
  if (!patientId) throw new HttpsError('invalid-argument', 'Patient profile is required.');
  const memberRef = db.doc(`careCircleMembers/${patientId}_${request.auth.uid}`);
  const member = await memberRef.get();
  if (!member.exists || member.data()?.status !== 'active') throw new HttpsError('permission-denied', 'Active care circle membership is required.');
  await memberRef.update({ notificationPreferences: parsed.data.preferences, preferencesUpdatedAt: FieldValue.serverTimestamp() });
  return { saved: true };
});

interface ReminderMessage {
  reminderId: string;
  patientId: string;
  recipientUid: string;
  kind: 'upcoming-dose' | 'missed-dose' | 'appointment';
  subject: string;
  body: string;
}

async function createReminder(message: ReminderMessage, resend: Resend | null, emailEnabled: boolean, pushEnabled: boolean) {
  const eventRef = db.doc(`reminderEvents/${message.reminderId}_${message.recipientUid}`);
  try {
    await eventRef.create({ ...message, status: 'processing', createdAt: FieldValue.serverTimestamp(), sentAt: null });
  } catch (error) {
    // A deterministic event key makes retries idempotent; an existing record means this reminder was already processed.
    if ((error as { code?: number }).code === 6 || String(error).includes('ALREADY_EXISTS')) return;
    throw error;
  }
  let status: 'sent' | 'dev_outbox' | 'disabled' | 'failed' = emailEnabled ? 'dev_outbox' : 'disabled';
  let sentAt: Timestamp | null = null;
  let deliveryError: string | null = null;
  if (emailEnabled) {
    try {
      const user = await getAuth().getUser(message.recipientUid);
      if (!resend || !process.env.EMAIL_FROM || !user.email) {
        status = 'dev_outbox';
      } else {
        const result = await resend.emails.send({
          from: process.env.EMAIL_FROM,
          to: user.email,
          subject: message.subject,
          text: `${message.body}\n\nSaarthiCare is a coordination tool, not a medical advice or emergency service.`,
        });
        if (result.error) throw new Error(result.error.message);
        status = 'sent';
        sentAt = Timestamp.now();
      }
    } catch (error) {
      status = 'failed';
      deliveryError = error instanceof Error ? error.message.slice(0, 300) : 'Unknown email delivery error';
      console.error('SaarthiCare reminder delivery failed', { reminderId: message.reminderId, error: deliveryError });
    }
  }
  let pushStatus: 'sent' | 'no_tokens' | 'disabled' | 'failed' = 'disabled';
  if (pushEnabled) {
    try {
      const tokenSnapshot = await db.collection('fcmTokens').where('patientId', '==', message.patientId).where('uid', '==', message.recipientUid).get();
      const tokenRows = tokenSnapshot.docs.filter((row) => typeof row.data().token === 'string' && row.data().token.length > 0);
      const tokens = tokenRows.map((row) => String(row.data().token));
      if (tokens.length) {
        const result = await getMessaging().sendEachForMulticast({
          tokens,
          notification: { title: message.subject, body: message.body },
          data: { reminderId: message.reminderId, url: '/dashboard' },
        });
        pushStatus = result.successCount > 0 ? 'sent' : 'failed';
        const invalidCodes = new Set(['messaging/invalid-registration-token', 'messaging/registration-token-not-registered']);
        const invalidDocs = tokenRows.filter((row, index) => {
          const code = result.responses[index]?.error?.code;
          return Boolean(code && invalidCodes.has(code));
        });
        await Promise.all(invalidDocs.map((row) => row.ref.delete()));
      } else {
        pushStatus = 'no_tokens';
      }
    } catch (error) {
      pushStatus = 'failed';
      console.error('SaarthiCare push delivery failed', { reminderId: message.reminderId, error: error instanceof Error ? error.message : 'Unknown push error' });
    }
  }
  await eventRef.update({ status, sentAt, deliveryError, pushStatus, updatedAt: FieldValue.serverTimestamp() });
}

async function notifyCircle(patientId: string, kind: ReminderMessage['kind'], reminderId: string, subject: string, body: string, resend: Resend | null) {
  const members = await db.collection('careCircleMembers').where('patientId', '==', patientId).where('status', '==', 'active').get();
  await Promise.all(members.docs.map(async (member) => {
    const preferences = member.data().notificationPreferences ?? {};
    const emailEnabled = kind === 'upcoming-dose' ? preferences.emailMedicationReminders !== false
      : kind === 'missed-dose' ? preferences.emailMissedDoseAlerts !== false
      : preferences.emailAppointmentReminders !== false;
    const pushEnabled = preferences.pushNotifications === true;
    if (!emailEnabled && !pushEnabled) return;
    await createReminder({ reminderId, patientId, recipientUid: String(member.data().uid), kind, subject, body }, resend, emailEnabled, pushEnabled);
  }));
}


function localParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

async function materializeUpcomingDoseLogs(now: Timestamp) {
  const schedules = await db.collection('medicationSchedules').where('active', '==', true).get();
  const baseDate = now.toDate();
  for (const schedule of schedules.docs) {
    const data = schedule.data();
    if (!Array.isArray(data.times)) continue;
    for (const offset of [0, 1]) {
      const date = new Date(baseDate);
      date.setUTCDate(date.getUTCDate() + offset);
      const dateKey = localParts(date);
      if (typeof data.startDate === 'string' && dateKey < data.startDate) continue;
      if (typeof data.endDate === 'string' && dateKey > data.endDate) continue;
      for (const timeValue of data.times) {
        if (typeof timeValue !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(timeValue)) continue;
        const scheduledAt = new Date(`${dateKey}T${timeValue}:00+05:30`);
        if (scheduledAt.getTime() <= now.toMillis() || scheduledAt.getTime() > now.toMillis() + 26 * 60 * 60 * 1000) continue;
        const id = `${schedule.id}_${dateKey}_${timeValue.replace(':', '')}`;
        const doseRef = db.doc(`doseLogs/${id}`);
        try {
          await doseRef.create({
            patientId: data.patientId,
            medicationId: data.medicationId,
            medicationName: data.medicationName ?? 'Medication',
            patientName: data.patientName ?? 'the patient',
            scheduleId: schedule.id,
            scheduledAt: Timestamp.fromDate(scheduledAt),
            status: 'pending',
            createdBy: 'system',
            createdAt: FieldValue.serverTimestamp(),
          });
        } catch (error) {
          if (!String(error).includes('ALREADY_EXISTS') && (error as { code?: number }).code !== 6) throw error;
        }
      }
    }
  }
}

export const processCareReminders = onSchedule({
  schedule: 'every 5 minutes',
  timeZone: 'Asia/Kolkata',
  secrets: [resendApiKey],
  retryCount: 2,
}, async () => {
  const apiKey = resendApiKey.value();
  const resend = apiKey ? new Resend(apiKey) : null;
  const now = Timestamp.now();
  await materializeUpcomingDoseLogs(now);
  const upcomingLimit = Timestamp.fromMillis(now.toMillis() + 15 * 60 * 1000);
  const missedCutoff = Timestamp.fromMillis(now.toMillis() - 5 * 60 * 1000);
  const appointmentLimit = Timestamp.fromMillis(now.toMillis() + 24 * 60 * 60 * 1000);

  const upcomingDoses = await db.collection('doseLogs').where('status', '==', 'pending').where('scheduledAt', '>', now).where('scheduledAt', '<=', upcomingLimit).get();
  for (const dose of upcomingDoses.docs) {
    const data = dose.data();
    const medication = data.medicationName ?? 'a scheduled medication';
    const due = (data.scheduledAt as Timestamp).toDate().toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });
    await notifyCircle(String(data.patientId), 'upcoming-dose', `upcoming-dose-${dose.id}`, `Medication reminder for ${data.patientName ?? 'your care circle'}`, `${medication} is scheduled for ${due}. Please follow the prescribed instructions.`, resend);
  }

  const missedDoses = await db.collection('doseLogs').where('status', '==', 'pending').where('scheduledAt', '<=', missedCutoff).get();
  for (const dose of missedDoses.docs) {
    const data = dose.data();
    await db.runTransaction(async (transaction) => {
      const current = await transaction.get(dose.ref);
      if (!current.exists || current.data()?.status !== 'pending') return;
      transaction.update(dose.ref, { status: 'missed', missedAt: FieldValue.serverTimestamp() });
    });
    const medication = data.medicationName ?? 'a scheduled medication';
    await notifyCircle(String(data.patientId), 'missed-dose', `missed-dose-${dose.id}`, 'A medication dose needs attention', `${medication} was not confirmed within the reminder window. Please check in with the patient and follow the clinician’s instructions.`, resend);
  }

  const appointments = await db.collection('appointments').where('status', '==', 'scheduled').where('dateTime', '>', now).where('dateTime', '<=', appointmentLimit).get();
  for (const appointment of appointments.docs) {
    const data = appointment.data();
    const visitAt = (data.dateTime as Timestamp).toDate().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' });
    await notifyCircle(String(data.patientId), 'appointment', `appointment-${appointment.id}`, 'Upcoming doctor appointment', `${data.doctorName ?? 'Your doctor'} appointment is scheduled for ${visitAt} at ${data.location ?? 'the saved clinic location'}.`, resend);
  }
});
