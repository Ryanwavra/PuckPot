// server.js
import express from "express";
import fetch from "node-fetch";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { nowEST, getContestId, getResetTimeUTC, toEST } from "./utils/time.js";
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

// ✅ Submit picks
app.post("/api/submit", async (req, res) => {
  const { userId, picks, tieBreaker } = req.body;
  try {
    const contestId = getContestId();
    const now = nowEST();

    // Ensure contest exists
    const { data: contest } = await supabase
      .from("contests")
      .select("lock_time,status")
      .eq("id", contestId)
      .maybeSingle();

    if (!contest) {
      return res.status(404).json({ error: "Contest not found" });
    }

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

    if (error) throw error;

    res.json({ success: true, submission: data[0] });
  } catch (err) {
    console.error("Submit error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Get today’s games
app.get("/api/games", async (req, res) => {
  try {
    const contestId = getContestId();
    const resetUTC = getResetTimeUTC(contestId);

    // Fetch NHL schedule
    const apiUrl = `https://api-web.nhle.com/v1/schedule/${contestId}`;
    const response = await fetch(apiUrl);
    const data = await response.json();

    const allGamesRaw = (data.gameWeek?.flatMap((w) => w.games) ?? []);

    const games = allGamesRaw
      .map((g) => {
        const startTimeEST = toEST(new Date(g.startTimeUTC));
        const y = startTimeEST.getFullYear();
        const m = String(startTimeEST.getMonth() + 1).padStart(2, "0");
        const d = String(startTimeEST.getDate()).padStart(2, "0");
        const estDay = `${y}-${m}-${d}`;
        return {
          gameId: g.id,
          homeTeam: g.homeTeam.abbrev,
          awayTeam: g.awayTeam.abbrev,
          startTimeEST,
          estDay,
          status: g.gameState === "FUT" ? "Upcoming" : g.gameState,
        };
      })
      .filter((g) => g.estDay === contestId);

    // Compute lock time = 30 min before earliest game
    let lockUTC = null;
    if (games.length > 0) {
      const earliestEST = new Date(Math.min(...games.map((g) => g.startTimeEST.getTime())));
      const lockEST = new Date(earliestEST.getTime() - 30 * 60 * 1000);
      //for real Logic: use LockEST
      lockUTC = new Date(lockEST.toISOString());

      //for testing: hardcode 5 minutes from now
      //lockUTC = new Date(Date.now() + 1 * 60 * 1000);

    }

    // Upsert contest row
    await supabase.from("contests").upsert([
      {
        id: contestId,
        lock_time: lockUTC ? lockUTC.toISOString() : null,
        reset_time: resetUTC.toISOString(),
        status: "open",
      },
    ]);

    res.json({
      success: true,
      contestId,
      lock_time: lockUTC ? lockUTC.toISOString() : null,
      reset_time: resetUTC.toISOString(),
      games,
    });
  } catch (err) {
    console.error("Games error:", err);
    res.status(500).json({ error: "Failed to fetch NHL schedule" });
  }
});

// ✅ Get submissions for a contest
app.get("/api/submissions/:contestId", async (req, res) => {
  try {
    const { contestId } = req.params;
    const { data, error } = await supabase
      .from("submissions")
      .select("*")
      .eq("contest_id", contestId);
    if (error) throw error;
    res.json({ success: true, count: data.length, pot: data.length, submissions: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Get a single user's submission
app.get("/api/submission/:contestId", async (req, res) => {
  try {
    const { contestId } = req.params;
    const { userId } = req.query;
    const { data, error } = await supabase
      .from("submissions")
      .select("*")
      .eq("contest_id", contestId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error && error.code !== "PGRST116") throw error;
    res.json({ submission: data || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Get live scores
app.get("/api/scores/:date", async (req, res) => {
  try {
    const { date } = req.params;
    const apiUrl = `https://api-web.nhle.com/v1/score/${date}`;
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