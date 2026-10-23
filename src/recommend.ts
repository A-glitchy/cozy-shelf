import type { Book, Session } from "./types";
import { moodById } from "./catalogue";

export interface Rec { book: Book; score: number; reasons: string[] }
const jaccard = (a: string[], b: string[]) => { const A = new Set(a), B = new Set(b); const i = [...A].filter(x => B.has(x)).length; const u = new Set([...A, ...B]).size; return u ? i / u : 0; };
const shared = (a: string[], b: string[]) => a.filter(x => b.includes(x));

/** Scores shared moods, genres, subgenres and author, plus a small boost from how you rated books with those moods. */
export function recommend(base: Book, candidates: Book[], sessions: Session[], lookup: (id: string) => Book | undefined, limit = 5): Rec[] {
  const taken = new Set(sessions.filter(s => ["read", "dnf", "reading"].includes(s.status)).map(s => s.bookRef));
  const aff = new Map<string, { sum: number; n: number }>();
  for (const s of sessions) {
    if (s.status !== "read" || !s.rating) continue;
    for (const m of lookup(s.bookRef)?.moods ?? []) { const a = aff.get(m) ?? { sum: 0, n: 0 }; a.sum += s.rating; a.n++; aff.set(m, a); }
  }
  const out: Rec[] = [];
  for (const c of candidates) {
    if (c.id === base.id || taken.has(c.id)) continue;
    const sm = shared(base.moods, c.moods), sg = shared(base.genres, c.genres), ss = shared(base.subgenres, c.subgenres);
    const sameAuthor = shared(base.authors.map(a => a.toLowerCase()), c.authors.map(a => a.toLowerCase())).length > 0;
    const loved = sm.filter(m => { const a = aff.get(m); return a && a.n >= 2 && a.sum / a.n >= 4; });
    let score = 3 * jaccard(base.moods, c.moods) + 2 * jaccard(base.genres, c.genres) + 1.5 * jaccard(base.subgenres, c.subgenres) + (sameAuthor ? 1 : 0);
    const rated = c.moods.map(m => aff.get(m)).filter((a): a is { sum: number; n: number } => !!a && a.n >= 2);
    if (rated.length) score += Math.max(-0.5, Math.min(0.5, ((rated.reduce((t, a) => t + a.sum / a.n, 0) / rated.length) - 3) / 4));
    if (!sm.length && !sg.length && !ss.length && !sameAuthor) continue;
    const reasons: string[] = [];
    if (sm.length) reasons.push(`Shares moods: ${sm.map(m => moodById(m)?.label ?? m).join(", ")}`);
    if (sg.length) reasons.push(`Same genre: ${sg.join(", ")}`);
    if (ss.length) reasons.push(`Similar style: ${ss.join(", ")}`);
    if (sameAuthor) reasons.push("Same author");
    for (const m of loved) { const a = aff.get(m)!; reasons.push(`You rate ${moodById(m)?.label ?? m} books highly (average ${(a.sum / a.n).toFixed(1)} from ${a.n})`); }
    out.push({ book: c, score, reasons });
  }
  return out.sort((a, b) => b.score - a.score || a.book.title.localeCompare(b.book.title)).slice(0, limit);
}
