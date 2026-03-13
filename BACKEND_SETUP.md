# Backend Setup

This repo is prepared for a `Clerk + Convex` backend, while the current app still runs on local demo state until credentials and server-side functions are ready.

## What is already scaffolded

- Clerk Expo provider shell
- Convex provider shell
- Convex auth config
- Initial Convex schema
- Expo Secure Store integration for Clerk token caching

Files:

- [app/_layout.tsx](/Users/sunday/Desktop/codex%20test/opsuite/app/_layout.tsx)
- [src/providers/BackendProviders.tsx](/Users/sunday/Desktop/codex%20test/opsuite/src/providers/BackendProviders.tsx)
- [convex/auth.config.ts](/Users/sunday/Desktop/codex%20test/opsuite/convex/auth.config.ts)
- [convex/schema.ts](/Users/sunday/Desktop/codex%20test/opsuite/convex/schema.ts)
- [.env.example](/Users/sunday/Desktop/codex%20test/opsuite/.env.example)

## Environment variables

Create a local `.env` file based on `.env.example` and fill in:

```bash
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=
EXPO_PUBLIC_CONVEX_URL=
CLERK_JWT_ISSUER_DOMAIN=
```

## Clerk dashboard setup

1. Create a Clerk application for Expo.
2. Enable email + password authentication.
3. Copy the publishable key into `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`.
4. Create a JWT template named `convex`.
5. Copy the issuer domain into `CLERK_JWT_ISSUER_DOMAIN`.

Notes:

- The current Expo docs use `@clerk/expo`.
- Token caching is handled with Expo Secure Store.

## Convex setup

1. Log in:

```bash
npx convex login
```

2. Initialize or link the project:

```bash
npx convex dev
```

3. Copy the generated deployment URL into `EXPO_PUBLIC_CONVEX_URL`.

4. Keep `convex dev` running while building backend functions.

## Current schema scope

The initial schema already covers:

- users
- organizations
- memberships
- sites
- teams
- tasks
- taskAudits
- dailyHandoffs
- availabilityRecords
- invites
- orgSettings

## Suggested implementation order

1. Auth bootstrap
2. Users + organizations + memberships
3. Active organization switching
4. Sites + teams + invites
5. Tasks + audits
6. Daily handoffs
7. Availability
8. Notifications
9. Scorecards

## Important implementation note

Until backend auth is fully wired:

- local demo auth remains the active source of truth
- Clerk/Convex providers are optional and only activate when env vars are present

That keeps the app runnable while the backend is being built.
