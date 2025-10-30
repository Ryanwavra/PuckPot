// scripts/picks.js

// Store user picks in memory on the client
const userPicks = {}; // { gameId: "TEAM" }

let games = [];
let contestId = null;

// --- Validation helpers ---
function allGamesPicked(games, userPicks) {
  return games.length > 0 && games.every(game => userPicks[game.gameId]);
}

function validTieBreaker() {
  const tieBreaker = document.getElementById("tieBreaker").value;
  return tieBreaker !== "" && !isNaN(tieBreaker);
}

function selectPick(gameId, team, cardEl, side) {
  userPicks[gameId] = team;

  cardEl.querySelectorAll(".away-team, .home-team").forEach(div => {
    div.classList.remove("selected");
  });

  cardEl.querySelector(`.${side}-team`).classList.add("selected");

  console.log("Current picks:", userPicks);
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

function renderGame(game, template, section) {
  const clone = template.cloneNode(true);
  clone.style.display = "block";
  clone.removeAttribute("id");
  clone.setAttribute("data-game-id", game.gameId);

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

  clone.querySelector(".game-date-time").textContent = `${estDate} • ${estTime} EST`;
  clone.querySelector(".game-status").textContent = normalizeStatus(game.status);
  clone.querySelector(".away-symbol h3").textContent = game.awayTeam;
  clone.querySelector(".home-symbol h3").textContent = game.homeTeam;

  const awayDiv = clone.querySelector(".away-team");
  const homeDiv = clone.querySelector(".home-team");

  awayDiv.addEventListener("click", () => selectPick(game.gameId, game.awayTeam, clone, "away"));
  homeDiv.addEventListener("click", () => selectPick(game.gameId, game.homeTeam, clone, "home"));

  section.appendChild(clone);
}

async function loadGames() {
  try {
    const res = await fetch("/api/games");
    const data = await res.json();

    console.log("Games API response:", data);

    games = data.games || [];
    contestId = data.contestId;

    const template = document.getElementById("games-template");
    const section = document.querySelector(".games-section");

    section.querySelectorAll(".game-card:not(#games-template)").forEach(el => el.remove());

    if (!games.length) {
      const msg = document.createElement("p");
      msg.textContent = "No games scheduled for this contest window.";
      section.appendChild(msg);
      return null;
    }

    games.forEach(game => renderGame(game, template, section));
    return contestId;
  } catch (err) {
    console.error("Error fetching NHL games:", err);
    const section = document.querySelector(".games-section");
    const msg = document.createElement("p");
    msg.textContent = "Failed to load games.";
    section.appendChild(msg);
    return null;
  }
}

async function hydrateUserPicks(userId, contestId) {
  console.log("hydrateUserPicks called with:", userId, contestId);
  try {
    const url = `/api/submission/${contestId}?userId=${userId}`;
    const res = await fetch(url);
    const data = await res.json();

    if (!data.submission) return;

    const { picks, tie_breaker } = data.submission;

    Object.entries(picks).forEach(([gameId, team]) => {
      userPicks[gameId] = team;

      const card = document.querySelector(`[data-game-id="${gameId}"]`);
      if (!card) return;

      const awayName = card.querySelector(".away-symbol h3").textContent;
      const homeName = card.querySelector(".home-symbol h3").textContent;

      const targetDiv =
        team === awayName
          ? card.querySelector(".away-team")
          : card.querySelector(".home-team");

      if (targetDiv) targetDiv.classList.add("selected");

      card.querySelectorAll(".away-team, .home-team").forEach(div => {
        div.style.pointerEvents = "none";
      });
      console.log("Hydrated picks:", userPicks);
    });

    const btn = document.getElementById("submit-picks");
    btn.disabled = true;
    btn.innerText = "Picks submitted";

    if (tie_breaker !== undefined && tie_breaker !== null) {
      const tbInput = document.getElementById("tieBreaker");
      tbInput.value = tie_breaker;
      tbInput.disabled = true;
    }
  } catch (err) {
    console.error("Error hydrating user picks:", err);
  }
}

async function applyGameResults(userId, contestId) {
  console.log("applyGameResults running for contest:", contestId); // ✅ top-level log
  try {
    const res = await fetch(`/api/scores/${contestId}`);
    const data = await res.json();
    const results = data.games || [];

    
console.log("Score API response:", results); 

    const resultMap = new Map(results.map(game => [String(game.gameId), game.winner]));

    Object.entries(userPicks).forEach(([gameId, team]) => {
  const card = document.querySelector(`[data-game-id="${gameId}"]`);
  if (!card) {
    console.warn("No card found for gameId:", gameId);
    return;
  }

  const winner = resultMap.get(gameId);
  if (!winner) {
    console.warn("No winner found for gameId:", gameId);
    return;
  }

  console.log("Game:", gameId, "Pick:", team, "Winner:", winner);

  const awayName = card.querySelector(".away-symbol h3").textContent;
  const homeName = card.querySelector(".home-symbol h3").textContent;

  console.log("Away:", awayName, "Home:", homeName);

  const targetDiv =
    team === awayName
      ? card.querySelector(".away-team")
      : card.querySelector(".home-team");

  if (!targetDiv) {
    console.warn("No target div found for team:", team);
    return;
  }

  targetDiv.classList.remove("selected");
  targetDiv.classList.add(team === winner ? "correct-pick" : "wrong-pick");
});
  } catch (err) {
    console.error("Error applying game results:", err);
  }
}

document.getElementById("submit-picks").addEventListener("click", async () => {
  const userId = "demo-user";
  const tieBreaker = document.getElementById("tieBreaker").value;

  if (!allGamesPicked(games, userPicks)) {
    alert("❌ Please make a pick for every game before submitting.");
    return;
  }

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

// Initial load
(async () => {
  try {
    const cid = await loadGames();
    if (cid) {
      await hydrateUserPicks("demo-user", cid);

      console.log("Calling applyGameResults with cid:", cid);

      await applyGameResults("demo-user", cid);
    }
  } catch (err) {
    console.error("Error during initial hydration:", err);
  }
})();