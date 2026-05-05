import { createClient } from '@supabase/supabase-js'

// Replace these with your actual keys from your .env.local file!
const supabaseUrl = 'https://yfwrkkgujvfmbrtpsvhw.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlmd3Jra2d1anZmbWJydHBzdmh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyNzU4NTEsImV4cCI6MjA5MDg1MTg1MX0.DMOqo-iF-BM59nx2nO_qMpqep0p5-hc4pIGvN7hCoFc'

export const supabase = createClient(supabaseUrl, supabaseKey)