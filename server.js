const express = require('express');
const axios = require('axios');
const cors = require('cors');
const translate = require('@iamtraction/google-translate');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

const TRAKT_CLIENT_ID = process.env.TRAKT_CLIENT_ID;
const TRAKT_BASE_URL = 'https://api.trakt.tv';

async function translateComment(text) {
  if (!text || text.trim() === '') return text;
  try {
    const res = await translate(text, { to: 'es' });
    return res.text;
  } catch (err) {
    return text;
  }
}

app.get('/:type/:id/comments', async (req, res) => {
  const { type, id } = req.params;
  const sort = req.query.sort || 'likes';

  if (!TRAKT_CLIENT_ID) {
    return res.status(500).json({ error: 'Falta TRAKT_CLIENT_ID en variables de entorno' });
  }

  try {
    const traktRes = await axios.get(`${TRAKT_BASE_URL}/${type}/${id}/comments/${sort}`, {
      headers: {
        'Content-Type': 'application/json',
        'trakt-api-version': '2',
        'trakt-api-key': TRAKT_CLIENT_ID
      }
    });

    const comments = traktRes.data;
    const topComments = comments.slice(0, 10);
    const translated = await Promise.all(
      topComments.map(async (item) => {
        const spanishText = await translateComment(item.comment);
        return {
          ...item,
          comment: spanishText
        };
      })
    );

    res.json(translated);
  } catch (error) {
    console.error('Error al pedir comentarios a Trakt:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: 'Error al procesar comentarios en Trakt'
    });
  }
});

app.get('/', (req, res) => {
  res.send('Proxy de traducción de Trakt activo y funcionando.');
});

app.listen(PORT, () => {
  console.log(`Proxy listo en puerto ${PORT}`);
});
