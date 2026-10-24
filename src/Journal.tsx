import { useMemo, useState } from "react";
import type { Book, Library, Status } from "./types";
import { moods } from "./catalogue";
import { Cover, MoodChip, StatusBadge, FavBadge } from "./components";
import { STATUSES, STATUS_STYLE, statusLabel, stars, newId, splitList, csvEscape, download } from "./format";
import { store, useLibrary, normalizeLibrary } from "./store";
import Import from "./Import";
import { useSyncStatus, connect, disconnect, syncNow, resolveConflict, getConnection } from "./sync";
import type { Session } from "./types";
import Fuse from "fuse.js";
import { findMatch } from "./importer";
import { books, warningState, catLabel } from "./catalogue";

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

function LinkBanner() {
  const lib = useLibrary();
  const links = lib.customBooks.map(c => ({ c, m: findMatch(c.title, c.authors.join(" "), books) }))
    .filter((x): x is { c: typeof x.c; m: { kind: "matched"; id: string; candidates: string[] } } => x.m.kind === "matched");
  if (!links.length) return null;
  return (
    <div className="notice">
      <p>{links.length} of your own book{links.length === 1 ? " is" : "s are"} now in the catalogue: {links.slice(0, 5).map(l => l.c.title).join(", ")}{links.length > 5 ? "…" : ""}. Link {links.length === 1 ? "it" : "them"} to get the catalogue details and warnings. Your dates, ratings and reviews move over unchanged.</p>
      <button className="btn primary" onClick={() => store.relink(Object.fromEntries(links.map(l => [l.c.id, l.m.id])))}>Link {links.length} book{links.length === 1 ? "" : "s"}</button>
    </div>
  );
}


const summ = (s: Session | null) => (s ? `${statusLabel(s.status)}${s.rating ? ` · ${stars(s.rating)}` : ""} · ${s.startDate ?? "?"} → ${s.finishDate ?? "—"}${s.review ? " · has review" : ""}` : "deleted in the Sheet");

function SyncPanel({ byId }: { byId: Map<string, Book> }) {
  const st = useSyncStatus();
  const [url, setUrl] = useState(getConnection().url);
  const [token, setToken] = useState(getConnection().token);
  return (
    <details className="panel" open={st.configured && (st.conflicts.length > 0 || st.state === "error") ? true : undefined}>
      <summary>Sync with Google Sheet {st.configured ? "✓" : ""}</summary>
      <p className="small">Keeps your journal in a Google Sheet you own, so your laptop and phone share it. The app still works offline and syncs when it can. Edit rows in the Sheet and they appear here; add a row with a title and author and it is matched to a book.</p>
      <div className="form">
        <label>Web app URL<input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://script.google.com/macros/s/…/exec" /></label>
        <label>Token (the phrase you put in the script)<input type="password" value={token} onChange={e => setToken(e.target.value)} /></label>
        <div className="row">
          <button className="btn primary" disabled={!url.trim() || !token.trim()} onClick={() => void connect(url, token, books)}>{st.configured ? "Save and sync" : "Connect and sync"}</button>
          {st.configured && <button className="btn" onClick={() => void syncNow(books)}>Sync now</button>}
          {st.configured && <button className="btn" onClick={() => { if (window.confirm("Disconnect from the Sheet? Your data stays in the app and in the Sheet.")) { disconnect(); setUrl(""); setToken(""); } }}>Disconnect</button>}
        </div>
      </div>
      {st.message && <p className={st.state === "error" ? "notice" : "small"}>{st.message}{st.lastSync && st.state === "ok" ? ` (${new Date(st.lastSync).toLocaleTimeString()})` : ""}</p>}
      {st.conflicts.map(c => (
        <div className="notice" key={c.id}>
          <strong>{byId.get(c.local.bookRef)?.title ?? "A book"}</strong> was changed in both places.
          <div className="small">In the app: {summ(c.local)}</div>
          <div className="small">In the Sheet: {summ(c.remote)}</div>
          <div className="row"><button className="btn" onClick={() => void resolveConflict(c.id, "app", books)}>Keep the app version</button><button className="btn" onClick={() => void resolveConflict(c.id, "sheet", books)}>Keep the Sheet version</button></div>
        </div>
      ))}
      {st.problems.length > 0 && <div className="notice"><p>These Sheet rows were skipped, so nothing was changed. Fix them in the Sheet:</p><ul className="plainlist">{st.problems.slice(0, 10).map((p, i) => <li key={i} className="small">{p}</li>)}</ul></div>}
    </details>
  );
}

