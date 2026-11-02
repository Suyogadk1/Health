# MindCare Frontend (Netlify Ready)

Modern, ultra-responsive mental wellness companion UI built with Next.js App Router, Tailwind CSS, Framer Motion, and Three.js.

---

## Quick Start (Local Development)

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start Development Server**:
   ```bash
   npm run dev
   ```
   The frontend runs on `http://localhost:3000`. By default, it proxies all `/api/*` requests to the backend at `http://localhost:5001`.

3. **Build Production Bundle**:
   ```bash
   npm run build
   ```

---

## Deploying to Netlify

### Option A: Deploying from the monorepo root
If your GitHub repository has both `frontend/` and `backend/`:
- **Base directory**: `frontend`
- **Build command**: `npm run build`
- **Publish directory**: `.next`
- The `netlify.toml` in the root is already configured with `base = "frontend"` to do this automatically!

### Option B: Deploying frontend as its own GitHub repo
If you upload only the contents of `frontend/` to a GitHub repository:
- **Base directory**: (leave blank)
- **Build command**: `npm run build`
- **Publish directory**: `.next`

### Environment Variables on Netlify
In Netlify **Site configuration > Environment variables**, add:
- `BACKEND_URL`: `https://your-backend-api.onrender.com` (URL of your deployed backend service)

Next.js rewrites in `next.config.js` will automatically proxy all `/api/*` requests directly to your private backend service with zero browser CORS hurdles.
