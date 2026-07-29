import { Package, Wrench, HardHat, Sparkles } from "lucide-react";

export type CategoryKey = "movers" | "handyman" | "specialist" | "other";

export interface CategoryDef {
  key: CategoryKey;
  label: string;
  short: string;
  emoji: string;
  icon: typeof Package;
  gradient: string;
  ring: string;
  tint: string;
  keywords: RegExp;
  description: string;
}

export const CATEGORIES: CategoryDef[] = [
  {
    key: "movers",
    label: "Грузчики",
    short: "Грузчики",
    emoji: "📦",
    icon: Package,
    gradient: "from-[hsl(215_85%_60%)] to-[hsl(230_75%_55%)]",
    ring: "hsl(220 80% 60% / 0.35)",
    tint: "hsl(220 80% 60% / 0.12)",
    keywords:
      /груз|переезд|погруз|разгруз|мебел|коробк|фур|такелаж|подъ[её]м|доставк|перенос|склад|фас[оа]вк|комплектов/i,
    description: "Переезды, погрузка, разгрузка, склад",
  },
  {
    key: "handyman",
    label: "Разнорабочие",
    short: "Разнорабочие",
    emoji: "🧰",
    icon: HardHat,
    gradient: "from-[hsl(38_95%_58%)] to-[hsl(22_92%_55%)]",
    ring: "hsl(35 90% 55% / 0.35)",
    tint: "hsl(35 90% 55% / 0.12)",
    keywords:
      /разнораб|уборк|мусор|демонтаж|копать|стройк|подсоб|снос|вынос|земл[яе]|бетон|штукатур|кровл|двор/i,
    description: "Стройка, уборка, демонтаж, подсобные работы",
  },
  {
    key: "specialist",
    label: "Специалисты",
    short: "Спецы",
    emoji: "🛠️",
    icon: Wrench,
    gradient: "from-[hsl(160_75%_45%)] to-[hsl(180_70%_42%)]",
    ring: "hsl(165 75% 45% / 0.35)",
    tint: "hsl(165 75% 45% / 0.12)",
    keywords:
      /сборщик|сборк|электрик|сантехн|монтаж|ремонт|мастер|водител|сварщ|плотник|маляр|отделочн|прораб|бригадир|техник/i,
    description: "Сборка, электрика, сантехника, монтаж, ремонт",
  },
  {
    key: "other",
    label: "Другое",
    short: "Другое",
    emoji: "✨",
    icon: Sparkles,
    gradient: "from-[hsl(280_70%_58%)] to-[hsl(320_65%_55%)]",
    ring: "hsl(290 65% 58% / 0.35)",
    tint: "hsl(290 65% 58% / 0.12)",
    keywords: /.*/,
    description: "Прочие вакансии и подработки",
  },
];

export function getCategory(key: CategoryKey): CategoryDef {
  return CATEGORIES.find((c) => c.key === key) || CATEGORIES[CATEGORIES.length - 1];
}

export function classifyJob(job: {
  title?: string | null;
  description?: string | null;
}): CategoryKey {
  const text = `${job.title || ""} ${job.description || ""}`;
  for (const c of CATEGORIES) {
    if (c.key === "other") continue;
    if (c.keywords.test(text)) return c.key;
  }
  return "other";
}

const STORAGE_KEY = "gruzli:job-categories:v1";

export function loadSubscribedCategories(): CategoryKey[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return null;
    const valid = arr.filter((k): k is CategoryKey =>
      CATEGORIES.some((c) => c.key === k)
    );
    return valid.length > 0 ? valid : null;
  } catch {
    return null;
  }
}

export function saveSubscribedCategories(cats: CategoryKey[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cats));
  } catch {
    /* ignore */
  }
}
