import { AppNav } from "@/components/app-nav";
import { getDictionary, resolveLocale } from "@/lib/i18n";

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const locale = resolveLocale((await params).locale);
  const dict = getDictionary(locale);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <AppNav locale={locale} dict={dict} />
      {children}
    </div>
  );
}