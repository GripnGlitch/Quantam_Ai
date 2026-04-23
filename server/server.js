import express from 'express';
import cors from 'cors';
import admin from 'firebase-admin';
import fetch from 'node-fetch';

const app = express();
const PORT = process.env.PORT || 3000;

// Firebase Admin SDK
if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    console.error('Missing FIREBASE_SERVICE_ACCOUNT');
    process.exit(1);
}
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

app.use(cors());
app.use(express.json());

const TURNSTILE_SECRET = "0x4AAAAAADB9qMDJUWYYG5CbJiniqawwDSY";

async function verifyTurnstile(token) {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `secret=${TURNSTILE_SECRET}&response=${token}`
    });
    const data = await response.json();
    return data.success === true;
}

// Admin backdoor (unchanged)
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || 'super-secret-admin-key-change-me';
function adminAuth(req, res, next) {
    const key = req.headers['x-admin-key'];
    if (!key || key !== ADMIN_API_KEY) return res.status(403).json({ error: 'Unauthorized' });
    next();
}
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
                msgsSnap.forEach(msg => messages.push({ chatId: chatDoc.id, ...msg.data() }));
            }
        }
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

// Login endpoint (verifies Turnstile)
app.post('/api/auth/login', async (req, res) => {
    const { accessCode, memberCode, turnstileToken } = req.body;
    if (!turnstileToken || !(await verifyTurnstile(turnstileToken))) {
        return res.status(400).json({ error: 'CAPTCHA verification failed' });
    }
    let role = null;
    if (memberCode === "AMI-021") role = "admin";
    else if (memberCode === "OE1-266") role = "moderator";
    else if (memberCode === "LAO-012") role = "leader";
    else if (memberCode === "MEI-021") role = "member";
    else return res.status(400).json({ error: 'Invalid Member Code' });
    const userDoc = await db.collection('users').doc(accessCode).get();
    if (!userDoc.exists) return res.status(404).json({ error: 'Access Code not found' });
    if (userDoc.data().role !== role) return res.status(403).json({ error: 'Member Code mismatch' });
    res.json({ success: true });
});

// Signup endpoint (verifies Turnstile, creates user)
app.post('/api/auth/signup', async (req, res) => {
    const { memberCode, role, communityId, nickname, realName, bio, birthday, hobby, securityQuestions, turnstileToken } = req.body;
    if (!turnstileToken || !(await verifyTurnstile(turnstileToken))) {
        return res.status(400).json({ error: 'CAPTCHA verification failed' });
    }
    // Generate unique 9-digit access code
    let accessCode;
    let exists = true;
    while (exists) {
        const arr = new Uint32Array(1);
        require('crypto').randomFillSync(arr);
        accessCode = (arr[0] % 900000000 + 100000000).toString();
        const docSnap = await db.collection('users').doc(accessCode).get();
        exists = docSnap.exists;
    }
    const userData = {
        role, communityId, nickname, realName, bio, birthday, hobby,
        loginHistory: [Date.now()],
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        securityQuestions: securityQuestions || null,
        online: true,
        blockedUsers: [],
        tester: false
    };
    await db.collection('users').doc(accessCode).set(userData);
    res.json({ success: true, accessCode });
});

app.get('/health', (req, res) => res.send('OK'));

app.listen(PORT, () => console.log(`Resistance backend running on port ${PORT}`));
