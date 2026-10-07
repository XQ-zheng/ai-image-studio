import { createServerSupabase } from "@/lib/supabase/server";

export type CurrentProfile = {
  userId: string;
  credits: number;
};

export async function getCurrentProfile(): Promise<CurrentProfile | null> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("credits")
    .eq("id", user.id)
    .single();

  if (error || !data) {
    return null;
  }

  return { userId: user.id, credits: data.credits };
}