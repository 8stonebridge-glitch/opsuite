export default {
  providers: [
    {
      // Clerk issuer domain — replace with your actual Clerk instance URL
      // Found in Clerk Dashboard → JWT Templates or API Keys
      domain: process.env.CLERK_ISSUER_URL || 'https://rich-monitor-29.clerk.accounts.dev',
      applicationID: 'convex',
    },
  ],
};
