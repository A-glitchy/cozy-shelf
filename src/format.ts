import type { Status } from "./types";
export const STATUSES: { id: Status; label: string }[] = [
  { id: "want", label: "Want to Read" }, { id: "reading", label: "Currently Reading" },
  { id: "read", label: "Read" }, { id: "hold", label: "On Hold" }, { id: "dnf", label: "Did Not Finish" },
];
export const statusLabel = (s: Status) => STATUSES.find(x => x.id === s)?.label ?? s;
export const RATINGS = Array.from({ length: 10 }, (_, i) => (i + 1) / 2);
export const stars = (r?: number) => (r ? "★".repeat(Math.floor(r)) + (r % 1 ? "½" : "") : "");
export const isDate = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
export function newId(prefix: string) {
  const raw = (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));
  return `${prefix}_${raw.replace(/-/g, "").slice(0, 12)}`;
}
export const csvEscape = (v: unknown) => { const s = String(v ?? ""); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export function download(name: string, text: string, mime: string) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const splitList = (s: string) => s.split(",").map(x => x.trim()).filter(Boolean);
