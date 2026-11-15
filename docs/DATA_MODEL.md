# Firestore data model

Every patient-owned record includes `patientId`. Collection-level queries in the app are scoped to the active patient profile, and rules check membership for that same ID.

| Collection | Document ID | Purpose | Important fields |
|---|---|---|---|
| `users` | Firebase UID | Account display profile | `uid`, `displayName`, `email`, `createdAt` |
| `patientProfiles` | Patient/profile ID | Patient-centered profile | `ownerUid`, `displayName`, `email`, `age`, `createdAt`, `updatedAt` |
| `careCircleMembers` | `{patientId}_{uid}` | Membership and permissions | `patientId`, `uid`, `role`, `status`, `permissions`, `notificationPreferences` |
| `invitations` | Auto ID | Hashed one-time invites | `patientId`, `invitedRole`, `inviteeEmail`, `codeHash`, `expiresAt`, `status`, `attempts`, `usedAt`, `usedByUid` |
| `medications` | Auto ID | Prescribed medication metadata | `patientId`, `name`, `dosage`, `instructions`, `frequency`, `times`, `active`, `createdBy` |
| `medicationSchedules` | Auto ID | Reminder schedule source | `patientId`, `medicationId`, `medicationName`, `times`, `active`, `createdBy` |
| `doseLogs` | Deterministic schedule/date/time ID | One scheduled dose and its adherence state | `patientId`, `medicationId`, `scheduledAt`, `status`, `confirmedBy`, `confirmedAt` |
| `appointments` | Auto ID | Doctor visits | `patientId`, `doctorName`, `specialty`, `dateTime`, `location`, `notes`, `status`, `createdBy` |
| `notifications` | Auto ID | In-app notification records (schema reserved) | `patientId`, `recipientUid`, `type`, `title`, `body`, `isRead`, `createdAt` |
| `reminderEvents` | Deterministic reminder/recipient key | Idempotency and delivery audit | `patientId`, `recipientUid`, `kind`, `status`, `sentAt`, `deliveryError` |
| `careNotes` | Auto ID | Shared handoff/update notes | `patientId`, `authorUid`, `authorName`, `authorRole`, `title`, `body`, `createdAt` |
| `auditLogs` | Auto ID | Important actions performed by the system/users | `patientId`, `actorUid`, `actorName`, `action`, `detail`, `type`, `createdAt` |
| `fcmTokens` | SHA-256 token hash | Device/browser registration | `patientId`, `uid`, `token`, `updatedAt` |
| `invitationRateLimits` | Firebase UID | Invitation redemption throttling | `attempts`, `resetAt` |

## Roles

- `owner`: creates the profile, manages access and has all default permissions.
- `patient`: patient identity when used as a membership role; can manage their own plan according to the membership record.
- `caregiver`: may manage medicines, appointments and care notes when its permission flags allow it.
- `family`: view-only by default; individual permissions can be granted by a trusted membership management flow.

The current invite flow creates `caregiver` or `family` memberships using server-defined default permissions. It does not accept a role or permission map from the browser as authoritative input.
