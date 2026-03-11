'use client';

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://sssjdmvuvixdcfvnkoky.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzc2pkbXZ1dml4ZGNmdm5rb2t5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNDE0NTEsImV4cCI6MjA4ODgxNzQ1MX0.-JEwEl1gZhAYAhQvndFu53KaETGOdlUn8RO7kdZrHtQ";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
