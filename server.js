import express from "express";
import fetch from "node-fetch";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { nowEST, getContestWindowEST, toEST } from "./utils/time.js";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json());
app.use(express.static("public"));

// Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// --- Helper: always return game-day contestId ---
function getContestIdEST() {
  const now = nowEST(); // current EST time
  // If it's before 7am, use yesterday's date (games belong to previous day)
  const cutoff = new Date(now);
  cutoff.setHours(7, 0, 0, 0);

  let contestDate = new Date(now);
  if (now < cutoff) {
    contestDate.setDate(contestDate.getDate() - 1);
  }

  return contestDate.toISOString().split("T")[0];
}

// ✅ Submit picks
app.post("/api/submit", async (req, res) => {
  console.log("Incoming submission body:", req.body);
  const { userId, picks, tieBreaker } = req.body;
  try {
    const contestId = getContestIdEST();

    // Check contest exists and is open
    const { data: contest } = await supabase
      .from("contests")
      .select("lock_time,status")
      .eq("id", contestId)
      .single();

    if (!contest) {
      console.error("❌ No contest found for ID:", contestId);
      return res.status(404).json({ error: "Contest not found" });
    }

    console.log("🧠 Submitting for contestId:", contestId);
    console.log("⏰ Contest lock_time (UTC):", contest.lock_time);
    console.log("📍 Contest status:", contest.status);
    console.log("🕒 Current time (EST):", nowEST().toISOString());

    const now = nowEST();
    if (contest.status !== "open" || new Date(contest.lock_time) <= now) {
      return res.status(403).json({ error: "Submissions are locked" });
    }

    // Enforce one submission per user per contest
    const { data: existing } = await supabase
      .from("submissions")
      .select("id")
      .eq("user_id", userId)
      .eq("contest_id", contestId);

    if (existing && existing.length > 0) {
      return res.status(409).json({ error: "Already submitted for this contest" });
    }

    // Insert submission
    const { data, error } = await supabase
      .from("submissions")
      .insert([{ user_id: userId, contest_id: contestId, picks, tie_breaker: tieBreaker }])
      .select();

    if (error) {
  console.error("❌ Supabase insert error:", error); // log full object
  return res.status(500).json({ error: error.message });
}

    console.log("✅ Submission saved:", data);
    res.json({ success: true, submission: data[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Get today’s games (normalized to EST + contest window)
app.get("/api/games", async (req, res) => {
  try {
    const { start, end } = getContestWindowEST(nowEST());
    const contestId = getContestIdEST();

    console.log("Contest window:", start, end, "Contest ID:", contestId);

    // Fetch NHL schedule for contest start date
    const contestDate = start.toLocaleDateString("en-CA", {
      timeZone: "America/New_York",
    });
    const apiUrl = `https://api-web.nhle.com/v1/schedule/${contestDate}`;
    const response = await fetch(apiUrl);
    const data = await response.json();

    console.log("Raw NHL data keys:", Object.keys(data));

    // Normalize and filter games into contest window
    const games = (data.gameWeek?.flatMap((w) => w.games) || [])
      .map((g) => {
        const startTimeEST = toEST(g.startTimeUTC);
        return {
          gameId: g.id,
          homeTeam: g.homeTeam.abbrev,
          awayTeam: g.awayTeam.abbrev,
          startTimeEST,
          status: g.gameState === "FUT" ? "Upcoming" : g.gameState,
        };
      })
      .filter((g) => g.startTimeEST >= start && g.startTimeEST <= end);

    console.log("Normalized games:", games);

    // Ensure contest row exists
    const resetBase = new Date(`${contestId}T00:00:00`); // midnight of contest day
    resetBase.setDate(resetBase.getDate() + 1); // move to next day
    resetBase.setHours(7, 0, 0, 0); // 7:00 AM EST
    const resetUTC = toEST(resetBase);

    await supabase.from("contests").upsert([
      {
        id: contestId,
        lock_time: games.length
          ? new Date(
              Math.min(...games.map((g) => g.startTimeEST.getTime())) -
                30 * 60000
            ).toISOString()
          : null,
        reset_time: resetUTC.toISOString(),
        status: "open",
      },
    ]);

    res.json({
      success: true,
      contestId,
      contestStart: start,
      contestEnd: end,
      games,
    });
  } catch (err) {
    console.error("API error:", err);
    res.status(500).json({ error: "Failed to fetch NHL schedule" });
  }
});

// ✅ Get submissions for a contest
app.get("/api/submissions/:contestId", async (req, res) => {
  const { contestId } = req.params;
  try {
    const { data, error } = await supabase
      .from("submissions")
      .select("*")
      .eq("contest_id", contestId);

    if (error) throw error;
    res.json({
      success: true,
      count: data.length,
      pot: data.length, // 1 USDC per submission
      submissions: data,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Get a single user's submission for a contest
app.get("/api/submission/:contestId", async (req, res) => {
  const { contestId } = req.params;
  const { userId } = req.query;

  try {
    const { data, error } = await supabase
      .from("submissions")
      .select("*")
      .eq("contest_id", contestId)
      .eq("user_id", userId)
      .single();

    if (error && error.code !== "PGRST116") throw error;

    res.json({ submission: data || null });
  } catch (err) {
    console.error("Error fetching submission:", err);
    res.status(500).json({ error: "Failed to fetch submission" });
  }
});

// ✅ Get live scores for a date
app.get("/api/scores/:date", async (req, res) => {
  const { date } = req.params;
  const apiUrl = `https://api-web.nhle.com/v1/score/${date}`;
  try {
    const response = await fetch(apiUrl);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch NHL scores" });
  }
});

// ✅ Health check
app.get("/health", (req, res) => res.json({ ok: true }));

// ✅ Serve picks.html
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.get("/picks.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "picks.html"));
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));