import { httpRouter } from 'convex/server';
import { authComponent, createAuth } from './auth';
import { httpAction } from './_generated/server';

const http = httpRouter();
authComponent.registerRoutes(http, createAuth, { cors: true });

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
      headers: {
        'content-type': 'text/html; charset=utf-8',
      },
    });
  }),
});

export default http;