export default function Journal({ byId, onOpen }: { byId: Map<string, Book>; onOpen: (id: string) => void }) {
  const lib = useLibrary();
  const [filter, setFilter] = useState<Status | "all">("all");
  const [favOnly, setFavOnly] = useState(false);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [q, setQ] = useState("");
  const isExcluded = (s: { bookRef: string; status: Status }) => {
    const b = byId.get(s.bookRef);
    return s.status === "want" && !!b && lib.excluded.some(c => warningState(b, c) === "present");
  };
  const hiddenCount = lib.sessions.filter(isExcluded).length;
  const matchIds = useMemo(() => {
    if (!q.trim()) return null;
    const mine = [...new Set(lib.sessions.map(s => s.bookRef))].map(id => byId.get(id)).filter((b): b is Book => !!b);
    return new Set(new Fuse(mine, { keys: ["title", "authors"], threshold: 0.3, ignoreLocation: true }).search(q.trim()).map(r => r.item.id));
  }, [q, lib.sessions, byId]);
  const list = lib.sessions.filter(s => (!matchIds || matchIds.has(s.bookRef)) && (showHidden || !isExcluded(s)) && (filter === "all" || s.status === filter) && (!favOnly || s.favorite)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return (
    <>
      <div className="row between">
        <h2 className="pagetitle">My journal</h2>
        <div className="row"><button className="btn" onClick={() => setImporting(true)}>Import…</button><button className="btn primary" onClick={() => setAdding(true)}>＋ Add my own book</button></div>
      </div>
      <input type="search" className="jsearch" placeholder="Search my journal by title or author…" value={q} onChange={e => setQ(e.target.value)} />
      <div className="chips">
        {([["all", "All"], ...STATUSES.map(s => [s.id, s.label])] as [string, string][]).map(([id, label]) => (
          <button key={id} className={`chip btn-chip plain ${filter === id ? "s1" : ""}`} style={id !== "all" ? { background: STATUS_STYLE[id as Status].bg, color: STATUS_STYLE[id as Status].text } : undefined} onClick={() => setFilter(id as Status | "all")}>{label}</button>
        ))}
        <button className={`chip btn-chip plain ${favOnly ? "s1" : ""}`} style={{ background: STATUS_STYLE.favorite.bg, color: STATUS_STYLE.favorite.text }} onClick={() => setFavOnly(v => !v)}>♥ Favorites</button>
      </div>
      <LinkBanner />
      {hiddenCount > 0 && (
        <p className="small">{hiddenCount} to-read book{hiddenCount === 1 ? " is" : "s are"} {showHidden ? "shown" : "hidden"} because of warnings you excluded ({lib.excluded.map(catLabel).join(", ")}). <button className="link" onClick={() => setShowHidden(v => !v)}>{showHidden ? "Hide them" : "Show them"}</button></p>
      )}
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
                <p className="meta"><StatusBadge status={s.status} /> {s.favorite && <FavBadge />} <span className="stars">{stars(s.rating)}</span></p>
                <p className="small">{s.startDate ?? "?"} → {s.finishDate ?? "—"}</p>
                {b && <div className="chips">{b.moods.slice(0, 2).map(m => <MoodChip key={m} id={m} />)}</div>}
              </div>
            </button>
          );
        })}
      </div>
      <SyncPanel byId={byId} />
      <Backup byId={byId} />
      {importing && <Import byId={byId} onClose={() => setImporting(false)} />}
      {adding && <AddBook onDone={id => { setAdding(false); if (id) onOpen(id); }} />}
    </>
  );
}
