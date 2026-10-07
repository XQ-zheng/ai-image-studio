import { deflateSync } from "node:zlib";
import OpenAI from "openai";

export const IMAGE_MODEL = "gpt-image-1";

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
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

// 开发环境缺少 OPENAI_API_KEY 时使用的占位图，用来验证积分与历史链路。
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

export async function generateImage(params: {
  prompt: string;
  size: string;
  quality: string;
}): Promise<Buffer> {
  if (!process.env.OPENAI_API_KEY) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("缺少 OPENAI_API_KEY，无法调用生图接口");
    }
    console.warn("[dev] 没有 OPENAI_API_KEY，本次返回占位图，不会调用模型");
    return placeholderPng(params.size);
  }

  const response = await getClient().images.generate({
    model: IMAGE_MODEL,
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