# Resistance

A private, invitation‑only communication platform for closed communities. Built for mobile‑first use in India.

## Features
- 4 fixed communities: Vibe Vault, Onyx, R.T.C.S, M.T.T
- Global chat (all members) + community chat (per community)
- Private 1‑to‑1 messaging (by nickname), groups
- Polls (anyone can create, vote)
- Pin messages (5 in private, 10 in global/community)
- Leader can mute community chat; admin can mute global chat
- Role‑based permissions: Admin, Moderator, Leader, Member
- Admin‑only “Tester” badge (visible on profiles)
- Profile pictures, nicknames, bio, birthday, hobby
- Omnius AI assistant (Bytez + OpenRouter)
- File attachments (images, voice notes, videos)
- Emoji reactions, message deletion (for me / everyone), replies
- Event calendar with approval queue
- Translator (words ↔ code)
- Developer panel (moderator‑only; admin has extra controls)
- Online/offline status
- 120‑day auto‑deletion of inactive accounts (admin exempt)
- PWA installable, offline‑capable

## Quick Start

### Frontend (GitHub Pages)
1. Clone repo.
2. Serve `public/` locally: `npx serve public`

### Backend (Render)
1. `cd server`
2. `npm install`
3. Copy `.env.example` to `.env` (already filled)
4. `npm start`

## Deployment
- Frontend: GitHub Pages (branch `gh-pages`)
- Backend: Render Web Service (auto‑deploy from `main`)

## Tech Stack
- Frontend: Vanilla JS, Tailwind CSS, Firebase SDK (v12.11.0 ES modules)
- Backend: Node.js + Express
- Database: Firestore (asia‑south2 – Delhi)
- Storage: Firebase Storage
- AI: Bytez, OpenRouter

## License
All Rights Reserved – see [LICENSE](./LICENSE)
