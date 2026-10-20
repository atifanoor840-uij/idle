import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://mgplbfzetblmkpsetrhu.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-key-to-prevent-import-crash";

if (supabaseServiceKey === "placeholder-key-to-prevent-import-crash" && process.env.NEXT_PHASE !== "phase-production-build") {
  console.warn("WARN: SUPABASE_SERVICE_ROLE_KEY is not defined. Using fallback data where available.");
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
