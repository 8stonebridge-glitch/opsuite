# Next App Setup Notes

This file is the practical record of what went wrong while setting up OpSuite, what fixed it, and what to do earlier next time.

Use it for two things:
- as a checklist when starting the next app
- as context you can hand to Codex or Claude so we do not repeat the same setup mistakes

## The big lesson

The hardest part was not building features. It was keeping these four things aligned at the same time:

1. Expo app runtime
2. Convex deployment
3. auth provider configuration
4. email delivery and verification flow

When any one of those drifted from the others, the app looked broken even when most of the code was correct.

## Mistakes we made and how they were fixed

### 1. We spent too long on Clerk + Convex when the real blocker was stack friction

What happened:
- We started with Clerk + Convex.
- The app had partial integration, dashboard-side configuration questions, stale sessions, and mobile token handoff issues.
- Expo Go made it harder to tell whether the problem was app code, network, or auth setup.

What fixed it:
- We removed Clerk from the runtime path.
- We switched to Convex Auth + Better Auth.
- We kept custom auth screens in the app.

What to do next time:
- Pick one auth stack early and commit to it.
- If the app is already deeply Convex-based, prefer Convex Auth + Better Auth unless there is a strong product reason to use Clerk.

### 2. Repo name, project name, and deployed backend name were easy to confuse

What happened:
- The repo/workspace folder was `opsuite`.
- The Convex project was `task`.
- That created repeated uncertainty about whether the app was pointed at the correct backend.

What fixed it:
- We verified the active deployment using Convex env and local project metadata.
- We stopped guessing and checked the actual deployment URL and project name.

What to do next time:
- Write these down on day one:
  - repo name
  - app name shown to users
  - Convex project name
  - dev deployment URL
  - production deployment URL

### 3. We had branch code and deployed backend code out of sync

What happened:
- Frontend code expected functions like `users.viewer`.
- The deployed backend did not yet have those functions.
- That made the app look like auth was failing when the real issue was version mismatch.

What fixed it:
- We merged the working auth/backend branch into `main`.
- We redeployed Convex from the same code state.
- We verified the exact functions available on the deployment.

What to do next time:
- Before debugging runtime errors, check:
  - is the frontend on the same branch as the backend?
  - has Convex been redeployed from that code?
  - does the generated API include the function the app is calling?

### 4. Adding a new Convex module without regenerating bindings caused fake TypeScript failures

What happened:
- We added modules like `availability.ts` and `emails.ts`.
- TypeScript then reported `api.availability` or `api.emails` as missing.

What fixed it:
- Run Convex sync/codegen first.
- Then run TypeScript.

What to do next time:
- After adding a new Convex file, always run:

```bash
npx convex dev --once
```

or:

```bash
npx convex codegen
```

before trusting frontend type errors.

### 5. Expo Go cached old bundles and made us think current code was still broken

What happened:
- The phone kept showing old Clerk-era screens and messages after the code had already changed.
- We were testing stale bundles without realizing it.

What fixed it:
- Start Expo on a fresh port with cache cleared.
- Fully close Expo Go before reopening.
- Open only the fresh tunnel URL, not the older recent-app entry.

What to do next time:
- If the UI still shows text that no longer exists in the repo, assume stale Expo cache first.

Use:

```bash
npx expo start --tunnel --clear --port 8092
```

and fully close Expo Go.

### 6. Email verification deep links were wrong for Expo Go

What happened:
- We initially used a custom app scheme callback.
- Tapping the email button produced "configure in iOS settings" or "address is invalid" behavior.
- That callback was reasonable for a built app, but unreliable in Expo Go.

What fixed it:
- We changed the verification callback to a normal web confirmation page on the Convex site.
- The browser now lands on `/email-confirmed`, and the user returns to the app manually.

What to do next time:
- During Expo Go development, prefer a simple web confirmation page.
- For production, switch to the real public confirmation URL.

Important current reminder:
- There is already a TODO in:
  - `/Users/sunday/Desktop/codex test/opsuite/src/lib/auth-client.ts`
- Before production launch, replace the current confirmation callback with the real public URL.

### 7. Resend was only half-configured at first

What happened:
- We set `RESEND_API_KEY`, but not the sender envs.
- Temporary tests used `onboarding@resend.dev`, which is heavily restricted.
- The send worked technically, but failed for recipients that were not the account owner's email.

What fixed it:
- We set:
  - `AUTH_FROM_EMAIL`
  - `AUTH_REPLY_TO_EMAIL`
- We switched the sender to `infor@payrail.online`.

