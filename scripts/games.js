const baseUrl = 'https://api-web.nhle.com/v1/schedule/';
const today = new Date().toISOString().slice(0, 10);
const fullUrl = `http://localhost:3001/nhl-schedule/${today}`;

fetch(fullUrl)
  .then(res => res.json())
  .then(data => {
    const todayGames = data.gameWeek?.[0]?.games || [];
    const normalizedGames = todayGames.map(normalizeGame);
    normalizedGames.forEach(renderGame);
  })
  .catch(err => console.error('Error fetching NHL games:', err));

function normalizeGame(apiGame) {
  const start = new Date(apiGame.startTimeUTC);
  const time = start.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/New_York'
  });

  return {
    date: start.toLocaleDateString('en-US'),
    time: time,
    status: apiGame.gameState === 'FUT' ? 'Upcoming' : 'Completed',
    awayTag: apiGame.awayTeam.abbrev,
    homeTag: apiGame.homeTeam.abbrev
  };
}

function renderGame(game) {
  const template = document.getElementById('games-template');
  const container = document.querySelector('.games-section');

  const clone = template.cloneNode(true);
  clone.style.display = 'block';
  clone.removeAttribute('id'); // prevent duplicate IDs

  clone.querySelector('.game-date-time').textContent = `${game.date} • ${game.time}`;
  clone.querySelector('.game-status').textContent = game.status;
  clone.querySelector('.away-symbol h3').textContent = game.awayTag;
  clone.querySelector('.home-symbol h3').textContent = game.homeTag;

  container.appendChild(clone);
}