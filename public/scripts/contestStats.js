// public/js/contestStats.js
async function loadContestStats(contestId) {
  try {
    const res = await fetch(`/api/contest-stats/${contestId}`);
    const data = await res.json();

    if (data?.success) {
      const playersEl = document.querySelector(".total-players");
      const potEl = document.querySelector(".total-pot");

      if (playersEl) playersEl.textContent = `Players Entered: ${data.players}`;

      const potDisplay = Number(data.pot).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      if (potEl) potEl.textContent = `Current Pot: $${potDisplay}`;
    }
  } catch (err) {
    console.error("Error loading contest stats", err);
  }
}

function initContestStats(contestId) {
  loadContestStats(contestId);
  const POLL_MS = 30000; // optional: refresh every 30s
  setInterval(() => loadContestStats(contestId), POLL_MS);
}

window.initContestStats = initContestStats;