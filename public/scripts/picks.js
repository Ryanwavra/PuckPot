// scripts/picks.js

// Store user picks in memory on the client
const userPicks = {}; // { gameId: "TEAM" }

function selectPick(gameId, team, cardEl, side) {
  // Save the pick
  userPicks[gameId] = team;

  // Clear any previous highlight
  cardEl.querySelectorAll(".away-team, .home-team").forEach(div => {
    div.classList.remove("selected");
  });

  // Highlight the chosen side
  cardEl.querySelector(`.${side}-team`).classList.add("selected");

  console.log("Current picks:", userPicks);
}

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

function normalizeStatus(state) {
  switch (state?.toUpperCase()) {
    case "FUT":
    case "PRE":
    case "UPCOMING":
      return "UPCOMING";
    case "LIVE":
    case "CRIT":
      return "LIVE";
    case "FINAL":
    case "OFF":
      return "FINAL";
    default:
      return "UPCOMING";
  }
}

// --- Helper function to render a single game card ---
function renderGame(game, template, section) {
  // Clone the hidden template
  const clone = template.cloneNode(true);
  clone.style.display = "block";
  clone.removeAttribute("id");

  // Convert UTC → EST for display
  // Use startTimeEST directly
const estTime = new Date(game.startTimeEST).toLocaleString("en-US", {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});
const estDate = new Date(game.startTimeEST).toLocaleDateString("en-US", {
  month: "short",
  day: "numeric",
  weekday: "short",
});

if (!game.startTimeEST || isNaN(new Date(game.startTimeEST))) {
  console.warn("Invalid startTimeEST:", game);
}

  // Fill in placeholders
  clone.querySelector(".game-date-time").textContent = `${estDate} • ${estTime} EST`;
  clone.querySelector(".game-status").textContent = normalizeStatus(game.status);
  clone.querySelector(".away-symbol h3").textContent = game.awayTeam;
  clone.querySelector(".home-symbol h3").textContent = game.homeTeam;

  // Make the team divs clickable
  const awayDiv = clone.querySelector(".away-team");
  const homeDiv = clone.querySelector(".home-team");

  awayDiv.addEventListener("click", () => selectPick(game.gameId, game.awayTeam, clone, "away"));
  homeDiv.addEventListener("click", () => selectPick(game.gameId, game.homeTeam, clone, "home"));

  // Append to section
  section.appendChild(clone);
}

// Run on page load
loadGames();