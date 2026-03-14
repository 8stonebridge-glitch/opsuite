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
  'https://opsuite.vercel.app',
  process.env.CONVEX_SITE_URL,
].filter(Boolean) as string[];

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
        const text = [
          `Hi ${firstName},`,
          '',
          'Confirm your email to finish setting up your OpSuite workspace.',
          '',
          `Confirm email: ${url}`,
          '',
          'If you did not create an OpSuite account, you can safely ignore this message.',
        ].join('\n');
        const html = `
          <div style="margin:0; padding:32px 20px; background:#f3f4f6;">
            <div style="max-width:560px; margin:0 auto; background:#ffffff; border-radius:20px; padding:32px 28px; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color:#111827; line-height:1.6; border:1px solid #e5e7eb;">
              <div style="margin-bottom:24px;">
                <div style="width:56px; height:56px; border-radius:18px; background:#059669; color:#ffffff; font-size:28px; line-height:56px; text-align:center;">&#128188;</div>
              </div>
              <h1 style="margin:0 0 8px; font-size:28px; line-height:1.2; color:#111827;">Confirm your email</h1>
              <p style="margin:0 0 20px; font-size:16px; color:#4b5563;">Hi ${firstName},</p>
              <p style="margin:0 0 24px; font-size:16px; color:#374151;">
                Finish setting up your OpSuite workspace by confirming the email address you used to sign up.
              </p>
              <p style="margin:0 0 28px;">
                <a href="${safeUrl}" style="display:inline-block; background:#059669; color:#ffffff; padding:14px 20px; border-radius:12px; text-decoration:none; font-weight:700; font-size:15px;">
                  Confirm email
                </a>
              </p>
              <div style="margin:0 0 24px; padding:16px; border-radius:14px; background:#f9fafb; border:1px solid #e5e7eb;">
                <p style="margin:0 0 8px; font-size:13px; font-weight:600; color:#111827;">Having trouble with the button?</p>
                <p style="margin:0 0 10px; font-size:13px; color:#6b7280;">Open this link in your browser instead:</p>
                <p style="margin:0; font-size:13px; word-break:break-all; color:#059669;">${safeUrl}</p>
              </div>
              <p style="margin:0; font-size:13px; color:#6b7280;">
                If you did not create an OpSuite account, you can safely ignore this message.
              </p>
            </div>
          </div>
        `;

        await sendEmailViaResend({
          to: user.email,
          subject: 'Confirm your email for OpSuite',
          html,
          text,
        });
      },
    },
    plugins: [expo(), convex({ authConfig })],
  });

export const { getAuthUser } = authComponent.clientApi();
