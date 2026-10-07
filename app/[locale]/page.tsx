import Image from "next/image";
import Link from "next/link";
import { getDictionary, resolveLocale } from "@/lib/i18n";
import { getCurrentProfile } from "@/lib/user/current";
import { buttonVariants } from "@/components/ui/button";

const SAMPLES = [
  { src: "/samples/sample-1.png", zh: "产品海报", en: "Product poster" },
  { src: "/samples/sample-2.png", zh: "角色插画", en: "Character art" },
  { src: "/samples/sample-3.png", zh: "场景概念", en: "Scene concept" },
];

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = resolveLocale((await params).locale);
  const dict = getDictionary(locale);
  const profile = await getCurrentProfile();
  const target = profile ? `/${locale}/studio` : `/${locale}/login`;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 pb-16">
      <section className="grid gap-8 py-12 lg:grid-cols-2 lg:items-center">
        <div className="flex flex-col items-start gap-5">
          <h1 className="text-4xl font-semibold leading-tight">
            {dict.home.title}
          </h1>
          <p className="max-w-md text-muted-foreground">{dict.home.subtitle}</p>
          <Link href={target} className={buttonVariants({ size: "lg" })}>
            {dict.home.cta}
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Image
            src={SAMPLES[0].src}
            alt={locale === "zh" ? SAMPLES[0].zh : SAMPLES[0].en}
            width={1024}
            height={1024}
            className="col-span-2 h-[240px] w-full rounded-lg object-cover"
            priority
          />
          <Image
            src={SAMPLES[1].src}
            alt={locale === "zh" ? SAMPLES[1].zh : SAMPLES[1].en}
            width={1024}
            height={1024}
            className="h-[170px] w-full rounded-lg object-cover"
          />
          <Image
            src={SAMPLES[2].src}
            alt={locale === "zh" ? SAMPLES[2].zh : SAMPLES[2].en}
            width={1024}
            height={1024}
            className="h-[170px] w-full rounded-lg object-cover"
          />
        </div>
      </section>

      <section className="flex flex-col gap-4 border-t pt-8">
        <h2 className="text-lg font-medium">{dict.home.samples}</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {SAMPLES.map((sample) => (
            <figure key={sample.src} className="flex flex-col gap-2">
              <Image
                src={sample.src}
                alt={locale === "zh" ? sample.zh : sample.en}
                width={1024}
                height={1024}
                className="h-[200px] w-full rounded-lg object-cover"
              />
              <figcaption className="text-sm text-muted-foreground">
                {locale === "zh" ? sample.zh : sample.en}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>
    </main>
  );
}