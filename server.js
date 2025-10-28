import express from 'express'
import fetch from 'node-fetch'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const app = express()
const PORT = 3001

// Middleware so Express can parse JSON request bodies
app.use(express.json())

// ✅ Debug route to confirm env vars are loaded
app.get('/ping', (req, res) => {
  res.json({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'loaded' : 'missing',
    anon: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'loaded' : 'missing'
  })
})


// Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// ✅ New route: insert a submission
app.post('/submit', async (req, res) => {
  const { userId, contestId, picks, tieBreaker } = req.body

  try {
    const { data, error } = await supabase
      .from('submissions')
      .insert([{ 
        user_id: userId, 
        contest_id: contestId, 
        picks, 
        tie_breaker: tieBreaker 
      }])
      .select()

    if (error) throw error
    res.json({ success: true, submission: data[0] })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Your existing NHL proxy route
app.get('/nhl-schedule/:date', async (req, res) => {
  const date = req.params.date
  const apiUrl = `https://api-web.nhle.com/v1/schedule/${date}`

  try {
    const response = await fetch(apiUrl)
    const data = await response.json()
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch NHL data' })
  }
})

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`))