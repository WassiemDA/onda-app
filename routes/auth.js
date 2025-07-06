const express = require('express');
const router = express.Router();
const axios = require('axios');

const REQUIRED_SCOPES = [
  'user-top-read',
  'user-read-private',
  'user-read-email',
  'user-library-read',
  'user-read-playback-position'
];

// GET /login — Redirects to Spotify login
router.get('/login', (req, res) => {
  const scopes = REQUIRED_SCOPES.join(' ');
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI;
  const clientId = process.env.SPOTIFY_CLIENT_ID;

  const authUrl = 'https://accounts.spotify.com/authorize?' +
    new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      scope: scopes,
      redirect_uri: redirectUri
    });

  console.log('🔁 Redirecting to Spotify Auth:', authUrl);
  res.redirect(authUrl.toString());
});

// GET /callback — Handles Spotify code exchange
router.get('/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).json({ error: 'Missing code parameter' });

  try {
    const response = await axios.post(
      'https://accounts.spotify.com/api/token',
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
        client_id: process.env.SPOTIFY_CLIENT_ID,
        client_secret: process.env.SPOTIFY_CLIENT_SECRET
      }),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }
    );

    const { access_token, scope } = response.data;
    const grantedScopes = scope?.split(' ') || [];

    console.log('✅ Spotify Access Token:', access_token);
    console.log('🔍 Scopes granted:', grantedScopes);

    const missingScopes = REQUIRED_SCOPES.filter(s => !grantedScopes.includes(s));
    if (missingScopes.length > 0) {
      console.warn('⚠️ Missing required scopes:', missingScopes);
    }

    const frontendURL = process.env.FRONTEND_REDIRECT_URI;
    res.redirect(`${frontendURL}?access_token=${access_token}`);
  } catch (err) {
    console.error('🔥 Token exchange failed:', err.response?.data || err.message);
    res.status(500).json({
      error: 'Token exchange failed',
      details: err.response?.data || err.message
    });
  }
});

module.exports = router;
