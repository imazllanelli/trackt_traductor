const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

const TRAKT_CLIENT_ID = process.env.TRAKT_CLIENT_ID;
const TRAKT_BASE_URL = 'https://api.trakt.tv';

// Traductor con Google Translate (bloques cortos y fiables)
async function translateToSpanish(text) {
  if (!text || text.trim() === '') return text;
  const cleanText = text.substring(0, 800);
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

// Manifiesto del Addon
app.get('/manifest.json', (req, res) => {
  res.json({
    id: 'community.trakt.es.reviews',
    version: '1.0.1',
    name: 'Reseñas Trakt en Español',
    description: 'Añade reseñas y opiniones de Trakt en castellano a la sinopsis',
    resources: ['meta'],
    types: ['movie', 'series'],
    idPrefixes: ['tt']
  });
});

// Endpoint que captura la ficha al abrirla en Nuvio
app.get('/meta/:type/:id.json', async (req, res) => {
  const { type, id } = req.params;
  const cleanId = id.replace('.json', '');
  const traktType = type === 'series' ? 'shows' : 'movies';

  if (!TRAKT_CLIENT_ID) {
    return res.json({ meta: { id: cleanId, type } });
  }

  try {
    // 1. Obtener comentarios usando el ID de IMDb directamente en Trakt
    const traktRes = await axios.get(`${TRAKT_BASE_URL}/${traktType}/${cleanId}/comments/likes`, {
      headers: {
        'Content-Type': 'application/json',
        'trakt-api-version': '2',
        'trakt-api-key': TRAKT_CLIENT_ID
      }
    });

    const comments = (traktRes.data || []).slice(0, 3);
    if (comments.length === 0) {
      return res.json({ meta: { id: cleanId, type } });
    }

    let reviewsText = '\n\n━━━━━━━━━━━━━━━━━━━━\n💬 CRÍTICAS EN CASTELLANO (TRAKT):\n';

    for (const item of comments) {
      const translated = await translateToSpanish(item.comment);
      const rating = item.user_rating ? ` (${item.user_rating}/10 ⭐)` : '';
      reviewsText += `\n👤 @${item.user?.username || 'Usuario'}${rating}:\n"${translated}"\n`;
    }

    res.json({
      meta: {
        id: cleanId,
        type: type,
        description: reviewsText
      }
    });
  } catch (error) {
    res.json({ meta: { id: cleanId, type } });
  }
});

app.get('/', (req, res) => {
  res.send('Servicio activo. Instala mediante /manifest.json');
});

app.listen(PORT, () => console.log(`Puerto ${PORT}`));
