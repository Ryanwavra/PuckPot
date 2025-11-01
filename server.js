

// server.js
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import { createClient } from "@supabase/supabase-js";
import { nowEST, getContestId, getResetTimeUTC, toEST } from "./utils/time.js";
import path from "path";
import { fileURLToPath } from "url";
import cron from "node-cron";
import { DateTime } from "luxon";

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

// ✅ Submit picks (wallet-native)
app.post("/api/submit", async (req, res) => {
  const { walletAddress, picks, tieBreaker, signature } = req.body;
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

    // Optional: verify signature to prove wallet ownership
    // (requires ethers.js)
    /*
    const recovered = ethers.utils.verifyMessage(contestId, signature);
    if (recovered.toLowerCase() !== walletAddress.toLowerCase()) {
      return res.status(401).json({ error: "Signature verification failed" });
    }
    */

    // Enforce one submission per wallet per contest
    const { data: existing } = await supabase
      .from("submissions")
      .select("id")
      .eq("wallet_address", walletAddress)
      .eq("contest_id", contestId);

    if (existing && existing.length > 0) {
      return res.status(409).json({ error: "Already submitted for this contest" });
    }

    // Insert submission
    const { data, error } = await supabase
      .from("submissions")
      .insert([
        {
          wallet_address: walletAddress,
          contest_id: contestId,
          picks,
          tie_breaker: tieBreaker,
        },
      ])
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

// ✅ Contest stats: players entered + net pot (minus 10%)
app.get("/api/contest-stats/:contestId", async (req, res) => {
  try {
    const { contestId } = req.params;

    // Count submissions for this contest
    const { data: subs, error } = await supabase
      .from("submissions")
      .select("id")
      .eq("contest_id", contestId);
      // When you add statuses, change to: .eq("status", "active")

    if (error) throw error;

    const players = subs.length;
    // Each entry = 1 USDC. Pot = entries * 0.9 (10% fee)
    const pot = players * 1 * 0.9;

    res.json({ success: true, players, pot });
  } catch (err) {
    console.error("contest-stats error:", err);
    res.status(500).json({ success: false, error: String(err) });
  }
});

// ✅ Get a single user's submission
app.get("/api/submission/:contestId", async (req, res) => {
  try {
    const { contestId } = req.params;
    const { walletAddress } = req.query;

    if (!walletAddress) {
      return res.status(400).json({ error: "walletAddress is required" });
    }

    const { data, error } = await supabase
      .from("submissions")
      .select("*")
      .eq("contest_id", contestId)
      .eq("wallet_address", walletAddress)
      .maybeSingle();

    // Supabase returns error code PGRST116 when no rows are found
    if (error && error.code !== "PGRST116") throw error;

    res.json({ submission: data || null });
  } catch (err) {
    console.error("Error in /api/submission:", err);
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

    // Map scores to winner format
    const mappedGames = (data.games ?? []).map(g => {
      const home = g.homeTeam?.abbrev;
      const away = g.awayTeam?.abbrev;
      const homeGoals = g.homeTeam?.score ?? 0;
      const awayGoals = g.awayTeam?.score ?? 0;
      const state = g.gameState;

      let winner = null;
if (state && ["FINAL", "OFF"].includes(state.toUpperCase())) {
  winner = homeGoals > awayGoals ? home : awayGoals > homeGoals ? away : null;
}

      return {
        gameId: g.id,
        winner,
        home,
        away,
        homeGoals,
        awayGoals,
        state,
      };
    });

    res.json({ games: mappedGames });
  } catch (err) {
    console.error("Score fetch error:", err);
    res.status(500).json({ error: "Failed to fetch NHL scores" });
  }
});

app.get("/api/results/:contestId", async (req, res) => {
  try {
    const { contestId } = req.params;

    // A) Load contest to check finalization
    const { data: contestRows, error: contestErr } = await supabase
      .from("contests")
      .select("*")
      .eq("id", contestId)
      .limit(1);
    if (contestErr) throw contestErr;
    const contest = contestRows?.[0];
    if (!contest) return res.status(404).json({ error: "Contest not found" });

    // If already finalized, return snapshot
    if (contest.finalized_at) {
      return res.json({
        success: true,
        contestId,
        message: "Contest already finalized",
        finalized_at: contest.finalized_at,
        finalize_reason: contest.finalize_reason
      });
    }

    // 1. Fetch submissions
    const { data: submissions, error: subError } = await supabase
      .from("submissions")
      .select("*")
      .eq("contest_id", contestId);
    if (subError) throw subError;

    // 2. Fetch scores
    const scoreRes = await fetch(`http://localhost:${PORT}/api/scores/${contestId}`);
    const scoreData = await scoreRes.json();

    // Only finished games count
    const finishedStates = new Set(["FINAL", "OFF"]);
    const finishedGames = (scoreData.games || []).filter(
      g => finishedStates.has((g.state || "").toUpperCase())
    );

    // Map gameId -> winner (finished only)
    const resultMap = Object.fromEntries(
      finishedGames.map(g => [String(g.gameId), g.winner])
    );

    // Highest scoring finished game total goals
    let highestGoals = 0;
    for (const g of finishedGames) {
      const total = (g.homeGoals || 0) + (g.awayGoals || 0);
      if (total > highestGoals) highestGoals = total;
    }
    const actualTieBreaker = finishedGames.length > 0 ? highestGoals : null;

    // 3. Score and tieDiff
    submissions.forEach(sub => {
      let correct = 0;
      for (const [gameId, pick] of Object.entries(sub.picks || {})) {
        if (resultMap[gameId] && resultMap[gameId] === pick) correct++;
      }
      sub.correctCount = correct;
      sub.tieDiff = actualTieBreaker != null
        ? Math.abs(Number(sub.tie_breaker) - actualTieBreaker)
        : null;
    });

    // 3b. Sort: correct desc, tieDiff asc (nulls last)
    submissions.sort((a, b) => {
      if (b.correctCount !== a.correctCount) return b.correctCount - a.correctCount;
      const aTD = a.tieDiff ?? Infinity;
      const bTD = b.tieDiff ?? Infinity;
      return aTD - bTD;
    });

    // 3c. Winners, with everyone-wrong fallback
    let winners = [];
    if (submissions.length > 0) {
      const maxCorrect = Math.max(...submissions.map(s => s.correctCount));
      if (maxCorrect > 0) {
        const top = submissions[0];
        winners = submissions.filter(
          s => s.correctCount === top.correctCount &&
               (top.tieDiff === null || s.tieDiff === top.tieDiff)
        );
      } else {
        const minTieDiff = Math.min(...submissions.map(s => s.tieDiff ?? Infinity));
        winners = submissions.filter(s => s.tieDiff === minTieDiff);
      }
    }

    // 4. Persist per submission
    for (const sub of submissions) {
      await supabase
        .from("submissions")
        .update({
          correct_count: sub.correctCount,
          tie_diff: sub.tieDiff,
          is_winner: winners.some(w => w.id === sub.id)
        })
        .eq("id", sub.id);
    }

    // 5. Finalize contest snapshot
    const allGames = scoreData.games || [];
    const allFinished = allGames.length > 0 &&
      allGames.every(g => finishedStates.has((g.state || "").toUpperCase()));

    const finalizeReason = allFinished ? "ALL_FINAL" : "RESET_7AM";
    await supabase
      .from("contests")
      .update({
        finalized_at: new Date().toISOString(),
        finalize_reason: finalizeReason
      })
      .eq("id", contestId);

    // 6. Return
    res.json({
      success: true,
      contestId,
      resultMap,
      actualTieBreaker,
      finalize_reason: finalizeReason,
      winners,
      submissions
    });
  } catch (err) {
    console.error("Results error:", err);
    res.status(500).json({ error: err.message });
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

// Example: finalize yesterday's contest at 7:00 AM Eastern
cron.schedule("0 7 * * *", async () => {
  try {
    const dt = DateTime.now().setZone("America/New_York").minus({ days: 1 });
    const contestId = dt.toFormat("yyyy-LL-dd");

    const res = await fetch(`http://localhost:${PORT}/api/results/${contestId}`);
    const data = await res.json();
    console.log("Finalized contest:", contestId, data.finalize_reason);
  } catch (err) {
    console.error("Cron finalize error:", err);
  }
});

// Every 10 minutes: check if all games are final, finalize early if possible
cron.schedule("*/10 * * * *", async () => {
  try {
    const dt = DateTime.now().setZone("America/New_York").minus({ days: 1 });
    const contestId = dt.toFormat("yyyy-LL-dd");

    // 1. Load contest row
    const { data: contestRows, error: contestErr } = await supabase
      .from("contests")
      .select("*")
      .eq("id", contestId)
      .limit(1);
    if (contestErr) throw contestErr;
    const contest = contestRows?.[0];
    if (!contest) return; // no contest for yesterday

    // Skip if already finalized
    if (contest.finalized_at) return;

    // 2. Fetch scores for yesterday
    const scoreRes = await fetch(`http://localhost:${PORT}/api/scores/${contestId}`);
    const scoreData = await scoreRes.json();

    const finishedStates = new Set(["FINAL", "OFF"]);
    const allGames = scoreData.games || [];

    // 3. Check if all games are finished
    const allFinished = allGames.length > 0 &&
      allGames.every(g => finishedStates.has((g.state || "").toUpperCase()));

    if (allFinished) {
      // 4. Finalize early
      const res = await fetch(`http://localhost:${PORT}/api/results/${contestId}`);
      const data = await res.json();
      console.log("Early finalization triggered:", contestId, data.finalize_reason);
    }
  } catch (err) {
    console.error("10‑minute poller error:", err);
  }
});