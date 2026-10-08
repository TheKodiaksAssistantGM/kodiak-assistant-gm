import express from 'express';
import cookieParser from 'cookie-parser';
import crypto from 'node:crypto';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

dotenv.config();

const app = express();
app.use(express.json());
app.use(cookieParser());

const PORT = process.env.PORT || 10000;

const BASE_URL = (
  process.env.BASE_URL ||
  `http://localhost:${PORT}`
).replace(/\/$/, '');

const REDIRECT_URI = `${BASE_URL}/auth/yahoo/callback`;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

/*
  -------------------------------------------------------
  KODIAKS ASSISTANT GM
  Version 1.1.1
  -------------------------------------------------------

  Yahoo remains the eventual source of truth.

  Until Yahoo Fantasy API approval is complete, the
  application runs in DEMO MODE so the dashboard and
  Assistant GM features can be developed safely.
*/

// -------------------------------------------------------
// DEMO LEAGUE DATA
// -------------------------------------------------------

const league = {
  name: 'The Alberta Cup',
  teams: 12,
  scoring: 'PPR',
  roster: {
    QB: 1,
    RB: 2,
    WR: 3,
    TE: 1,
    FLEX: 1,
    BENCH: 6,
    IR: 2
  },
  keepers: 3,
  auctionBudget: 106,
  dataSource: 'Yahoo Fantasy Sports',
  demoMode: true
};

const teams = [
  { id: 'kodiaks', name: 'Kodiaks', owner: 'You', record: '—', standing: '—' },
  { id: 'horned-frogs', name: 'Horned Frogs', owner: 'Zach', record: '—', standing: '—' },
  { id: 'fatboyz', name: 'Fatboyz', owner: 'Fatboyz', record: '—', standing: '—' },
  { id: 'team-4', name: 'Team 4', owner: '—', record: '—', standing: '—' },
  { id: 'team-5', name: 'Team 5', owner: '—', record: '—', standing: '—' },
  { id: 'team-6', name: 'Team 6', owner: '—', record: '—', standing: '—' },
  { id: 'team-7', name: 'Team 7', owner: '—', record: '—', standing: '—' },
  { id: 'team-8', name: 'Team 8', owner: '—', record: '—', standing: '—' },
  { id: 'team-9', name: 'Team 9', owner: '—', record: '—', standing: '—' },
  { id: 'team-10', name: 'Team 10', owner: '—', record: '—', standing: '—' },
  { id: 'team-11', name: 'Team 11', owner: '—', record: '—', standing: '—' },
  { id: 'team-12', name: 'Team 12', owner: '—', record: '—', standing: '—' }
];

const kodiaks = {
  team: 'Kodiaks',
  rosterStatus: 'Yahoo import pending',
  roster: [],
  watchlist: [
    {
      player: 'Jordan Mason',
      position: 'RB',
      category: 'Injury Watch',
      note: 'Monitor injury status and expected return timeline.'
    },
    {
      player: 'Emmett Johnson',
      position: 'RB',
      category: 'Handcuff Watch',
      note: 'Monitor opportunity and depth-chart movement.'
    },
    {
      player: 'Sadiq',
      position: 'TE',
      category: 'Waiver Watch',
      note: 'Monitor targets and weekly role.'
    },
    {
      player: 'Jake Ferguson',
      position: 'TE',
      category: 'Waiver Watch',
      note: 'Monitor availability and role.'
    }
  ]
};

const players = [
  {
    name: 'Jordan Mason',
    position: 'RB',
    category: 'Injury Watch',
    trend: 'Monitor',
    availability: 'League',
  },
  {
    name: 'Emmett Johnson',
    position: 'RB',
    category: 'Handcuff Watch',
    trend: 'Upside',
    availability: 'League',
  },
  {
    name: 'Sadiq',
    position: 'TE',
    category: 'Waiver Watch',
    trend: 'Monitor',
    availability: 'Waiver',
  },
  {
    name: 'Jake Ferguson',
    position: 'TE',
    category: 'Waiver Watch',
    trend: 'Monitor',
    availability: 'Waiver',
  }
];

const recommendations = [
  {
    type: 'Something Changed',
    priority: 'High',
    title: 'Monitor Jordan Mason',
    description:
      'Keep an eye on his injury status before making this week’s lineup decisions.'
  },
  {
    type: 'Potential Steal',
    priority: 'Medium',
    title: 'Watch Emmett Johnson',
    description:
      'His value is tied to opportunity. A change in the depth chart could increase his fantasy value quickly.'
  },
  {
    type: 'Waiver Scouting',
    priority: 'Medium',
    title: 'Monitor the TE position',
    description:
      'Sadiq and Jake Ferguson are both worth monitoring for role, targets and availability.'
  }
];

