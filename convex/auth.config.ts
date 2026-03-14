import type { AuthConfig } from 'convex/server';

export default {
  providers: [
    {
      // Hardcode the URL here for the handshake to work reliably
      domain: "https://welcome-wombat-17.clerk.accounts.dev",
      applicationID: 'convex',
    },
  ],
} satisfies AuthConfig;
