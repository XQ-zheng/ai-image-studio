import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { createSignedImageUrl } from "@/lib/storage/upload";
import { getCurrentProfile } from "@/lib/user/current";
import { getDictionary, resolveLocale } from "@/lib/i18n";
import { buttonVariants } from "@/components/ui/button";

type GenerationRow = {
  id: string;
  status: string;
  prompt: string;
  subject: string;
  size: string;
  quality: string;
  storage_path: string | null;
  created_at: string;
};

export default async function HistoryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = resolveLocale((await params).locale);
  const dict = getDictionary(locale);
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect(`/${locale}/login`);
  }

  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("generations")
    .select(
      "id, status, prompt, subject, size, quality, storage_path, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(24);

  const rows = (data ?? []) as GenerationRow[];

  const items = await Promise.all(
    rows.map(async (row) => {
      let url: string | null = null;
      if (row.storage_path) {
        try {
          url = await createSignedImageUrl(row.storage_path);
        } catch {
          url = null;
        }
      }
      return { ...row, url };
    }),
  );

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-8">
      <h1 className="mb-6 text-2xl font-semibold">{dict.history.title}</h1>

      {items.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed p-8">
          <p className="text-muted-foreground">{dict.history.empty}</p>
          <Link href={`/${locale}/studio`} className={buttonVariants()}>
            {dict.history.emptyCta}
          </Link>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <li key={item.id} className="flex flex-col gap-3 rounded-lg border p-3">
              {item.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.url}
                  alt={item.subject}
                  className="h-[220px] w-full rounded-md object-cover"
                />
              ) : (
                <div className="flex h-[220px] w-full items-center justify-center rounded-md bg-muted text-sm text-muted-foreground">
                  {dict.history.failed}
                </div>
              )}

              <p className="text-sm tabular-nums text-muted-foreground">
                {new Date(item.created_at).toLocaleString(
                  locale === "zh" ? "zh-CN" : "en-US",
                )}
              </p>

              <details className="text-sm">
                <summary className="cursor-pointer">
                  {dict.history.detail}
                </summary>
                <div className="mt-2 flex flex-col gap-1 text-muted-foreground">
                  <p className="break-all">
                    {dict.history.prompt}: {item.prompt}
                  </p>
                  <p>
                    {dict.history.options}: {item.size} / {item.quality}
                  </p>
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}