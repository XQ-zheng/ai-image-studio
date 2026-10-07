import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

function readConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "缺少 Supabase 环境变量，请把 NEXT_PUBLIC_SUPABASE_URL 与 NEXT_PUBLIC_SUPABASE_ANON_KEY 填进项目根目录的 .env.local",
    );
  }

  return { url, anonKey };
}

export async function createServerSupabase() {
  const { url, anonKey } = readConfig();
  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // 服务端组件里不允许写 cookie，此时直接忽略。
        }
      },
    },
  });
}