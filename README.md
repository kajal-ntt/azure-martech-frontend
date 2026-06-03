# Enterprise Marktech Frontend

Production-grade **Next.js (App Router)** frontend for the Enterprise Marktech platform.

This app integrates with the existing **Enterprise Marktech Backend** authentication server (Better Auth) and proxies auth routes through the frontend to keep cookies **first-party**.

---

## Key Features

- **Next.js App Router** with React Server Components and server-side session checks
- **Better Auth client** (cookie-based auth) wired to backend Better Auth
- **First-party auth proxy**: `/api/auth/*` on the frontend rewrites to the backend (`BACKEND_URL`)
- **Protected pages** using server-side session validation (`/dashboard`)
- **Production defaults**: `output: "standalone"`, disabled `x-powered-by`, basic security headers

---

## Project Structure

```text
enterprise-marktech-frontend/
├── app/
│   ├── page.tsx                  # Home (shows session status)
│   ├── sign-in/page.tsx          # Google sign-in + sign-out
│   └── dashboard/
│       ├── page.tsx              # Protected dashboard (server-side session check)
│       └── sign-out-button.tsx   # Client sign-out button
├── lib/
│   └── auth-client.ts            # Better Auth client instance
├── next.config.ts                # Prod config + /api/auth rewrite to backend
└── package.json
```

---

## Prerequisites

- Node.js v20+
- pnpm (recommended)
- Backend running locally or deployed:
  - `enterprise-marktech-backend` (Better Auth mounted at `/api/auth/*`)

---

## Setup (Local Development)

### 1) Install

```bash
pnpm -C enterprise-marktech-frontend install
```

### 2) Configure environment

Set this environment variable for the frontend:

```text
BACKEND_URL=http://localhost:8000
```

Notes:
- `BACKEND_URL` is used by `next.config.ts` (rewrite) and server-side session fetches.
- If you deploy, set `BACKEND_URL` to your backend origin (e.g. `https://api.example.com`).

### 3) Run

```bash
pnpm -C enterprise-marktech-frontend dev
```

Open http://localhost:3000

---

## Auth Architecture (Better Auth)

### How auth works in this repo

- The backend runs Better Auth at: `BACKEND_URL/api/auth/*`
- The frontend exposes: `/api/auth/*`
- Next.js rewrites `/api/auth/*` → `${BACKEND_URL}/api/auth/*`
- The React client uses:
  - `basePath: "/api/auth"` so calls stay on the frontend origin
  - `credentials: "include"` so cookies are sent/received correctly

Client setup: [auth-client.ts](file:///c:/Users/Abhishek.N/Desktop/Gitlab/enterprise-marktech/enterprise-marktech-frontend/lib/auth-client.ts)

### Pages

- `/sign-in`
  - Starts Google OAuth using `authClient.signIn.social({ provider: "google" })`
  - Signs out via `authClient.signOut()`
- `/dashboard`
  - Server-rendered and protected by fetching `/api/auth/get-session` (via backend)
  - Redirects to `/sign-in` if no session

---

## Required Backend Configuration

To avoid Better Auth origin/CSRF rejections, ensure the backend trusts the frontend:

- Backend should set `CLIENT_URL` to the frontend origin:
  - `CLIENT_URL=http://localhost:3000` (dev)
  - `CLIENT_URL=https://app.example.com` (prod)

If you serve frontend and backend on different domains, cookies can become third-party in some browsers (Safari ITP). The recommended setup is:

- Keep auth requests on the **frontend** origin via `/api/auth/*` (this repo already does this), and
- Ensure backend `trustedOrigins` includes the frontend origin.

---

## Common Commands

```bash
pnpm -C enterprise-marktech-frontend dev
pnpm -C enterprise-marktech-frontend build
pnpm -C enterprise-marktech-frontend start
```

---

## Production Deployment Notes

- `next build` produces a standalone build (`output: "standalone"`).
- Set `BACKEND_URL` to the backend service origin in your deployment environment.
- Ensure the backend sets secure cookies in production and that `trustedOrigins` includes your frontend origin.

---

## Troubleshooting

- **Auth works in Chrome but not Safari**
  - Ensure auth requests stay first-party via `/api/auth/*` on the frontend origin.
  - Avoid calling the backend auth endpoints directly from the browser.
- **Blocked by origin/CSRF checks**
  - Confirm backend `trustedOrigins` includes the frontend origin and `CLIENT_URL` is correct.
- **TypeScript can’t resolve a local import**
  - Prefer `@/*` imports (configured in `tsconfig.json`) and restart the TS server in VS Code.
