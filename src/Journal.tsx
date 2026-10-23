import { useState } from "react";
import type { Book, Library, Status } from "./types";
import { moods } from "./catalogue";
import { Cover, MoodChip } from "./components";
import { STATUSES, statusLabel, stars, newId, splitList, csvEscape, download } from "./format";
import { store, useLibrary, normalizeLibrary } from "./store";
import Import from "./Import";

function AddBook({ onDone }: { onDone: (id?: string) => void }) {
  const [title, setTitle] = useState(""); const [authors, setAuthors] = useState(""); const [pages, setPages] = useState("");
  const [genres, setGenres] = useState(""); const [sel, setSel] = useState<string[]>([]); const [status, setStatus] = useState<Status>("want");
  const [err, setErr] = useState("");
  function save() {
    const p = pages ? Number(pages) : null;
    if (!title.trim()) return setErr("A title is required.");
    if (p !== null && (!Number.isInteger(p) || p < 1 || p > 5000)) return setErr("Page count must be a whole number between 1 and 5000, or empty.");
    const id = newId("usr");
    store.addCustomBook({ id, title: title.trim(), authors: splitList(authors), pages: p, genres: splitList(genres), moods: sel, createdAt: new Date().toISOString() });
    store.upsertSession({ id: newId("ses"), bookRef: id, status, favorite: false, tags: [], updatedAt: new Date().toISOString() });
    onDone(id);
  }
  return (
    <div className="overlay" onClick={() => onDone()}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <button className="close" onClick={() => onDone()} aria-label="Close">×</button>
        <h2>Add a book of my own</h2>
        <div className="form">
          <label>Title<input value={title} onChange={e => setTitle(e.target.value)} /></label>
          <label>Author(s), comma separated<input value={authors} onChange={e => setAuthors(e.target.value)} /></label>
          <label>Pages (optional)<input type="number" min={1} value={pages} onChange={e => setPages(e.target.value)} /></label>
          <label>Genres, comma separated (optional)<input value={genres} onChange={e => setGenres(e.target.value)} /></label>
          <div>Moods (optional)<div className="chips">
            {moods.map(m => <button key={m.id} className={`chip btn-chip ${sel.includes(m.id) ? "s1" : ""}`} style={{ background: m.bg, color: m.text }}
              onClick={() => setSel(s => s.includes(m.id) ? s.filter(x => x !== m.id) : [...s, m.id])}>{sel.includes(m.id) ? "✓ " : ""}{m.label}</button>)}
          </div></div>
          <label>Status<select value={status} onChange={e => setStatus(e.target.value as Status)}>{STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
          {err && <p className="notice">{err}</p>}
          <div className="row"><button className="btn primary" onClick={save}>Add book</button><button className="btn" onClick={() => onDone()}>Cancel</button></div>
        </div>
      </div>
    </div>
  );
}

function Backup({ byId }: { byId: Map<string, Book> }) {
  const lib = useLibrary();
  const [pending, setPending] = useState<{ lib: Library; skipped: number } | null>(null);
  const [msg, setMsg] = useState("");
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; e.target.value = ""; if (!f) return;
    try {
      const res = normalizeLibrary(JSON.parse(await f.text()));
      if (!res.valid) { setMsg("This file is not a Cozy Shelf backup."); setPending(null); return; }
      setPending(res); setMsg("");
    } catch { setMsg("Could not read that file. It must be a Cozy Shelf JSON backup."); setPending(null); }
  }
  function csv() {
    const rows = [["Title", "Authors", "Status", "Started", "Finished", "Rating", "Favorite", "Tags", "Review", "Notes", "Estimated pages", "Book ID"]];
    for (const s of lib.sessions) {
      const b = byId.get(s.bookRef);
      rows.push([b?.title ?? "(book not in catalogue)", b?.authors.join("; ") ?? "", statusLabel(s.status), s.startDate ?? "", s.finishDate ?? "",
        s.rating?.toString() ?? "", s.favorite ? "yes" : "", s.tags.join("; "), s.review ?? "", s.notes ?? "", b?.pages.estimate?.toString() ?? "", s.bookRef]);
    }
    download("cozy-shelf-library.csv", "\ufeff" + rows.map(r => r.map(csvEscape).join(",")).join("\r\n"), "text/csv;charset=utf-8");
  }
  const stamp = () => new Date().toISOString().slice(0, 10);
  return (
    <details className="panel">
      <summary>Backup, restore & export</summary>
      <p className="notice">Your library is stored only in this browser. It does not sync to your other devices or browsers. Use a backup file to move it, and download one regularly.</p>
      <div className="row">
        <button className="btn primary" onClick={() => download(`cozy-shelf-backup-${stamp()}.json`, JSON.stringify(store.exportObject(), null, 2), "application/json")}>Download backup (JSON)</button>
        <button className="btn" onClick={csv}>Export CSV</button>
        <label className="btn filebtn">Restore from backup…<input type="file" accept="application/json,.json" onChange={onFile} hidden /></label>
      </div>
      {msg && <p className="notice">{msg}</p>}
      {pending && (
        <div className="notice">
          <p>Found {pending.lib.sessions.length} reading records and {pending.lib.customBooks.length} of your own books{pending.skipped ? ` (${pending.skipped} invalid records will be ignored)` : ""}.</p>
          <div className="row">
            <button className="btn primary" onClick={() => {
              const r = store.merge(pending.lib);
              setMsg(`Merged: added ${r.addedSessions} reading records and ${r.addedBooks} books. Skipped ${r.skippedSessions + r.skippedBooks} already in your library (nothing was overwritten).`);
              setPending(null);
            }}>Merge into my library (safe)</button>
            <button className="btn" onClick={() => {
              if (window.confirm("Replace your whole current library with this backup? This cannot be undone.")) { store.replace(pending.lib); setMsg("Library replaced with the backup."); setPending(null); }
            }}>Replace my library…</button>
            <button className="btn" onClick={() => setPending(null)}>Cancel</button>
          </div>
        </div>
      )}
    </details>
  );
}

