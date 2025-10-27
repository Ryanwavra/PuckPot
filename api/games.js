// api/games.js
export default async function handler(req, res) {
  try {
    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().slice(0, 10);

    // Call the official NHL API
    const response = await fetch(`https://api-web.nhle.com/v1/schedule/${today}`);

    if (!response.ok) {
      throw new Error(`NHL API returned ${response.status}`);
    }

    const data = await response.json();

    // Normalize the data into a simpler structure for your frontend
    const games = data.gameWeek?.[0]?.games.map(g => {
      const start = new Date(g.startTimeUTC);
      return {
        date: start.toLocaleDateString("en-US"),
        time: start.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          timeZone: "America/New_York",
        }),
        status: g.gameState === "FUT" ? "Upcoming" : g.gameState,
        awayTeam: g.awayTeam.abbrev,
        homeTeam: g.homeTeam.abbrev,
      };
    }) || [];

    res.status(200).json(games);
  } catch (err) {
    console.error("API error:", err);
    res.status(500).json({ error: "Failed to fetch NHL data" });
  }
}