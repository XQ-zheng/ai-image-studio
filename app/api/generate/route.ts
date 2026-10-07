import { NextResponse } from "next/server";
import { assertServerEnv } from "@/lib/env";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { buildPrompt, type PromptInput } from "@/lib/prompt/build";
import { generateImage } from "@/lib/image/generate-image";
import {
  createSignedImageUrl,
  uploadGenerationImage,
} from "@/lib/storage/upload";

export const maxDuration = 60;

const IN_PROGRESS_WINDOW_MS = 3 * 60 * 1000;

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function parseInput(body: unknown): PromptInput {
  const raw = (body ?? {}) as Record<string, unknown>;
  return {
    imageTypeId: readString(raw.imageTypeId),
    ratioId: readString(raw.ratioId),
    styleId: readString(raw.styleId),
    sceneId: readString(raw.sceneId),
    whitespaceId: readString(raw.whitespaceId),
    subject: readString(raw.subject),
    notes: readString(raw.notes),
  };
}

export async function POST(request: Request) {
  assertServerEnv();

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let input: PromptInput;
  try {
    input = parseInput(await request.json());
  } catch {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  let built;
  try {
    built = buildPrompt(input);
  } catch (error) {
    return NextResponse.json(
      {
        error: "invalid_options",
        detail: error instanceof Error ? error.message : "unknown",
      },
      { status: 400 },
    );
  }

  const admin = createAdminSupabase();

  const since = new Date(Date.now() - IN_PROGRESS_WINDOW_MS).toISOString();
  const { data: pending } = await admin
    .from("generations")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "processing")
    .gte("created_at", since)
    .limit(1)
    .maybeSingle();

  if (pending) {
    return NextResponse.json({ error: "in_progress" }, { status: 409 });
  }

  const { data: generationId, error: startError } = await admin.rpc(
    "start_generation",
    {
      p_user_id: user.id,
      p_prompt: built.prompt,
      p_options: input,
      p_subject: input.subject,
      p_notes: input.notes,
      p_size: built.size,
      p_quality: built.quality,
    },
  );

  if (startError) {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }

  if (!generationId) {
    return NextResponse.json({ error: "insufficient_credits" }, { status: 402 });
  }

  try {
    const image = await generateImage({
      prompt: built.prompt,
      size: built.size,
      quality: built.quality,
    });

    const path = await uploadGenerationImage(user.id, image);

    const { error: updateError } = await admin
      .from("generations")
      .update({
        status: "succeeded",
        storage_path: path,
        updated_at: new Date().toISOString(),
      })
      .eq("id", generationId);

    if (updateError) {
      throw new Error(updateError.message);
    }

    const url = await createSignedImageUrl(path);
    return NextResponse.json({ generationId, url });
  } catch (error) {
    await admin.rpc("refund_credit", { p_generation_id: generationId });
    await admin
      .from("generations")
      .update({ error: error instanceof Error ? error.message : "unknown" })
      .eq("id", generationId);

    return NextResponse.json({ error: "generation_failed" }, { status: 502 });
  }
}