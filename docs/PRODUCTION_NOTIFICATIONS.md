# Production notifications checklist

## Email reminders
- Verify a sending domain in Resend.
- Set Firebase Functions secret `RESEND_API_KEY`.
- Set `EMAIL_FROM` in `functions/.env.<firebase-project-id>` to an address on the verified domain.
- Deploy Cloud Functions.
- Confirm each active member's notification preferences allow the relevant email type.
- Inspect `reminderEvents` in Firestore for status `sent`; `dev_outbox` means delivery credentials/from-address are missing.

## Browser push reminders
- Add the Firebase Cloud Messaging Web Push public VAPID key to `VITE_FIREBASE_VAPID_KEY`.
- Serve the app on HTTPS (localhost is allowed for local development).
- Each member must sign in on the browser/device and enable Push notifications in Preferences.
- Allow browser notification permission.
- Inspect `fcmTokens` for that member and `reminderEvents.pushStatus` for delivery state.

## Schedule
The `processCareReminders` Cloud Function runs every five minutes in `Asia/Kolkata`. It sends:
- Upcoming medicine reminder 15 minutes before a dose.
- Missed-dose alert after a five-minute grace period if still pending.
- Appointment reminder within 24 hours before a scheduled visit.

Scheduled Functions require billing to be enabled on the Firebase project. Email and push are best-effort delivery channels and must not be treated as emergency monitoring.
