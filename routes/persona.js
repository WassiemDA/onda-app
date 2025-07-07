const express = require("express");
const router = express.Router();
const axios = require("axios");
const OpenAI = require("openai");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 🎯 Step 1: Define GPT system prompt
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

// 🔥 Utility: Classify a track into a mood category based on audio features
function classifyMood({ energy, valence, danceability }) {
  if (energy >= 0.7 && valence >= 0.5 && danceability >= 0.6) return "gym";
  if (energy <= 0.4 && valence <= 0.4) return "reflect";
  if (valence >= 0.5 && energy >= 0.3 && energy <= 0.6) return "chill";
  return null; // fallback for edge cases
}

// ✅ GET /persona — fetch Spotify data, enrich with Recobeats, classify moods
router.get("/", async (req, res) => {
  const accessToken = req.query.access_token;
  if (!accessToken) return res.status(400).json({ error: "Missing access token" });

  try {
    const headers = { Authorization: `Bearer ${accessToken}` };

    // Step 2: Fetch top 50 tracks + top 10 artists (long_term)
    const [topTracksRes, topArtistsRes] = await Promise.all([
      axios.get("https://api.spotify.com/v1/me/top/tracks?limit=10&time_range=long_term", { headers }),
      axios.get("https://api.spotify.com/v1/me/top/artists?limit=10&time_range=long_term", { headers })
    ]);

    const topTracks = topTracksRes.data?.items || [];
    const topArtists = topArtistsRes.data?.items || [];
    const spotifyIds = topTracks.map(t => t.id);

    // Step 3: Get Recobeats Track IDs from Spotify IDs
    const lookupRes = await axios.get(`https://api.reccobeats.com/v1/track?ids=${spotifyIds.join(",")}`);
    const trackIdMap = {};
    lookupRes.data.content.forEach(track => {
      const spotifyHref = track.href.split("/").pop();
      trackIdMap[spotifyHref] = track.id;
    });

    // Step 4: Fetch audio features and classify mood
    const audioFeatures = await Promise.all(
      spotifyIds.map(async (spotifyId) => {
        const recobeatsId = trackIdMap[spotifyId];
        if (!recobeatsId) return null;
        try {
          const res = await axios.get(`https://api.reccobeats.com/v1/track/${recobeatsId}/audio-features`);
          return {
            spotifyId,
            ...res.data,
            mood: classifyMood(res.data)
          };
        } catch (e) {
          console.warn("⚠️ Recobeats fetch error for", recobeatsId);
          return null;
        }
      })
    );

    const filteredAudio = audioFeatures.filter(Boolean);
    res.json({ topTracks, topArtists, audioFeatures: filteredAudio });
  } catch (err) {
    console.error("🔥 [GET] Spotify fetch error:", err.response?.data || err.message);
    res.status(500).json({ error: "Failed to fetch Spotify or Recobeats data" });
  }
});

// ✅ POST /persona/generate — sends 2 chunks of 5 tracks each to GPT
router.post("/generate", async (req, res) => {
  try {
    const { topTracks, topArtists, audioFeatures } = req.body;
    if (!topTracks || !topArtists || !audioFeatures) return res.status(400).json({ error: "Missing input data" });

    // Step 1: Chunk topTracks into 2 x 5
    const chunks = [topTracks.slice(0, 5), topTracks.slice(5, 10)];

    // Step 2: Send each chunk to GPT using the model defined in .env
    const gptModel = process.env.GPT_MODEL || "gpt-4";
    const gptResponses = await Promise.all(
      chunks.map(async (chunk, i) => {
        const userPrompt = `Here are some of my top tracks and artists:\n\nTracks:\n${chunk.map(t => `${t.name} – ${t.artists.map(a => a.name).join(", ")}`).join("\n")}\n\nArtists:\n${topArtists.map(a => a.name).join(", ")}`;

        const completion = await openai.chat.completions.create({
          model: gptModel,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          temperature: 0.7
        });

        const jsonMatch = completion.choices[0].message.content.trim();
        return JSON.parse(jsonMatch);
      })
    );

    // Step 3: Merge both GPT responses (basic merge — TODO: refine as needed)
    const finalResponse = gptResponses[0];

    // Merge moods from chunk 2
    for (const mood of ["reflect", "gym", "chill"]) {
      finalResponse.moods[mood].topTracks.push(...(gptResponses[1].moods[mood]?.topTracks || []));
      finalResponse.moods[mood].withinGenre.push(...(gptResponses[1].moods[mood]?.withinGenre || []));
      finalResponse.moods[mood].tastePivots.push(...(gptResponses[1].moods[mood]?.tastePivots || []));
    }

    // Merge taste pivots
    finalResponse.tastePivotPlaylist.push(...(gptResponses[1].tastePivotPlaylist || []));

    res.json(finalResponse);
  } catch (err) {
    console.error("🔥 [POST] GPT error:", err.response?.data || err.message);
    res.status(500).json({ error: "Failed to generate persona" });
  }
});

module.exports = router;
