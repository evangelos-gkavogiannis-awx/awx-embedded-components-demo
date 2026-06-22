/**
 * server.js — Express backend skeleton.
 *
 * ─── Claude instructions ────────────────────────────────────────────────────
 * • Add your API routes BELOW the "API routes" comment.
 * • Do NOT change the PORT setup or the static-file middleware.
 * • Frontend fetch calls must use:
 *     const BASE = window.__API_BASE__ || '';
 *     fetch(BASE + '/api/your-endpoint')
 * ────────────────────────────────────────────────────────────────────────────
 */
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

const app = express();
app.use(cors());
app.use(express.json());

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,                  // max 100 requests per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api', apiLimiter);

// ── API routes ───────────────────────────────────────────────────────────────
import { generateCodeVerifier, generateCodeChallengeFromVerifier } from './authUtils.js';

const AIRWALLEX_API_BASE = 'https://api-demo.airwallex.com';

// In-memory storage for tokens (per session - keyed by clientId)
const tokenStore = new Map();

/**
 * Helper to make fetch requests with timeout and better error handling
 */
async function airwallexFetch(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

  try {
    console.log(`[Airwallex API] ${options.method || 'GET'} ${url}`);
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return response;
  } catch (error) {
    clearTimeout(timeout);
    if (error.name === 'AbortError') {
      throw new Error('Request timed out after 30 seconds');
    }
    // More descriptive error message
    console.error(`[Airwallex API] Network error:`, error);
    throw new Error(`Network error: ${error.message || 'Unable to connect to Airwallex API'}`);
  }
}

/**
 * Fetch access token from Airwallex
 */
async function fetchAccessToken(clientId, apiKey) {
  const response = await airwallexFetch(`${AIRWALLEX_API_BASE}/api/v1/authentication/login`, {
    method: 'POST',
    headers: {
      'x-client-id': clientId,
      'x-api-key': apiKey,
      'Content-Type': 'application/json'
    },
    body: ''
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage;
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.message || errorJson.error || 'Authentication failed';
    } catch {
      errorMessage = errorText || `HTTP ${response.status}: Authentication failed`;
    }
    throw new Error(errorMessage);
  }

  const data = await response.json();
  console.log('[Airwallex API] Authentication successful');
  return {
    token: data.token,
    expiresAt: new Date(data.expires_at).getTime()
  };
}

/**
 * Get or refresh access token
 */
async function getAccessToken(clientId, apiKey) {
  const stored = tokenStore.get(clientId);

  // Check if we have a valid token (with 1 minute buffer)
  if (stored && Date.now() < stored.expiresAt - 60000) {
    return stored.token;
  }

  // Fetch new token
  const tokenData = await fetchAccessToken(clientId, apiKey);
  tokenStore.set(clientId, tokenData);
  return tokenData.token;
}

// Test credentials endpoint
app.post('/api/test-credentials', async (req, res) => {
  const { clientId, apiKey } = req.body;

  if (!clientId || !apiKey) {
    return res.status(400).json({ error: 'clientId and apiKey are required' });
  }

  try {
    await getAccessToken(clientId, apiKey);
    res.json({ success: true, message: 'Credentials are valid' });
  } catch (error) {
    console.error('Credential test failed:', error.message);
    res.status(401).json({ error: 'Invalid credentials', message: error.message });
  }
});

