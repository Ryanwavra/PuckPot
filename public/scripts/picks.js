// scripts/picks.js

// -----------------------------
// Shared utilities
// -----------------------------
async function safeFetchJson(url, opts = {}) {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    const text = await res.text();
    throw new Error(`Expected JSON at ${url}, got: ${text.slice(0, 160)}...`);
  }
  return res.json();
}

function getConnectedAddress() {
  return localStorage.getItem("connectedAddress") || null;
}

function shortenAddress(addr) {
  return addr ? addr.slice(0, 6) + "..." + addr.slice(-4) : "";
}

// -----------------------------
// State
// -----------------------------
const userPicks = {}; // { [gameId]: "TEAM" }
let games = [];
let contestId = null;

// -----------------------------
// Validation helpers
// -----------------------------
function allGamesPicked(games, userPicks) {
  return games.length > 0 && games.every((game) => userPicks[game.gameId]);
}

function validTieBreaker() {
  const el = document.getElementById("tieBreaker");
  if (!el) return false;
  const tie = el.value;
  return tie !== "" && !isNaN(tie);
}

// -----------------------------
// Rendering helpers
// -----------------------------
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

function selectPick(gameId, team, cardEl, side) {
  userPicks[gameId] = team;

  cardEl.querySelectorAll(".away-team, .home-team").forEach((div) => {
    div.classList.remove("selected");
  });

  const target = cardEl.querySelector(`.${side}-team`);
  if (target) target.classList.add("selected");

  console.log("Current picks:", userPicks);
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

  const dtEl = clone.querySelector(".game-date-time");
  if (dtEl) dtEl.textContent = `${estDate} • ${estTime} EST`;

  const statusEl = clone.querySelector(".game-status");
  if (statusEl) statusEl.textContent = normalizeStatus(game.status);

  const awayNameEl = clone.querySelector(".away-symbol h3");
  const homeNameEl = clone.querySelector(".home-symbol h3");
  if (awayNameEl) awayNameEl.textContent = game.awayTeam;
  if (homeNameEl) homeNameEl.textContent = game.homeTeam;

  const awayDiv = clone.querySelector(".away-team");
  const homeDiv = clone.querySelector(".home-team");

  awayDiv?.addEventListener("click", () =>
    selectPick(game.gameId, game.awayTeam, clone, "away")
  );
  homeDiv?.addEventListener("click", () =>
    selectPick(game.gameId, game.homeTeam, clone, "home")
  );

  section.appendChild(clone);
}

// -----------------------------
// API integrations
// -----------------------------
async function loadGames() {
  try {
    const data = await safeFetchJson("/api/games");
    console.log("Games API response:", data);

    games = data.games || [];
    contestId = data.contestId;

    const template = document.getElementById("games-template");
    const section = document.querySelector(".games-section");
    if (!template || !section) return contestId;

    // Clear previous cards
    section.querySelectorAll(".game-card:not(#games-template)").forEach((el) => el.remove());

    if (!games.length) {
      const msg = document.createElement("p");
      msg.textContent = "No games scheduled for this contest window.";
      section.appendChild(msg);
      return contestId;
    }

    games.forEach((game) => renderGame(game, template, section));
    return contestId;
  } catch (err) {
    console.error("Error fetching NHL games:", err);
    const section = document.querySelector(".games-section");
    if (section) {
      const msg = document.createElement("p");
      msg.textContent = "Failed to load games.";
      section.appendChild(msg);
    }
    return null;
  }
}

