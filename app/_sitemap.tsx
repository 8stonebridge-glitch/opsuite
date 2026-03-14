import { Redirect } from 'expo-router';

/**
 * Override Expo Router's built-in _sitemap dev page so it is never
 * accessible in production. Redirects to the app root.
 */
export default function SitemapOverride() {
  return <Redirect href="/" />;
}
