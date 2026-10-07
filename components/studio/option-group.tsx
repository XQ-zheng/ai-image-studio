"use client";

import type { OptionItem } from "@/lib/prompt/catalog";
import type { Locale } from "@/lib/i18n";

export function OptionGroup({
  title,
  items,
  value,
  locale,
  onChange,
}: {
  title: string;
  items: OptionItem[];
  value: string;
  locale: Locale;
  onChange: (id: string) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-medium">{title}</legend>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => {
          const active = item.id === value;
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(item.id)}
              className={
                active
                  ? "rounded-md border border-primary bg-primary px-3 py-1.5 text-sm text-primary-foreground"
                  : "rounded-md border border-border px-3 py-1.5 text-sm hover:border-foreground/40"
              }
            >
              {locale === "zh" ? item.labelZh : item.labelEn}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}