# Omnius AI

## Deployment Instructions

### Frontend (GitHub Pages)
- Place `index.html` in the `docs/` folder of your repository.
- Go to repository **Settings → Pages** and set source to `Deploy from branch: main /docs`.
- Your frontend will be available at `https://gripnglitch.github.io/Quantam_Ai/`.

### Backend (Render)
- Create a new Web Service on Render, connect your repository.
- Set **Root Directory** to the folder containing `server.js` and `package.json` (e.g., `api` or root).
- **Build Command:** `npm install`
- **Start Command:** `npm start`
- Add environment variable:  
  `OPENROUTER_API_KEY` = `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`
- Deploy. Your backend URL will be `https://your-service.onrender.com`.
- The frontend already uses `https://quantam-ai-1am2.onrender.com/api/chat`.

### After Deployment
- Open your GitHub Pages URL. The loading screen should disappear.
- Send a test message – the AI should respond.
- If you see errors, check the Eruda console (red floating button) or Render logs.
