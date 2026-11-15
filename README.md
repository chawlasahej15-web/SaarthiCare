# SaarthiCare

SaarthiCare is a role-based elderly-care app for patients, family members and caregivers. It uses one React application and a shared Firebase backend.

## What works when configured

- Firebase email/password registration, sign-in and password reset
- Patient/elder profile bootstrap and one-time family/caregiver invitation codes
- Shared medication schedules, dose confirmations, appointments, care notes and member permissions
- Scheduled medication reminders: email/push 15 minutes before a dose
- Missed-dose escalation: email/push after a 5-minute grace period if the dose remains unconfirmed
- Doctor appointment reminders: email/push within 24 hours of the visit
- Browser push notifications through Firebase Cloud Messaging
- Elder-friendly dashboard with voice input/output support in compatible browsers

**No demo accounts or sample patient records are shipped in the sign-in flow.** Firebase credentials and deployed backend services are required before accounts and reminders can work.

## Local development

Requirements: Node.js 20+, npm, Firebase CLI.

```powershell
npm install
Copy-Item .env.example .env.local
```

Fill the `VITE_FIREBASE_*` values in `.env.local` from Firebase Console → Project settings → Your apps → Web app. Then:

```powershell
npm run dev
```

The app will require Firebase configuration and a real account; it will not open a sample workspace.

## Firebase setup

1. Create a Firebase project.
2. In Authentication → Sign-in method, enable **Email/Password**.
3. Create a Cloud Firestore database.
4. Register a Firebase Web App and copy its config into `.env.local`.
5. In Firebase Console → Cloud Messaging → Web Push certificates, generate a key pair and put the public key in `VITE_FIREBASE_VAPID_KEY`.
6. Add your deployment domain and `localhost` under Authentication → Settings → Authorized domains.
7. Install and select the project:

```powershell
npm install -g firebase-tools
firebase login
firebase use --add
```

8. Deploy Firestore rules and indexes:

```powershell
firebase deploy --only firestore:rules,firestore:indexes
```

9. Configure email delivery. Verify a sending domain in Resend, then set the API key as a Firebase secret:

```powershell
firebase functions:secrets:set RESEND_API_KEY
```

Create `functions/.env.<YOUR_FIREBASE_PROJECT_ID>` (replace the suffix with your actual project ID) containing:

```env
EMAIL_FROM="SaarthiCare <reminders@your-verified-domain.com>"
```

The sender domain must be verified in Resend. Do not commit the API key or `.env.local`.

10. Deploy the scheduled reminder functions:

```powershell
npm --prefix functions install
npm --prefix functions run build
firebase deploy --only functions
```

11. Build and deploy the web app:

```powershell
npm run build
firebase deploy --only hosting
```

Cloud Scheduler / scheduled Functions deployment requires a Firebase project on the Blaze billing plan. Check Firebase usage and budgets before enabling production traffic.

## Reminder behavior

The scheduled `processCareReminders` function runs every five minutes in `Asia/Kolkata`:

- Upcoming medicine reminder: 15 minutes before the scheduled dose.
- Missed medicine alert: 5 minutes after the due time if the dose is still pending.
- Appointment reminder: within 24 hours before the appointment.
- A confirmed dose changes its status and prevents the pending dose from being escalated as missed.
- Recipients are active care-circle members whose relevant notification preference is enabled.
- Email delivery requires `RESEND_API_KEY` and `EMAIL_FROM`.
- Device push requires the member to enable Push notifications in Preferences, grant browser permission, and configure the VAPID public key.

Reminder delivery is not guaranteed if Firebase Functions, billing, email provider credentials, browser permission, or network services are not configured. This app is a care-coordination aid, not an emergency alert or medical advice service.

## Useful commands

```powershell
npm run dev
npm run build
npm run lint
npm test
npm --prefix functions run build
```

See `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`, and `docs/SECURITY.md` for implementation details.
