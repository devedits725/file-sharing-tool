import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Use a fallback for build time if env vars are missing
const isConfigured =
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl !== 'your_supabase_project_url' &&
  supabaseUrl !== '' &&
  supabaseUrl.startsWith('https://')

if (!isConfigured && typeof window !== 'undefined') {
  console.warn('Supabase is not properly configured. Check your environment variables.')
}

export const supabase = isConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null
