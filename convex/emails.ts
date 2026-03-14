"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";

export const sendWelcome = action({
  args: {
    email: v.optional(v.string()),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { ok: false, error: "Unauthenticated" as const };
    }

    const to =
      args.email?.trim().toLowerCase() ||
      (typeof identity.email === "string" ? identity.email.trim().toLowerCase() : "");

    if (!to) {
      return { ok: false, error: "No email address is available for this test send" as const };
    }

    const name =
      args.name?.trim() ||
      (typeof identity.name === "string" ? identity.name.trim() : "") ||
      "there";

    const apiKey = process.env.RESEND_API_KEY?.trim();
    const from = process.env.AUTH_FROM_EMAIL?.trim();
    if (!apiKey) {
      return { ok: false, error: "RESEND_API_KEY is not set in Convex" as const };
    }
    if (!from) {
      return { ok: false, error: "AUTH_FROM_EMAIL is not set in Convex" as const };
    }

    const subject = "Welcome to TaskHub";
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111827; line-height: 1.6;">
        <p>Hi ${name},</p>
        <p>This is a temporary test email from your TaskHub app to confirm Resend is connected.</p>
        <p>If you received this, your Convex action can send email successfully.</p>
      </div>
    `;
    const text = `Hi ${name}, this is a temporary TaskHub test email to confirm Resend is connected.`;

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        html,
        text,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      return {
        ok: false,
        error: `Failed to send welcome email: ${body || response.statusText}`,
      } as const;
    }

    const result = await response.json();

    return {
      ok: true as const,
      to,
      id: result?.id ?? null,
    };
  },
});
