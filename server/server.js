import express from 'express';
import cors from 'cors';
import admin from 'firebase-admin';
import fetch from 'node-fetch';
import crypto from 'crypto';

const app = express();
const PORT = process.env.PORT || 3000;

// Firebase Admin SDK – from environment variable
if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    console.error('Missing FIREBASE_SERVICE_ACCOUNT');
    process.exit(1);
}
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

app.use(cors());
app.use(express.json());

// Cloudflare Turnstile secret key (from your dashboard)
const TURNSTILE_SECRET = "0x4AAAAAADB9qMDJUWYYG5CbJiniqawwDSY";

// Helper function to verify Turnstile token
async function verifyTurnstile(token) {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `secret=${TURNSTILE_SECRET}&response=${token}`
    });
    const data = await response.json();
    return data.success === true;
}

// Admin backdoor API key (store in environment variable)
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || 'super-secret-admin-key-change-me';

// Middleware: validate admin API key
function adminAuth(req, res, next) {
    const key = req.headers['x-admin-key'];
    if (!key || key !== ADMIN_API_KEY) {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    next();
}

// Admin backdoor: inspect private messages
app.post('/api/admin/inspect-messages', adminAuth, async (req, res) => {
    const { targetAccessCode } = req.body;
    if (!targetAccessCode) return res.status(400).json({ error: 'Missing targetAccessCode' });

    try {
        const chatsRef = db.collection('privateChats');
        const snapshot = await chatsRef.get();
        const messages = [];
        for (const chatDoc of snapshot.docs) {
            const chatData = chatDoc.data();
            if (chatData.participants && chatData.participants.includes(targetAccessCode)) {
                const msgsSnap = await chatDoc.ref.collection('messages').orderBy('timestamp').get();
                msgsSnap.forEach(msg => {
                    messages.push({ chatId: chatDoc.id, ...msg.data() });
                });
            }
        }
        // Audit log
        await db.collection('adminAuditLogs').add({
            admin: req.headers['x-admin-id'] || 'unknown',
            target: targetAccessCode,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            count: messages.length
        });
        res.json({ success: true, messages });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Example login endpoint (with Turnstile verification)
app.post('/api/auth/login', async (req, res) => {
    const { accessCode, memberCode, turnstileToken } = req.body;
    if (!turnstileToken || !(await verifyTurnstile(turnstileToken))) {
        return res.status(400).json({ error: 'CAPTCHA verification failed' });
    }
    // ... rest of login logic (check memberCode, return JWT etc.)
    res.json({ success: true });
});

app.get('/health', (req, res) => res.send('OK'));

app.listen(PORT, () => console.log(`Resistance backend running on port ${PORT}`));