export default function Journal({ byId, onOpen }: { byId: Map<string, Book>; onOpen: (id: string) => void }) {
  const lib = useLibrary();
  const [filter, setFilter] = useState<Status | "all">("all");
  const [favOnly, setFavOnly] = useState(false);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const list = lib.sessions.filter(s => (filter === "all" || s.status === filter) && (!favOnly || s.favorite)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return (
    <>
      <div className="row between">
        <h2 className="pagetitle">My journal</h2>
        <div className="row"><button className="btn" onClick={() => setImporting(true)}>Import…</button><button className="btn primary" onClick={() => setAdding(true)}>＋ Add my own book</button></div>
      </div>
      <div className="chips">
        {([["all", "All"], ...STATUSES.map(s => [s.id, s.label])] as [string, string][]).map(([id, label]) => (
          <button key={id} className={`chip btn-chip plain ${filter === id ? "s1" : ""}`} onClick={() => setFilter(id as Status | "all")}>{label}</button>
        ))}
        <button className={`chip btn-chip plain ${favOnly ? "s1" : ""}`} onClick={() => setFavOnly(v => !v)}>♥ Favorites</button>
      </div>
      <p className="count">{list.length} record{list.length === 1 ? "" : "s"}</p>
      {lib.sessions.length === 0 && <p className="notice">Nothing here yet. Open a book in Discover and tap “Add to my shelf”, or add a book of your own.</p>}
      <div className="grid">
        {list.map(s => {
          const b = byId.get(s.bookRef);
          return (
            <button key={s.id} className="card" onClick={() => b && onOpen(b.id)} disabled={!b}>
              {b ? <Cover b={b} small /> : <div className="cover small" />}
              <div className="info">
                <h2>{b?.title ?? "Book no longer in the catalogue"}</h2>
                <p className="by">{b?.authors.join(", ") ?? s.bookRef}</p>
                <p className="meta"><span className="badge unk">{statusLabel(s.status)}</span> <span className="stars">{stars(s.rating)}</span> {s.favorite && "♥"}</p>
                <p className="small">{s.startDate ?? "?"} → {s.finishDate ?? "—"}</p>
                {b && <div className="chips">{b.moods.slice(0, 2).map(m => <MoodChip key={m} id={m} />)}</div>}
              </div>
            </button>
          );
        })}
      </div>
      <Backup byId={byId} />
      {importing && <Import byId={byId} onClose={() => setImporting(false)} />}
      {adding && <AddBook onDone={id => { setAdding(false); if (id) onOpen(id); }} />}
    </>
  );
}
