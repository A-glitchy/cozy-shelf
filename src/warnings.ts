import type { Book, Warning } from "./types";

/** Stable identity of one reported trigger on one book. Removals are stored by this key, so they survive catalogue updates. */
export const warnKey = (bookId: string, w: Warning) => `${bookId}|${w.category}|${(w.name ?? w.subcategory ?? w.category).trim().toLowerCase()}`;
/** Only triggers that were actually reported are shown or used. "Not found" and "unsure" entries stay in the data but never count. */
export const isReported = (w: Warning) => w.presence === "present";
export function reportedWarnings(b: Book, removed: readonly string[]): Warning[] {
  const r = new Set(removed);
  return b.warnings.filter(w => isReported(w) && !r.has(warnKey(b.id, w)));
}
export function removedWarningsOf(b: Book, removed: readonly string[]): Warning[] {
  const r = new Set(removed);
  return b.warnings.filter(w => isReported(w) && r.has(warnKey(b.id, w)));
}

export const CATEGORY_LABEL: Record<string, string> = {
  "sexual-violence": "Sexual violence", abuse: "Abuse", "violence-gore": "Violence or gore", kidnapping: "Kidnapping", stalking: "Stalking",
  "suicide-self-harm": "Suicide or self-harm", "mental-health": "Mental health", "eating-disorders": "Eating disorders", addiction: "Addiction",
  "death-grief": "Death or grief", illness: "Illness", "pregnancy-loss": "Pregnancy loss", "animal-cruelty": "Animal cruelty or death",
  discrimination: "Discrimination", war: "War", infidelity: "Infidelity", other: "Other",
};
const ORDER = Object.keys(CATEGORY_LABEL);
export type Tone = "red" | "violet" | "sand";
export const toneOf = (cat: string): Tone =>
  ["sexual-violence", "abuse", "violence-gore", "kidnapping", "stalking"].includes(cat) ? "red"
  : ["suicide-self-harm", "mental-health", "eating-disorders", "addiction", "death-grief", "pregnancy-loss"].includes(cat) ? "violet" : "sand";

export function groupWarnings(ws: Warning[]): { category: string; label: string; items: Warning[] }[] {
  const m = new Map<string, Warning[]>();
  for (const w of ws) m.set(w.category, [...(m.get(w.category) ?? []), w]);
  return [...m.entries()]
    .sort((a, b) => ORDER.indexOf(a[0]) - ORDER.indexOf(b[0]))
    .map(([category, items]) => ({ category, label: CATEGORY_LABEL[category] ?? category, items: [...items].sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "")) }));
}
export const pillName = (w: Warning) => w.name ?? w.subcategory ?? CATEGORY_LABEL[w.category] ?? w.category;
export function describeWarning(w: Warning): string {
  const bits: string[] = [];
  if (w.note) bits.push(w.note);
  if (w.category === "sexual-violence" && w.subcategory) bits.push(`Details: ${w.subcategory}.`);
  return bits.join(" ") || `Reported for this book in the sources listed below.`;
}

export const ABUSE_SUBTYPES = ["Emotional abuse", "Physical abuse", "Sexual abuse", "Child abuse", "Domestic abuse", "Psychological abuse", "Verbal abuse", "Neglect", "Gaslighting", "Toxic relationship", "Abandonment", "Other / unspecified abuse"];
/** An exclusion is either a category id ("abuse") or a subtype key ("abuse:emotional abuse"). */
export const subtypeExclusionKey = (subtype: string) => `abuse:${subtype.trim().toLowerCase()}`;
export function exclusionHit(w: Warning, key: string): boolean {
  const i = key.indexOf(":");
  if (i < 0) return w.category === key;
  if (w.category !== key.slice(0, i)) return false;
  const sub = key.slice(i + 1);
  return (w.abuseSubtype ?? w.name ?? "").trim().toLowerCase() === sub;
}
export const exclusionLabel = (key: string) => {
  const i = key.indexOf(":");
  if (i < 0) return CATEGORY_LABEL[key] ?? key;
  const sub = key.slice(i + 1); return `${CATEGORY_LABEL[key.slice(0, i)] ?? key.slice(0, i)} – ${sub.charAt(0).toUpperCase() + sub.slice(1)}`;
};
export const DEPICTION_LABEL: Record<string, string> = { "on-page": "Shown on the page", "off-page": "Happens off the page", referenced: "Mentioned or referred to" };
export const cap1 = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
