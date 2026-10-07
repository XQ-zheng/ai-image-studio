import { describe, expect, it } from "vitest";
import { placeholderPng } from "./generate-image";

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