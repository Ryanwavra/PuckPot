// /public/js/global.js

// Fetch today's games from your API route
fetch("/api/games")
  .then(res => res.json())
  .then(games => {
    games.forEach(renderGame);
  })
  .catch(err => console.error("Error fetching games:", err));

function renderGame(game) {
  const container = document.querySelector(".games-section");
  const div = document.createElement("div");
  div.className = "game-card";
  div.textContent = `${game.awayTeam} @ ${game.homeTeam} • ${game.time} (${game.status})`;
  container.appendChild(div);
}