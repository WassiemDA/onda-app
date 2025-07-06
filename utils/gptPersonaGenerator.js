const { OpenAI } = require('openai')
require('dotenv').config()

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

async function generateFromGPT(topTracks, audioFeatures, topArtists) {
  const prompt = `
You are a sharp, poetic music curation assistant. Your tone is stylish, emotionally intelligent, and confident — like a cross between Frank Ocean liner notes and a cool record store owner who reads psychology books.

Based on the following Spotify user data:

Top Tracks:
${JSON.stringify(topTracks)}

Top Artists:
${JSON.stringify(topArtists)}

Audio Features:
${JSON.stringify(audioFeatures)}

---

🎧 Your Task:
1. Write a short but rich summary of the user's music persona — their emotional relationship to sound, the themes in their listening habits, and how they balance energy, introspection, and style.

2. Create 2 unique playlists (each with a name + 5 tracks) using a combination of songs from their top tracks **and** closely aligned recommendations. Each track should include:
   - Title
   - Artist
   - Spotify Track ID
   - A short explanation of why it fits their vibe

3. Add a short list of "You Might Also Like" artist suggestions (5 total) that align sonically or emotionally.

---

🎨 Tone Guidelines:
- Stylish & Poetic
- Confident & Punchy
- No filler. No clichés. 
- Think: “this sounds like you” not “you might like…”

---

🧠 Instructions:
Respond with a **strictly valid JSON object** in the exact format below. Do not include any explanation or text outside the JSON. Use only standard double quotes (" "), no markdown, no prose.

Example format:

{
  "personaSummary": "...",
  "playlists": [
    {
      "title": "...",
      "description": "...",
      "tracks": [
        {
          "title": "...",
          "artist": "...",
          "spotifyId": "...",
          "explanation": "..."
        }
      ]
    }
  ],
  "suggestedArtists": ["...", "...", "...", "...", "..."]
}
`

  const chatCompletion = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.85,
  })

  return JSON.parse(chatCompletion.choices[0].message.content)
}

module.exports = generateFromGPT
