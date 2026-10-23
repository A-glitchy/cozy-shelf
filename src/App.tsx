import { useMemo, useState } from "react";
import { books, customToBook } from "./catalogue";
import type { Book } from "./types";
import { Detail } from "./components";
import Discover from "./Discover";
import Journal from "./Journal";
import Stats from "./Stats";
import { useLibrary, useSaveError } from "./store";

type Tab = "discover" | "journal" | "stats";
const TABS: [Tab, string][] = [["discover", "Discover"], ["journal", "Journal"], ["stats", "Stats"]];

export default function App() {
  const lib = useLibrary();
  const saveError = useSaveError();
  const [tab, setTab] = useState<Tab>("discover");
  const [openId, setOpenId] = useState<string | null>(null);
  const byId = useMemo(() => {
    const m = new Map<string, Book>();
    books.forEach(b => m.set(b.id, b));
    lib.customBooks.forEach(c => m.set(c.id, customToBook(c)));
    return m;
  }, [lib.customBooks]);
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
      {open && <Detail b={open} onClose={() => setOpenId(null)} />}
    </div>
  );
}
