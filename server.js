const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

const TRAKT_CLIENT_ID = process.env.TRAKT_CLIENT_ID;
const TRAKT_BASE_URL = 'https://api.trakt.tv';

// Traductor ligero usando la API pública de Google Translate
async function translateToSpanish(text) {
  if (!text || text.trim() === '') return text;
  // Recortamos a un tamaño razonable para no saturar
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

// 1. Manifiesto del Addon para Nuvio / Stremio
app.get('/manifest.json', (req, res) => {
  res.json({
    id: 'community.trakt.es.reviews',
    version: '1.0.0',
    name: 'Reseñas Trakt en Español',
    description: 'Muestra las críticas y comentarios de Trakt traducidos al castellano',
    resources: ['meta'],
    types: ['movie', 'series'],
    catalogs: []
  });
});

// 2. Endpoint de metadatos (inyecta las reseñas en la descripción)
app.get('/meta/:type/:id.json', async (req, res) => {
  const { type, id } = req.params;
  const cleanId = id.replace('.json', '');
  const traktType = type === 'series' ? 'shows' : 'movies';

  try {
    const traktRes = await axios.get(`${TRAKT_BASE_URL}/${traktType}/${cleanId}/comments/likes`, {
      headers: {
        'Content-Type': 'application/json',
        'trakt-api-version': '2',
        'trakt-api-key': TRAKT_CLIENT_ID
      }
    });

    const comments = traktRes.data.slice(0, 4); // Tomamos las 4 mejores reseñas
    let reviewsText = '\n\n💬 CRÍTICAS Y OPINIONES (TRAKT EN ESPAÑOL):\n';

    for (const item of comments) {
      const translated = await translateToSpanish(item.comment);
      const userRating = item.user_rating ? `⭐ ${item.user_rating}/10` : '';
      reviewsText += `\n👤 @${item.user.username} ${userRating}:\n"${translated}"\n`;
    }

    res.json({
      meta: {
        id: cleanId,
        type: type,
        description: reviewsText
      }
    });
  } catch (error) {
    res.json({ meta: { id: cleanId, type: type } });
  }
});

// 3. Endpoint tipo API proxy original (por si se consulta directo)
app.get('/:type/:id/comments', async (req, res) => {
  const { type, id } = req.params;
  try {
    const traktRes = await axios.get(`${TRAKT_BASE_URL}/${type}/${id}/comments/likes`, {
      headers: {
        'Content-Type': 'application/json',
        'trakt-api-version': '2',
        'trakt-api-key': TRAKT_CLIENT_ID
      }
    });

    const comments = traktRes.data.slice(0, 5);
    const translated = await Promise.all(
      comments.map(async (item) => {
        const textEs = await translateToSpanish(item.comment);
        return { ...item, comment: textEs };
      })
    );
    res.json(translated);
  } catch (e) {
    res.status(500).json({ error: 'Error' });
  }
});

app.get('/', (req, res) => {
  res.send('Addon de Trakt en Español activo. Instálalo con /manifest.json');
});

app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));
