
import express from 'express';
import cookieParser from 'cookie-parser';
import crypto from 'node:crypto';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

dotenv.config();
console.log("Environment diagnostic:", {
  cwd: process.cwd(),
  baseUrlPresent: Boolean(process.env.BASE_URL),
  clientIdPresent: Boolean(process.env.YAHOO_CLIENT_ID),
  clientSecretPresent: Boolean(process.env.YAHOO_CLIENT_SECRET),
  nodeEnv: process.env.NODE_ENV || "(unset)",
  deploymentId: process.env.RAILWAY_DEPLOYMENT_ID,
  processId: process.pid
});
const app = express();
app.use(express.json());
app.use(cookieParser());

const PORT = process.env.PORT || 10000;


const NFL_ROSTER_CSV_URL =
  'https://github.com/nflverse/nflverse-data/releases/download/weekly_rosters/roster_weekly_2026.csv';

async function getActiveNflYahooIds() {
  const response = await fetch(NFL_ROSTER_CSV_URL);

  if (!response.ok) {
    throw new Error(
      `NFL roster data request failed: HTTP ${response.status}`
    );
  }

  const csv = await response.text();
  const lines = csv.split(/\r?\n/).filter(Boolean);

  if (lines.length < 2) {
    throw new Error('NFL roster CSV is empty.');
  }

  // Parse CSV fields while respecting quoted commas.
  function parseCsvRow(line) {
    const fields = [];
    let field = '';
    let quoted = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (quoted && line[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = !quoted;
        }
      } else if (char === ',' && !quoted) {
        fields.push(field);
        field = '';
      } else {
        field += char;
      }
    }

    fields.push(field);
    return fields;
  }

  const headers = parseCsvRow(lines[0]);
  const index = Object.fromEntries(
    headers.map((header, i) => [header, i])
  );

  for (const column of [
    'season',
    'week',
    'status',
    'yahoo_id'
  ]) {
    if (index[column] === undefined) {
      throw new Error(`NFL roster CSV is missing ${column}.`);
    }
  }

  const rows = lines.slice(1).map(line => {
    const values = parseCsvRow(line);
    return {
      season: Number(values[index.season]),
      week: Number(values[index.week]),
      status: (values[index.status] || '').trim(),
      yahooId: (values[index.yahoo_id] || '').trim(),
      gameType: index.game_type === undefined
        ? ''
        : (values[index.game_type] || '').trim()
    };
  });

  const seasonRows = rows.filter(
    row => row.season === 2026 && row.yahooId
  );

  if (!seasonRows.length) {
    throw new Error('No 2026 NFL roster records with Yahoo IDs found.');
  }

  const latestWeek = Math.max(
    ...seasonRows.map(row => row.week).filter(Number.isFinite)
  );

  const activeYahooIds = new Set(
    seasonRows
      .filter(row =>
        row.week === latestWeek &&
        row.status === 'ACT' &&
        (!row.gameType || row.gameType === 'REG')
      )
      .map(row => row.yahooId)
  );

  return {
    latestWeek,
    activeYahooIds
  };
}

const BASE_URL = (
  process.env.BASE_URL ||
  'https://kodiak-assistant-gm-production.up.railway.app'
).replace(/\/$/, '');

const REDIRECT_URI = `${BASE_URL}/auth/yahoo/callback`;

