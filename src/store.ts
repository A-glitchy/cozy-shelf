import { useSyncExternalStore } from "react";
import type { Library, Session, CustomBook, Goal } from "./types";
import { isDate } from "./format";

const KEY = "cozy-shelf:v1";
const STATUS_IDS = ["want", "reading", "read", "hold", "dnf"];
const emptyLib = (): Library => ({ version: 1, sessions: [], customBooks: [], goals: [], excluded: [], tombstones: [] });
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : undefined);
const date = (v: unknown) => (typeof v === "string" && isDate(v) ? v : undefined);

function cleanSession(x: any): Session | null {
  if (!x || typeof x.id !== "string" || typeof x.bookRef !== "string" || !STATUS_IDS.includes(x.status)) return null;
  const okRating = typeof x.rating === "number" && x.rating >= 0.5 && x.rating <= 5 && (x.rating * 2) % 1 === 0;
  return {
    id: x.id, bookRef: x.bookRef, status: x.status, startDate: date(x.startDate), finishDate: date(x.finishDate),
    rating: okRating ? x.rating : undefined, review: str(x.review), notes: str(x.notes), favorite: x.favorite === true,
    tags: Array.isArray(x.tags) ? x.tags.filter((t: unknown) => typeof t === "string") : [],
    updatedAt: typeof x.updatedAt === "string" ? x.updatedAt : new Date().toISOString(),
  };
}
function cleanBook(x: any): CustomBook | null {
  if (!x || typeof x.id !== "string" || !x.id.startsWith("usr_") || !str(x.title)) return null;
  return {
    id: x.id, title: x.title, authors: Array.isArray(x.authors) ? x.authors.filter((a: unknown) => typeof a === "string") : [],
    pages: typeof x.pages === "number" && Number.isInteger(x.pages) && x.pages > 0 ? x.pages : null,
    genres: Array.isArray(x.genres) ? x.genres.filter((g: unknown) => typeof g === "string") : [],
    moods: Array.isArray(x.moods) ? x.moods.filter((g: unknown) => typeof g === "string") : [],
    summary: str(x.summary), createdAt: typeof x.createdAt === "string" ? x.createdAt : new Date().toISOString(),
  };
}
export function normalizeLibrary(raw: any): { lib: Library; skipped: number; valid: boolean } {
  const lib = emptyLib(); let skipped = 0;
  const valid = !!raw && typeof raw === "object" && raw.app === "cozy-shelf" && Array.isArray(raw.sessions);
  if (!valid) return { lib, skipped, valid };
  for (const s of raw.sessions) { const c = cleanSession(s); c ? lib.sessions.push(c) : skipped++; }
  for (const b of Array.isArray(raw.customBooks) ? raw.customBooks : []) { const c = cleanBook(b); c ? lib.customBooks.push(c) : skipped++; }
  for (const g of Array.isArray(raw.goals) ? raw.goals : []) {
    if (g && Number.isInteger(g.year) && Number.isInteger(g.target) && g.target > 0) lib.goals.push({ year: g.year, target: g.target });
  }
  lib.tombstones = Array.isArray(raw.tombstones) ? raw.tombstones.filter((x: unknown) => typeof x === "string") : [];
  lib.settingsUpdatedAt = typeof raw.settingsUpdatedAt === "string" ? raw.settingsUpdatedAt : undefined;
  lib.excluded = Array.isArray(raw.excluded) ? raw.excluded.filter((x: unknown) => typeof x === "string") : [];
  return { lib, skipped, valid };
}

let saveError: string | null = null;
function load(): Library {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
    if (raw) { const r = normalizeLibrary({ app: "cozy-shelf", ...JSON.parse(raw) }); return r.lib; }
  } catch {
    // Keep unreadable data instead of overwriting it.
    try { if (raw) localStorage.setItem(KEY + ":unreadable", raw); } catch { /* ignore */ }
    saveError = "Your saved data could not be read. A copy was kept aside; please contact support before adding new records.";
  }
  return emptyLib();
}
let lib: Library = load();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());
function commit(next: Library) {
  lib = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); saveError = null; }
  catch { saveError = "Could not save to this browser (storage may be full or blocked). Download a backup now."; }
  emit();
}
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const useLibrary = () => useSyncExternalStore(subscribe, () => lib);
export const useSaveError = () => useSyncExternalStore(subscribe, () => saveError);

