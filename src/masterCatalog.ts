import type { Book, Evidence, Warning } from "./types";
import { CATEGORY_LABEL } from "./warnings";

/** The master workbook tabs, as the Apps Script sends them: headers plus rows. */
export interface MasterTable { headers: string[]; rows: unknown[][] }
export type MasterTables = Partial<Record<"Books" | "Trigger Warnings" | "Sources" | "Research Status", MasterTable>>;
export interface MasterResult { books: Book[]; problems: string[]; stats: { books: number; triggers: number; sources: number } }

const txt = (v: unknown) => (v === null || v === undefined ? "" : String(v).replace(/\s+/g, " ").trim());
const k = (s: unknown) => txt(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
type Row = Record<string, unknown>;
function rows(t?: MasterTable): Row[] {
  if (!t) return [];
  const heads = t.headers.map(k);
  return t.rows.map(r => Object.fromEntries(heads.map((h, i) => [h, r[i]]))).filter(r => Object.values(r).some(v => txt(v) !== ""));
}
const col = (r: Row, ...names: string[]) => { for (const n of names) { const v = txt(r[k(n)]); if (v) return v; } return ""; };

const CAT_BY_NAME: Record<string, string> = {};
for (const [id, label] of Object.entries(CATEGORY_LABEL)) { CAT_BY_NAME[k(label)] = id; CAT_BY_NAME[k(id)] = id; }
const catId = (s: string) => CAT_BY_NAME[k(s)];

export type SvStatus = "yes" | "no" | "unsure" | "not-recorded";
export function svStatusOf(s: string): SvStatus | undefined {
  const t = k(s); if (!t) return undefined;
  if (t.startsWith("not recorded")) return "not-recorded";
  if (t.startsWith("yes")) return "yes";
  if (t === "no" || t.startsWith("no ")) return "no";
  if (t.startsWith("unsure")) return "unsure";
  return undefined;
}
const INTENSITIES = ["mild", "minor", "moderate", "heavy", "graphic"] as const;
export const intensityOf = (s: string): Warning["intensity"] => { const t = k(s); return (INTENSITIES as readonly string[]).includes(t) ? (t as Warning["intensity"]) : undefined; };
export function depictionOf(s: string): Warning["depiction"] {
  const t = k(s); if (t.startsWith("on page")) return "on-page"; if (t.startsWith("off page")) return "off-page"; if (t.includes("mention") || t.includes("referenc")) return "referenced"; return undefined;
}
const list = (s: string) => s.split(/[,;]/).map(x => x.trim()).filter(Boolean);
const labels = (s: string) => s.split(";").map(x => x.trim()).filter(Boolean);

function addEvidence(into: Evidence[], label: string, note?: string, url?: string) {
  const l = txt(label).replace(/[.;,]+$/, ""); if (!l) return;
  const have = into.find(e => k(e.label) === k(l));
  if (have) { if (note && !have.note) have.note = note; if (url && !have.url) have.url = url; return; }
  into.push({ label: l, ...(note ? { note } : {}), ...(url ? { url } : {}) });
}

/**
 * Turns the master tables into catalogue books.
 *  - one pill per (book, category, trigger); several sources never create several pills
 *  - only reported triggers become warnings; "no" and "unsure" statuses are kept as hidden records
 *  - nothing here reads or changes your personal journal, shelves or removed warnings
 */
export function parseMaster(tables: MasterTables, opts: { moodIds: string[]; moodByLabel: Record<string, string>; base?: Map<string, Book> }): MasterResult {
  const problems: string[] = [];
  const base = opts.base ?? new Map<string, Book>();
  const moodId = (m: string) => { const t = k(m); return opts.moodIds.includes(m.trim()) ? m.trim() : opts.moodByLabel[t] ?? t.replace(/ /g, "-"); };
  const status = new Map<string, Row>();
  for (const r of rows(tables["Research Status"])) { const id = col(r, "Book ID"); if (id) status.set(id, r); }

  const byId = new Map<string, Book>(); const order: string[] = [];
  for (const r of rows(tables.Books)) {
    const id = col(r, "Book ID"); if (!id) { problems.push("A Books row has no Book ID and was skipped."); continue; }
    if (byId.has(id)) { problems.push(`Books: ${id} appears twice; the first row is used.`); continue; }
    const old = base.get(id); const st = status.get(id) ?? {};
    const pagesRaw = col(r, "Pages estimate"); const pages = Number(pagesRaw.replace(/[, ]/g, ""));
    const svs = svStatusOf(col(st, "Sexual violence status") || col(r, "Sexual violence status"));
    const general = col(st, "General sources / notes");
    byId.set(id, {
      id, title: col(r, "Title") || old?.title || id, authors: col(r, "Author(s)", "Author") ? col(r, "Author(s)", "Author").split(";").map(x => x.trim()).filter(Boolean) : old?.authors ?? ["Unknown"],
      summary: col(r, "Summary") || null,
      pages: { estimate: pagesRaw && Number.isInteger(pages) && pages > 0 ? pages : null, confidence: (col(r, "Page-count confidence") || "unknown").toLowerCase(), source: old?.pages.source || "From the master Sheet" },
      genres: list(col(r, "Genres")), subgenres: list(col(r, "Subgenres")), moods: list(col(r, "Moods")).map(moodId),
      warnings: [], warningsReviewed: (["none", "partial", "complete"].includes(col(st, "Warnings reviewed") || col(r, "Warnings reviewed")) ? (col(st, "Warnings reviewed") || col(r, "Warnings reviewed")) : "none") as Book["warningsReviewed"],
      sources: general ? [{ label: general }] : old?.sources ?? [], cover: old?.cover ?? null,
      research: { status: col(st, "Research status") || col(r, "Research status") || "draft", lastReviewed: col(st, "Last reviewed") || col(r, "Last reviewed") },
      svStatus: svs, svNote: col(r, "Sexual violence research note") || undefined,
    });
    order.push(id);
  }
  // sources, grouped per trigger
  const src = new Map<string, Evidence[]>(); let sourceRows = 0;
  for (const r of rows(tables.Sources)) {
    const bid = col(r, "Book ID"), cid = catId(col(r, "Category")), trig = k(col(r, "Trigger / warning", "Trigger"));
    if (!bid || !cid || !trig) { problems.push("A Sources row is missing its book, category or trigger and was skipped."); continue; }
    sourceRows++;
    const key = `${bid}|${cid}|${trig}`; const arr = src.get(key) ?? []; addEvidence(arr, col(r, "Source / evidence label", "Source"), col(r, "Research note") || undefined); src.set(key, arr);
  }
  // triggers
  let triggers = 0; const seen = new Set<string>(); const used = new Set<string>();
  for (const r of rows(tables["Trigger Warnings"])) {
    const bid = col(r, "Book ID"), name = col(r, "Trigger / warning", "Trigger"), cat = catId(col(r, "Category"));
    if (!bid || !name) { problems.push("A Trigger Warnings row is missing its Book ID or trigger and was skipped."); continue; }
    const book = byId.get(bid); if (!book) { problems.push(`Trigger Warnings: "${name}" refers to ${bid}, which is not in Books (skipped).`); continue; }
    const category = cat ?? "other"; if (!cat) problems.push(`Trigger Warnings: unknown category "${col(r, "Category")}" for "${name}" on ${book.title}; shown under Other.`);
    const key = `${bid}|${category}|${k(name)}`;
    const incoming: Evidence[] = [];
    for (const e of src.get(key) ?? []) addEvidence(incoming, e.label, e.note, e.url);
    for (const l of labels(col(r, "Evidence / source labels", "Evidence"))) addEvidence(incoming, l);
    const sub = col(r, "Abuse subtype"), inten = intensityOf(col(r, "Intensity")), dep = depictionOf(col(r, "Depiction (on-page / off-page)", "Depiction")), note = col(r, "Description / note", "Note");
    const existing = book.warnings.find(w => w.category === category && k(w.name ?? "") === k(name));
    if (existing) { // the same trigger twice: merge, never a second pill
      for (const e of incoming) addEvidence(existing.evidence!, e.label, e.note, e.url);
      existing.intensity ??= inten; existing.depiction ??= dep; existing.abuseSubtype ??= sub || undefined; existing.note ||= note || undefined; seen.add(key); continue;
    }
    used.add(key);
    // keep a link the built-in catalogue already had for the same source
    const old = base.get(bid)?.warnings.find(w => w.category === category && k(w.name ?? "") === k(name));
    for (const e of incoming) { const o = old?.evidence?.find(x => k(x.label) === k(e.label)); if (o?.url && !e.url) e.url = o.url; }
    book.warnings.push({
      category, name, presence: "present", verification: "unverified-research", evidence: incoming,
      ...(category === "abuse" || sub ? { abuseSubtype: sub || (category === "abuse" ? name : undefined) } : {}),
      ...(inten ? { intensity: inten } : {}), ...(dep ? { depiction: dep } : {}), ...(note ? { note } : {}), ...(col(r, "Warning ID") ? { warningId: col(r, "Warning ID") } : {}),
      ...(old?.spoilerNote ? { spoilerNote: old.spoilerNote } : {}), ...(old?.subcategory ? { subcategory: old.subcategory } : {}),
    });
    triggers++;
  }
  for (const key of src.keys()) if (!used.has(key) && !seen.has(key)) problems.push(`Sources: "${key.split("|")[2]}" on ${byId.get(key.split("|")[0])?.title ?? key.split("|")[0]} has no matching Trigger Warnings row (ignored).`);
  // sexual violence: the status column and the trigger rows are reconciled, and any positive report is included
  for (const id of order) {
    const b = byId.get(id)!; const sv = b.warnings.find(w => w.category === "sexual-violence");
    const intensity = intensityOf(txt((rows(tables.Books).find(r => col(r, "Book ID") === id) ?? {})[k("Sexual violence intensity")]));
    if (b.svStatus === "yes" && !sv) { b.warnings.push({ category: "sexual-violence", name: "Sexual violence", presence: "present", verification: "unverified-research", evidence: [], ...(intensity ? { intensity } : {}), ...(b.svNote ? { note: b.svNote } : {}) }); triggers++; }
    else if (sv) {
      sv.intensity ??= intensity; if (b.svNote && !sv.note) sv.note = b.svNote;
      if (b.svStatus && b.svStatus !== "yes") problems.push(`${b.title}: has a sexual-violence trigger row but the status says "${b.svStatus}". The trigger row is included.`);
    } else if (b.svStatus === "no") b.warnings.push({ category: "sexual-violence", presence: "absent", verification: "unverified-research", evidence: [] });
    else if (b.svStatus === "unsure") b.warnings.push({ category: "sexual-violence", presence: "unknown", verification: "unverified-research", evidence: [] });
  }
  return { books: order.map(id => byId.get(id)!), problems, stats: { books: order.length, triggers, sources: sourceRows } };
}
