import { describe, expect, it } from "vitest";
import { buildPrompt } from "./build";
import type { PromptInput } from "./build";

const base: PromptInput = {
  imageTypeId: "photo",
  ratioId: "square",
  styleId: "minimal",
  sceneId: "solid",
  whitespaceId: "none",
  subject: "一只戴着圆眼镜的橘猫",
  notes: "",
};

describe("buildPrompt", () => {
  it("把选项与主体拼成完整句子", () => {
    const { prompt } = buildPrompt(base);
    expect(prompt).toContain("Create a photorealistic image.");
    expect(prompt).toContain("一只戴着圆眼镜的橘猫");
    expect(prompt).toContain("square composition at 1024x1024");
  });

  it("同一组输入产出完全一致的提示词", () => {
    expect(buildPrompt(base).prompt).toBe(buildPrompt(base).prompt);
  });

  it("补充要求为空时不出现多余句子", () => {
    expect(buildPrompt(base).prompt).not.toContain("Additional requirements");
  });

  it("补充要求非空时会被拼接", () => {
    const { prompt } = buildPrompt({ ...base, notes: "背景要干净" });
    expect(prompt).toContain("Additional requirements: 背景要干净.");
  });

  it("非法选项 id 会抛错", () => {
    expect(() => buildPrompt({ ...base, ratioId: "16:9" })).toThrow(/未知的比例选项/);
  });

  it("主体为空会抛错", () => {
    expect(() => buildPrompt({ ...base, subject: "   " })).toThrow(/主体不能为空/);
  });

  it("比例决定实际请求的尺寸", () => {
    expect(buildPrompt({ ...base, ratioId: "portrait" }).size).toBe("1024x1536");
  });
});