const express = require("express");
const router = express.Router();
const axios = require("axios");
const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

router.post("/generate", async (req, res) => {
  try {
    const { topTracks, topArtists } = req.body;

    console.log("🧠 [POST] Generating GPT persona with:", {
      topTracks: topTracks.map(t => t.name),
      topArtists: topArtists.map(a => a.name)
    });

    const completion = await openai.chat.completions.create({
      model: process.env.GPT_MODEL || "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that analyzes music preferences and returns structured JSON personas."
        },
        {
          role: "user",
          content: `Here is a user's top 10 tracks and top 5 artists from Spotify. Please generate a JSON response with their music persona summary, three mood categories, and track recommendations per mood with GPT explanations.

Top Tracks: ${topTracks.slice(0, 10).map(t => `${t.name} by ${t.artists[0].name}`).join(", ")}
Top Artists: ${topArtists.map(a => a.name).join(", ")}

IMPORTANT: Respond only with valid JSON matching this format:
{
  "personaSummary": "...",
  "playlists": [
    {
      "title": "Mood name",
      "description": "One-line mood summary",
      "tracks": [
        {
          "title": "...",
          "artist": "...",
          "spotifyId": "",
          "explanation": "..."
        }
      ]
    }
  ]
}`
        }
      ]
    });

    // Parse and return JSON
    let response;
    try {
      const raw = completion.choices[0].message.content;
      console.log("🧾 GPT raw response:", raw);
      response = JSON.parse(raw);
    } catch (err) {
      console.error("🚨 GPT response was not valid JSON:", err.message);
      return res.status(500).json({
        error: "GPT returned invalid JSON",
        raw: completion.choices[0].message.content
      });
    }

    res.json({
      ...response,
      topTracks,
      topArtists
    });
  } catch (error) {
    console.error("🔥 [POST] GPT error:", {
      message: error.message,
      stack: error.stack
    });
    res.status(500).json({
      error: "Failed to generate persona",
      details: error.message || error.toString()
    });
  }
});

router.get("/", async (req, res) => {
  const accessToken = req.query.access_token;
  if (!accessToken)
    return res.status(400).json({ error: "Missing access token" });

  console.log("🛂 Received access token:", accessToken);

  try {
    const headers = {
      Authorization: `Bearer ${accessToken}`
    };

    console.log("🌐 [GET] Fetching Spotify data...");

    const topTracksRes = await axios.get(
      "https://api.spotify.com/v1/me/top/tracks?limit=50&time_range=long_term",
      { headers }
    );
    const topTracks = topTracksRes.data?.items || [];
    console.log("🎵 Top Tracks fetched:", topTracks.map(t => t.name));

    const topArtistsRes = await axios.get(
      "https://api.spotify.com/v1/me/top/artists?limit=5&time_range=long_term",
      { headers }
    );
    const topArtists = topArtistsRes.data?.items || [];
    console.log("🎤 Top Artists fetched:", topArtists.map(a => a.name));

    res.json({
      topTracks,
      topArtists
    });
  } catch (err) {
    console.error("🔥 [GET] Error building persona:", {
      message: err.message,
      status: err.response?.status,
      data: err.response?.data,
      url: err.config?.url
    });
    res.status(500).json({
      error: "Failed to fetch data from Spotify",
      details: err.response?.data || err.message
    });
  }
});

module.exports = router;
