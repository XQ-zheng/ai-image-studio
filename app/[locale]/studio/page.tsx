import { redirect } from "next/navigation";
import { StudioClient } from "@/components/studio/studio-client";
import { getDictionary, resolveLocale } from "@/lib/i18n";
import { getCurrentProfile } from "@/lib/user/current";

export default async function StudioPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ upgrade?: string }>;
}) {
  const locale = resolveLocale((await params).locale);
  const dict = getDictionary(locale);
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect(`/${locale}/login`);
  }

  const upgradeOpen = (await searchParams).upgrade === "1";

  return (
    <StudioClient
      locale={locale}
      dict={dict}
      initialCredits={profile.credits}
      upgradeOpen={upgradeOpen}
    />
  );
}