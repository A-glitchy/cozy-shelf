import { useEffect, useMemo, useState } from "react";
import { books, customToBook } from "./catalogue";
import type { Book } from "./types";
import { Detail } from "./components";
import Discover from "./Discover";
import Journal from "./Journal";
import Stats from "./Stats";
import { useLibrary, useSaveError } from "./store";
import { useSyncStatus, syncNow } from "./sync";

type Tab = "discover" | "journal" | "stats";
const TABS: [Tab, string][] = [["discover", "Discover"], ["journal", "Journal"], ["stats", "Stats"]];

export default function App() {
  const lib = useLibrary();
  const saveError = useSaveError();
  const sync = useSyncStatus();
  const [tab, setTab] = useState<Tab>("discover");
  const [openId, setOpenId] = useState<string | null>(null);
  const byId = useMemo(() => {
    const m = new Map<string, Book>();
    books.forEach(b => m.set(b.id, b));
    lib.customBooks.forEach(c => m.set(c.id, customToBook(c)));
    return m;
  }, [lib.customBooks]);
  // Sync a moment after any change, when the app is opened again, and when the connection returns.
  useEffect(() => {
    if (!sync.configured) return;
    const t = setTimeout(() => void syncNow(books), 1500);
    return () => clearTimeout(t);
  }, [lib, sync.configured]);
  useEffect(() => {
    const f = () => void syncNow(books);
    window.addEventListener("focus", f); window.addEventListener("online", f);
    return () => { window.removeEventListener("focus", f); window.removeEventListener("online", f); };
  }, []);
  const open = openId ? byId.get(openId) ?? null : null;
  return (
    <div className="app">
      <header>
        <h1>Cozy Shelf</h1>
        <nav className="tabs" aria-label="Sections">
          {TABS.map(([id, label]) => <button key={id} className={`tab ${tab === id ? "active" : ""}`} onClick={() => setTab(id)}>{label}</button>)}
        </nav>
      </header>
      {saveError && <div className="banner">{saveError}</div>}
      <main>
        {tab === "discover" && <Discover onOpen={setOpenId} />}
        {tab === "journal" && <Journal byId={byId} onOpen={setOpenId} />}
        {tab === "stats" && <Stats byId={byId} />}
      </main>
      {open && <Detail key={open.id} b={open} onClose={() => setOpenId(null)} onOpen={setOpenId} />}
    </div>
  );
}
