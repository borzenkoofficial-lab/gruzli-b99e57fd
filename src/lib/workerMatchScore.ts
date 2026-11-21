type MatchProfile = {
  rating?: number | null;
  completed_orders?: number | null;
  skills?: string[] | null;
  verified?: boolean | null;
  last_seen_at?: string | null;
} | null | undefined;

type MatchJob = { title?: string | null; description?: string | null };

const STOP_WORDS = new Set([
  "для", "при", "после", "перед", "нужно", "нужны", "работа", "работы",
  "заказ", "объект", "смена", "человек", "человека", "час", "часа", "часов",
  "руб", "рублей", "оплата", "оплатой", "срочно",
]);

function tokens(value: string): string[] {
  return value.toLocaleLowerCase("ru-RU").replace(/ё/g, "е").match(/[a-zа-я0-9]{3,}/gi) ?? [];
}

/** Explainable 0–100 fit score. Premium status is intentionally excluded. */
export function getWorkerMatchScore(profile: MatchProfile, job: MatchJob): number {
  if (!profile) return 0;
  const rating = Math.max(0, Math.min(5, Number(profile.rating) || 0));
  const experience = Math.max(0, Math.min(100, Number(profile.completed_orders) || 0));
  const jobTokens = [...new Set(tokens((job.title || "") + " " + (job.description || "")))].filter((token) => !STOP_WORDS.has(token));
  const skillTokens = [...new Set((profile.skills || []).flatMap(tokens))];
  const matchedSkills = jobTokens.filter((token) => skillTokens.some((skill) => skill === token || skill.includes(token) || token.includes(skill)));
  const skillFit = jobTokens.length > 0 ? matchedSkills.length / jobTokens.length : 0;
  const lastSeen = profile.last_seen_at ? new Date(profile.last_seen_at).getTime() : NaN;
  const ageMs = Date.now() - lastSeen;
  const recentlyActive = Number.isFinite(lastSeen) && ageMs >= 0 && ageMs <= 24 * 60 * 60 * 1000;
  return Math.round((rating / 5) * 40 + (experience / 100) * 20 + skillFit * 25 + (profile.verified ? 10 : 0) + (recentlyActive ? 5 : 0));
}
