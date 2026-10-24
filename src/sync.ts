import { useSyncExternalStore } from "react";
import type { Book, CustomBook, Session } from "./types";
import { customToBook } from "./catalogue";
import { findMatch, splitAuthors } from "./importer";
import { newId } from "./format";
import { getLibrary, store } from "./store";
import { rowToSession, sessionToRow, planSessions, planSettings, splitList, isYes, type Conflict, type Force, type SheetBook, type SheetSession } from "./syncCore";

const CFG_KEY = "cozy-shelf:sync";
interface Cfg { url: string; token: string; base: Record<string, string>; force: Force; lastSync?: string }
const blank = (): Cfg => ({ url: "", token: "", base: {}, force: {} });
function loadCfg(): Cfg { try { const r = localStorage.getItem(CFG_KEY); if (r) return { ...blank(), ...JSON.parse(r) }; } catch { /* ignore */ } return blank(); }
let cfg = loadCfg();
const saveCfg = () => { try { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); } catch { /* ignore */ } };

export interface SyncStatus { configured: boolean; state: "idle" | "syncing" | "ok" | "error"; message: string; lastSync?: string; conflicts: Conflict[]; problems: string[] }
let status: SyncStatus = { configured: !!cfg.url, state: "idle", message: "", lastSync: cfg.lastSync, conflicts: [], problems: [] };
const listeners = new Set<() => void>();
const setStatus = (p: Partial<SyncStatus>) => { status = { ...status, ...p, configured: !!cfg.url && !!cfg.token }; listeners.forEach(l => l()); };
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const useSyncStatus = () => useSyncExternalStore(subscribe, () => status);
export const getConnection = () => ({ url: cfg.url, token: cfg.token });

async function call(payload: Record<string, unknown>) {
  const res = await fetch(cfg.url, { method: "POST", body: JSON.stringify({ token: cfg.token, ...payload }), redirect: "follow" });
  const j = await res.json();
  if (!j.ok) throw new Error(j.error || "The Sheet script returned an error");
  return j;
}

export function connect(url: string, token: string, catalogue: Book[]) {
  cfg = { ...blank(), url: url.trim(), token: token.trim() }; saveCfg(); setStatus({ conflicts: [], problems: [], message: "" });
  return syncNow(catalogue);
}
export function disconnect() { cfg = blank(); saveCfg(); setStatus({ state: "idle", message: "", conflicts: [], problems: [], lastSync: undefined }); }
export function resolveConflict(id: string, keep: "app" | "sheet", catalogue: Book[]) { cfg.force[id] = keep; saveCfg(); return syncNow(catalogue); }

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
let running = false, again = false;
export async function syncNow(catalogue: Book[]) {
  if (!cfg.url || !cfg.token) return;
  if (running) { again = true; return; }
  running = true; setStatus({ state: "syncing", message: "Syncing…" });
  try { await doSync(catalogue); }
  catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    setStatus({ state: "error", message: /Failed to fetch|NetworkError|Load failed/i.test(m) ? "Couldn't reach the Sheet (offline, or the link is wrong). Your data is safe here and will sync later." : `Sync problem: ${m}` });
  } finally { running = false; if (again) { again = false; void syncNow(catalogue); } }
}

