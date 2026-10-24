import type { Session, Goal } from "./types";
import { parseDate, parseStatus, parseRating } from "./importer";
import { statusLabel } from "./format";

export interface SheetSession {
  row?: number; id: string; bookId?: string; title?: string; authors?: string; status?: string; started?: string; finished?: string;
  rating?: string | number; favorite?: string; tags?: string; review?: string; notes?: string; updatedAt?: string; deleted?: string; deleteOnly?: boolean;
}
export interface SheetBook { row?: number; id: string; title?: string; authors?: string; pages?: string | number; genres?: string; moods?: string; createdAt?: string; deleted?: string; deleteOnly?: boolean; updatedAt?: string }
export interface Conflict { id: string; kind: "edited" | "deleted-remotely"; local: Session; remote: Session | null }
export type Force = Record<string, "app" | "sheet">;

const txt = (v: unknown) => String(v ?? "").trim();
export const isYes = (v: unknown) => /^(1|true|yes|y|♥)/i.test(txt(v));
const list = (v: unknown) => txt(v).split(/[;,]/).map(x => x.trim()).filter(Boolean);
export const splitList = list;

export function rowToSession(r: SheetSession, bookRef: string, now: string): { session?: Session; problem?: string } {
  const st = parseStatus(txt(r.status)); if (st === null) return { problem: `Unrecognized status “${txt(r.status)}”` };
  const sd = parseDate(txt(r.started), "mdy"); if (sd === null) return { problem: `Invalid start date “${txt(r.started)}” (use YYYY-MM-DD)` };
  const fd = parseDate(txt(r.finished), "mdy"); if (fd === null) return { problem: `Invalid finish date “${txt(r.finished)}” (use YYYY-MM-DD)` };
  if (sd && fd && fd < sd) return { problem: "Finish date is before start date" };
  const rt = parseRating(txt(r.rating)); if (rt === null) return { problem: `Invalid rating “${txt(r.rating)}” (use 0.5–5 in half steps)` };
  return { session: { id: r.id, bookRef, status: st ?? "want", startDate: sd ?? undefined, finishDate: fd ?? undefined, rating: rt ?? undefined,
    review: txt(r.review) || undefined, notes: txt(r.notes) || undefined, favorite: isYes(r.favorite), tags: list(r.tags), updatedAt: txt(r.updatedAt) || now } };
}
export function sessionToRow(s: Session, title: string, authors: string): SheetSession {
  return { id: s.id, bookId: s.bookRef, title, authors, status: statusLabel(s.status), started: s.startDate ?? "", finished: s.finishDate ?? "",
    rating: s.rating ?? "", favorite: s.favorite ? "yes" : "", tags: s.tags.join("; "), review: s.review ?? "", notes: s.notes ?? "", updatedAt: s.updatedAt, deleted: "" };
}
export function sameContent(a: Session, b: Session) {
  const k = (s: Session) => JSON.stringify([s.bookRef, s.status, s.startDate ?? "", s.finishDate ?? "", s.rating ?? 0, (s.review ?? "").trim(), (s.notes ?? "").trim(), s.favorite, s.tags.join("|")]);
  return k(a) === k(b);
}

export interface SessionPlan { push: Session[]; apply: Session[]; deleteLocal: string[]; pushDeleted: string[]; conflicts: Conflict[]; baseSet: Record<string, string>; forcedDone: string[] }
/** Decides what to send, receive or flag. Nothing is overwritten when both sides changed since the last sync. */
export function planSessions(local: Session[], remote: Map<string, { session: Session; deleted: boolean }>, base: Record<string, string>,
  tomb: Set<string>, skip: Set<string>, fill: Set<string>, force: Force): SessionPlan {
  const p: SessionPlan = { push: [], apply: [], deleteLocal: [], pushDeleted: [], conflicts: [], baseSet: {}, forcedDone: [] };
  const L = new Map(local.map(s => [s.id, s]));
  const ids = new Set([...L.keys(), ...remote.keys(), ...tomb]);
  for (const id of ids) {
    if (skip.has(id)) continue;
    const l = L.get(id), r = remote.get(id), b = base[id], f = force[id];
    if (tomb.has(id) && !l) { if (r && !r.deleted) p.pushDeleted.push(id); continue; }
    if (r?.deleted) {
      if (!l) continue;
      if (f === "app") { p.push.push(l); p.baseSet[id] = l.updatedAt; p.forcedDone.push(id); }
      else if (f === "sheet" || l.updatedAt === b) { p.deleteLocal.push(id); if (f) p.forcedDone.push(id); }
      else p.conflicts.push({ id, kind: "deleted-remotely", local: l, remote: null });
      continue;
    }
    if (l && !r) { p.push.push(l); p.baseSet[id] = l.updatedAt; continue; }
    if (!l && r) { p.apply.push(r.session); p.baseSet[id] = r.session.updatedAt; if (fill.has(id)) p.push.push(r.session); continue; }
    if (l && r) {
      const rs = r.session;
      if (f === "app") { p.push.push(l); p.baseSet[id] = l.updatedAt; p.forcedDone.push(id); }
      else if (f === "sheet") { p.apply.push(rs); p.baseSet[id] = rs.updatedAt; p.forcedDone.push(id); }
      else if (sameContent(l, rs)) { p.baseSet[id] = l.updatedAt; if (fill.has(id)) p.push.push(l); }
      else {
        const lc = l.updatedAt !== b, rc = rs.updatedAt !== b;
        if (b !== undefined && lc && !rc) { p.push.push(l); p.baseSet[id] = l.updatedAt; }
        else if (b !== undefined && rc && !lc) { p.apply.push(rs); p.baseSet[id] = rs.updatedAt; }
        else p.conflicts.push({ id, kind: "edited", local: l, remote: rs });
      }
    }
  }
  return p;
}

export interface SettingsData { excluded: string[]; goals: Goal[]; updatedAt?: string }
export function planSettings(local: SettingsData, remote: { value: string; updatedAt: string } | null, baseStamp: string | undefined):
  { push?: SettingsData & { updatedAt: string }; apply?: SettingsData & { updatedAt: string } } {
  const hasLocal = local.excluded.length > 0 || local.goals.length > 0;
  const lstamp = local.updatedAt ?? "";
  if (!remote) return hasLocal || lstamp ? { push: { ...local, updatedAt: lstamp || new Date().toISOString() } } : {};
  let rd: { excluded?: unknown; goals?: unknown } = {};
  try { rd = JSON.parse(remote.value); } catch { return {}; }
  const remoteData = { excluded: Array.isArray(rd.excluded) ? (rd.excluded as unknown[]).filter((x): x is string => typeof x === "string") : [],
    goals: Array.isArray(rd.goals) ? (rd.goals as Goal[]).filter(g => Number.isInteger(g?.year) && Number.isInteger(g?.target)) : [], updatedAt: remote.updatedAt };
  const b = baseStamp ?? "";
  const lc = lstamp !== b, rc = remote.updatedAt !== b;
  if (lc && !rc) return { push: { ...local, updatedAt: lstamp || new Date().toISOString() } };
  if (rc && !lc) return { apply: remoteData };
  if (lc && rc) return remote.updatedAt > lstamp ? { apply: remoteData } : { push: { ...local, updatedAt: lstamp } };
  return {};
}
