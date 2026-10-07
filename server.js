import express from 'express';
import cookieParser from 'cookie-parser';
import crypto from 'node:crypto';
import dotenv from 'dotenv';

dotenv.config();
const app = express();
app.use(express.json());
app.use(cookieParser());
const PORT = process.env.PORT || 10000;
const BASE_URL = (process.env.BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const REDIRECT_URI = `${BASE_URL}/auth/yahoo/callback`;

app.get('/', (_req, res) => res.type('text').send(`Kodiaks Assistant GM backend is running. OAuth redirect URI: ${REDIRECT_URI}`));
app.get('/api/status', (_req, res) => res.json({ ok:true, service:'Kodiaks Assistant GM backend', redirectUri:REDIRECT_URI, yahooConfigured:Boolean(process.env.YAHOO_CLIENT_ID && process.env.YAHOO_CLIENT_SECRET) }));

app.get('/auth/yahoo', (req, res) => {
  if (!process.env.YAHOO_CLIENT_ID) return res.status(500).send('YAHOO_CLIENT_ID is not configured yet.');
  const state = crypto.randomBytes(24).toString('hex');
  res.cookie('oauth_state', state, { httpOnly:true, secure:BASE_URL.startsWith('https://'), sameSite:'lax', maxAge:600000 });
  const params = new URLSearchParams({ client_id:process.env.YAHOO_CLIENT_ID, redirect_uri:REDIRECT_URI, response_type:'code', state });
  res.redirect(`https://api.login.yahoo.com/oauth2/request_auth?${params}`);
});

app.get('/auth/yahoo/callback', (req, res) => {
  if (req.query.error) return res.status(400).send(`Yahoo authorization was not completed: ${req.query.error}`);
  if (!req.query.code) return res.status(400).send('Yahoo did not return an authorization code.');
  res.type('html').send('<h2>Kodiaks Assistant GM</h2><p>Yahoo authorization callback received successfully.</p><p>The next build will exchange the authorization code for tokens and import the league.</p>');
});

app.listen(PORT, '0.0.0.0', () => console.log(`Kodiaks backend listening on ${PORT}; redirect URI: ${REDIRECT_URI}`));