const depthCharts = [
  {
    team: 'Kansas City',
    position: 'RB',
    note: 'Monitor the backup/handcuff situation.'
  },
  {
    team: 'New York Jets',
    position: 'TE',
    note: 'Monitor Sadiq’s weekly opportunity.'
  },
  {
    team: 'Dallas',
    position: 'TE',
    note: 'Monitor Ferguson’s role and availability.'
  }
];

// -------------------------------------------------------
// BASIC PAGES
// -------------------------------------------------------

app.get('/', (_req, res) => {
  res.sendFile(path.join(PROJECT_ROOT, 'index.html'));
});

// -------------------------------------------------------
// STATUS
// -------------------------------------------------------

app.get('/api/status', (_req, res) => {
  res.json({
    ok: true,
    service: 'Kodiaks Assistant GM backend',
    version: '1.1.1',
    environment: process.env.NODE_ENV || 'development',
    demoMode: true,
    yahooConfigured: Boolean(
      process.env.YAHOO_CLIENT_ID &&
      process.env.YAHOO_CLIENT_SECRET
    ),
    yahooApproval: 'pending',
    redirectUri: REDIRECT_URI
  });
});

// -------------------------------------------------------
// LEAGUE
// -------------------------------------------------------

app.get('/api/league', (_req, res) => {
  res.json(league);
});

app.get('/api/teams', (_req, res) => {
  res.json({
    league: league.name,
    teams
  });
});

// -------------------------------------------------------
// KODIAKS
// -------------------------------------------------------

app.get('/api/team/kodiaks', (_req, res) => {
  res.json(kodiaks);
});

// -------------------------------------------------------
// PLAYERS / WAIVERS
// -------------------------------------------------------

app.get('/api/players', (_req, res) => {
  res.json({
    demoMode: true,
    players
  });
});

app.get('/api/waivers', (_req, res) => {
  res.json({
    demoMode: true,
    players: players.filter(
      player => player.availability === 'Waiver'
    )
  });
});

// -------------------------------------------------------
// RECOMMENDATIONS
// -------------------------------------------------------

app.get('/api/recommendations', (_req, res) => {
  res.json({
    demoMode: true,
    recommendations
  });
});

// -------------------------------------------------------
// DEPTH CHARTS
// -------------------------------------------------------

app.get('/api/depth-charts', (_req, res) => {
  res.json({
    demoMode: true,
    depthCharts
  });
});

// -------------------------------------------------------
// YAHOO OAUTH
// -------------------------------------------------------

app.get('/auth/yahoo', (req, res) => {
  if (!process.env.YAHOO_CLIENT_ID) {
    return res
      .status(500)
      .send('YAHOO_CLIENT_ID is not configured yet.');
  }

  const state = crypto.randomBytes(24).toString('hex');

  res.cookie('oauth_state', state, {
    httpOnly: true,
    secure: BASE_URL.startsWith('https://'),
    sameSite: 'lax',
    maxAge: 600000
  });

  const params = new URLSearchParams({
    client_id: process.env.YAHOO_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    state
  });

  res.redirect(
    `https://api.login.yahoo.com/oauth2/request_auth?${params}`
  );
});

app.get('/auth/yahoo/callback', (req, res) => {
  if (req.query.error) {
    return res
      .status(400)
      .send(
        `Yahoo authorization was not completed: ${req.query.error}`
      );
  }

  if (!req.query.code) {
    return res
      .status(400)
      .send('Yahoo did not return an authorization code.');
  }

  res.type('html').send(`
    <h2>Kodiaks Assistant GM</h2>
    <p>Yahoo authorization callback received successfully.</p>
    <p>Yahoo API approval/token exchange is the next integration step.</p>
  `);
});

// -------------------------------------------------------
// STATIC FRONTEND
// -------------------------------------------------------

app.use(express.static(PROJECT_ROOT));

// -------------------------------------------------------
// START SERVER
// -------------------------------------------------------

app.listen(PORT, '0.0.0.0', () => {
  console.log(
    `Kodiaks backend listening on ${PORT}; redirect URI: ${REDIRECT_URI}`
  );
});
