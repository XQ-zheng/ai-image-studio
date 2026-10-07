import { deflateSync } from "node:zlib";
import OpenAI from "openai";

export type ImageProvider = "openai" | "ark";

export type ImageConfig = {
  provider: ImageProvider;
  baseURL: string;
  apiKey: string;
  model: string;
};

export const OPENAI_DEFAULT_MODEL = "gpt-image-1";
export const ARK_DEFAULT_MODEL = "doubao-seedream-5-0-pro-260628";

// 火山方舟不接受我们内部的画幅尺寸，按它支持的档位换算。
const ARK_SIZE: Record<string, string> = {
  "1024x1024": "1024x1024",
  "1536x1024": "1152x864",
  "1024x1536": "864x1152",
};

export function resolveImageConfig(): ImageConfig {
  const provider = (process.env.IMAGE_PROVIDER ?? "openai").trim().toLowerCase();

  if (provider === "ark") {
    return {
      provider: "ark",
      baseURL:
        process.env.ARK_BASE_URL ?? "https://ark.cn-beijing.volces.com/api/v3",
      apiKey: process.env.ARK_API_KEY ?? "",
      model: process.env.ARK_IMAGE_MODEL ?? ARK_DEFAULT_MODEL,
    };
  }

  return {
    provider: "openai",
    baseURL: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
    apiKey: process.env.OPENAI_API_KEY ?? "",
    model: process.env.OPENAI_IMAGE_MODEL ?? OPENAI_DEFAULT_MODEL,
  };
}

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

function crc32(buffer: Buffer): number {
  let c = -1;
  for (let i = 0; i < buffer.length; i += 1) {
    c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ -1) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeBuffer = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, crc]);
}

// 开发环境没有配置任何生图密钥时使用的占位图，用来验证积分与历史链路。
export function placeholderPng(size: string): Buffer {
  const [width, height] = size.split("x").map(Number);
  const raw = Buffer.alloc((width * 3 + 1) * height);

  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (width * 3 + 1);
    raw[rowStart] = 0;
    for (let x = 0; x < width; x += 1) {
      const i = rowStart + 1 + x * 3;
      raw[i] = 38 + Math.floor((x / width) * 90);
      raw[i + 1] = 46 + Math.floor((y / height) * 60);
      raw[i + 2] = 92 + Math.floor(((x + y) / (width + height)) * 80);
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

async function downloadImage(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`下载模型返回的图片失败: ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

type ImageResponseItem = { url?: string; b64_json?: string };

function pickImageData(payload: unknown): ImageResponseItem | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const data = (payload as { data?: unknown }).data;
  if (!Array.isArray(data) || data.length === 0) {
    return null;
  }

  return data[0] as ImageResponseItem;
}

async function generateWithArk(
  config: ImageConfig,
  params: { prompt: string; size: string },
): Promise<Buffer> {
  const response = await fetch(`${config.baseURL}/images/generations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      prompt: params.prompt,
      size: ARK_SIZE[params.size] ?? "1024x1024",
      response_format: "url",
      output_format: "png",
      watermark: false,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`方舟生图失败: ${response.status} ${detail.slice(0, 300)}`);
  }

  const item = pickImageData(await response.json());
  if (!item) {
    throw new Error("模型未返回图片数据");
  }
  if (item.url) {
    return downloadImage(item.url);
  }
  if (item.b64_json) {
    return Buffer.from(item.b64_json, "base64");
  }

  throw new Error("模型未返回图片数据");
}

async function generateWithOpenAI(
  config: ImageConfig,
  params: { prompt: string; size: string; quality: string },
): Promise<Buffer> {
  const client = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseURL });

  const response = await client.images.generate({
    model: config.model,
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

export async function generateImage(params: {
  prompt: string;
  size: string;
  quality: string;
}): Promise<Buffer> {
  const config = resolveImageConfig();

  if (!config.apiKey) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(`缺少 ${config.provider} 的生图密钥，无法生成图片`);
    }
    console.warn(
      `[dev] 没有配置 ${config.provider} 的生图密钥，本次返回占位图，不会调用模型`,
    );
    return placeholderPng(params.size);
  }

  if (config.provider === "ark") {
    return generateWithArk(config, params);
  }

  return generateWithOpenAI(config, params);
}