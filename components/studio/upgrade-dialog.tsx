"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Dictionary, Locale } from "@/lib/i18n";

const PLANS = [
  { id: "starter", zh: "体验包 · 20 积分", en: "Starter · 20 credits" },
  { id: "plus", zh: "标准包 · 60 积分", en: "Plus · 60 credits" },
  { id: "pro", zh: "专业包 · 200 积分", en: "Pro · 200 credits" },
];

export function UpgradeDialog({
  open,
  onOpenChange,
  locale,
  dict,
  credits,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locale: Locale;
  dict: Dictionary;
  credits: number;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{dict.upgrade.title}</DialogTitle>
          <DialogDescription>{dict.upgrade.description}</DialogDescription>
        </DialogHeader>

        <div className="flex gap-6 text-sm">
          <span>
            {dict.upgrade.current}: <span className="tabular-nums">{credits}</span>
          </span>
          <span>
            {dict.upgrade.required}: <span className="tabular-nums">1</span>
          </span>
        </div>

        <ul className="flex flex-col gap-2">
          {PLANS.map((plan) => (
            <li
              key={plan.id}
              className="flex items-center justify-between rounded-md border px-3 py-2"
            >
              <span className="text-sm">
                {locale === "zh" ? plan.zh : plan.en}
              </span>
              <Button variant="outline" size="sm" disabled>
                {dict.upgrade.comingSoon}
              </Button>
            </li>
          ))}
        </ul>

        <Button onClick={() => onOpenChange(false)}>{dict.upgrade.close}</Button>
      </DialogContent>
    </Dialog>
  );
}