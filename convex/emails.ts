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
      throw new Error("Unauthenticated");
    }

    const to =
      args.email?.trim().toLowerCase() ||
      (typeof identity.email === "string" ? identity.email.trim().toLowerCase() : "");

    if (!to) {
      throw new Error("No email address is available for this test send");
    }

    const name =
      args.name?.trim() ||
      (typeof identity.name === "string" ? identity.name.trim() : "") ||
      "there";

    const apiKey = process.env.RESEND_API_KEY?.trim();
    if (!apiKey) {
      throw new Error("RESEND_API_KEY is not set in Convex");
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
        from: "onboarding@resend.dev",
        to: [to],
        subject,
        html,
        text,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Failed to send welcome email: ${body || response.statusText}`);
    }

    const result = await response.json();

    return {
      ok: true,
      to,
      id: result?.id ?? null,
    };
  },
});
