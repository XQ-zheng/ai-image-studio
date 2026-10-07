import { createAdminSupabase } from "@/lib/supabase/admin";

const BUCKET = "generations";

export async function uploadGenerationImage(
  userId: string,
  data: Buffer,
): Promise<string> {
  const path = `${userId}/${crypto.randomUUID()}.png`;
  const admin = createAdminSupabase();

  const { error } = await admin.storage.from(BUCKET).upload(path, data, {
    contentType: "image/png",
    upsert: false,
  });

  if (error) {
    throw new Error(`图片上传失败: ${error.message}`);
  }

  return path;
}

export async function createSignedImageUrl(
  path: string,
  expiresInSeconds = 3600,
): Promise<string> {
  const admin = createAdminSupabase();
  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresInSeconds);

  if (error || !data) {
    throw new Error(`签名地址生成失败: ${error?.message ?? "unknown"}`);
  }

  return data.signedUrl;
}