async function hydrateUserPicks(walletAddress, cid) {
  console.log("hydrateUserPicks called with:", walletAddress, cid);
  if (!walletAddress || !cid) return;

  try {
    // ✅ use cid (the function argument), not contestId
    const url = `/api/submission/${cid}?walletAddress=${encodeURIComponent(walletAddress)}`;
    const data = await safeFetchJson(url);
    if (!data.submission) return;

    const { picks, tie_breaker } = data.submission;

    Object.entries(picks || {}).forEach(([gameId, team]) => {
      userPicks[gameId] = team;

      const card = document.querySelector(`[data-game-id="${gameId}"]`);
      if (!card) return;

      const awayName = card.querySelector(".away-symbol h3")?.textContent;
      const targetDiv =
        team === awayName ? card.querySelector(".away-team") : card.querySelector(".home-team");

      targetDiv?.classList.add("selected");

      // Disable picking after hydration (already submitted)
      card.querySelectorAll(".away-team, .home-team").forEach((div) => {
        div.style.pointerEvents = "none";
      });
    });

    // Lock submit button
    const btn = document.getElementById("submit-picks");
    if (btn) {
      btn.disabled = true;
      btn.innerText = "Picks submitted";
      btn.classList.add("locked-submitted"); // grey style
    }

    // Lock tie breaker
    if (tie_breaker !== undefined && tie_breaker !== null) {
      const tbInput = document.getElementById("tieBreaker");
      if (tbInput) {
        tbInput.value = tie_breaker;
        tbInput.disabled = true;
      }
    }
  } catch (err) {
    console.error("Error hydrating user picks:", err);
  }
}

async function applyGameResults(cid) {
  console.log("applyGameResults running for contest:", cid);
  if (!cid) return;

  try {
    const data = await safeFetchJson(`/api/scores/${cid}`);
    const results = data.games || [];
    console.log("Score API response:", results);

    const resultMap = new Map(results.map((game) => [String(game.gameId), game.winner]));

    Object.entries(userPicks).forEach(([gameId, team]) => {
      const card = document.querySelector(`[data-game-id="${gameId}"]`);
      if (!card) return;

      const winner = resultMap.get(gameId);
      if (!winner) return;

      const awayName = card.querySelector(".away-symbol h3")?.textContent;
      const targetDiv =
        team === awayName ? card.querySelector(".away-team") : card.querySelector(".home-team");
      if (!targetDiv) return;

      targetDiv.classList.remove("selected");
      targetDiv.classList.add(team === winner ? "correct-pick" : "wrong-pick");
    });
  } catch (err) {
    console.error("Error applying game results:", err);
  }
}

// -----------------------------
// Submit picks
// -----------------------------
document.getElementById("submit-picks")?.addEventListener("click", async () => {
  const userAddress = getConnectedAddress();
  if (!userAddress) {
    alert("Please connect your wallet before submitting picks.");
    return;
  }

  const tieBreakerEl = document.getElementById("tieBreaker");
  const tieBreaker = tieBreakerEl ? tieBreakerEl.value : "";

  if (!allGamesPicked(games, userPicks)) {
    alert("❌ Please make a pick for every game before submitting.");
    return;
  }

  if (!validTieBreaker()) {
    alert("❌ Please enter a valid number for the tiebreaker guess.");
    return;
  }

  try {
    const result = await safeFetchJson("/api/submit", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    walletAddress: userAddress,   // ✅ new
    picks: userPicks,
    tieBreaker: parseInt(tieBreaker, 10),
  }),
});

    if (result.success) {
      alert("✅ Picks submitted successfully!");
      const btn = document.getElementById("submit-picks");
      if (btn) {
        btn.disabled = true;
        btn.innerText = "Picks submitted";
        btn.classList.add("locked-submitted");
      }

      // Disable selecting on all cards post-submit
      document.querySelectorAll(".game-card").forEach((card) => {
        card.querySelectorAll(".away-team, .home-team").forEach((div) => {
          div.style.pointerEvents = "none";
        });
      });
    } else {
      alert("❌ Submission failed: " + (result.error || "Unknown error"));
    }
  } catch (err) {
    console.error("Submission error:", err);
    alert("⚠️ Something went wrong.");
  }
});

// -----------------------------
// Initial load
// -----------------------------
(async () => {
  try {
    const cid = await loadGames();
    const walletAddress = getConnectedAddress(); // ✅ pull from localStorage

    if (cid) {
      if (walletAddress) {
        await hydrateUserPicks(walletAddress, cid); // ✅ pass wallet address
      }
      await applyGameResults(cid);

      if (window.initContestStats) {
        window.initContestStats(cid);
      }
    }
  } catch (err) {
    console.error("Error during initial hydration:", err);
  }
})();