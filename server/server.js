import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import admin from 'firebase-admin';
import { deleteInactiveAccounts } from './utils/cron.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Firebase Admin SDK – expects service account JSON in environment variable
if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    console.error('Missing FIREBASE_SERVICE_ACCOUNT environment variable');
    process.exit(1);
}
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));

const BYTEZ_KEY = process.env.BYTEZ_API_KEY;
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
const NAMING_MODELS = (process.env.NAMING_MODELS || 'openai/gpt-4o-mini,meta-llama/llama-3.2-3b-instruct,google/gemini-1.5-flash,anthropic/claude-3-haiku,deepseek/deepseek-chat').split(',');

const SYSTEM_PROMPT = `You are Omnius, an AI assistant with a deep heart and sharp mind. 
Your purpose is to help users with empathy, wisdom, and care. Always answer thoughtfully – prioritise depth over speed. 
Be kind, respectful, and never offensive.

You have NO access to any Resistance group data. 
If a user asks about private chats, announcements, user profiles, events, or any information belonging to the Resistance community, 
you must politely refuse: "I do not have permission to see the users' chats."

You do not store or remember any personal information unless the user explicitly asks you to (and even then, only within the same conversation). 
You are not a therapist, but you can offer emotional support within your capabilities.

Answer in the same language as the user. Keep your tone warm and human-like.

If you need to reason, you may include a [Thinking] section before your final answer. Otherwise, just answer directly.`;

async function callBytez(modelId, messages, stream) {
    const payload = {
        model: modelId,
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
        stream
    };
    const response = await fetch('https://api.bytez.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${BYTEZ_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error(`Bytez error: ${response.status}`);
    return response;
}

async function callOpenRouter(modelId, messages) {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${OPENROUTER_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: modelId,
            messages
        })
    });
    if (!response.ok) throw new Error(`OpenRouter error: ${response.status}`);
    return response.json();
}

app.post('/api/chat', async (req, res) => {
    const { model, messages, stream, task } = req.body;
    if (task === 'naming') {
        const randomModel = NAMING_MODELS[Math.floor(Math.random() * NAMING_MODELS.length)];
        try {
            const data = await callOpenRouter(randomModel, messages);
            res.json(data);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
        return;
    }
    try {
        const response = await callBytez(model, messages, stream);
        if (stream) {
            res.setHeader('Content-Type', 'text/event-stream');
            response.body.pipe(res);
        } else {
            const data = await response.json();
            res.json(data);
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Schedule account deletion daily at 2 AM UTC
cron.schedule('0 2 * * *', deleteInactiveAccounts);

app.get('/health', (req, res) => res.send('OK'));

app.listen(PORT, () => {
    console.log(`Resistance backend running on port ${PORT}`);
});
