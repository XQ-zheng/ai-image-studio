import OpenAI from "openai";

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}

export async function generateImage(params: {
  prompt: string;
  size: string;
  quality: string;
}): Promise<Buffer> {
  const response = await getClient().images.generate({
    model: "gpt-image-1",
    prompt: params.prompt,
    size: params.size as "1024x1024" | "1536x1024" | "1024x1536",
    quality: params.quality as "low" | "medium" | "high" | "auto",
    n: 1,
  });

  const base64 = response.data?.[0]?.b64_json;
  if (!base64) {
    throw new Error("模型未返回图片数据");
  }

  return Buffer.from(base64, "base64");
}