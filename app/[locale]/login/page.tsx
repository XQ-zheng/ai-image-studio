import { LoginForm } from "@/components/login-form";
import { getDictionary, resolveLocale } from "@/lib/i18n";

export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = resolveLocale((await params).locale);
  const dict = getDictionary(locale);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center gap-6 px-6 py-16">
      <h1 className="text-2xl font-semibold">{dict.login.title}</h1>
      <LoginForm locale={locale} dict={dict} />
    </main>
  );
}