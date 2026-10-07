export type OptionItem = {
  id: string;
  labelZh: string;
  labelEn: string;
  fragment: string;
};

export type RatioItem = OptionItem & { size: string };

export const imageTypes: OptionItem[] = [
  { id: "photo", labelZh: "照片写实", labelEn: "Photo", fragment: "a photorealistic image" },
  { id: "illustration", labelZh: "插画", labelEn: "Illustration", fragment: "a hand-drawn illustration" },
  { id: "render3d", labelZh: "3D 渲染", labelEn: "3D render", fragment: "a 3D rendered scene" },
  { id: "flat", labelZh: "扁平矢量", labelEn: "Flat vector", fragment: "a flat vector graphic" },
  { id: "watercolor", labelZh: "水彩", labelEn: "Watercolor", fragment: "a watercolor painting" },
];

export const ratios: RatioItem[] = [
  { id: "square", labelZh: "方图", labelEn: "Square", fragment: "square composition", size: "1024x1024" },
  { id: "landscape", labelZh: "横图", labelEn: "Landscape", fragment: "landscape composition", size: "1536x1024" },
  { id: "portrait", labelZh: "竖图", labelEn: "Portrait", fragment: "portrait composition", size: "1024x1536" },
];

export const styles: OptionItem[] = [
  { id: "minimal", labelZh: "简约现代", labelEn: "Minimal modern", fragment: "a clean minimal modern aesthetic" },
  { id: "business", labelZh: "商务专业", labelEn: "Business", fragment: "a polished professional business aesthetic" },
  { id: "warm", labelZh: "温暖治愈", labelEn: "Warm and cozy", fragment: "a warm and comforting mood" },
  { id: "tech", labelZh: "科技感", labelEn: "Tech", fragment: "a futuristic technology mood" },
  { id: "retro", labelZh: "复古胶片", labelEn: "Retro film", fragment: "a retro film photography look" },
];

export const scenes: OptionItem[] = [
  { id: "solid", labelZh: "纯色背景", labelEn: "Solid background", fragment: "on a plain solid color background" },
  { id: "indoor", labelZh: "室内", labelEn: "Indoor", fragment: "in a realistic indoor setting" },
  { id: "nature", labelZh: "自然环境", labelEn: "Nature", fragment: "in a natural outdoor setting" },
  { id: "city", labelZh: "城市街景", labelEn: "City", fragment: "in an urban street setting" },
  { id: "abstract", labelZh: "抽象空间", labelEn: "Abstract", fragment: "in an abstract spatial environment" },
];

export const whitespaces: OptionItem[] = [
  { id: "none", labelZh: "无留白满构图", labelEn: "Full bleed", fragment: "fill the entire frame with no empty space" },
  { id: "even", labelZh: "四周均匀留白", labelEn: "Even margin", fragment: "leave an even margin of empty space around the subject" },
  { id: "top", labelZh: "顶部留白留标题位", labelEn: "Top space", fragment: "leave clean empty space along the top of the frame for a title" },
  { id: "wide", labelZh: "大面积负空间", labelEn: "Negative space", fragment: "use generous negative space around the subject" },
];