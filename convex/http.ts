import { httpRouter } from 'convex/server';
import { authComponent, createAuth } from './auth';
import { httpAction } from './_generated/server';

const http = httpRouter();
authComponent.registerRoutes(http, createAuth, { cors: true });

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function corsOptions() {
  return httpAction(async () => {
    return new Response(null, { status: 204, headers: corsHeaders });
  });
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/* ── Admin-provisioned account creation ─────────────────────────────── *
 * Creates a Better Auth email/password account for an admin-provisioned
 * employee. Uses the auth instance's internalAdapter to mark the email
 * as verified immediately — no confirmation email needed.
 * ──────────────────────────────────────────────────────────────────── */
http.route({
  path: '/admin/create-auth-account',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const body = await request.json() as { name: string; email: string; password: string };
    const { name, email, password } = body;

    if (!name || !email || !password) {
      return jsonResponse({ error: 'name, email, and password are required' }, 400);
    }
    if (password.length < 6) {
      return jsonResponse({ error: 'Password must be at least 6 characters' }, 400);
    }

    const siteUrl = process.env.CONVEX_SITE_URL!;
    const normalizedEmail = email.trim().toLowerCase();

    try {
      const auth = createAuth(ctx);
      const authCtx = await (auth as any).$context;

      // 1. Call Better Auth sign-up endpoint on this same server.
      let alreadyExists = false;
      const signUpRes = await fetch(`${siteUrl}/api/auth/sign-up/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: normalizedEmail,
          password,
        }),
      });

      if (!signUpRes.ok) {
        const errText = await signUpRes.text();
        if (errText.includes('already') || errText.includes('exists') || errText.includes('USER_ALREADY_EXISTS')) {
          alreadyExists = true;
        } else {
          return jsonResponse({ error: `Auth signup failed: ${errText}` }, 400);
        }
      }

      // 2. Always mark email as verified — covers both new and existing accounts
      //    whose verification may have failed on a previous attempt.
      if (authCtx?.internalAdapter?.updateUserByEmail) {
        await authCtx.internalAdapter.updateUserByEmail(normalizedEmail, {
          emailVerified: true,
        });
      }

      return jsonResponse({ ok: true, alreadyExists });
    } catch (err: any) {
      return jsonResponse({ error: err.message || 'Unknown error' }, 500);
    }
  }),
});

http.route({ path: '/admin/create-auth-account', method: 'OPTIONS', handler: corsOptions() });

/* ── Admin update password ─────────────────────────────────────────── */
http.route({
  path: '/admin/update-auth-password',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const body = await request.json() as { email: string; newPassword: string };
    const { email, newPassword } = body;

    if (!email || !newPassword) {
      return jsonResponse({ error: 'email and newPassword are required' }, 400);
    }
    if (newPassword.length < 6) {
      return jsonResponse({ error: 'Password must be at least 6 characters' }, 400);
    }

    const normalizedEmail = email.trim().toLowerCase();

    try {
      const auth = createAuth(ctx);
      const authCtx = await (auth as any).$context;
      const adapter = authCtx?.internalAdapter;

      if (!adapter) {
        return jsonResponse({ error: 'Auth adapter not available' }, 500);
      }

      // Find user by email
      const authUser = await adapter.findUserByEmail(normalizedEmail);
      if (!authUser?.user) {
        return jsonResponse({ error: 'User not found' }, 404);
      }

      // Hash the new password using Better Auth's crypto
      const { hashPassword } = await import('better-auth/crypto');
      const hashedPassword = await hashPassword(newPassword);

      // Find their credential account and update password
      const accounts = await adapter.findAccounts(authUser.user.id);
      const credentialAccount = accounts.find((a: any) => a.providerId === 'credential');

      if (!credentialAccount) {
        return jsonResponse({ error: 'No credential account found for this user' }, 404);
      }

      // Use the DB adapter to update the password on the account
      const dbAdapter = authCtx.adapter;
      await dbAdapter.update({
        model: 'account',
        where: [{ field: 'id', value: credentialAccount.id }],
        update: { password: hashedPassword },
      });

      return jsonResponse({ ok: true });
    } catch (err: any) {
      return jsonResponse({ error: err.message || 'Unknown error' }, 500);
    }
  }),
});

http.route({ path: '/admin/update-auth-password', method: 'OPTIONS', handler: corsOptions() });

/* ── Admin update email ─────────────────────────────────────────────── */
http.route({
  path: '/admin/update-auth-email',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const body = await request.json() as { oldEmail: string; newEmail: string };
    const { oldEmail, newEmail } = body;

    if (!oldEmail || !newEmail) {
      return jsonResponse({ error: 'oldEmail and newEmail are required' }, 400);
    }

    const normalizedOld = oldEmail.trim().toLowerCase();
    const normalizedNew = newEmail.trim().toLowerCase();

    try {
      const auth = createAuth(ctx);
      const authCtx = await (auth as any).$context;
      const adapter = authCtx?.internalAdapter;

      if (!adapter) {
        return jsonResponse({ error: 'Auth adapter not available' }, 500);
      }

      // Find auth user by old email
      const authUser = await adapter.findUserByEmail(normalizedOld);
      if (!authUser?.user) {
        return jsonResponse({ error: 'User not found' }, 404);
      }

      // Update email on the auth user and keep it verified
      await adapter.updateUserByEmail(normalizedOld, {
        email: normalizedNew,
        emailVerified: true,
      });

      // Update the accountId on the credential account
      const accounts = await adapter.findAccounts(authUser.user.id);
      const credentialAccount = accounts.find((a: any) => a.providerId === 'credential');

      if (credentialAccount) {
        const dbAdapter = authCtx.adapter;
        await dbAdapter.update({
          model: 'account',
          where: [{ field: 'id', value: credentialAccount.id }],
          update: { accountId: normalizedNew },
        });
      }

      return jsonResponse({ ok: true });
    } catch (err: any) {
      return jsonResponse({ error: err.message || 'Unknown error' }, 500);
    }
  }),
});

http.route({ path: '/admin/update-auth-email', method: 'OPTIONS', handler: corsOptions() });

/* ── Email confirmed page ──────────────────────────────────────────── */
http.route({
  path: '/email-confirmed',
  method: 'GET',
  handler: httpAction(async () => {
    const html = `
      <!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Email confirmed | OpSuite</title>
          <style>
            body {
              margin: 0;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
              background: #f3f4f6;
              color: #111827;
            }
            .shell {
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 24px;
            }
            .card {
              width: 100%;
              max-width: 560px;
              background: #ffffff;
              border: 1px solid #e5e7eb;
              border-radius: 24px;
              padding: 32px 28px;
              box-shadow: 0 18px 50px rgba(15, 23, 42, 0.08);
            }
            .badge {
              width: 56px;
              height: 56px;
              border-radius: 18px;
              background: #059669;
              color: #ffffff;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 28px;
              margin-bottom: 20px;
            }
            h1 {
              margin: 0 0 10px;
              font-size: 30px;
              line-height: 1.2;
            }
            p {
              margin: 0 0 16px;
              font-size: 16px;
              line-height: 1.7;
              color: #4b5563;
            }
            .hint {
              margin-top: 20px;
              padding: 16px;
              border-radius: 14px;
              background: #f9fafb;
              border: 1px solid #e5e7eb;
              font-size: 14px;
            }
          </style>
        </head>
        <body>
          <main class="shell">
            <section class="card">
              <div class="badge">✓</div>
              <h1>Email confirmed</h1>
              <p>Your email has been successfully verified for OpSuite.</p>
              <p>You can return to the app and sign in with your email and password.</p>
              <div class="hint">
                If the app is still open, go back to it manually and continue from the sign-in screen.
              </div>
            </section>
          </main>
        </body>
      </html>
    `;

    return new Response(html, {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  }),
});

export default http;
