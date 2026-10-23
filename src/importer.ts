import type { Book, Status, Session } from "./types";

export type Field = "title" | "author" | "status" | "startDate" | "finishDate" | "rating" | "pages" | "review" | "notes" | "tags" | "favorite";
export const FIELDS: { id: Field; label: string }[] = [
  { id: "title", label: "Title (required)" }, { id: "author", label: "Author" }, { id: "status", label: "Reading status" },
  { id: "startDate", label: "Start date" }, { id: "finishDate", label: "Finish date" }, { id: "rating", label: "Rating (0.5–5)" },
  { id: "pages", label: "Page count" }, { id: "review", label: "Review" }, { id: "notes", label: "Notes" },
  { id: "tags", label: "Tags / shelves" }, { id: "favorite", label: "Favorite" },
];
const ALIASES: Record<Field, string[]> = {
  title: ["title", "book title", "book", "name"], author: ["author", "authors", "author name"],
  status: ["status", "exclusive shelf", "shelf", "reading status", "read status"],
  startDate: ["start date", "started", "date started", "started on"],
  finishDate: ["finish date", "finished", "date read", "date finished", "read date", "finished on"],
  rating: ["rating", "my rating", "stars", "star rating"], pages: ["pages", "number of pages", "page count"],
  review: ["review", "my review"], notes: ["notes", "private notes", "my notes"],
  tags: ["tags", "bookshelves"], favorite: ["favorite", "favourite", "favorites"],
};
export const emptyMapping = (): Record<Field, number> => Object.fromEntries(FIELDS.map(f => [f.id, -1])) as Record<Field, number>;
const normHeader = (h: string) => h.toLowerCase().replace(/[_-]+/g, " ").trim();
export function autoMap(headers: string[]): Record<Field, number> {
  const m = emptyMapping(); const hs = headers.map(normHeader);
  for (const f of FIELDS) { const i = hs.findIndex(h => ALIASES[f.id].includes(h)); if (i >= 0) m[f.id] = i; }
  return m;
}

export function parseCsv(input: string): string[][] {
  const text = input.replace(/^\uFEFF/, "");
  const first = text.split(/\r?\n/)[0] ?? "";
  const count = (c: string) => first.split(c).length - 1;
  const best = [",", ";", "\t"].sort((a, b) => count(b) - count(a))[0];
  const d = count(best) > 0 ? best : ",";
  const rows: string[][] = []; let row: string[] = []; let field = ""; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; } else field += c; }
    else if (c === '"') q = true;
    else if (c === d) { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(field); field = ""; rows.push(row); row = []; }
    else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim() !== ""));
}

/** Accepts lines like "Title by Author", "Title - Author", "Title | Author", "Title<TAB>Author", or just "Title". */
export function parsePaste(text: string): string[][] {
  return text.split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(line => {
    if (line.includes("|")) { const [t, ...a] = line.split("|"); return [t.trim(), a.join("|").trim()]; }
    if (line.includes("\t")) { const [t, ...a] = line.split("\t"); return [t.trim(), a.join("\t").trim()]; }
    const by = line.toLowerCase().lastIndexOf(" by ");
    if (by > 0) return [line.slice(0, by).trim(), line.slice(by + 4).trim()];
    const dash = line.search(/ [-–—] /);
    if (dash > 0) return [line.slice(0, dash).trim(), line.slice(dash + 3).trim()];
    return [line, ""];
  });
}

// ---------- normalization & matching ----------
const strip = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const clean = (s: string) => s.replace(/[^a-z0-9]+/g, " ").trim().replace(/^(the|a|an) /, "");
export function titleKeys(title: string): string[] {
  const t = strip(title).replace(/\(.*?\)|\[.*?\]/g, " ");
  const full = clean(t), base = clean(t.split(/[:–—]/)[0]);
  return [...new Set([full, base].filter(Boolean))];
}
const tokens = (s: string) => strip(s).split(/[^a-z0-9]+/).filter(t => t.length >= 3);
function authorMatch(author: string, authors: string[]) {
  const a = new Set(tokens(author)); return tokens(authors.join(" ")).some(t => a.has(t));
}
export const splitAuthors = (s: string) => s.split(/;| & | and /i).map(x => x.trim()).filter(Boolean);

export type Match = { kind: "matched"; id: string; candidates: string[] } | { kind: "ambiguous"; candidates: string[] } | { kind: "new"; candidates: string[] };
export function findMatch(title: string, author: string, all: Book[]): Match {
  const keys = titleKeys(title);
  if (!keys.length) return { kind: "new", candidates: [] };
  const same = all.filter(b => titleKeys(b.title).some(k => keys.includes(k)));
  if (!same.length) return { kind: "new", candidates: [] };
  const ids = same.map(b => b.id);
  if (!author.trim()) return same.length === 1 ? { kind: "matched", id: ids[0], candidates: ids } : { kind: "ambiguous", candidates: ids };
  const both = same.filter(b => authorMatch(author, b.authors));
  return both.length === 1 ? { kind: "matched", id: both[0].id, candidates: ids } : { kind: "ambiguous", candidates: ids };
}

