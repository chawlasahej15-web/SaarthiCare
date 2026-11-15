# Demo walkthrough (3–4 minutes)

1. **Start with the patient:** open the dashboard and explain how the patient sees today's medicine plan, adherence, upcoming visit and people involved in care.
2. **Confirm a dose:** mark a pending dose as taken. Show the state update and the shared activity timeline. Explain that the local demo simulates the flow in browser storage; Firebase mode uses the trusted `confirmDose` transaction.
3. **Manage the medication plan:** add a medicine using sample clinician-prescribed text and reminder times. Pause/reactivate a medication to show schedule management. Avoid describing the app as a prescriber or dosage calculator.
4. **Coordinate an appointment:** add a doctor visit with date, time, location and notes. Cancel it to demonstrate lifecycle status.
5. **Show the care circle:** switch between patient, caregiver and family demo personas. Explain that family is view-only by default and caregivers receive assigned permissions. Add a handoff note.
6. **Show reminders and trust:** visit Preferences; explain the server-side scheduler, one-time invitation codes, access rules, Resend email configuration and the development outbox fallback.
7. **Close on patient agency:** emphasize that the patient remains at the centre, with access shared intentionally and reviewed by the profile owner.

Use only the built-in fictional sample data in a public demo.