// Create a connected account
app.post('/api/create-account', async (req, res) => {
  const { clientId, apiKey, email, countryCode } = req.body;

  if (!clientId || !apiKey) {
    return res.status(400).json({ error: 'clientId and apiKey are required' });
  }

  try {
    const accessToken = await getAccessToken(clientId, apiKey);

    const accountPayload = {
      primary_contact: { email: email || 'test@airwallex.com' },
      account_details: {},
      customer_agreements: {
        agreed_to_terms_and_conditions: true,
        agreed_to_data_usage: true
      }
    };

    const response = await airwallexFetch(`${AIRWALLEX_API_BASE}/api/v1/accounts/create`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'x-client-id': clientId,
        'x-api-version': '2024-09-27'
      },
      body: JSON.stringify(accountPayload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.message || JSON.stringify(errorJson);
      } catch {
        errorMessage = errorText || `HTTP ${response.status}: Account creation failed`;
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    console.log('Account created:', data.id);
    res.json({ accountId: data.id, account: data });
  } catch (error) {
    console.error('Account creation error:', error.message);
    res.status(500).json({ error: 'Failed to create account', message: error.message });
  }
});

// Get authorization code for SDK initialization
app.post('/api/get-auth-code', async (req, res) => {
  const { clientId, apiKey, accountId, scopes, identity } = req.body;

  if (!clientId || !apiKey) {
    return res.status(400).json({ error: 'clientId and apiKey are required' });
  }

  try {
    const accessToken = await getAccessToken(clientId, apiKey);
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallengeFromVerifier(codeVerifier);

    const defaultScopes = scopes || ['w:awx_action:onboarding'];

    const authPayload = {
      scope: defaultScopes,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    };

    const resolvedIdentity = identity || accountId;
    if (resolvedIdentity) {
      authPayload.identity = resolvedIdentity;
    }

    console.log('Auth payload:', JSON.stringify(authPayload, null, 2));

    const authHeaders = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'x-client-id': clientId,
    };
    if (accountId) {
      authHeaders['x-on-behalf-of'] = accountId;
    }

    const response = await airwallexFetch(`${AIRWALLEX_API_BASE}/api/v1/authentication/authorize`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(authPayload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.message || JSON.stringify(errorJson);
      } catch {
        errorMessage = errorText || `HTTP ${response.status}: Authorization failed`;
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    console.log('Auth code received');
    res.json({
      authCode: data.authorization_code,
      codeVerifier
    });
  } catch (error) {
    console.error('Auth code error:', error.message);
    res.status(500).json({ error: 'Failed to get authorization code', message: error.message });
  }
});

// Create a beneficiary
app.post('/api/create-beneficiary', async (req, res) => {
  const { clientId, apiKey, accountId, beneficiaryPayload } = req.body;

  if (!clientId || !apiKey || !beneficiaryPayload) {
    return res.status(400).json({ error: 'clientId, apiKey, and beneficiaryPayload are required' });
  }

  try {
    const accessToken = await getAccessToken(clientId, apiKey);

    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'x-client-id': clientId,
      'x-api-version': '2024-09-27',
    };

    if (accountId) {
      headers['x-on-behalf-of'] = accountId;
    }

    const response = await airwallexFetch(`${AIRWALLEX_API_BASE}/api/v1/beneficiaries/create`, {
      method: 'POST',
      headers,
      body: JSON.stringify(beneficiaryPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.message || JSON.stringify(errorJson);
      } catch {
        errorMessage = errorText || `HTTP ${response.status}: Beneficiary creation failed`;
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    console.log('Beneficiary created:', data.id);
    res.json(data);
  } catch (error) {
    console.error('Beneficiary creation error:', error.message);
    res.status(500).json({ error: 'Failed to create beneficiary', message: error.message });
  }
});

// Create a transfer
app.post('/api/create-transfer', async (req, res) => {
  const { clientId, apiKey, accountId, transferPayload } = req.body;

  if (!clientId || !apiKey || !transferPayload) {
    return res.status(400).json({ error: 'clientId, apiKey, and transferPayload are required' });
  }

  try {
    const accessToken = await getAccessToken(clientId, apiKey);

    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'x-client-id': clientId,
      'x-api-version': '2024-09-27',
    };

    if (accountId) {
      headers['x-on-behalf-of'] = accountId;
    }

    const response = await airwallexFetch(`${AIRWALLEX_API_BASE}/api/v1/transfers/create`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        request_id: `transfer_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        ...transferPayload,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.message || JSON.stringify(errorJson);
      } catch {
        errorMessage = errorText || `HTTP ${response.status}: Transfer creation failed`;
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    console.log('Transfer created:', data.id);
    res.json(data);
  } catch (error) {
    console.error('Transfer creation error:', error.message);
    res.status(500).json({ error: 'Failed to create transfer', message: error.message });
  }
});

// Get balance (may trigger SCA)
app.post('/api/get-balance', async (req, res) => {
  const { clientId, apiKey, accountId } = req.body;

  if (!clientId || !apiKey || !accountId) {
    return res.status(400).json({ error: 'clientId, apiKey, and accountId are required' });
  }

  try {
    const accessToken = await getAccessToken(clientId, apiKey);

    const response = await airwallexFetch(`${AIRWALLEX_API_BASE}/api/v1/balances/current`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'x-client-id': clientId,
        'x-on-behalf-of': accountId,
      },
    });

    if (response.ok) {
      const data = await response.json();
      return res.json({ balance: data });
    }

    const errorText = await response.text();
    let errorJson = {};
    try {
      errorJson = JSON.parse(errorText);
    } catch {
      errorJson = { message: errorText };
    }

    if (errorJson.code === 'sca_token_missing') {
      const sessionCode = response.headers.get('x-sca-session-code');
      console.log('SCA required, session code received');
      return res.json({
        code: 'sca_token_missing',
        sca_session_code: sessionCode,
      });
    }

    throw new Error(errorJson.message || `HTTP ${response.status}: Failed to fetch balance`);
  } catch (error) {
    console.error('Get balance error:', error.message);
    res.status(500).json({ error: 'Failed to fetch balance', message: error.message });
  }
});

// Get balance after SCA verification
app.post('/api/get-balance-verified', async (req, res) => {
  const { clientId, apiKey, accountId, scaToken, scaSessionCode } = req.body;

  if (!clientId || !apiKey || !accountId || !scaToken) {
    return res.status(400).json({ error: 'clientId, apiKey, accountId, and scaToken are required' });
  }

  try {
    const accessToken = await getAccessToken(clientId, apiKey);

    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'x-client-id': clientId,
      'x-on-behalf-of': accountId,
      'x-sca-token': scaToken,
    };

    if (scaSessionCode) {
      headers['x-sca-session-code'] = scaSessionCode;
    }

    const response = await airwallexFetch(`${AIRWALLEX_API_BASE}/api/v1/balances/current`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.message || JSON.stringify(errorJson);
      } catch {
        errorMessage = errorText || `HTTP ${response.status}: SCA verification failed`;
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    res.json({ balance: data });
  } catch (error) {
    console.error('Verified balance error:', error.message);
    res.status(500).json({ error: 'SCA verification failed', message: error.message });
  }
});

// Get list of connected accounts
app.post('/api/list-accounts', async (req, res) => {
  const { clientId, apiKey } = req.body;

  if (!clientId || !apiKey) {
    return res.status(400).json({ error: 'clientId and apiKey are required' });
  }

  try {
    const accessToken = await getAccessToken(clientId, apiKey);

    const response = await airwallexFetch(`${AIRWALLEX_API_BASE}/api/v1/accounts`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'x-client-id': clientId
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.message || JSON.stringify(errorJson);
      } catch {
        errorMessage = errorText || `HTTP ${response.status}: Failed to list accounts`;
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('List accounts error:', error.message);
    res.status(500).json({ error: 'Failed to list accounts', message: error.message });
  }
});



// ── API error handler (must come after API routes, before static) ────────────
// Catches any unhandled errors thrown in API routes and returns JSON instead of
// falling through to the HTML catch-all below (which would cause "Unexpected
// token '<'" errors in the frontend).
app.use('/api', (err, req, res, _next) => {
  console.error('[server] API error:', err);
  res.status(500).json({ ok: false, error: err?.message || String(err) });
});

// ── Serve built frontend (must stay at the end) ──────────────────────────────
const distDir = path.resolve(__dirname, '../../frontend/dist');
app.use(express.static(distDir));
app.get('*', (_req, res) => {
  res.sendFile(path.join(distDir, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
