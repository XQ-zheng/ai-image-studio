import Link from "next/link";
import { Coins, LogOut, Sparkles } from "lucide-react";
import { signOutAction } from "@/lib/auth/actions";
import { getCurrentProfile } from "@/lib/user/current";
import type { Dictionary, Locale } from "@/lib/i18n";
import { Button } from "@/components/ui/button";

export async function AppNav({
  locale,
  dict,
}: {
  locale: Locale;
  dict: Dictionary;
}) {
  const profile = await getCurrentProfile();

  return (
    <header className="border-b">
      <nav className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-4 px-6 py-3">
        <Link href={`/${locale}`} className="font-semibold">
          AI Image Studio
        </Link>

        <Link href={`/${locale}/studio`} className="text-sm">
          {dict.nav.studio}
        </Link>
        <Link href={`/${locale}/history`} className="text-sm">
          {dict.nav.history}
        </Link>

        <div className="ml-auto flex items-center gap-3">
          {profile ? (
            <>
              <span className="flex items-center gap-1 text-sm tabular-nums">
                <Coins className="h-4 w-4" aria-hidden />
                {profile.credits}
              </span>
              <Link
                href={`/${locale}/studio?upgrade=1`}
                className="flex items-center gap-1 text-sm"
              >
                <Sparkles className="h-4 w-4" aria-hidden />
                {dict.nav.upgrade}
              </Link>
              <form action={signOutAction}>
                <input type="hidden" name="locale" value={locale} />
                <Button type="submit" variant="ghost" size="sm">
                  <LogOut className="h-4 w-4" aria-hidden />
                  {dict.nav.logout}
                </Button>
              </form>
            </>
          ) : (
            <Link href={`/${locale}/login`} className="text-sm">
              {dict.nav.login}
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}