async function doSync(catalogue: Book[]) {
  const lib = getLibrary();
  const pulled = await call({ action: "pull" });
  const now = new Date().toISOString();
  const tomb = new Set(lib.tombstones);

  // --- own books ---
  const localBooks = new Map(lib.customBooks.map(b => [b.id, b]));
  const remoteBookIds = new Set<string>();
  const addBooks: CustomBook[] = [], pushBooks: CustomBook[] = [], pushBookDeletes: string[] = [];
  for (const r of (pulled.books ?? []) as SheetBook[]) {
    remoteBookIds.add(r.id);
    if (isYes(r.deleted)) continue;
    if (tomb.has(r.id)) { pushBookDeletes.push(r.id); continue; }
    if (!localBooks.has(r.id) && String(r.title ?? "").trim()) {
      const pg = Number(r.pages);
      addBooks.push({ id: r.id, title: String(r.title).trim(), authors: splitAuthors(String(r.authors ?? "")), pages: Number.isInteger(pg) && pg > 0 ? pg : null,
        genres: splitList(r.genres), moods: splitList(r.moods), createdAt: String(r.createdAt || now) });
    }
  }
  for (const b of lib.customBooks) if (!remoteBookIds.has(b.id)) pushBooks.push(b);

  // --- sessions typed or changed in the Sheet ---
  const known: Book[] = [...catalogue, ...[...lib.customBooks, ...addBooks].map(customToBook)];
  const created = new Map<string, CustomBook>();
  const fill = new Set<string>(), skip = new Set<string>(), problems: string[] = [];
  const remote = new Map<string, { session: Session; deleted: boolean }>();
  for (const row of (pulled.sessions ?? []) as SheetSession[]) {
    const deleted = isYes(row.deleted);
    let bookRef = String(row.bookId ?? "").trim();
    if (!bookRef) {
      if (deleted) continue;
      const title = String(row.title ?? "").trim();
      if (!title) { problems.push(`Sheet row ${row.row}: needs a title`); skip.add(row.id); continue; }
      const authors = String(row.authors ?? "");
      const m = findMatch(title, authors, known);
      if (m.kind === "matched") bookRef = m.id;
      else {
        const key = norm(title) + "|" + norm(authors);
        let nb = created.get(key);
        if (!nb) { nb = { id: newId("usr"), title, authors: splitAuthors(authors), pages: null, genres: [], moods: [], createdAt: now }; created.set(key, nb); known.push(customToBook(nb)); }
        bookRef = nb.id;
      }
      fill.add(row.id);
    }
    const r = rowToSession(row, bookRef, now);
    if (r.problem || !r.session) { problems.push(`Sheet row ${row.row}: ${r.problem}`); skip.add(row.id); fill.delete(row.id); continue; }
    remote.set(row.id, { session: r.session, deleted });
  }
  for (const nb of created.values()) { addBooks.push(nb); pushBooks.push(nb); }

  const plan = planSessions(lib.sessions, remote, cfg.base, tomb, skip, fill, cfg.force);
  const sp = planSettings({ excluded: lib.excluded, goals: lib.goals, updatedAt: lib.settingsUpdatedAt }, pulled.settings ?? null, cfg.base["settings"]);

  // --- apply locally, then send ---
  const titleOf = (id: string) => known.find(b => b.id === id);
  const rows: SheetSession[] = plan.push.map(s => { const b = titleOf(s.bookRef); return sessionToRow(s, b?.title ?? "", b?.authors.join("; ") ?? ""); });
  for (const id of plan.pushDeleted) rows.push({ id, deleteOnly: true, updatedAt: now });
  const bookRows: SheetBook[] = pushBooks.map(b => ({ id: b.id, title: b.title, authors: b.authors.join("; "), pages: b.pages ?? "", genres: b.genres.join("; "), moods: b.moods.join("; "), createdAt: b.createdAt, deleted: "" }));
  for (const id of pushBookDeletes) bookRows.push({ id, deleteOnly: true });

  store.applySync({ addBooks, upsertSessions: plan.apply, deleteSessionIds: plan.deleteLocal, clearTombstones: [...tomb], settings: sp.apply });
  const payload: Record<string, unknown> = { action: "push", sessions: rows, books: bookRows };
  if (sp.push) payload.settings = { value: JSON.stringify({ excluded: sp.push.excluded, goals: sp.push.goals }), updatedAt: sp.push.updatedAt };
  if (rows.length || bookRows.length || sp.push) await call(payload);

  Object.assign(cfg.base, plan.baseSet);
  if (sp.push) cfg.base["settings"] = sp.push.updatedAt; else if (sp.apply) cfg.base["settings"] = sp.apply.updatedAt; else if (pulled.settings) cfg.base["settings"] = pulled.settings.updatedAt;
  for (const id of plan.forcedDone) delete cfg.force[id];
  cfg.lastSync = now; saveCfg();

  const sent = plan.push.length + pushBooks.length, got = plan.apply.length + addBooks.length;
  setStatus({ state: "ok", lastSync: now, conflicts: plan.conflicts, problems,
    message: `Synced: sent ${sent}, received ${got}${plan.conflicts.length ? `, ${plan.conflicts.length} need your decision` : ""}${problems.length ? `, ${problems.length} Sheet row(s) skipped` : ""}.` });
}
