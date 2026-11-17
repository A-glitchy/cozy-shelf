import type { Book, Mood } from "./types";
import { reportedWarnings, warnKey } from "./warnings";
import moodsJson from "../data/moods.json";
import catsJson from "../data/warning-categories.json";

const shards = import.meta.glob("../data/books-*.json", { eager: true, import: "default" });
export const books: Book[] = Object.values(shards).flat() as Book[];
export const moods = moodsJson as Mood[];
export const warningCategories = catsJson as string[];
export const moodById = (id: string) => moods.find(m => m.id === id);
export const catLabel = (c: string) => c.replace(/-/g, " ").replace(/^./, s => s.toUpperCase());

/** "unassessed" is never treated as safe. */
export function warningState(b: Book, cat: string, removed: readonly string[] = []): "present" | "absent" | "unassessed" {
  if (reportedWarnings(b, removed).some(x => x.category === cat)) return "present";
  const gone = new Set(removed);
  if (b.warnings.some(x => x.category === cat && x.presence === "absent") && !b.warnings.some(x => x.category === cat && x.presence === "present" && gone.has(warnKey(b.id, x)))) return "absent";
  return "unassessed";
}
export function pagesLabel(b: Book) {
  const p = b.pages.estimate;
  return p === null ? "Page count unknown" : `approx. ${p} pages`;
}

import type { CustomBook } from "./types";
export function customToBook(c: CustomBook): Book {
  return {
    id: c.id, title: c.title, authors: c.authors.length ? c.authors : ["Unknown"], summary: c.summary ?? "Added by you.",
    pages: { estimate: c.pages, confidence: c.pages ? "high" : "unknown", source: "Entered by you" },
    genres: c.genres, subgenres: [], moods: c.moods, warnings: [], warningsReviewed: "none", sources: [], cover: null,
    research: { status: "personal", lastReviewed: c.createdAt.slice(0, 10) }, custom: true,
  };
}
