const express = require('express');
const router = express.Router();
const axios = require('axios');
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// POST /persona/generate — generate full music persona
router.post('/generate', async (req, res) => {
  try {
    const { topTracks, topArtists } = req.body;

    const trackList = topTracks.map(t => `${t.name} by ${t.artists?.[0]?.name || 'Unknown'}`).slice(0, 50);
    const artistList = topArtists.map(a => a.name).slice(0, 5);

    const prompt = `
You are Onda, a poetic and insightful music companion that helps users understand their sonic identity and discover new music that fits — or gently stretches — their taste.

The user listens to the following tracks:
${trackList.map((t, i) => `${i + 1}. ${t}`).join("\n")}

And their top artists are:
${artistList.join(", ")}

🎧 Generate a rich, immersive music persona using this structure (no intro, just JSON):
{
  "personaSummary": "[Stylish paragraph]",
  "sonicSignatures": ["..."],
  "genreEraFusion": ["..."],
  "toneMapping": {
    "reflect": {
      "summary": "[mood summary]",
      "tracks": ["..."],
      "recommendation": {
        "track": "...",
        "explanation": "..."
      }
    },
    "gym": {
      "summary": "...",
      "tracks": ["..."],
      "recommendation": {
        "track": "...",
        "explanation": "..."
      }
    },
    "chill": {
      "summary": "...",
      "tracks": ["..."],
      "recommendation": {
        "track": "...",
        "explanation": "..."
      }
    }
  }
}
`.trim();

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      temperature: 0.8,
      messages: [
        { role: "system", content: "You are a poetic and punchy music insight generator." },
        { role: "user", content: prompt }
      ]
    });

    const persona = JSON.parse(completion.choices[0].message.content);

    res.json({
      topTracks,
      topArtists,
      persona
    });
  } catch (error) {
    console.error('🔥 [POST] GPT error:', {
      message: error.message,
      stack: error.stack
    });
    res.status(500).json({ error: 'Failed to generate persona', details: error.message || error.toString() });
  }
});

// GET /persona — fetch Spotify top tracks + artists
router.get('/', async (req, res) => {
  const accessToken = req.query.access_token;
  if (!accessToken) return res.status(400).json({ error: 'Missing access token' });

  try {
    const headers = {
      Authorization: `Bearer ${accessToken}`
    };

    const [tracksRes, artistsRes] = await Promise.all([
      axios.get('https://api.spotify.com/v1/me/top/tracks?limit=50&time_range=long_term', { headers }),
      axios.get('https://api.spotify.com/v1/me/top/artists?limit=5&time_range=long_term', { headers })
    ]);

    res.json({
      topTracks: tracksRes.data.items || [],
      topArtists: artistsRes.data.items || []
    });
  } catch (err) {
    console.error('🔥 [GET] Error fetching from Spotify:', {
      message: err.message,
      status: err.response?.status,
      data: err.response?.data
    });
    res.status(500).json({
      error: 'Spotify fetch failed',
      details: err.response?.data || err.message
    });
  }
});

module.exports = router;
