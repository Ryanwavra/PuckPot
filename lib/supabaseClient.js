// lib/supabaseClient.js
import { createClient } from '@supabase/supabase-js'

// These values come from your .env.local file
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Create a single supabase client for the whole app
export const supabase = createClient(supabaseUrl, supabaseAnonKey)