import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, type RulesTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';

let testEnv: RulesTestEnvironment;
const projectId = 'carecircle-rules-test';

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});

afterAll(async () => { await testEnv.cleanup(); });

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'patientProfiles/patient-a'), { ownerUid: 'owner-a', displayName: 'Demo Patient' });
    await setDoc(doc(db, 'careCircleMembers/patient-a_owner-a'), { patientId: 'patient-a', uid: 'owner-a', role: 'owner', status: 'active', permissions: { manageMedications: true, manageAppointments: true, writeCareNotes: true, inviteMembers: true } });
    await setDoc(doc(db, 'careCircleMembers/patient-a_caregiver-a'), { patientId: 'patient-a', uid: 'caregiver-a', role: 'caregiver', status: 'active', permissions: { manageMedications: true, manageAppointments: true, writeCareNotes: true, inviteMembers: false } });
    await setDoc(doc(db, 'careCircleMembers/patient-a_family-a'), { patientId: 'patient-a', uid: 'family-a', role: 'family', status: 'active', permissions: { manageMedications: false, manageAppointments: false, writeCareNotes: false, inviteMembers: false } });
  });
});

describe('Firestore access boundaries', () => {
  it('allows an active circle member to read the shared patient profile', async () => {
    const db = testEnv.authenticatedContext('family-a').firestore();
    await assertSucceeds(getDoc(doc(db, 'patientProfiles/patient-a')));
  });

  it('blocks an unrelated account from another family’s patient profile', async () => {
    const db = testEnv.authenticatedContext('outsider').firestore();
    await assertFails(getDoc(doc(db, 'patientProfiles/patient-a')));
  });

  it('allows an authorised caregiver to add a medication', async () => {
    const db = testEnv.authenticatedContext('caregiver-a').firestore();
    await assertSucceeds(setDoc(doc(db, 'medications/med-1'), { patientId: 'patient-a', name: 'Example medication', dosage: 'As prescribed', createdBy: 'caregiver-a', active: true }));
  });

  it('blocks a read-only family member from changing medication records', async () => {
    const db = testEnv.authenticatedContext('family-a').firestore();
    await assertFails(setDoc(doc(db, 'medications/med-2'), { patientId: 'patient-a', name: 'Example medication', dosage: 'As prescribed', createdBy: 'family-a', active: true }));
  });

  it('keeps dose confirmation behind the trusted callable function', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'doseLogs/dose-1'), { patientId: 'patient-a', status: 'pending', medicationId: 'med-1', scheduledAt: new Date().toISOString() });
    });
    const db = testEnv.authenticatedContext('caregiver-a').firestore();
    await assertFails(setDoc(doc(db, 'doseLogs/dose-1'), { patientId: 'patient-a', status: 'taken', medicationId: 'med-1', scheduledAt: new Date().toISOString(), confirmedBy: 'caregiver-a' }));
  });
});
