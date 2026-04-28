# Mandi Accounting - Production Deployment Guide

Setup: Frontend on **Vercel**, Backend on **Render**, Database on **MongoDB Atlas**, Domain **mandipro.in** (GoDaddy).

---

## Step 1 — Save to GitHub from Emergent

1. In the Emergent chat input bar, click **"Save to GitHub"** button.
2. Pick (or create) a fresh repo, e.g. `mandipro` under your GitHub account.
3. Confirm. Wait for the push to complete (~30 sec).

---

## Step 2 — MongoDB Atlas (one-time)

1. Atlas dashboard → your `Cluster0` → **Network Access** → Add IP Address → **Allow Access from Anywhere (0.0.0.0/0)**. Render's free tier doesn't have a static IP.
2. **Database Access** → confirm you have a user with read/write on `mandi-accounting`.
3. **Database** → Connect → "Drivers" → Python → copy the connection string. Replace `<password>` with the actual password.

   Format:
   ```
   mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
   ```

---

## Step 3 — Deploy Backend to Render

1. https://dashboard.render.com → **New** → **Web Service**.
2. Connect GitHub → select `mandipro` repo.
3. Settings:
   - **Name:** `mandi-backend`
   - **Region:** Singapore (closest to India)
   - **Branch:** `main`
   - **Root Directory:** `backend`
   - **Runtime:** Python 3
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn server:app --host 0.0.0.0 --port $PORT`
   - **Plan:** Free
4. **Environment Variables** (click *Add Environment Variable* for each):

   | Key | Value |
   |---|---|
   | `ENV` | `production` |
   | `MONGO_URL` | (Atlas connection string from Step 2) |
   | `DB_NAME` | `mandi-accounting` |
   | `JWT_SECRET` | Generate one: run `python -c "import secrets; print(secrets.token_hex(32))"` |
   | `ADMIN_EMAIL` | `admin@mandi.com` |
   | `ADMIN_PASSWORD` | (your strong password — used to seed the admin on first boot) |
   | `CORS_ORIGINS` | `https://mandipro.in,https://www.mandipro.in` (set to Vercel preview URL temporarily, then update) |
   | `PYTHON_VERSION` | `3.11.9` |

5. Click **Create Web Service**. Render builds + deploys (~3-5 min).
6. Once live, copy the URL — looks like `https://mandi-backend-xxxx.onrender.com`. **You'll need it for the frontend.**

⚠️ **Free-tier note:** Render free spins down after 15 min of inactivity. First request after sleep takes ~30 sec to wake. Upgrade to Starter ($7/mo) if you need always-on.

---

## Step 4 — Deploy Frontend to Vercel

1. https://vercel.com/new → Import GitHub → pick `mandipro` repo.
2. Settings:
   - **Framework Preset:** Create React App
   - **Root Directory:** `frontend` (click *Edit* and set this!)
   - **Build Command:** `yarn build` (auto-detected)
   - **Output Directory:** `build` (auto-detected)
3. **Environment Variables**:

   | Key | Value |
   |---|---|
   | `REACT_APP_BACKEND_URL` | (the Render URL from Step 3, e.g. `https://mandi-backend-xxxx.onrender.com`) |

4. Click **Deploy**. Build takes ~2 min.
5. Visit the temp Vercel URL (e.g. `mandipro.vercel.app`) — confirm login works with `admin@mandi.com`.

---

## Step 5 — Update CORS on Render

Now that you have your Vercel URL, update Render env:

1. Render dashboard → `mandi-backend` → **Environment**.
2. Edit `CORS_ORIGINS` →
   ```
   https://mandipro.in,https://www.mandipro.in,https://mandipro.vercel.app
   ```
3. Save → Render auto-redeploys.

---

## Step 6 — Connect mandipro.in (GoDaddy → Vercel)

1. Vercel dashboard → `mandipro` project → **Settings** → **Domains** → Add `mandipro.in` → Add `www.mandipro.in`.
2. Vercel will show DNS records you need to add. Two options:

   **Option A (recommended) — Use Vercel nameservers**
   - Copy Vercel's nameservers (e.g. `ns1.vercel-dns.com`, `ns2.vercel-dns.com`).
   - GoDaddy → My Products → Domain `mandipro.in` → DNS → Nameservers → Change → enter Vercel's NS.
   - Propagation: 10 min – 24 hr.

   **Option B — Keep GoDaddy DNS, add records manually**
   - GoDaddy → DNS → Add records as Vercel instructs:
     - `A` record: `@` → `76.76.21.21`
     - `CNAME`: `www` → `cname.vercel-dns.com`

3. Wait for Vercel to mark domain as "Valid Configuration" (green check). HTTPS is automatic via Let's Encrypt.

---

## Step 7 — Final Smoke Test on Production

1. Visit `https://mandipro.in`.
2. Log in with admin → confirm:
   - Dashboard loads metrics
   - Dukandar Ledger / Bepaari Ledger render
   - Cash Book / Daily Sales work
   - Balance Sheet (admin only) shows tally diff = 0
3. Log out → log in as operator → confirm Balance Sheet is hidden.

---

## Common Gotchas

| Symptom | Fix |
|---|---|
| `CORS error` on login | `CORS_ORIGINS` env on Render must include your exact Vercel/domain URL with `https://` |
| Login succeeds but next API call returns 401 | Cookies blocked. Confirm `ENV=production` on Render so cookies are `SameSite=None; Secure` |
| Frontend build fails on Vercel | Set **Root Directory** to `frontend`, NOT repo root |
| MongoDB connection timeout on Render | Atlas Network Access must allow `0.0.0.0/0` (Render free tier has no static IP) |
| 502 on first request | Render free tier just woke up — wait 30 sec, retry |
| Admin user not created on first boot | Check Render logs for "Admin user seeded"; verify `MONGO_URL` is correct |

---

## Auto-Deploy on Future Changes

After this is set up, the loop becomes:

**Emergent UI → make changes → click "Save to GitHub" → Vercel + Render auto-redeploy from `main`.**

Both platforms watch your `main` branch by default. No manual redeploy needed.

---

## Backup Strategy (Recommended Before Launch)

1. Atlas dashboard → Cluster0 → **Backup** → enable **Cloud Backup** (free tier on M0 has *no* automated backups; consider M2+ at $9/mo for 1-day retention OR use `mongodump` weekly).
2. Manual backup now:
   ```bash
   mongodump --uri="<your atlas uri>" --db=mandi-accounting --out=./backup-$(date +%F)
   ```

---

Ready to ship 🚀
