// api/games.js
import { getContestWindowUTC, contestIdUTC } from "../utils/time.js";

export default async function handler(req, res) {
  try {
    // Get the current contest window in UTC
    const { start, end } = getContestWindowUTC(new Date());
    const contestId = contestIdUTC();

    // Use contest start date (YYYY-MM-DD UTC) to query NHL API
    const contestDate = start.toISOString().slice(0, 10);

    // Call the official NHL API
    const response = await fetch(`https://api-web.nhle.com/v1/schedule/${contestDate}`);
    if (!response.ok) {
      throw new Error(`NHL API returned ${response.status}`);
    }

    const data = await response.json();

    // Normalize and filter games into UTC
    const games = (data.gameWeek?.flatMap(w => w.games) || [])
      .map(g => {
        const startTimeUTC = new Date(g.startTimeUTC);
        return {
          gameId: g.id,
          homeTeam: g.homeTeam.abbrev,
          awayTeam: g.awayTeam.abbrev,
          startTimeUTC, // keep in UTC
          status: g.gameState === "FUT" ? "Upcoming" : g.gameState,
        };
      })
      // ✅ Only include games inside the UTC contest window
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