// scripts/picks.js

// Store user picks in memory on the client
const userPicks = {}; // { gameId: "TEAM" }

// --- Validation helpers ---
function allGamesPicked(games, userPicks) {
  // games will be loaded by loadGames()
  return games.length > 0 && games.every(game => userPicks[game.gameId]);
}

function validTieBreaker() {
  const tieBreaker = document.getElementById("tieBreaker").value;
  return tieBreaker !== "" && !isNaN(tieBreaker);
}

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

let games = [];
let contestId = null;

async function loadGames() {
  try {
    const res = await fetch("/api/games");
    const data = await res.json();

    games = data.games || [];
    contestId = data.contestId; // ✅ capture contestId from backend

    const template = document.getElementById("games-template");
    const section = document.querySelector(".games-section");

    // Remove any previously rendered cards (but keep the hidden template)
    section.querySelectorAll(".game-card:not(#games-template)").forEach(el => el.remove());

    if (!data.games || data.games.length === 0) {
      const msg = document.createElement("p");
      msg.textContent = "No games scheduled for this contest window.";
      section.appendChild(msg);
      return null; // nothing to hydrate
    }

    data.games.forEach(game => renderGame(game, template, section));

    return contestId; // ✅ return it explicitly
  } catch (err) {
    console.error("Error fetching NHL games:", err);
    const section = document.querySelector(".games-section");
    const msg = document.createElement("p");
    msg.textContent = "Failed to load games.";
    section.appendChild(msg);
    return null;
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

  // Add data-game-id so we can find this card later
  clone.setAttribute("data-game-id", game.gameId);

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

document.getElementById("submit-picks").addEventListener("click", async () => {
  const userId = "demo-user"; // Replace with real user logic later
  const tieBreaker = document.getElementById("tieBreaker").value;

  // ✅ Require all games picked
  if (!allGamesPicked(games, userPicks)) {
    alert("❌ Please make a pick for every game before submitting.");
    return;
  }

  // ✅ Require valid tiebreaker
  if (!validTieBreaker()) {
    alert("❌ Please enter a valid number for the tiebreaker guess.");
    return;
  }

  try {
    const res = await fetch("/api/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        picks: userPicks,
        tieBreaker: parseInt(tieBreaker, 10),
      }),
    });

    const result = await res.json();
    if (result.success) {
      alert("✅ Picks submitted successfully!");
      document.getElementById("submit-picks").disabled = true;
      document.getElementById("submit-picks").innerText = "Picks submitted";
    } else {
      alert("❌ Submission failed: " + result.error);
    }
  } catch (err) {
    console.error("Submission error:", err);
    alert("⚠️ Something went wrong.");
  }
});

async function hydrateUserPicks(userId, contestId) {
  console.log("hydrateUserPicks called with:", userId, contestId);
  try {
    const url = `/api/submission/${contestId}?userId=${userId}`;
    console.log("Hydrate fetch URL:", url);

    const res = await fetch(url);
    console.log("Hydrate raw status:", res.status);

    const data = await res.json();
    console.log("Hydrate response JSON:", data);

    if (!data.submission) return;

    const { picks, tie_breaker } = data.submission;

    Object.entries(picks).forEach(([gameId, team]) => {
      const card = document.querySelector(`[data-game-id="${gameId}"]`);
      if (!card) return;

      const awayName = card.querySelector(".away-symbol h3").textContent;
      const homeName = card.querySelector(".home-symbol h3").textContent;

      const targetDiv =
        team === awayName
          ? card.querySelector(".away-team")
          : card.querySelector(".home-team");

      if (targetDiv) targetDiv.classList.add("selected");

      // Prevent changes after submission
      card.querySelectorAll(".away-team, .home-team").forEach(div => {
        div.style.pointerEvents = "none";
      });
    });

    // Lock the submit UI
    const btn = document.getElementById("submit-picks");
    btn.disabled = true;
    btn.innerText = "Picks submitted";

    // Optional: restore tiebreaker
    if (tie_breaker !== undefined && tie_breaker !== null) {
      document.getElementById("tieBreaker").value = tie_breaker;
      document.getElementById("tieBreaker").disabled = true;
    }
  } catch (err) {
    console.error("Error hydrating user picks:", err);
  }
}

(async () => {
  const cid = await loadGames();   // ✅ get contestId directly
  if (cid) {
    await hydrateUserPicks("demo-user", cid);
  }
})();