// ---------- field parsing ----------
export function parseDate(raw: string, order: "mdy" | "dmy"): string | null | undefined {
  const s = raw.trim(); if (!s) return undefined;
  let y: number, m: number, d: number, x: RegExpMatchArray | null;
  if ((x = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/))) { y = +x[1]; m = +x[2]; d = +x[3]; }
  else if ((x = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/))) {
    const a = +x[1], b = +x[2]; y = +x[3];
    if (a > 12) { d = a; m = b; } else if (b > 12) { m = a; d = b; } else if (order === "mdy") { m = a; d = b; } else { d = a; m = b; }
  } else return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
function parseStatus(raw: string): Status | null | undefined {
  const s = raw.toLowerCase().replace(/[_-]+/g, " ").trim(); if (!s) return undefined;
  if (["to read", "want to read", "want", "wishlist", "wish list", "tbr"].includes(s)) return "want";
  if (["currently reading", "reading", "in progress"].includes(s)) return "reading";
  if (["read", "finished", "done", "completed"].includes(s)) return "read";
  if (["on hold", "paused", "hold"].includes(s)) return "hold";
  if (["dnf", "did not finish", "abandoned", "stopped"].includes(s)) return "dnf";
  return null;
}
function parseRating(raw: string): number | null | undefined {
  const s = raw.trim().replace(",", "."); if (!s) return undefined;
  const n = Number(s); if (Number.isNaN(n)) return null;
  if (n === 0) return undefined; // many services use 0 for "unrated"
  return n >= 0.5 && n <= 5 && (n * 2) % 1 === 0 ? n : null;
}

export interface RowResult {
  n: number; title: string; author: string; status?: Status; startDate?: string; finishDate?: string; rating?: number;
  pages: number | null; review?: string; notes?: string; tags: string[]; favorite: boolean;
  errors: string[]; warnings: string[]; match: Match;
}
export function analyze(rows: string[][], mapping: Record<Field, number>, opts: { dateOrder: "mdy" | "dmy" }, all: Book[]): RowResult[] {
  return rows.map((r, idx) => {
    const g = (f: Field) => (mapping[f] >= 0 ? (r[mapping[f]] ?? "").trim() : "");
    const errors: string[] = [], warnings: string[] = [];
    const title = g("title"), author = g("author");
    if (!title) errors.push("Missing title");
    const status = parseStatus(g("status")); if (status === null) errors.push(`Unrecognized status “${g("status")}”`);
    const sd = parseDate(g("startDate"), opts.dateOrder); if (sd === null) errors.push(`Invalid start date “${g("startDate")}”`);
    const fd = parseDate(g("finishDate"), opts.dateOrder); if (fd === null) errors.push(`Invalid finish date “${g("finishDate")}”`);
    if (sd && fd && fd < sd) errors.push("Finish date is before start date");
    const rating = parseRating(g("rating")); if (rating === null) errors.push(`Invalid rating “${g("rating")}” (use 0.5–5 in half steps)`);
    let pages: number | null = null; const pr = g("pages");
    if (pr) { const p = Number(pr.replace(/[, ]/g, "")); if (Number.isInteger(p) && p >= 1 && p <= 5000) pages = p; else errors.push(`Invalid page count “${pr}”`); }
    if (status === "read" && !fd) warnings.push("No finish date, so it won't appear in monthly stats");
    return {
      n: idx + 1, title, author, status: status ?? undefined, startDate: sd ?? undefined, finishDate: fd ?? undefined,
      rating: rating ?? undefined, pages, review: g("review") || undefined, notes: g("notes") || undefined,
      tags: g("tags").split(/[,;]/).map(t => t.trim()).filter(Boolean), favorite: /^(1|true|yes|y|♥|fav)/i.test(g("favorite")),
      errors, warnings, match: title ? findMatch(title, author, all) : { kind: "new", candidates: [] },
    };
  });
}

export type Plan = { type: "add"; ref: string } | { type: "dup" } | { type: "skip" } | { type: "error"; reason: string } | { type: "unresolved" };
/** Decides, row by row, what would happen. Existing sessions are never overwritten; exact repeats are skipped. */
export function plan(results: RowResult[], choices: Record<number, string>, existing: Session[], defaultStatus: Status): Plan[] {
  const seen = new Set(existing.map(s => `${s.bookRef}|${s.status}|${s.startDate ?? ""}|${s.finishDate ?? ""}`));
  return results.map(r => {
    if (r.errors.length) return { type: "error", reason: r.errors.join("; ") };
    const choice = choices[r.n] ?? (r.match.kind === "matched" ? r.match.id : r.match.kind === "new" ? "new" : "");
    if (choice === "skip") return { type: "skip" };
    if (!choice) return { type: "unresolved" };
    const ref = choice === "new" ? `new:${clean(strip(r.title))}|${clean(strip(r.author))}` : choice;
    const key = `${ref}|${r.status ?? defaultStatus}|${r.startDate ?? ""}|${r.finishDate ?? ""}`;
    if (seen.has(key)) return { type: "dup" };
    seen.add(key);
    return { type: "add", ref };
  });
}
