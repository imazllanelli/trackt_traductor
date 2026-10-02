const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

const TRAKT_CLIENT_ID = process.env.TRAKT_CLIENT_ID;
const TRAKT_BASE_URL = 'https://api.trakt.tv';

async function translateToSpanish(text) {
  if (!text || text.trim() === '') return text;
  const cleanText = text.substring(0, 1000);
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=es&dt=t&q=${encodeURIComponent(cleanText)}`;
    const response = await axios.get(url);
    if (response.data && response.data[0]) {
      return response.data[0].map(item => item[0]).join('');
    }
    return text;
  } catch (err) {
    return text;
  }
}

// Manifiesto por si se instala como addon
app.get('/manifest.json', (req, res) => {
  res.json({
    id: 'community.trakt.es.reviews',
    version: '1.0.2',
    name: 'Reseñas Trakt en Español',
    description: 'Comentarios de Trakt traducidos al castellano',
    resources: ['meta'],
    types: ['movie', 'series'],
    idPrefixes: ['tt']
  });
});

// Captura cualquier petición de comentarios de Nuvio (/comments, /comments/likes, etc.)
app.get('/:type/:id/comments*', async (req, res) => {
  const { type, id } = req.params;
  const sort = req.params[0] ? req.params[0].replace('/', '') : 'likes';

  if (!TRAKT_CLIENT_ID) {
    return res.status(500).json([]);
  }

  try {
    const traktRes = await axios.get(`${TRAKT_BASE_URL}/${type}/${id}/comments/${sort || 'likes'}`, {
      headers: {
        'Content-Type': 'application/json',
        'trakt-api-version': '2',
        'trakt-api-key': TRAKT_CLIENT_ID
      }
    });

    const comments = traktRes.data || [];
    const topComments = comments.slice(0, 15);
    const translated = await Promise.all(
      topComments.map(async (item) => {
        const textEs = await translateToSpanish(item.comment);
        return {
          ...item,
          comment: textEs
        };
      })
    );

    res.json(translated);
  } catch (error) {
    res.status(500).json([]);
  }
});

app.get('/', (req, res) => res.send('OK'));

app.listen(PORT, () => console.log(`Puerto ${PORT}`));
