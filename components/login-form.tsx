"use client";

import { useActionState, useState } from "react";
import { signInAction, signUpAction, type AuthState } from "@/lib/auth/actions";
import type { Dictionary, Locale } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const initial: AuthState = { error: null };

export function LoginForm({
  locale,
  dict,
}: {
  locale: Locale;
  dict: Dictionary;
}) {
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const action = mode === "signIn" ? signInAction : signUpAction;
  const [state, formAction, pending] = useActionState(action, initial);

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-4">
      <input type="hidden" name="locale" value={locale} />

      <label className="flex flex-col gap-1.5 text-sm">
        {dict.login.email}
        <Input name="email" type="email" required autoComplete="email" />
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        {dict.login.password}
        <Input
          name="password"
          type="password"
          required
          minLength={6}
          autoComplete={mode === "signIn" ? "current-password" : "new-password"}
        />
      </label>

      {state.error ? (
        <p className="text-sm text-destructive">
          {state.error === "invalid_input" ? dict.login.invalidInput : state.error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {mode === "signIn" ? dict.login.signIn : dict.login.signUp}
      </Button>

      <button
        type="button"
        className="text-sm text-muted-foreground underline"
        onClick={() => setMode(mode === "signIn" ? "signUp" : "signIn")}
      >
        {mode === "signIn" ? dict.login.toSignUp : dict.login.toSignIn}
      </button>
    </form>
  );
}