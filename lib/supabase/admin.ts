import { createClient } from "@supabase/supabase-js";

// 只能在服务端导入。使用 service role key，会绕过行级安全。
export function createAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}