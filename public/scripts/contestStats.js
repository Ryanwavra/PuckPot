async function loadContestStats(contestId) {
  try {
    const res = await fetch(`/api/contest-stats/${contestId}`);
    const data = await res.json();

    if (data?.success) {
      const playersEl = document.getElementById("player-count");
      const potEl = document.getElementById("total-amount");

      // Only update the numbers, not the labels
      if (playersEl) playersEl.textContent = data.players;

      const potDisplay = Number(data.pot).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      if (potEl) potEl.textContent = `$${potDisplay}`;
    }
  } catch (err) {
    console.error("Error loading contest stats", err);
  }
}

function initContestStats(contestId) {
  loadContestStats(contestId);
  const POLL_MS = 30000; // refresh every 30s
  setInterval(() => loadContestStats(contestId), POLL_MS);
}

window.initContestStats = initContestStats;