// server.js
import express from 'express';
import fetch from 'node-fetch';

const app = express();
const PORT = 3001;

app.get('/nhl-schedule/:date', async (req, res) => {
  const date = req.params.date;
  const apiUrl = `https://api-web.nhle.com/v1/schedule/${date}`;

  try {
    const response = await fetch(apiUrl);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch NHL data' });
  }
});

app.listen(PORT, () => console.log(`Proxy running on http://localhost:${PORT}`));