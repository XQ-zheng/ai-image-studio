import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const STUCK_AFTER_MS = 3 * 60 * 1000;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization");

  if (!secret || header !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminSupabase();
  const cutoff = new Date(Date.now() - STUCK_AFTER_MS).toISOString();

  const { data: stuck, error } = await admin
    .from("generations")
    .select("id")
    .eq("status", "processing")
    .lt("created_at", cutoff);

  if (error) {
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }

  let refunded = 0;
  for (const row of stuck ?? []) {
    const { data } = await admin.rpc("refund_credit", {
      p_generation_id: row.id,
    });
    if (data === true) {
      refunded += 1;
    }
  }

  return NextResponse.json({ checked: stuck?.length ?? 0, refunded });
}