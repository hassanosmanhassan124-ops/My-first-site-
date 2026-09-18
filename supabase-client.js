/* ============================================================
   Supabase connection — PASTE YOUR OWN PROJECT VALUES HERE.
   Find them in: Supabase Dashboard → Project Settings → API
   - Project URL           → SUPABASE_URL
   - anon / public API key → SUPABASE_ANON_KEY
   The anon key is safe to expose in frontend code — it can only
   do what the Row Level Security policies in database/schema.sql allow.
   ============================================================ */
const SUPABASE_URL = "https://YOUR-PROJECT-ID.supabase.co";
const SUPABASE_ANON_KEY = "YOUR-ANON-PUBLIC-KEY";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
