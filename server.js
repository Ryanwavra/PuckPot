import express from 'express'
import fetch from 'node-fetch'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(express.json())

// Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// Utility: get today's date in EST (YYYY-MM-DD)
function getTodayEST() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
}

// ✅ Submit picks
app.post('/api/submit', async (req, res) => {
  const { userId, contestId, picks, tieBreaker } = req.body
  try {
    // Check contest exists and is open
    const { data: contest, error: contestError } = await supabase
      .from('contests')
      .select('lock_time,status')
      .eq('id', contestId)
      .single()

    if (contestError) throw contestError
    if (!contest) return res.status(400).json({ error: 'Contest not found' })

    const now = new Date()
    if (contest.status !== 'open' || new Date(contest.lock_time) <= now) {
      return res.status(403).json({ error: 'Submissions are locked' })
    }

    // Enforce one submission per user per contest
    const { data: existing } = await supabase
      .from('submissions')
      .select('id')
      .eq('user_id', userId)
      .eq('contest_id', contestId)

    if (existing && existing.length > 0) {
      return res.status(409).json({ error: 'Already submitted for this contest' })
    }

    // Insert submission
    const { data, error } = await supabase
      .from('submissions')
      .insert([{ user_id: userId, contest_id: contestId, picks, tie_breaker: tieBreaker }])
      .select()

    if (error) throw error
    res.json({ success: true, submission: data[0] })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ✅ Get today’s games (normalized to EST)
app.get('/api/games', async (req, res) => {
  const today = getTodayEST()
  const apiUrl = `https://api-web.nhle.com/v1/schedule/${today}`

  try {
    const response = await fetch(apiUrl)
    const data = await response.json()

    // Ensure contest row exists
    await supabase.from('contests').upsert([{
      id: today,
      lock_time: `${today}T23:59:00Z`,
      reset_time: `${today}T07:00:00Z`,
      status: 'open'
    }])

    res.json(data)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch NHL schedule' })
  }
})

// ✅ Get submissions for a contest
app.get('/api/submissions/:contestId', async (req, res) => {
  const { contestId } = req.params
  try {
    const { data, error } = await supabase
      .from('submissions')
      .select('*')
      .eq('contest_id', contestId)

    if (error) throw error
    res.json({
      success: true,
      count: data.length,
      pot: data.length, // 1 USDC per submission
      submissions: data
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ✅ Get live scores for a date
app.get('/api/scores/:date', async (req, res) => {
  const { date } = req.params
  const apiUrl = `https://api-web.nhle.com/v1/score/${date}`

  try {
    const response = await fetch(apiUrl)
    const data = await response.json()
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch NHL scores' })
  }
})

// ✅ Health check
app.get('/health', (req, res) => res.json({ ok: true }))

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`))