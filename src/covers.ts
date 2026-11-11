import { useSyncExternalStore } from "react";
// Cover images you add yourself. They are stored in this browser (IndexedDB), never uploaded anywhere.
const DB = "cozy-shelf-covers", STORE = "covers";
const cache = new Map<string, string>();
const listeners = new Set<() => void>();
let version = 0;
const emit = () => { version++; listeners.forEach(l => l()); };
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const useCoverVersion = () => useSyncExternalStore(subscribe, () => version);
export const getCover = (id: string) => cache.get(id);

function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => { r.result.createObjectStore(STORE); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
export async function loadAllCovers() {
  try {
    const db = await open();
    await new Promise<void>((res, rej) => {
      const tx = db.transaction(STORE, "readonly"), st = tx.objectStore(STORE), req = st.openCursor();
      req.onsuccess = () => { const c = req.result; if (c) { cache.set(String(c.key), String(c.value)); c.continue(); } else res(); };
      req.onerror = () => rej(req.error);
    });
    emit();
  } catch { /* storage unavailable: covers simply stay generated */ }
}
async function shrink(file: File, maxW = 360): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("That file is not an image I can read.")); i.src = url; });
    const k = Math.min(1, maxW / img.width), c = document.createElement("canvas");
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.85);
  } finally { URL.revokeObjectURL(url); }
}
export async function saveCover(id: string, file: File) {
  const data = await shrink(file);
  const db = await open();
  await new Promise<void>((res, rej) => { const tx = db.transaction(STORE, "readwrite"); tx.objectStore(STORE).put(data, id); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
  cache.set(id, data); emit();
}
export async function removeCover(id: string) {
  const db = await open();
  await new Promise<void>((res, rej) => { const tx = db.transaction(STORE, "readwrite"); tx.objectStore(STORE).delete(id); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
  cache.delete(id); emit();
}
