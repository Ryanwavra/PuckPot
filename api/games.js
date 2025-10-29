import { getContestWindowUTC, contestIdUTC } from "../utils/time.js";

// 👇 Step 1: add this helper at the top
function normalizeStatus(state) {
  switch (state) {
    case "FUT":   // future
    case "PRE":   // pre-game
      return "UPCOMING";
    case "LIVE":  // in progress
    case "CRIT":  // critical (close game, 3rd period/OT)
      return "LIVE";
    case "FINAL":
    case "OFF":   // game over
      return "FINAL";
    default:
      return "UPCOMING"; // fallback
  }
}

export default async function handler(req, res) {
  try {
    const { start, end } = getContestWindowUTC(new Date());
    const contestId = contestIdUTC();

    const contestDate = start.toISOString().slice(0, 10);

    const response = await fetch(`https://api-web.nhle.com/v1/schedule/${contestDate}`);
    if (!response.ok) {
      throw new Error(`NHL API returned ${response.status}`);
    }

    const data = await response.json();

    const games = (data.gameWeek?.flatMap(w => w.games) || [])
  .map(g => {
    const startTimeUTC = new Date(g.startTimeUTC);
    const startTimeEST = new Date(
      new Date(g.startTimeUTC).toLocaleString("en-US", { timeZone: "America/New_York" })
    );
    return {
      gameId: g.id,
      homeTeam: g.homeTeam.abbrev,
      awayTeam: g.awayTeam.abbrev,
      startTimeUTC,
      startTimeEST,
      status: normalizeStatus(g.gameState),
    };
  })
  .filter(g => g.startTimeUTC >= start && g.startTimeUTC <= end);
    res.status(200).json({
      success: true,
      contestId,
      contestStartUTC: start,
      contestEndUTC: end,
      games,
    });
  } catch (err) {
    console.error("API error:", err);
    res.status(500).json({ error: "Failed to fetch NHL data" });
  }
}