What to do next time:
- Resend is not "done" when the API key exists.
- It is only actually ready when all three exist in Convex:

```bash
npx convex env set RESEND_API_KEY <key>
npx convex env set AUTH_FROM_EMAIL <sender>
npx convex env set AUTH_REPLY_TO_EMAIL <reply-to>
```

### 8. `resend.dev` is only for limited testing

What happened:
- The temporary email action failed with a 403 validation error.
- Resend said testing emails could only be sent to the account owner's own email address.

What fixed it:
- We switched from `onboarding@resend.dev` to a real sender on a verified domain.

What to do next time:
- Do not plan real signup email delivery around `resend.dev`.
- Use it only for quick self-tests if needed.

### 9. Verified email sending still went to junk

What happened:
- Email delivery worked, but messages landed in junk.

What improved it:
- Real sender domain
- reply-to configured
- cleaner email subject and body
- more normal-looking branded copy

What to do next time:
- Expect junk-folder behavior early on with a new sending domain.
- Check domain authentication in Resend:
  - SPF
  - DKIM
  - DMARC if used
- Polish the email content early.

### 10. Resetting the dev database was more than deleting app tables

What happened:
- With Better Auth, wiping only app tables was not enough.
- Auth component tables like users, sessions, accounts, and verifications also needed to be cleared.

What fixed it:
- We wiped both:
  - app tables
  - Better Auth component tables

What to do next time:
- If you need a clean re-register test, remember there are two data layers:
  - app data
  - auth data

### 11. Local onboarding and new auth flow overlapped

What happened:
- Old onboarding routes were still around while the new auth flow was being built.
- That made it feel like there were multiple sign-up paths.

What fixed it:
- We gated the legacy onboarding flow.
- We kept one clear sign-up path for real users.

What to do next time:
- As soon as auth changes, remove or isolate old onboarding routes.
- One real sign-up path is much easier to debug.

## Things that were difficult to set up

These were the recurring pain points:

1. Understanding which environment was the source of truth
   - local repo
   - Convex dev deployment
   - Expo Go
   - Resend dashboard

2. Getting email verification to work in Expo Go without broken deep links

3. Knowing whether a bug was:
   - stale bundle
   - undeployed backend
   - missing generated types
   - email provider restriction

4. Knowing which values belonged where
   - Resend API key is created in Resend
   - sender and reply-to are stored in Convex env
   - frontend only gets public Convex env values

5. Keeping temporary test code from becoming permanent
   - for example, one-time reset helpers and temporary email test buttons

## Best setup order for the next app

If we do another app like this, use this order:

1. Create the Expo app
2. Create the Convex project
3. Set frontend env:

```env
EXPO_PUBLIC_CONVEX_URL=
EXPO_PUBLIC_CONVEX_SITE_URL=
```

4. Set Convex auth env:

```bash
npx convex env set BETTER_AUTH_SECRET <random-secret>
```

5. Decide email strategy immediately:
   - if no domain yet, accept manual verification for a while
   - if real emails are needed, verify a sender domain before spending time on polish

6. Set Resend env only when the sender domain is real:

```bash
npx convex env set RESEND_API_KEY <key>
npx convex env set AUTH_FROM_EMAIL <sender>
npx convex env set AUTH_REPLY_TO_EMAIL <reply-to>
```

7. Use a simple web confirmation page during Expo Go development
8. Add custom sign-in and sign-up screens
9. Add backend sync for user/bootstrap/org selection
10. Only then start feature cutovers like tasks, handoffs, availability, and notifications

## Best commands to remember

### Convex sync after backend changes

```bash
npx convex dev --once
```

### Typecheck after Convex codegen

```bash
npm run typecheck
```

### Fresh Expo session

```bash
npx expo start --tunnel --clear --port 8092
```

### Check Convex env

```bash
npx convex env list
```

### Inspect dev tables

```bash
npx convex data
```

## What to tell Codex or Claude next time

If you want to start a similar app faster, you can paste this:

> Build this Expo + Convex app using Convex Auth with Better Auth from day one. Use custom auth screens. During Expo Go development, do not use an app-scheme email verification callback. Use a normal web confirmation page on the backend site first, and leave a TODO to swap to the real production URL later. Set up Resend only after the sender domain is verified. After adding any Convex module, run Convex sync/codegen before trusting frontend type errors. Keep frontend branch, generated API, and deployed Convex functions aligned at all times.

## Current production reminder

Before real production launch, still remember to:
- replace the current confirmation callback URL with the real public URL
- remove temporary Resend test UI if it is still present
- confirm password reset email delivery is production-ready
- verify deliverability, not just successful sending
