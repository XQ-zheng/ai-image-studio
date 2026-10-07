"use server";

import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";

export type AuthState = { error: string | null };

function read(formData: FormData) {
  return {
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
    locale: String(formData.get("locale") ?? "zh"),
  };
}

export async function signUpAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const { email, password, locale } = read(formData);
  if (!email || password.length < 6) {
    return { error: "invalid_input" };
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) {
    return { error: error.message };
  }

  redirect(`/${locale}/studio`);
}

export async function signInAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const { email, password, locale } = read(formData);
  if (!email || password.length < 6) {
    return { error: "invalid_input" };
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { error: error.message };
  }

  redirect(`/${locale}/studio`);
}

export async function signOutAction(formData: FormData): Promise<void> {
  const locale = String(formData.get("locale") ?? "zh");
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  redirect(`/${locale}`);
}