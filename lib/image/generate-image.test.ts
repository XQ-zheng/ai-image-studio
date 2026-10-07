import { afterEach, describe, expect, it } from "vitest";
import { ARK_DEFAULT_MODEL, OPENAI_DEFAULT_MODEL, generateImage, placeholderPng, resolveImageConfig } from "./generate-image";

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

describe("placeholderPng", () => {
  it("产出带 PNG 文件头的图片", () => {
    const png = placeholderPng("256x256");
    expect([...png.subarray(0, 8)]).toEqual(SIGNATURE);
  });

  it("尺寸与请求一致", () => {
    const png = placeholderPng("1536x1024");
    expect(png.readUInt32BE(16)).toBe(1536);
    expect(png.readUInt32BE(20)).toBe(1024);
  });

  it("以 IEND 结尾", () => {
    const png = placeholderPng("128x128");
    expect(png.subarray(-8, -4).toString("ascii")).toBe("IEND");
  });

  it("竖图不会被当成横图处理", () => {
    const png = placeholderPng("1024x1536");
    expect(png.readUInt32BE(16)).toBe(1024);
    expect(png.readUInt32BE(20)).toBe(1536);
  });
});
const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("resolveImageConfig", () => {
  it("默认使用 OpenAI", () => {
    delete process.env.IMAGE_PROVIDER;
    const config = resolveImageConfig();
    expect(config.provider).toBe("openai");
    expect(config.model).toBe(OPENAI_DEFAULT_MODEL);
    expect(config.baseURL).toContain("api.openai.com");
  });

  it("IMAGE_PROVIDER 设为 ark 时切到方舟", () => {
    process.env.IMAGE_PROVIDER = "ark";
    const config = resolveImageConfig();
    expect(config.provider).toBe("ark");
    expect(config.model).toBe(ARK_DEFAULT_MODEL);
    expect(config.baseURL).toContain("volces.com");
  });

  it("方舟的模型名可以被环境变量覆盖", () => {
    process.env.IMAGE_PROVIDER = "ark";
    process.env.ARK_IMAGE_MODEL = "my-model";
    expect(resolveImageConfig().model).toBe("my-model");
  });

  it("方舟密钥缺省时回退到占位图", async () => {
    process.env.IMAGE_PROVIDER = "ark";
    delete process.env.ARK_API_KEY;
    const png = await generateImage({ prompt: "x", size: "1024x1024", quality: "medium" });
    expect([...png.subarray(0, 8)]).toEqual(SIGNATURE);
  });
});