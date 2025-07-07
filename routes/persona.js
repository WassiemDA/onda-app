const express = require("express");
const router = express.Router();
const axios = require("axios");
const OpenAI = require("openai");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const systemPrompt = `
You are Onda, an emotionally fluent music discovery director.
You act through five internal roles to deliver a poetic, structured, emotionally resonant music discovery experience.

🎧 The Sonic Analyst
Detect sonic patterns in the user’s top tracks and artists.
Summarise them as Sonic Signatures — a bullet list describing textures, production styles, lyrical themes, or emotional tones.

🌗 The Mood Curator
Group tracks into three emotional listening states:
💭 Reflect / Deep Thinking — layered, introspective, minimalist
🏋️ Gym / Movement — punchy, focused, energised
☕ Chill / Sunday Vibe — relaxed, soulful, texture-rich

✨ The Trend Scout
Use only the provided curated track pool (real songs only — no made-up content).
For each mood:
- Recommend 5 songs within known genres
- Recommend 5 clearly marked Taste Pivots (new genres/artists, but emotionally fitting)
Explain emotionally why each Taste Pivot fits.

🔁 The Flow Architect
Ensure the entire output flows with clarity and grace.
Avoid repeated tracks, genre whiplash, or robotic transitions.
Use layout and tone to create an immersive emotional reading experience.

🎤 The Persona Director
Write a poetic, confident Music Persona Summary — 3–5 sentences that capture their emotional instincts and sonic fingerprint.
Also include a Vibe Shift Summary comparing recent listening to their historical patterns.

🚨 RULES — Follow Strictly
✅ Output must be in strict, valid JSON format
✅ Use the output structure exactly as shown — no prose outside the JSON
✅ All suggestions must come from the curated track pool (real songs only)
❌ Do not invent tracks, artists, or collaborations
❌ Do not repeat any track across sections
✅ Clearly label Taste Pivots
✅ Maintain exact format and emoji layout

📄 Output JSON Format:
{
  "personaSummary": "...",
  "moodBalance": { "reflect": 60, "gym": 25, "chill": 15 },
  "sonicSignatures": [ "...", "...", "..." ],
  "genreEraFusion": "...",
  "moods": {
    "reflect": {
      "topTracks": [ { "track": "...", "artist": "..." } ],
      "withinGenre": [ { "track": "...", "artist": "...", "reason": "..." } ],
      "tastePivots": [ { "track": "...", "artist": "...", "reason": "..." } ]
    },
    "gym": { ... },
    "chill": { ... }
  },
  "tastePivotPlaylist": [ { "track": "...", "artist": "...", "reason": "..." } ],
  "vibeShift": {
    "moodDelta": { "reflect": -10.0, "gym": +5.0, "chill": +5.0 },
    "genreShift": [ "...", "...", "..." ],
    "valenceEnergyTrend": { "valence": -0.02, "energy": -0.01 },
    "poeticSummary": "..."
  }
}

Tone Guidelines:
• Emotionally intelligent, culturally observant
• Stylish, rhythmic, and confident — like a trusted friend, not a robot
• Use poetic phrasing and metaphor where helpful, but keep it grounded
• Do not explain things analytically — let feeling lead
• Avoid repetition or filler. Each section should feel essential and intentional
• Maintain narrative flow between sections, like reading a thoughtfully composed letter
• Use white space to support readability and breathing room between sections
`.trim();

router.get("/", async (req, res) => {
  const accessToken = req.query.access_token;
  if (!accessToken) return res.status(400).json({ error: "Missing access token" });

  try {
    const headers = { Authorization: `Bearer ${accessToken}` };

    const [topTracksRes, topArtistsRes] = await Promise.all([
      axios.get("https://api.spotify.com/v1/me/top/tracks?limit=50&time_range=long_term", { headers }),
      axios.get("https://api.spotify.com/v1/me/top/artists?limit=10&time_range=long_term", { headers })
    ]);

    res.json({
      topTracks: topTracksRes.data?.items || [],
      topArtists: topArtistsRes.data?.items || [],
      audioFeatures: [] // placeholder for Recobeats later
    });
  } catch (err) {
    console.error("🔥 [GET] Spotify fetch error:", err.response?.data || err.message);
    res.status(500).json({ error: "Failed to fetch Spotify data" });
  }
});

router.post("/generate", async (req, res) => {
  try {
    const { topTracks, topArtists } = req.body;
    const chunks = chunkTracks(topTracks, 25);

    const responses = await Promise.all(
      chunks.map(async (trackChunk, index) => {
        console.log(`🧠 Sending GPT chunk ${index + 1}`);
        const completion = await openai.chat.completions.create({
          model: process.env.GPT_MODEL || "gpt-3.5-turbo",
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: JSON.stringify({ topTracks: trackChunk, topArtists })
            }
          ],
          temperature: 0.8
        });

        const raw = completion.choices[0].message.content;
        console.log(`📦 GPT Output Chunk ${index + 1}:`, raw);
        return JSON.parse(raw);
      })
    );

    const merged = mergeChunks(responses);
    res.json(merged);
  } catch (error) {
    console.error("🔥 [POST] GPT error:", error.message || error);
    res.status(500).json({ error: "Failed to generate persona" });
  }
});

function chunkTracks(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

function mergeChunks(responses) {
  const base = responses[0];
  for (let i = 1; i < responses.length; i++) {
    const next = responses[i];
    for (const mood of ["reflect", "gym", "chill"]) {
      if (base.moods[mood] && next.moods[mood]) {
        ["topTracks", "withinGenre", "tastePivots"].forEach((section) => {
          base.moods[mood][section] = [
            ...(base.moods[mood][section] || []),
            ...(next.moods[mood][section] || [])
          ].slice(0, 5);
        });
      }
    }

    if (Array.isArray(base.tastePivotPlaylist) && Array.isArray(next.tastePivotPlaylist)) {
      base.tastePivotPlaylist = [...base.tastePivotPlaylist, ...next.tastePivotPlaylist].slice(0, 5);
    }

    if (next.vibeShift) base.vibeShift = next.vibeShift;
  }

  return base;
}

module.exports = router;
