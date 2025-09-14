const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 1200;

// Middleware
app.use(cors());
app.use(express.json());
app.set('json spaces', 2);

// Lyrics API endpoint
app.get('/api/lyrics', async (req, res) => {
  const { q: searchQuery } = req.query;

  if (!searchQuery) {
    return res.status(400).json({ 
      error: 'Please provide a search query with the "q" parameter' 
    });
  }

  try {
    const searchResponse = await axios.get(
      "https://genius.com/api/search/multi?per_page=5&q=" + 
      encodeURIComponent(searchQuery), 
      {
        headers: {
          accept: "application/json, text/plain, */*",
          "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/97.0.4692.71 Safari/537.36"
        }
      }
    );

    const responseData = searchResponse.data;
    
    const songResult = responseData.response.sections.find(section => {
      return ["song", "lyric"].includes(section.type) && 
             section.hits?.find(hit => ["song", "lyric"].includes(hit.type));
    })?.hits?.find(hit => ["song", "lyric"].includes(hit.type))?.result;

    if (!songResult) {
      return res.status(404).json({ 
        error: "No song found matching your query",
        details: responseData 
      });
    }

    const {
      artist_names: artistName,
      title: songTitle,
      url: songUrl,
      header_image_url: imageUrl,
      api_path
    } = songResult;

    if (!songUrl) {
      return res.status(404).json({ 
        error: "Couldn't find lyrics URL for this song",
        details: responseData 
      });
    }

    // Extract song ID from api_path
    const songId = api_path.split('/').pop();
    
    // Make the view count request (silently fail if it doesn't work)
    try {
      await axios.post(
        `https://genius.com/api/songs/${songId}/count_view`,
        {}, // empty body
        {
          headers: {
            'accept': '*/*',
            'referer': songUrl,
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'
          }
        }
      );
    } catch (error) {
      console.error('View count failed (non-critical):', error.message);
    }

    const lyricsPage = await axios.get(songUrl).then(response => response.data);
    const $ = cheerio.load(lyricsPage);
    
    let lyricsText = "";
    $("#lyrics-root > div[data-lyrics-container=\"true\"]").each((index, element) => {
      const verseText = $($(element).html().replace(/<br>/g, "\n")).text().trim();
      if (verseText) {
        lyricsText += verseText + "\n\n";
      }
    });

    // Clean up the lyrics
    const cleanedLyrics = lyricsText.replace(/^[\s\S]*?(\[Verse 1\])/, '$1').trim();

    return res.json({
      status: 200,
      success: true,
      result: {
      title: songTitle,
      artist: artistName,
      link: songUrl,
      image: imageUrl,
      lyrics: cleanedLyrics
      }
    });

  } catch (error) {
    console.error('Lyrics fetch error:', error);
    return res.status(500).json({ 
      error: "Failed to fetch lyrics",
      details: error.message 
    });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.send(`
    <h1>Genius.com Lyrics API</h1>
    <p>Use the <code>/api/lyrics?q=SONG_NAME</code> endpoint to search for lyrics</p>
    <p>Example: <a href="/api/lyrics?q=Dynasty MIIA">Tap Here</a></p>
    <p>Made By: Gifted Tech</p>
  `);
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Try it out: http://localhost:${PORT}/api/lyrics?q=Dynasty MIIA`);
});
