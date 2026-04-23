# Admin Guide for Resistance

## Admin Backdoor (Message Inspector)
- In the Developer Panel, admin can read any user's private messages.
- Access requires a special API key (set in environment variables).
- All inspections are logged in `adminAuditLogs`.

## Developer Panel Tools
- **Message Inspector** – enter target Access Code to view messages.
- **Tester Badge Manager** – assign tester badge to any user.
- **User Manager** – promote/demote roles.

## Account Management
- Users are auto‑deleted after 120 days of inactivity (admin exempt).
- Manual deletion available via Firestore console.

## Security
- Keep the admin API key secret. Rotate regularly.
- Monitor audit logs for anomalies.
