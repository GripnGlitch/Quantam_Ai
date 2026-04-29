import express from 'express';
import cors from 'cors';
import admin from 'firebase-admin';
import fetch from 'node-fetch';
import crypto from 'crypto';
import cron from 'node-cron';
import rateLimit from 'express-rate-limit';
import fs from 'fs';

const app = express();
const PORT = process.env.PORT || 3000;

// Firebase Admin init – reads secret file from Render
let serviceAccount;
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  // fallback old method (not recommended)
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} else {
  const serviceAccountPath = '/etc/secrets/firebase-admin-key.json';
  serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
}
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

app.use(cors());
app.use(express.json());

const TURNSTILE_SECRET = "0x4AAAAAADB9qMDJUWYYG5CbJiniqawwDSY";
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || "super-secret-admin-key-change-me";
const MEMBER_CODES = { "AMI-021":"admin", "OE1-266":"moderator", "LAO-012":"leader", "MEI-021":"member" };

// Rate limiting for auth
const authLimiter = rateLimit({ windowMs:15*60*1000, max:20, message:{error:'Too many attempts'} });

// Turnstile verification
async function verifyTurnstile(token) {
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:`secret=${TURNSTILE_SECRET}&response=${token}`
  });
  const data = await res.json();
  return data.success === true;
}

// Health
app.get('/health', (req,res)=>res.json({status:'ok'}));

// Login with custom token
app.post('/api/auth/login', authLimiter, async (req,res) => {
  try {
    const { accessCode, memberCode, turnstileToken } = req.body;
    if (!accessCode || !memberCode || !turnstileToken) return res.status(400).json({error:'Missing fields'});
    const valid = await verifyTurnstile(turnstileToken);
    if (!valid) return res.status(400).json({error:'CAPTCHA failed'});
    const role = MEMBER_CODES[memberCode];
    if (!role) return res.status(400).json({error:'Invalid Member Code'});
    const userDoc = await db.collection('users').doc(accessCode).get();
    if (!userDoc.exists) return res.status(404).json({error:'User not found'});
    if (userDoc.data().role !== role) return res.status(403).json({error:'Role mismatch'});

    const token = await admin.auth().createCustomToken(accessCode);
    res.json({ success:true, token });
  } catch(e) { res.status(500).json({error:e.message}); }
});

// Signup with custom token
app.post('/api/auth/signup', authLimiter, async (req,res) => {
  try {
    const { memberCode, role:clientRole, communityId, nickname, realName, bio, birthday, hobby, securityQuestions, turnstileToken } = req.body;
    if (!memberCode || !clientRole || !communityId || !nickname || !turnstileToken)
      return res.status(400).json({error:'Missing required fields'});
    const valid = await verifyTurnstile(turnstileToken);
    if (!valid) return res.status(400).json({error:'CAPTCHA failed'});

    // Generate unique 9-digit access code
    let accessCode;
    let exists = true;
    while (exists) {
      accessCode = crypto.randomInt(100000000, 1000000000).toString();
      const doc = await db.collection('users').doc(accessCode).get();
      exists = doc.exists;
    }

    const userData = {
      role: clientRole, communityId, nickname,
      realName: realName || '', bio: bio || '', birthday: birthday || '',
      hobby: hobby || '', securityQuestions: securityQuestions || [],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      online: true, lastSeen: admin.firestore.FieldValue.serverTimestamp(),
      loginHistory: [admin.firestore.FieldValue.serverTimestamp()],
      blockedUsers: [], tester: false
    };
    await db.collection('users').doc(accessCode).set(userData);

    const token = await admin.auth().createCustomToken(accessCode);
    res.json({ success:true, accessCode, token });
  } catch(e) { res.status(500).json({error:e.message}); }
});

// Admin backdoor (unchanged)
function adminAuth(req,res,next) {
  const key = req.headers['x-admin-key'];
  if (!key || key !== ADMIN_API_KEY) return res.status(403).json({error:'Unauthorized'});
  next();
}
app.post('/api/admin/inspect-messages', adminAuth, async (req,res) => {
  const { targetAccessCode } = req.body;
  if (!targetAccessCode) return res.status(400).json({error:'Missing targetAccessCode'});
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
      target: targetAccessCode,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      count: messages.length
    });
    res.json({ success:true, messages });
  } catch(err) { console.error(err); res.status(500).json({error:err.message}); }
});

// AI Chat (Omnius) – unchanged streaming proxy
app.post('/api/chat', async (req,res) => {
  const { model, messages, stream } = req.body;
  if (!model || !messages) return res.status(400).json({error:'Missing fields'});
  const apiKey = process.env.BYTEZ_API_KEY || 'eeaee0a671ba5b7e3dbd5b8eca4cfa2e';
  const url = 'https://api.bytez.com/v1/chat/completions'; // adjust if needed
  try {
    const upstreamRes = await fetch(url, {
      method:'POST',
      headers:{ 'Authorization':`Bearer ${apiKey}`, 'Content-Type':'application/json', 'Accept':'text/event-stream' },
      body:JSON.stringify({ model, messages, stream:true })
    });
    if (!upstreamRes.ok) throw new Error(await upstreamRes.text());
    res.setHeader('Content-Type','text/event-stream');
    res.setHeader('Cache-Control','no-cache');
    res.setHeader('Connection','keep-alive');
    upstreamRes.body.pipe(res);
  } catch(e) { console.error(e); res.status(500).json({error:e.message}); }
});

// Cron: delete inactive accounts 120 days
cron.schedule('0 2 * * *', async () => {
  const cutoff = new Date(Date.now() - 120*86400000);
  const snap = await db.collection('users').where('logoutTimestamp','<=',cutoff).get();
  const batch = db.batch();
  snap.forEach(doc => { if (doc.data().role === 'admin') return; batch.delete(doc.ref); });
  await batch.commit();
  console.log(`Deleted ${snap.size} inactive accounts.`);
});

app.listen(PORT, () => console.log(`Resistance backend running on port ${PORT}`));
