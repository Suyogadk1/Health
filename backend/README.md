# MindCare AI API Backend

Standalone, lightweight Node.js / Express API service for MindCare. It orchestrates the multi-provider AI engine (Gemini 1 & 2 failover + Grok / Groq backup), safety risk assessment filters, rate limiting, and conversation persistence.

---

## Quick Start (Local Development)

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure Environment**:
   Copy `.env.example` to `.env` and enter your AI API keys:
   ```bash
   cp .env.example .env
   ```

3. **Start the Development Server**:
   ```bash
   npm run dev
   ```
   The backend will be running on `http://localhost:5001`.

---

## API Endpoints

- `GET  /api/health` — Service health check & AI configuration status.
- `POST /api/chat` — Generates supportive AI reflections with automatic provider failover and safety risk assessment.
- `GET  /api/conversations` — Lists recent conversations.
- `GET  /api/conversations/:id` — Retrieves conversation messages.
- `GET  /api/profile` — Retrieves user profile.
- `PUT  /api/profile` — Updates user profile preferences.
- `GET  /api/ai/status` — Reports multi-provider AI availability.

---

## How to Upload to Private GitHub Repository

1. Initialize git inside this `backend` folder:
   ```bash
   cd backend
   git init
   git add .
   git commit -m "Initial commit of Understory Backend API"
   ```

2. Create a new **Private** repository on GitHub (e.g., `understory-backend`).

3. Link and push to your private GitHub repository:
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/understory-backend.git
   git branch -M main
   git push -u origin main
   ```

---

## 1-Click Deployment to Cloud

You can deploy this repository for free or low cost on **Render**, **Railway**, or **Fly.io**:

### Deploying on Render (Recommended)
1. Go to [Render Dashboard](https://dashboard.render.com/) > **New +** > **Web Service**.
2. Connect your private GitHub repository (`understory-backend`).
3. Set the following settings:
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
4. Under **Environment Variables**, add:
   - `GEMINI_API_KEY`: Your primary Gemini API key
   - `GEMINI_API_KEY_2`: Your backup Gemini API key
   - `GROK_API_KEY`: Your Grok/Groq API key
   - `PORT`: `5001`
5. Click **Deploy Web Service**. You will receive an API URL (e.g., `https://understory-backend.onrender.com`).

---

## Connecting Netlify Frontend to This Backend

In your **Netlify Dashboard** for the frontend:
1. Go to **Site configuration** > **Environment variables**.
2. Add a new variable:
   - **Key**: `BACKEND_URL`
   - **Value**: `https://your-backend-service.onrender.com` (your backend URL)
3. Trigger a redeploy on Netlify. All `/api/*` calls from your frontend will automatically route to your private backend!
