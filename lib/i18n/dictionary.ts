export const locales = ["zh", "en"] as const;
export type Locale = (typeof locales)[number];

const zh = {
  nav: {
    studio: "生图",
    history: "历史",
    credits: "积分",
    upgrade: "升级",
    login: "登录",
    logout: "退出",
  },
  home: {
    title: "把选项拼成专业提示词",
    subtitle: "选好类型、比例、风格、场景与留白，写下你的主体，剩下的交给系统。",
    cta: "开始生成",
    samples: "作品示例",
  },
  studio: {
    title: "生成图片",
    imageType: "图片类型",
    ratio: "比例",
    style: "风格",
    scene: "场景",
    whitespace: "留白",
    subject: "主体",
    subjectPlaceholder: "例如：一只戴着圆眼镜的橘猫",
    notes: "补充要求",
    notesPlaceholder: "可选，例如：背景要干净",
    submit: "生成",
    generating: "正在生成，请稍候",
    failed: "这次生成失败了，积分已经退回",
  },
  history: {
    title: "生成历史",
    empty: "还没有生成记录",
    emptyCta: "去生成一张",
    detail: "详情",
    prompt: "使用的提示词",
    options: "参数",
    failed: "生成失败",
  },
  login: {
    title: "登录或注册",
    email: "邮箱",
    password: "密码",
    signIn: "登录",
    signUp: "注册",
    toSignUp: "还没有账号？去注册",
    toSignIn: "已有账号？去登录",
    invalidInput: "请填写邮箱和至少 6 位密码",
  },
  upgrade: {
    title: "积分不足",
    description: "每次生成消耗 1 积分。升级入口即将开放。",
    current: "当前积分",
    required: "本次需要",
    close: "知道了",
    comingSoon: "即将开放",
  },
};

export type Dictionary = typeof zh;

const en: Dictionary = {
  nav: {
    studio: "Create",
    history: "History",
    credits: "Credits",
    upgrade: "Upgrade",
    login: "Sign in",
    logout: "Sign out",
  },
  home: {
    title: "Turn choices into a professional prompt",
    subtitle: "Pick a type, ratio, style, scene and whitespace, describe your subject, and let the system do the rest.",
    cta: "Start creating",
    samples: "Samples",
  },
  studio: {
    title: "Generate an image",
    imageType: "Image type",
    ratio: "Ratio",
    style: "Style",
    scene: "Scene",
    whitespace: "Whitespace",
    subject: "Subject",
    subjectPlaceholder: "e.g. an orange cat wearing round glasses",
    notes: "Extra requirements",
    notesPlaceholder: "optional, e.g. keep the background clean",
    submit: "Generate",
    generating: "Generating, please wait",
    failed: "This run failed and the credit was refunded",
  },
  history: {
    title: "History",
    empty: "No generations yet",
    emptyCta: "Create your first image",
    detail: "Details",
    prompt: "Prompt used",
    options: "Options",
    failed: "Failed",
  },
  login: {
    title: "Sign in or sign up",
    email: "Email",
    password: "Password",
    signIn: "Sign in",
    signUp: "Sign up",
    toSignUp: "No account yet? Sign up",
    toSignIn: "Already have an account? Sign in",
    invalidInput: "Enter an email and a password of at least 6 characters",
  },
  upgrade: {
    title: "Not enough credits",
    description: "Each generation costs 1 credit. Upgrades are coming soon.",
    current: "Current credits",
    required: "Required",
    close: "Got it",
    comingSoon: "Coming soon",
  },
};

export const dictionary: Record<Locale, Dictionary> = { zh, en };

export function getDictionary(locale: Locale): Dictionary {
  return dictionary[locale];
}