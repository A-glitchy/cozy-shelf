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

/** One colour pair per status, plus favourite, so they are easy to tell apart. */
export const STATUS_STYLE: Record<Status | "favorite", { bg: string; text: string }> = {
  want: { bg: "#E3DAF0", text: "#43365E" },
  reading: { bg: "#D4E3F2", text: "#27456B" },
  read: { bg: "#CFE5C8", text: "#2A4D26" },
  hold: { bg: "#F7E2A6", text: "#6B4E0B" },
  dnf: { bg: "#E0D3CB", text: "#5A4034" },
  favorite: { bg: "#F4C9D3", text: "#8A2748" },
};
