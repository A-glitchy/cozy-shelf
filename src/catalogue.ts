import type { Book, Mood } from "./types";
import moodsJson from "../data/moods.json";
import catsJson from "../data/warning-categories.json";

const shards = import.meta.glob("../data/books-*.json", { eager: true, import: "default" });
export const books: Book[] = Object.values(shards).flat() as Book[];
export const moods = moodsJson as Mood[];
export const warningCategories = catsJson as string[];
export const moodById = (id: string) => moods.find(m => m.id === id);
export const catLabel = (c: string) => c.replace(/-/g, " ").replace(/^./, s => s.toUpperCase());

/** "unassessed" is never treated as safe. */
export function warningState(b: Book, cat: string): "present" | "absent" | "unassessed" {
  const w = b.warnings.filter(x => x.category === cat);
  if (w.some(x => x.presence === "present")) return "present";
  if (w.some(x => x.presence === "absent")) return "absent";
  return "unassessed";
}
export function pagesLabel(b: Book) {
  const p = b.pages.estimate;
  return p === null ? "Page count unknown" : `approx. ${p} pages`;
}
export const verLabel: Record<string, string> = {
  verified: "Verified", "unverified-research": "Unverified research",
  "community-report": "Community report", disputed: "Disputed",
};
