// api/games.js
import { nowEST, getContestWindowEST, toEST } from "../utils/time.js";

export default async function handler(req, res) {
  try {
    // Get the current contest window in EST
    const { start, end } = getContestWindowEST(nowEST());

    // Use the contestId date (YYYY-MM-DD EST) to query NHL API
    const contestDate = start.toLocaleDateString("en-CA", {
      timeZone: "America/New_York",
    });

    // Call the official NHL API
    const response = await fetch(`https://api-web.nhle.com/v1/schedule/${contestDate}`);
    if (!response.ok) {
      throw new Error(`NHL API returned ${response.status}`);
    }

    const data = await response.json();

    // Normalize and filter games into a simpler structure
    const games =
      data.gameWeek?.[0]?.games
        .map((g) => {
          const startTimeEST = toEST(g.startTimeUTC);
          return {
            gameId: g.id,
            date: startTimeEST.toLocaleDateString("en-US", {
              timeZone: "America/New_York",
            }),
            time: startTimeEST.toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
              timeZone: "America/New_York",
            }),
            status: g.gameState === "FUT" ? "Upcoming" : g.gameState,
            awayTeam: g.awayTeam.abbrev,
            homeTeam: g.homeTeam.abbrev,
            startTimeEST,
          };
        })
        // Only include games inside the contest window
        .filter((g) => g.startTimeEST >= start && g.startTimeEST <= end) || [];

    res.status(200).json({
      success: true,
      contestStart: start,
      contestEnd: end,
      games,
    });
  } catch (err) {
    console.error("API error:", err);
    res.status(500).json({ error: "Failed to fetch NHL data" });
  }
}