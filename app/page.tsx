import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function RootPage() {
  const store = await cookies();
  const locale = store.get("NEXT_LOCALE")?.value === "en" ? "en" : "zh";
  redirect(`/${locale}`);
}