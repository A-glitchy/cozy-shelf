import { useSyncExternalStore } from "react";
import type { Book, Mood } from "./types";
import { reportedWarnings, warnKey, exclusionHit, exclusionLabel } from "./warnings";
import moodsJson from "../data/moods.json";
import catsJson from "../data/warning-categories.json";

const shards = import.meta.glob("../data/books-*.json", { eager: true, import: "default" });
/** The built-in catalogue shipped with the site. */
export const baselineBooks: Book[] = Object.values(shards).flat() as Book[];
// The master Google Sheet (Books, Trigger Warnings, Sources, Research Status) can replace books by id. It is cached on this device.
let merged: Book[] = baselineBooks;
let version = 0;
const listeners = new Set<() => void>();
export const getBooks = () => merged;
export function setMasterOverlay(overlay: Book[] | null) {
  if (!overlay || !overlay.length) merged = baselineBooks;
  else {
    const m = new Map(overlay.map(b => [b.id, b]));
    merged = [...baselineBooks.map(b => m.get(b.id) ?? b), ...overlay.filter(b => !baselineBooks.some(x => x.id === b.id))];
  }
  version++; listeners.forEach(l => l());
}
export const useBooks = () => useSyncExternalStore(l => { listeners.add(l); return () => { listeners.delete(l); }; }, getBooks);
export const moods = moodsJson as Mood[];
export const warningCategories = catsJson as string[];
export const moodById = (id: string) => moods.find(m => m.id === id);
export const catLabel = (c: string) => (c.includes(":") ? exclusionLabel(c) : c.replace(/-/g, " ").replace(/^./, s => s.toUpperCase()));

/** "unassessed" is never treated as safe. */
export function warningState(b: Book, cat: string, removed: readonly string[] = []): "present" | "absent" | "unassessed" {
  if (reportedWarnings(b, removed).some(x => exclusionHit(x, cat))) return "present";
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
