# Security notes and deployment checklist

## Implemented safeguards

- Firebase Auth is required for Firebase-backed routes.
- Firestore rules use active care-circle membership checks and default-deny for unknown collections.
- Sensitive membership, invitation, audit and reminder event records are server-managed.
- Invitation codes are generated with cryptographic random bytes, stored only as SHA-256 hashes, expire after seven days, can be used once and are optionally restricted to the invitee's email.
- Invitation redemption is rate-limited per authenticated UID.
- Dose confirmation runs in a transaction, checks membership/role and pending status, and writes an audit record.
- Email keys remain in Firebase Secret Manager and are never exposed through Vite environment variables.
- Local demo records are fictional and stored in the browser only.

## Before real deployment

- Review `firestore.rules` against the exact roles, permissions and patient consent process your organization intends to use.
- Create a dedicated Firebase project for each environment and restrict project IAM access.
- Configure Firebase App Check and abuse protections where appropriate.
- Add a proper profile and membership management flow for changing/removing access; do not edit membership documents from the client.
- Define retention, deletion, export, backups, incident response and access review procedures.
- Configure verified sender domains and rate/volume limits for Resend.
- Configure the Firebase Web Push certificate and test notifications across supported browsers/devices.
- Review data residency, privacy notices, consent and applicable health-data requirements with qualified counsel/security staff.
- Run Emulator Suite rules tests, dependency audits, static analysis and a human security review before production.
- Do not use real patient information in the local demo or public challenge demonstration.

No HIPAA, ISO 27001 or other regulatory certification is claimed by this repository.
