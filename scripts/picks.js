// scripts/picks.js

async function loadGames() {
  try {
    const res = await fetch("/api/games");
    const data = await res.json();

    const template = document.getElementById("games-template");
    const section = document.querySelector(".games-section");

    // Remove any previously rendered cards (but keep the hidden template)
    section.querySelectorAll(".game-card:not(#games-template)").forEach(el => el.remove());

    if (!data.games || data.games.length === 0) {
      const msg = document.createElement("p");
      msg.textContent = "No games scheduled for this contest window.";
      section.appendChild(msg);
      return;
    }

    data.games.forEach(game => renderGame(game, template, section));
  } catch (err) {
    console.error("Error fetching NHL games:", err);
    const section = document.querySelector(".games-section");
    const msg = document.createElement("p");
    msg.textContent = "Failed to load games.";
    section.appendChild(msg);
  }
}

// --- Helper function to render a single game card ---
function renderGame(game, template, section) {
  // Clone the hidden template
  const clone = template.cloneNode(true);
  clone.style.display = "block";
  clone.removeAttribute("id");

  // Convert UTC → EST for display
  const estTime = new Date(game.startTimeUTC).toLocaleString("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
  });
  const estDate = new Date(game.startTimeUTC).toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
  });

  // Fill in placeholders
  clone.querySelector(".game-date-time").textContent = `${estDate} • ${estTime} EST`;
  clone.querySelector(".game-status").textContent = game.status;
  clone.querySelector(".away-symbol h3").textContent = game.awayTeam;
  clone.querySelector(".home-symbol h3").textContent = game.homeTeam;

  // Append to section
  section.appendChild(clone);
}

// Run on page load
loadGames();