async function getSavedYahooAccessToken() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
    throw new Error('Supabase is not configured.');
  }

  const supabaseUrl = process.env.SUPABASE_URL.replace(/\/$/, '');
  const headers = {
    apikey: process.env.SUPABASE_SECRET_KEY,
    'Content-Type': 'application/json'
  };

  // Read the saved Yahoo tokens from Supabase.
  const storedResponse = await fetch(
    `${supabaseUrl}/rest/v1/yahoo_tokens?id=eq.1&select=id,access_token,refresh_token,expires_at`,
    { headers }
  );

  if (!storedResponse.ok) {
    throw new Error(`Could not read saved Yahoo tokens: HTTP ${storedResponse.status}.`);
  }

  const rows = await storedResponse.json();

  if (!rows.length) {
    throw new Error('No saved Yahoo connection was found. Connect Yahoo again.');
  }

  const saved = rows[0];

  // Reuse the access token if it remains valid for at least another minute.
  if (Date.parse(saved.expires_at) > Date.now() + 60000) {
    return saved.access_token;
  }

  // Otherwise, ask Yahoo for a fresh access token.
  const credentials = Buffer.from(
    `${process.env.YAHOO_CLIENT_ID}:${process.env.YAHOO_CLIENT_SECRET}`
  ).toString('base64');

  const refreshResponse = await fetch(
    'https://api.login.yahoo.com/oauth2/get_token',
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: saved.refresh_token
      })
    }
  );

  const refreshed = await refreshResponse.json();

  if (!refreshResponse.ok || !refreshed.access_token) {
    console.error('Yahoo token refresh failed:', refreshResponse.status);
    throw new Error('Yahoo token refresh failed. Please reconnect Yahoo if needed.');
  }

  const expiresAt = new Date(
    Date.now() + Number(refreshed.expires_in) * 1000
  ).toISOString();

  // Save the renewed tokens without exposing them to the browser.
  const saveResponse = await fetch(
    `${supabaseUrl}/rest/v1/yahoo_tokens?on_conflict=id`,
    {
      method: 'POST',
      headers: {
        ...headers,
        Prefer: 'resolution=merge-duplicates,return=minimal'
      },
      body: JSON.stringify({
        id: 1,
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token || saved.refresh_token,
        expires_at: expiresAt,
        updated_at: new Date().toISOString()
      })
    }
  );

  if (!saveResponse.ok) {
    console.error('Could not save refreshed Yahoo tokens:', saveResponse.status);
    throw new Error('Yahoo tokens refreshed, but saving them failed.');
  }

  console.log('Yahoo access token refreshed and saved.');

  return refreshed.access_token;
}

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
  application runs in DEMO MODE.
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
    availability: 'League'
  },
  {
    name: 'Emmett Johnson',
    position: 'RB',
    category: 'Handcuff Watch',
    trend: 'Upside',
    availability: 'League'
  },
  {
    name: 'Sadiq',
    position: 'TE',
    category: 'Waiver Watch',
    trend: 'Monitor',
    availability: 'Waiver'
  },
  {
    name: 'Jake Ferguson',
    position: 'TE',
    category: 'Waiver Watch',
    trend: 'Monitor',
    availability: 'Waiver'
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
// STATUS AND SAFE DIAGNOSTICS
// -------------------------------------------------------

app.get('/api/env-check', (req, res) => {
  res.json({
    clientIdPresent: Boolean(process.env.YAHOO_CLIENT_ID),
    clientSecretPresent: Boolean(process.env.YAHOO_CLIENT_SECRET),
    baseUrlPresent: Boolean(process.env.BASE_URL),
    deploymentId: process.env.RAILWAY_DEPLOYMENT_ID,
    processId: process.pid
  });
});

app.get('/api/status', (_req, res) => {
  const clientIdPresent = Boolean(process.env.YAHOO_CLIENT_ID);
  const clientSecretPresent = Boolean(process.env.YAHOO_CLIENT_SECRET);
  const baseUrlPresent = Boolean(process.env.BASE_URL);

  res.json({
    ok: true,
    service: 'Kodiaks Assistant GM backend',
    version: '1.1.1',
    environment: process.env.NODE_ENV || 'development',

    // Some app sections still use demo data.
    demoMode: true,

    yahooConfigured: clientIdPresent && clientSecretPresent,
    yahooRosterConnected: true,

    diagnostic: {
      clientIdPresent,
      clientSecretPresent,
      baseUrlPresent,
      railwayServiceName: process.env.RAILWAY_SERVICE_NAME || null,
      railwayEnvironmentName: process.env.RAILWAY_ENVIRONMENT_NAME || null,
      railwayDeploymentId: process.env.RAILWAY_DEPLOYMENT_ID || null
    },

    yahooApproval: 'approved',
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

app.get('/api/nfl-roster-check', async (_req, res) => {
  try {
    const { latestWeek, activeYahooIds } =
      await getActiveNflYahooIds();

    return res.json({
      ok: true,
      source: 'nflverse',
      season: 2026,
      latestWeek,
      activePlayerCount: activeYahooIds.size,
      sampleYahooIds: [...activeYahooIds].slice(0, 10)
    });
  } catch (error) {
    console.error('NFL roster check failed:', error.message);

    return res.status(502).json({
      ok: false,
      error: 'Could not retrieve NFL roster data.'
    });
  }
});

// -------------------------------------------------------
// PLAYERS / WAIVERS
// -------------------------------------------------------

app.get('/api/waivers', async (_req, res) => {
  try {
    const accessToken = await getSavedYahooAccessToken();

    const response = await fetch(
      'https://fantasysports.yahooapis.com/fantasy/v2/league/470.l.667251/players;status=FA;start=0;count=25?format=json',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json'
        }
      }
    );

    if (!response.ok) {
      console.error('Yahoo waiver request failed:', response.status);

      return res.status(502).json({
        ok: false,
        error: `Yahoo API returned HTTP ${response.status}.`
      });
    }

    const data = await response.json();
    console.log(
  'Yahoo waiver response sample:',
  JSON.stringify(data?.fantasy_content?.league?.[1]?.players?.[0] ?? null)
);

    const { latestWeek, activeYahooIds } =
      await getActiveNflYahooIds();
  
const playersObject =
  data?.fantasy_content?.league?.[1]?.players;

const playerEntries = playersObject
  ? Object.entries(playersObject)
      .filter(([key]) => key !== 'count')
      .flatMap(([, value]) => {
        const playerData = value?.player?.[0];

        if (!Array.isArray(playerData)) {
          return [];
        }

        const player = {};

        for (const field of playerData) {
          if (field && typeof field === 'object' && !Array.isArray(field)) {
            Object.assign(player, field);
          }
        }

        return Object.keys(player).length ? [player] : [];
      })
  : [];

    const filteredPlayers = playerEntries.filter(player => {
      const yahooId = String(
        player?.player_id ?? ''
      );

      return yahooId && activeYahooIds.has(yahooId);
    });

    return res.json({
      ok: true,
      demoMode: false,
      source: 'Yahoo Fantasy API + nflverse',
      message: 'Active NFL free agents retrieved.',
      rosterWeek: latestWeek,
      yahooFreeAgentCount: playerEntries.length,
      activeFreeAgentCount: filteredPlayers.length,
      players: filteredPlayers
    });
  } catch (error) {
    console.error('Yahoo waiver endpoint failed:', error.message);

    return res.status(502).json({
      ok: false,
      error: 'Could not retrieve filtered Yahoo waiver data. Check server logs.'
    });
  }
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
// YAHOO OAUTH — AUTHORIZATION START
// -------------------------------------------------------

app.get('/auth/yahoo', (req, res) => {
    console.log("Yahoo route diagnostic:", {
    clientIdPresent: Boolean(process.env.YAHOO_CLIENT_ID),
    deploymentId: process.env.RAILWAY_DEPLOYMENT_ID
  });
  
  if (!process.env.YAHOO_CLIENT_ID) {
    return res
      .status(500)
      .send('YAHOO_CLIENT_ID is not available to the running server.');
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

  return res.redirect(
    `https://api.login.yahoo.com/oauth2/request_auth?${params}`
  );
});

// -------------------------------------------------------
// YAHOO OAUTH — CALLBACK
// -------------------------------------------------------

app.get('/auth/yahoo/callback', async (req, res) => {
  if (req.query.error) {
    return res
      .status(400)
      .send('Yahoo authorization was not completed.');
  }

  const returnedState = req.query.state;
  const savedState = req.cookies.oauth_state;

  res.clearCookie('oauth_state', {
    httpOnly: true,
    secure: BASE_URL.startsWith('https://'),
    sameSite: 'lax'
  });

  if (!returnedState || !savedState || returnedState !== savedState) {
    return res
      .status(400)
      .send('Yahoo authorization state could not be verified. Please try connecting again.');
  }

  if (!req.query.code) {
    return res
      .status(400)
      .send('Yahoo did not return an authorization code.');
  }

  if (!process.env.YAHOO_CLIENT_ID ||
      !process.env.YAHOO_CLIENT_SECRET) {
    return res
      .status(500)
      .send('Yahoo client credentials are not configured.');
  }

  try {
    const redirectUri =
      `${BASE_URL}/auth/yahoo/callback`;

    const credentials = Buffer.from(
      `${process.env.YAHOO_CLIENT_ID}:${process.env.YAHOO_CLIENT_SECRET}`
    ).toString('base64');

    const tokenResponse = await fetch(
      'https://api.login.yahoo.com/oauth2/get_token',
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
          code: String(req.query.code)
        })
      }
    );

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error(
        'Yahoo token exchange failed with HTTP status:',
        tokenResponse.status
      );

      return res
        .status(502)
        .send('Yahoo token exchange failed. Check the server logs for the HTTP status.');
    }

    const leagueResponse = await fetch(
      'https://fantasysports.yahooapis.com/fantasy/v2/users;use_login=1/games;game_keys=nfl/leagues?format=json',
      {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Accept': 'application/json'
        }
      }
    );

   if (!leagueResponse.ok) {
  const yahooError = await leagueResponse.text();

  console.error('Yahoo Fantasy API error:', {
    status: leagueResponse.status,
    response: yahooError.slice(0, 1500)
  });

  throw new Error(
    `Yahoo token exchange succeeded, but the Fantasy API returned HTTP ${leagueResponse.status}. Check Railway logs for Yahoo's error details.`
  );
}

    const leagueData = await leagueResponse.json();

    // Save Yahoo tokens securely in Supabase.
    if (
      !process.env.SUPABASE_URL ||
      !process.env.SUPABASE_SECRET_KEY
    ) {
      throw new Error('Supabase environment variables are missing.');
    }

    if (!tokenData.refresh_token || !tokenData.expires_in) {
      throw new Error('Yahoo did not return the required refresh token details.');
    }

    const expiresAt = new Date(
      Date.now() + Number(tokenData.expires_in) * 1000
    ).toISOString();

    const supabaseResponse = await fetch(
      `${process.env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/yahoo_tokens?on_conflict=id`,
      {
        method: 'POST',
        headers: {
          'apikey': process.env.SUPABASE_SECRET_KEY,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates,return=minimal'
        },
        body: JSON.stringify({
          id: 1,
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          expires_at: expiresAt,
          updated_at: new Date().toISOString()
        })
      }
    );

    if (!supabaseResponse.ok) {
      const supabaseError = await supabaseResponse.text();

      console.error('Supabase token storage failed:', {
        status: supabaseResponse.status,
        response: supabaseError.slice(0, 1000)
      });

      throw new Error(
        `Supabase token storage failed with HTTP ${supabaseResponse.status}.`
      );
    }

    console.log('Yahoo tokens saved successfully to Supabase.');

    return res.status(200).json({
      ok: true,
      message: 'Yahoo connected and tokens saved securely.',
      leagueImportTest: 'success',
      tokenStorage: 'success',
      leagues: leagueData
    });

      } catch (error) {
    console.error('Yahoo callback request failed:', error.message);

    return res
      .status(502)
      .send('The Yahoo connection could not be completed. Check the server logs.');
  }
});

app.get('/api/yahoo/leagues', async (_req, res) => {
  try {
    const accessToken = await getSavedYahooAccessToken();

    const response = await fetch(
      'https://fantasysports.yahooapis.com/fantasy/v2/users;use_login=1/games;game_keys=nfl/leagues?format=json',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json'
        }
      }
    );

    if (!response.ok) {
      console.error('Yahoo leagues request failed:', response.status);

      return res.status(502).json({
        ok: false,
        error: `Yahoo API returned HTTP ${response.status}.`
      });
    }

    const data = await response.json();

    return res.json({
      ok: true,
      message: 'Live Yahoo league data retrieved successfully.',
      data
    });
  } catch (error) {
    console.error('Live Yahoo leagues endpoint failed:', error.message);

    return res.status(502).json({
      ok: false,
      error: 'Could not retrieve live Yahoo league data. Check server logs.'
    });
  }
});

