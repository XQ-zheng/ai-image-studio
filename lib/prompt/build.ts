import {
  imageTypes,
  ratios,
  scenes,
  styles,
  whitespaces,
  type OptionItem,
} from "./catalog";

export const QUALITY = "medium";

const MAX_SUBJECT_LENGTH = 300;
const MAX_NOTES_LENGTH = 300;

export type PromptInput = {
  imageTypeId: string;
  ratioId: string;
  styleId: string;
  sceneId: string;
  whitespaceId: string;
  subject: string;
  notes: string;
};

export type BuiltPrompt = {
  prompt: string;
  size: string;
  quality: string;
  options: PromptInput;
};

function pick<T extends OptionItem>(list: T[], id: string, group: string): T {
  const found = list.find((item) => item.id === id);
  if (!found) {
    throw new Error(`未知的${group}选项: ${id}`);
  }
  return found;
}

function clean(text: string, limit: number): string {
  return text.trim().replace(/\s+/g, " ").slice(0, limit);
}

export function buildPrompt(input: PromptInput): BuiltPrompt {
  const imageType = pick(imageTypes, input.imageTypeId, "图片类型");
  const ratio = pick(ratios, input.ratioId, "比例");
  const style = pick(styles, input.styleId, "风格");
  const scene = pick(scenes, input.sceneId, "场景");
  const whitespace = pick(whitespaces, input.whitespaceId, "留白");

  const subject = clean(input.subject, MAX_SUBJECT_LENGTH);
  if (!subject) {
    throw new Error("主体不能为空");
  }
  const notes = clean(input.notes, MAX_NOTES_LENGTH);

  const sentences = [
    `Create ${imageType.fragment}.`,
    `The subject is: ${subject}.`,
    `Render it in ${style.fragment}.`,
    `Place the subject ${scene.fragment}.`,
    `For composition, ${whitespace.fragment}.`,
    `Use a ${ratio.fragment} at ${ratio.size}.`,
  ];

  if (notes) {
    sentences.push(`Additional requirements: ${notes}.`);
  }

  return {
    prompt: sentences.join(" "),
    size: ratio.size,
    quality: QUALITY,
    options: input,
  };
}