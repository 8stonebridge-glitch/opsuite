# Backend Setup

This repo now uses Convex Auth with Better Auth for Expo.

## Required env

Frontend (`.env` or `.env.local`):

```env
EXPO_PUBLIC_CONVEX_URL=
EXPO_PUBLIC_CONVEX_SITE_URL=
```

Convex env:

```bash
npx convex env set BETTER_AUTH_SECRET <random-secret>
npx convex env set RESEND_API_KEY <resend-api-key>
npx convex env set AUTH_FROM_EMAIL onboarding@yourdomain.com
npx convex env set AUTH_REPLY_TO_EMAIL support@yourdomain.com
```

## What is configured

- Convex Better Auth component in `/Users/sunday/Desktop/codex test/opsuite/convex/convex.config.ts`
- Better Auth server in `/Users/sunday/Desktop/codex test/opsuite/convex/auth.ts`
- Auth routes in `/Users/sunday/Desktop/codex test/opsuite/convex/http.ts`
- Convex auth provider config in `/Users/sunday/Desktop/codex test/opsuite/convex/auth.config.ts`
- Expo auth client in `/Users/sunday/Desktop/codex test/opsuite/src/lib/auth-client.ts`
- React provider bridge in `/Users/sunday/Desktop/codex test/opsuite/src/providers/BackendProviders.tsx`

## Local workflow

1. Start Convex:

```bash
npx convex dev
```

2. Start Expo:

```bash
npm start
```

## Current scope

Implemented:
- email + password sign in
- email + password sign up
- sign-up password confirmation
- email verification on sign up
- Convex-backed session restore
- owner bootstrap into organizations/workspaces

Not yet configured:
- password reset email delivery
- social auth
