# Kodiaks Assistant GM — Yahoo backend

This is the server-side backend for the Kodiaks Assistant GM. It provides the OAuth callback endpoint while keeping the Yahoo Client Secret off the browser/frontend.

## Render settings
- Root Directory: `backend`
- Build Command: `npm install`
- Start Command: `npm start`
- Plan: Free for initial testing
- Environment variable: `BASE_URL=https://YOUR-RENDER-SERVICE.onrender.com`

After deployment, the Yahoo Redirect URI will be:
`https://YOUR-RENDER-SERVICE.onrender.com/auth/yahoo/callback`

Never commit a real `.env` file or Yahoo Client Secret to GitHub.
