import type { Book, Session, Status } from "./types";
import type { Season } from "./seasons";
import { reportedWarnings } from "./warnings";

export const SEASON_MOODS: Record<Season, string[]> = {
  autumn: ["cozy", "spooky", "atmospheric", "dark-unsettling", "nostalgic", "suspenseful"],
  winter: ["comforting", "cozy", "heartbreaking", "nostalgic", "whimsical", "dreamy"],
  spring: ["hopeful", "romantic", "whimsical", "dreamy", "funny"],
  summer: ["adventurous", "funny", "romantic", "hopeful"],
};
const hash = (s: string) => { // FNV-1a with a final mix, so a different seed really reshuffles
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 16; h = Math.imul(h, 2246822507); h ^= h >>> 13; h = Math.imul(h, 3266489909); h ^= h >>> 16;
  return h >>> 0;
};
export interface Suggestion { book: Book; why: string[] }

/** Season-fitting books you have not read. Books on your want-to-read list rank first; "refresh" reshuffles ties. */
export function suggest(o: { season: Season; books: Book[]; sessions: Session[]; excluded: string[]; removed?: string[]; skip: Set<string>; seed: number; limit: number }): Suggestion[] {
  const latest = new Map<string, Status>();
  [...o.sessions].sort((a, b) => a.updatedAt.localeCompare(b.updatedAt)).forEach(s => latest.set(s.bookRef, s.status));
  const moods = new Set(SEASON_MOODS[o.season]);
  const out: (Suggestion & { score: number })[] = [];
  for (const b of o.books) {
    if (o.skip.has(b.id)) continue;
    const st = latest.get(b.id);
    if (st === "read" || st === "dnf" || st === "reading") continue;
    if (b.genres.some(g => g === "nonfiction" || g === "poetry")) continue;
    if (reportedWarnings(b, o.removed ?? []).some(w => o.excluded.includes(w.category))) continue; // never suggest books with warnings you excluded
    const match = b.moods.filter(m => moods.has(m));
    const want = st === "want";
    if (!match.length && !want) continue;
    const score = match.length + (want ? 5 : 0) + ((hash(b.id + ":" + o.seed) % 100) / 100) * 3;
    const why = [...(match.length ? [`Fits ${o.season}: ${match.join(", ")}`] : []), ...(want ? ["On your want-to-read list"] : [])];
    out.push({ book: b, why, score });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, o.limit).map(({ book, why }) => ({ book, why }));
}