export const store = {
  upsertSession(s: Session) {
    const i = lib.sessions.findIndex(x => x.id === s.id);
    const sessions = i >= 0 ? lib.sessions.map(x => (x.id === s.id ? s : x)) : [...lib.sessions, s];
    commit({ ...lib, sessions });
  },
  deleteSession(id: string) { commit({ ...lib, sessions: lib.sessions.filter(s => s.id !== id), tombstones: [...lib.tombstones, id] }); },
  addCustomBook(b: CustomBook) { commit({ ...lib, customBooks: [...lib.customBooks, b] }); },
  removeCustomBook(id: string) {
    const gone = lib.sessions.filter(s => s.bookRef === id).map(s => s.id);
    commit({ ...lib, customBooks: lib.customBooks.filter(b => b.id !== id), sessions: lib.sessions.filter(s => s.bookRef !== id), tombstones: [...lib.tombstones, id, ...gone] });
  },
  setGoal(year: number, target: number) {
    const goals: Goal[] = lib.goals.filter(g => g.year !== year);
    if (target > 0) goals.push({ year, target });
    commit({ ...lib, goals, settingsUpdatedAt: new Date().toISOString() });
  },
  importBatch(newBooks: CustomBook[], newSessions: Session[]) {
    commit({ ...lib, customBooks: [...lib.customBooks, ...newBooks], sessions: [...lib.sessions, ...newSessions] });
  },
  /** Moves reading records from your own book to a catalogue book, then removes the duplicate own book. */
  relink(map: Record<string, string>) {
    commit({ ...lib, sessions: lib.sessions.map(x => (map[x.bookRef] ? { ...x, bookRef: map[x.bookRef], updatedAt: new Date().toISOString() } : x)),
      customBooks: lib.customBooks.filter(b => !map[b.id]), tombstones: [...lib.tombstones, ...Object.keys(map)] });
  },
  setExcluded(cats: string[]) { commit({ ...lib, excluded: cats, settingsUpdatedAt: new Date().toISOString() }); },
  replace(next: Library) { commit(next); },
  /** Adds records that are not already present. Existing records are never overwritten. */
  merge(inc: Library) {
    const sIds = new Set(lib.sessions.map(s => s.id)), bIds = new Set(lib.customBooks.map(b => b.id));
    const newS = inc.sessions.filter(s => !sIds.has(s.id)), newB = inc.customBooks.filter(b => !bIds.has(b.id));
    const years = new Set(lib.goals.map(g => g.year));
    const newG = inc.goals.filter(g => !years.has(g.year));
    commit({ ...lib, sessions: [...lib.sessions, ...newS], customBooks: [...lib.customBooks, ...newB], goals: [...lib.goals, ...newG], excluded: [...new Set([...lib.excluded, ...inc.excluded])] });
    return { addedSessions: newS.length, skippedSessions: inc.sessions.length - newS.length, addedBooks: newB.length, skippedBooks: inc.customBooks.length - newB.length };
  },
  /** Applies what a sync received, without creating new timestamps or tombstones. */
  applySync(d: { addBooks: CustomBook[]; upsertSessions: Session[]; deleteSessionIds: string[]; clearTombstones: string[]; settings?: { excluded: string[]; goals: Goal[]; updatedAt: string } }) {
    const have = new Set(lib.customBooks.map(b => b.id));
    const addBooks = d.addBooks.filter(b => !have.has(b.id));
    const del = new Set(d.deleteSessionIds), up = new Map(d.upsertSessions.map(x => [x.id, x]));
    let sessions = lib.sessions.filter(x => !del.has(x.id)).map(x => up.get(x.id) ?? x);
    const present = new Set(sessions.map(x => x.id));
    sessions = [...sessions, ...d.upsertSessions.filter(x => !present.has(x.id))];
    const clear = new Set(d.clearTombstones);
    const tombstones = lib.tombstones.filter(t => !clear.has(t));
    const changed = addBooks.length || d.upsertSessions.length || del.size || tombstones.length !== lib.tombstones.length || d.settings;
    if (!changed) return;
    commit({ ...lib, customBooks: [...lib.customBooks, ...addBooks], sessions, tombstones,
      ...(d.settings ? { excluded: d.settings.excluded, goals: d.settings.goals, settingsUpdatedAt: d.settings.updatedAt } : {}) });
  },
  exportObject() { return { app: "cozy-shelf", exportedAt: new Date().toISOString(), ...lib }; },
};
export const getLibrary = () => lib;
export const requestPersistence = () => { try { void navigator.storage?.persist?.(); } catch { /* ignore */ } };
