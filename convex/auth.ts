import { createClient } from '@convex-dev/better-auth';
import { convex } from '@convex-dev/better-auth/plugins';
import { expo } from '@better-auth/expo';
import { betterAuth } from 'better-auth';
import { components } from './_generated/api';
import authConfig from './auth.config';

export const authComponent = createClient(components.betterAuth);

const trustedOrigins = [
  'taskhub://',
  'exp://',
  'http://localhost',
  'http://localhost:8081',
  'http://localhost:19006',
  'http://localhost:8088',
];

async function sendEmailViaResend({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.AUTH_FROM_EMAIL?.trim();
  const replyTo = process.env.AUTH_REPLY_TO_EMAIL?.trim();

  if (!apiKey || !from) {
    console.info(`[auth] Verification email for ${to}: ${text}`);
    return;
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      reply_to: replyTo || undefined,
      subject,
      html,
      text,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to send verification email: ${body || response.statusText}`);
  }
}

export const createAuth = (ctx: Parameters<typeof authComponent.adapter>[0]) =>
  betterAuth({
    baseURL: process.env.CONVEX_SITE_URL,
    basePath: '/api/auth',
    secret: process.env.BETTER_AUTH_SECRET,
    database: authComponent.adapter(ctx),
    trustedOrigins,
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: 6,
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: true,
      autoSignInAfterVerification: true,
      async sendVerificationEmail({ user, url }) {
        const firstName = user.name?.trim().split(/\s+/)[0] || 'there';
        const safeUrl = url.replace(/"/g, '&quot;');
        const text = `Hi ${firstName}, verify your TaskHub email by opening this link: ${url}`;
        const html = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111827; line-height: 1.6;">
            <p>Hi ${firstName},</p>
            <p>Confirm your email to finish setting up your TaskHub workspace.</p>
            <p>
              <a href="${safeUrl}" style="display: inline-block; background: #059669; color: #ffffff; padding: 12px 18px; border-radius: 10px; text-decoration: none; font-weight: 600;">
                Confirm email
              </a>
            </p>
            <p>If the button does not work, copy and paste this link into your browser:</p>
            <p>${safeUrl}</p>
          </div>
        `;

        await sendEmailViaResend({
          to: user.email,
          subject: 'Confirm your TaskHub email',
          html,
          text,
        });
      },
    },
    plugins: [expo(), convex({ authConfig })],
  });

export const { getAuthUser } = authComponent.clientApi();
