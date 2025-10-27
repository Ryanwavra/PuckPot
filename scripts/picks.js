// global.js (client-side)

// Fetch today's games from your Vercel API route
fetch("/api/games")
  .then(res => res.json())
  .then(games => {
    const container = document.querySelector(".games-section");

    // Clear any previously rendered cards (but keep the hidden template)
    container.querySelectorAll(".game-card:not(#games-template)").forEach(el => el.remove());

    if (!games || games.length === 0) {
      const msg = document.createElement("p");
      msg.textContent = "No games scheduled for today.";
      container.appendChild(msg);
      return;
    }

    // Render each game using the helper function
    games.forEach(renderGame);
  })
  .catch(err => console.error("Error fetching NHL games:", err));


// --- Helper function to render a single game card ---
function renderGame(game) {
  const template = document.getElementById("games-template");
  const container = document.querySelector(".games-section");

  // Clone the hidden template
  const clone = template.cloneNode(true);
  clone.style.display = "block";
  clone.removeAttribute("id");

  // Fill in the placeholders
  clone.querySelector(".game-date-time").textContent = `${game.date} • ${game.time}`;
  clone.querySelector(".game-status").textContent = game.status;
  clone.querySelector(".away-symbol h3").textContent = game.awayTeam;
  clone.querySelector(".home-symbol h3").textContent = game.homeTeam;

  // Append to the section
  container.appendChild(clone);
}