import type { Book } from "./types";
// The master catalogue pulled from your Google Sheet, cached on this device so it works offline.
// Your journal, shelves and removed warnings are never stored here or changed by it.
const DB = "cozy-shelf-master", STORE = "master";
export interface MasterCache { hash: string; at: string; books: Book[]; problems: string[]; stats: { books: number; triggers: number; sources: number } }
function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => { r.result.createObjectStore(STORE); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
}
export async function loadMaster(): Promise<MasterCache | null> {
  try {
    const db = await open();
    return await new Promise<MasterCache | null>((res, rej) => { const q = db.transaction(STORE).objectStore(STORE).get("overlay"); q.onsuccess = () => res((q.result as MasterCache) ?? null); q.onerror = () => rej(q.error); });
  } catch { return null; }
}
export async function saveMaster(c: MasterCache | null) {
  const db = await open();
  await new Promise<void>((res, rej) => { const tx = db.transaction(STORE, "readwrite"); if (c) tx.objectStore(STORE).put(c, "overlay"); else tx.objectStore(STORE).delete("overlay"); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
}
