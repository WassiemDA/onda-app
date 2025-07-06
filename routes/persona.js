const express = require('express');
const router = express.Router();
const axios = require('axios');
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// POST /persona/generate — used when regenerating persona
router.post('/generate', async (req, res) => {
  try {
    const { topTracks, topArtists } = req.body;

    console.log("🧠 [POST] Generating GPT persona with:", {
      topTracks: topTracks.map(t => t.name),
      topArtists: topArtists.map(a => a.name)
    });

    const model = process.env.GPT_MODEL || 'gpt-4';

    const messages = [
      {
        role: "system",
        content: `You are a music expert. Create a rich, poetic music persona summary and mood-specific track breakdowns for the user, based on their top tracks and artists. Keep it stylish and immersive.`
      },
      {
        role: "user",
        content: JSON.stringify({ topTracks, topArtists })
      }
    ];

    const completion = await openai.chat.completions.create({
      model,
      messages,
      temperature: 0.8
    });

    const response = JSON.parse(completion.choices[0].message.content);

    res.json({
      ...response,
      topTracks,
      topArtists
    });
  } catch (error) {
    console.error('🔥 [POST] GPT error:', {
      message: error.message,
      stack: error.stack
    });
    res.status(500).json({ error: 'Failed to generate persona', details: error.message || error.toString() });
  }
});

// GET /persona — fetches Spotify top tracks and artists
router.get('/', async (req, res) => {
  const accessToken = req.query.access_token;
  if (!accessToken) return res.status(400).json({ error: 'Missing access token' });

  console.log("🛂 Received access token:", accessToken);

  try {
    const headers = {
      Authorization: `Bearer ${accessToken}`
    };

    console.log("🌐 [GET] Fetching Spotify data...");

    // 1. Get top 10 tracks
    const topTracksRes = await axios.get(
      'https://api.spotify.com/v1/me/top/tracks?limit=10&time_range=long_term',
      { headers }
    );
    const topTracks = topTracksRes.data?.items || [];
    console.log("🎵 Top Tracks fetched:", topTracks.map(t => t.name));

    // 2. Get top 5 artists
    const topArtistsRes = await axios.get(
      'https://api.spotify.com/v1/me/top/artists?limit=5&time_range=long_term',
      { headers }
    );
    const topArtists = topArtistsRes.data?.items || [];
    console.log("🎤 Top Artists fetched:", topArtists.map(a => a.name));

    res.json({
      topTracks,
      topArtists
    });
  } catch (err) {
    console.error('🔥 [GET] Error building persona:', {
      message: err.message,
      status: err.response?.status,
      data: err.response?.data,
      url: err.config?.url
    });
    res.status(500).json({
      error: 'Failed to fetch data from Spotify',
      details: err.response?.data || err.message
    });
  }
});

module.exports = router;