app.get('/api/yahoo/teams', async (_req, res) => {
  try {
    const accessToken = await getSavedYahooAccessToken();

    const response = await fetch(
      'https://fantasysports.yahooapis.com/fantasy/v2/league/470.l.667251/teams?format=json',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json'
        }
      }
    );

    if (!response.ok) {
      console.error('Yahoo teams request failed:', response.status);

      return res.status(502).json({
        ok: false,
        error: `Yahoo API returned HTTP ${response.status}.`
      });
    }

    const data = await response.json();

    return res.json({
      ok: true,
      message: 'Live Yahoo teams retrieved successfully.',
      data
    });
  } catch (error) {
    console.error('Live Yahoo teams endpoint failed:', error.message);

    return res.status(502).json({
      ok: false,
      error: 'Could not retrieve live Yahoo teams. Check server logs.'
    });
  }
});

app.get('/api/yahoo/roster', async (_req, res) => {
  try {
    const accessToken = await getSavedYahooAccessToken();

    const response = await fetch(
      'https://fantasysports.yahooapis.com/fantasy/v2/team/470.l.667251.t.9/roster?format=json',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json'
        }
      }
    );

    if (!response.ok) {
      console.error('Yahoo roster request failed:', response.status);

      return res.status(502).json({
        ok: false,
        error: `Yahoo API returned HTTP ${response.status}.`
      });
    }

    const data = await response.json();

    return res.json({
      ok: true,
      message: 'Live Kodiaks roster retrieved successfully.',
      data
    });
  } catch (error) {
    console.error('Live Yahoo roster endpoint failed:', error.message);

    return res.status(502).json({
      ok: false,
      error: 'Could not retrieve the Kodiaks roster. Check server logs.'
    });
  }
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
