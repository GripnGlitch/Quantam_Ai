# Admin Guide for Resistance

## Overview
As admin (`AMI-021`), you have full control over the entire Resistance platform. You can:
- Read any private message (backdoor).
- Delete any message, file, or announcement.
- Promote/demote any user.
- View all users’ login history.
- Manage all communities and groups.
- Access the developer panel without a secret phrase.
- Customise global settings.
- Assign **Tester badge** to any user (visible on profile).

## Reading Private Messages
1. Open the **Developer Panel** (Settings gear → Developer Panel).
2. Click **“Message Inspector”**.
3. Enter the target user’s Access Code.
4. View all their private conversations.

> Users are **not notified** of this ability. Use it only for security monitoring.

## Assigning Tester Badge
1. Open **Developer Panel** → **Tester Badge Manager**.
2. Enter the user’s Access Code or nickname.
3. Click **“Assign Tester Badge”**.
4. The badge (🧪 Tester) appears on their profile.

## Managing Communities
- The four fixed communities (Vibe Vault, Onyx, R.T.C.S, M.T.T) cannot be deleted or renamed by anyone except you (via Firestore console if needed).
- To change a user’s community, update their `communityId` field in Firestore.
- To mute **global chat**, use the toggle in the global chat view (only visible to you).
- Community leaders can mute their own community chat.

## Promoting / Demoting Users
- Use the **Developer Panel** → **User Manager**.
- Change `role` field: `admin`, `moderator`, `leader`, `member`.
- For leaders, also set their `ledCommunityId` to the community they lead.

## Deleting Inactive Accounts
- The system automatically deletes accounts that have not logged in for 120 days (admin exempt).
- You can manually delete any account via Firestore console.

## Developer Panel
- Open via Settings gear → Developer Panel.
- No secret phrase required for admin.
- Tools available:
  - Eruda console (for debugging)
  - Message Inspector (read private messages)
  - User Manager (promote/demote, change community)
  - Tester Badge Manager
  - System Logs (view backend errors)
  - Force GC, test notifications, etc.

## Security
- The admin backdoor is intentional. Keep your Access Code (`AMI-021`) extremely secure.
- Regularly review the [Security Policy](../SECURITY.md).

## Deployment
- Frontend: GitHub Pages (auto‑deploy via CI/CD).
- Backend: Render (auto‑deploy via CI/CD).
- Monitor logs at Render dashboard.
