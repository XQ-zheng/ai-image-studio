"use client";

import { useState } from "react";
import {
  imageTypes,
  ratios,
  scenes,
  styles,
  whitespaces,
} from "@/lib/prompt/catalog";
import { OptionGroup } from "./option-group";
import { UpgradeDialog } from "./upgrade-dialog";
import type { Dictionary, Locale } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type ErrorKind = "insufficient" | "failed" | null;

export function StudioClient({
  locale,
  dict,
  initialCredits,
  upgradeOpen,
}: {
  locale: Locale;
  dict: Dictionary;
  initialCredits: number;
  upgradeOpen: boolean;
}) {
  const [imageTypeId, setImageTypeId] = useState(imageTypes[0].id);
  const [ratioId, setRatioId] = useState(ratios[0].id);
  const [styleId, setStyleId] = useState(styles[0].id);
  const [sceneId, setSceneId] = useState(scenes[0].id);
  const [whitespaceId, setWhitespaceId] = useState(whitespaces[0].id);
  const [subject, setSubject] = useState("");
  const [notes, setNotes] = useState("");

  const [pending, setPending] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<ErrorKind>(null);
  const [credits, setCredits] = useState(initialCredits);
  const [upgrade, setUpgrade] = useState(upgradeOpen);

  async function submit() {
    if (pending || subject.trim().length === 0) {
      return;
    }

    setPending(true);
    setError(null);
    setImageUrl(null);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageTypeId,
          ratioId,
          styleId,
          sceneId,
          whitespaceId,
          subject,
          notes,
        }),
      });

      if (response.status === 402) {
        setError("insufficient");
        setUpgrade(true);
        return;
      }

      if (!response.ok) {
        setError("failed");
        return;
      }

      const data = (await response.json()) as { url: string };
      setImageUrl(data.url);
      setCredits((value) => value - 1);
    } catch {
      setError("failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto grid w-full max-w-6xl gap-8 px-6 py-8 lg:grid-cols-[260px_1fr_1fr]">
      <section className="flex flex-col gap-6">
        <OptionGroup
          title={dict.studio.imageType}
          items={imageTypes}
          value={imageTypeId}
          locale={locale}
          onChange={setImageTypeId}
        />
        <OptionGroup
          title={dict.studio.ratio}
          items={ratios}
          value={ratioId}
          locale={locale}
          onChange={setRatioId}
        />
        <OptionGroup
          title={dict.studio.style}
          items={styles}
          value={styleId}
          locale={locale}
          onChange={setStyleId}
        />
        <OptionGroup
          title={dict.studio.scene}
          items={scenes}
          value={sceneId}
          locale={locale}
          onChange={setSceneId}
        />
        <OptionGroup
          title={dict.studio.whitespace}
          items={whitespaces}
          value={whitespaceId}
          locale={locale}
          onChange={setWhitespaceId}
        />
      </section>

      <section className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm">
          {dict.studio.subject}
          <Textarea
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            placeholder={dict.studio.subjectPlaceholder}
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          {dict.studio.notes}
          <Textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder={dict.studio.notesPlaceholder}
          />
        </label>

        <Button onClick={submit} disabled={pending || subject.trim().length === 0}>
          {pending ? dict.studio.generating : dict.studio.submit}
        </Button>

        {error === "failed" ? (
          <p className="text-sm text-destructive">{dict.studio.failed}</p>
        ) : null}

        <p className="text-sm tabular-nums text-muted-foreground">
          {dict.nav.credits}: {credits}
        </p>
      </section>

      <section className="flex min-h-[360px] items-center justify-center rounded-lg border bg-muted/30 p-4">
        {pending ? (
          <p className="text-sm text-muted-foreground">{dict.studio.generating}</p>
        ) : imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={subject}
            className="max-h-[520px] w-auto rounded-md"
          />
        ) : (
          <p className="max-w-xs text-center text-sm text-muted-foreground">
            {dict.studio.subjectPlaceholder}
          </p>
        )}
      </section>

      <UpgradeDialog
        open={upgrade}
        onOpenChange={setUpgrade}
        locale={locale}
        dict={dict}
        credits={credits}
      />
    </main>
  );
}