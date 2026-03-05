  import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Allow frontend requests
app.use(express.json());

// OpenRouter endpoint – read API key from environment variable
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
if (!OPENROUTER_API_KEY) {
  console.error('❌ OPENROUTER_API_KEY environment variable is not set!');
  process.exit(1); // Exit if key missing – Render will mark deployment as failed
} else {
  console.log(`✅ OPENROUTER_API_KEY loaded (length: ${OPENROUTER_API_KEY.length})`);
}

// Proxy endpoint
app.post('/api/chat', async (req, res) => {
  const { model, messages, stream } = req.body;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        // Your GitHub Pages URL – already replaced
        'HTTP-Referer': 'https://gripnglitch.github.io/Quantam_Ai/',
        'X-Title': 'Omnius AI'
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        stream: stream || false
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter error:', response.status, errorText);
      return res.status(response.status).json({ error: 'OpenRouter error', details: errorText });
    }

    // Forward streaming response
    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(decoder.decode(value));
        }
      } finally {
        reader.releaseLock();
        res.end();
      }
    } else {
      const data = await response.json();
      return res.status(200).json(data);
    }
  } catch (error) {
    console.error('Proxy error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Optional health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK' });
});

app.listen(PORT, () => {
  console.log(`🚀 Omnius backend running on port ${PORT}`);
});
