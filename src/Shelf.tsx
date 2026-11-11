import { useEffect, useMemo, useState } from "react";
import type { Book, Status } from "./types";
import { moodById, books as catalogue } from "./catalogue";
import { STATUSES, STATUS_STYLE } from "./format";
import { store, useLibrary } from "./store";
import { SEASONS, THEMES, GarlandFor, seasonKey, seasonOf, inSeason, type Season, type Theme } from "./seasons";
import { StatusBadge, CoverArt } from "./components";
import { suggest, SEASON_MOODS } from "./suggest";

const hash = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };
const FALLBACK = [["#8B5E3C", "#FFF3E0"], ["#6B7F5E", "#F3F8EE"], ["#A15C5C", "#FFF0F0"], ["#5E6B8B", "#EEF2FF"], ["#B08B4F", "#FFF8E6"]];

function usePerRow() {
  const [w, setW] = useState(() => (typeof window === "undefined" ? 800 : window.innerWidth));
  useEffect(() => { const f = () => setW(window.innerWidth); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f); }, []);
  return w < 520 ? { spines: 5, faces: 3 } : { spines: 9, faces: 5 };
}

function Face({ book, status, onOpen, action, why }: { book: Book; status?: Status; onOpen: () => void; action?: React.ReactNode; why?: string }) {
  return (
    <div className="facewrap">
      <button className="face" onClick={onOpen} aria-label={`${book.title} by ${book.authors.join(", ")}`} title={why ? `${book.title} · ${why}` : book.title}>
        <CoverArt b={book} />
        {status && <span className="sdot2" style={{ background: STATUS_STYLE[status].text, borderColor: STATUS_STYLE[status].bg }} />}
      </button>
      {action}
    </div>
  );
}

function RowShell({ i, theme, season, label, children }: { i: number; theme: Theme; season: Season; label?: string; children: React.ReactNode }) {
  const Decor = theme.decor[i % theme.decor.length], left = i % 2 === 0;
  return (
    <div className="shelfrow" style={{ borderBottomColor: theme.plank }}>
      {(i === 0 || i === 2) && <div className="garlandwrap"><GarlandFor season={season} /></div>}
      {label && <span className="shelflabel" style={{ background: theme.plank, color: theme.ink }}>{label}</span>}
      <div className="rowinner">
        {left && <div className="decorslot"><Decor /></div>}
        {children}
        {!left && <div className="decorslot"><Decor /></div>}
      </div>
    </div>
  );
}

function Spine({ book, status, edit, onOpen, onRemove }: { book: Book; status?: Status; edit: boolean; onOpen: () => void; onRemove: () => void }) {
  const h = hash(book.id), m = moodById(book.moods[0] ?? "");
  const [fb, ft] = FALLBACK[h % FALLBACK.length];
  const bg = m?.bg ?? fb, fg = m?.text ?? ft;
  const height = 120 + (h % 48), width = Math.max(26, Math.min(46, 24 + (book.pages.estimate ?? 300) / 18));
  return (
    <div className="spinewrap">
      <button className="spine" style={{ background: bg, color: fg, height, width }} onClick={onOpen} aria-label={`${book.title} by ${book.authors.join(", ")}`} title={book.title}>
        {status && <span className="sdot" style={{ background: STATUS_STYLE[status].text, borderColor: STATUS_STYLE[status].bg }} />}
        <span className="st">{book.title}</span>
        <span className="sa">{book.authors[0]}</span>
      </button>
      {edit && <button className="sx" onClick={onRemove} aria-label={`Remove ${book.title}`}>×</button>}
    </div>
  );
}

function Picker({ byId, selected, onToggle, onClose }: { byId: Map<string, Book>; selected: string[]; onToggle: (id: string) => void; onClose: () => void }) {
  const lib = useLibrary();
  const [q, setQ] = useState(""); const [f, setF] = useState<Status | "all">("all");
  const list = useMemo(() => {
    const latest = new Map<string, Status>();
    [...lib.sessions].sort((a, b) => a.updatedAt.localeCompare(b.updatedAt)).forEach(s => latest.set(s.bookRef, s.status));
    return [...latest.entries()].map(([id, st]) => ({ b: byId.get(id), st })).filter((x): x is { b: Book; st: Status } => !!x.b)
      .filter(x => (f === "all" || x.st === f) && (!q.trim() || (x.b.title + " " + x.b.authors.join(" ")).toLowerCase().includes(q.trim().toLowerCase())))
      .sort((a, b) => a.b.title.localeCompare(b.b.title));
  }, [lib.sessions, byId, q, f]);
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <button className="close" onClick={onClose} aria-label="Close">×</button>
        <h2>Choose books for this shelf</h2>
        <input type="search" className="jsearch" placeholder="Search my books…" value={q} onChange={e => setQ(e.target.value)} />
        <div className="chips">
          <button className={`chip btn-chip plain ${f === "all" ? "s1" : ""}`} onClick={() => setF("all")}>All</button>
          {STATUSES.map(s => <button key={s.id} className={`chip btn-chip plain ${f === s.id ? "s1" : ""}`} style={{ background: STATUS_STYLE[s.id].bg, color: STATUS_STYLE[s.id].text }} onClick={() => setF(s.id)}>{s.label}</button>)}
        </div>
        <ul className="plainlist">
          {list.map(({ b, st }) => (
            <li key={b.id}><label className="pickrow"><input type="checkbox" checked={selected.includes(b.id)} onChange={() => onToggle(b.id)} />
              <span><strong>{b.title}</strong> <span className="small">{b.authors[0]}</span></span> <StatusBadge status={st} /></label></li>
          ))}
          {list.length === 0 && <li className="small">No books match. Add books to your journal first, then pick them here.</li>}
        </ul>
        <div className="row"><button className="btn primary" onClick={onClose}>Done ({selected.length} on this shelf)</button></div>
      </div>
    </div>
  );
}

export default function Shelf({ byId, onOpen }: { byId: Map<string, Book>; onOpen: (id: string) => void }) {
  const lib = useLibrary();
  const now = useMemo(() => seasonOf(), []);
  const [season, setSeason] = useState<Season>(now.season);
  const [year, setYear] = useState(now.year);
  const [edit, setEdit] = useState(false);
  const [picking, setPicking] = useState(false);
  const [msg, setMsg] = useState("");
  const per = usePerRow();
  const [seed, setSeed] = useState(1);
  const key = seasonKey(year, season), theme = THEMES[season];
  const ids = lib.shelves[key] ?? [];
  const books = ids.map(id => byId.get(id)).filter((b): b is Book => !!b);
  const statusOf = useMemo(() => {
    const m = new Map<string, Status>();
    [...lib.sessions].sort((a, b) => a.updatedAt.localeCompare(b.updatedAt)).forEach(s => m.set(s.bookRef, s.status));
    return m;
  }, [lib.sessions]);

  const reading = useMemo(() => {
    const seen = new Set<string>(), out: Book[] = [];
    for (const x of [...lib.sessions].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))) {
      if (x.status !== "reading" || seen.has(x.bookRef)) continue;
      const b = byId.get(x.bookRef); if (b) { seen.add(x.bookRef); out.push(b); }
    }
    return out.slice(0, per.faces);
  }, [lib.sessions, byId, per.faces]);
  const suggestions = useMemo(() => suggest({ season, books: catalogue, sessions: lib.sessions, excluded: lib.excluded, skip: new Set(ids), seed, limit: per.faces }),
    [season, lib.sessions, lib.excluded, ids, seed, per.faces]);

  function fill() {
    const have = new Set(ids), add: string[] = [];
    for (const s of lib.sessions) {
      const finished = s.status === "read" && !!s.finishDate && inSeason(s.finishDate, year, season);
      const reading = s.status === "reading" && season === now.season && year === now.year;
      if ((finished || reading) && !have.has(s.bookRef)) { have.add(s.bookRef); add.push(s.bookRef); }
    }
    if (add.length) store.setShelf(key, [...ids, ...add]);
    setMsg(add.length ? `Added ${add.length} book${add.length === 1 ? "" : "s"} from your journal.` : "No new books found. This fills from books you marked Read with a finish date in this season, plus what you're reading now.");
  }
  const toggle = (id: string) => store.setShelf(key, ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]);

  const rows: Book[][] = [];
  for (let i = 0; i < books.length; i += per.spines) rows.push(books.slice(i, i + per.spines));
  if (!rows.length) rows.push([]);

  return (
    <>
      <h2 className="pagetitle">My seasonal shelf</h2>
      <div className="seasonbar">
        {SEASONS.map(s => (
          <button key={s} className={`chip btn-chip plain ${s === season ? "s1" : ""}`} onClick={() => { setSeason(s); setMsg(""); }}>{THEMES[s].emoji} {THEMES[s].label}</button>
        ))}
        <span className="yearpick"><button className="link big" onClick={() => setYear(y => y - 1)} aria-label="Previous year">‹</button> {year} <button className="link big" onClick={() => setYear(y => y + 1)} aria-label="Next year">›</button></span>
      </div>
      <div className="row">
        <button className="btn primary" onClick={() => setPicking(true)}>＋ Choose books</button>
        <button className="btn" onClick={fill}>Fill from my journal</button>
        <button className="btn" onClick={() => setSeed(x => x + 1)}>New suggestions</button>
        <button className="btn" onClick={() => setEdit(v => !v)}>{edit ? "Done editing" : "Edit shelf"}</button>
      </div>
      {msg && <p className="small">{msg}</p>}
      <div className="bookcase" style={{ background: theme.wall, borderColor: theme.wood, color: theme.ink }}>
        <RowShell i={0} theme={theme} season={season} label="Currently reading">
          {reading.length ? reading.map(b => <Face key={b.id} book={b} status="reading" onOpen={() => onOpen(b.id)} />)
            : <p className="shelfhint">Nothing in progress yet. Set a book to “Currently Reading” in Discover and it appears here.</p>}
        </RowShell>
        <RowShell i={1} theme={theme} season={season} label={`Suggestions for ${theme.label.toLowerCase()}`}>
          {suggestions.length ? suggestions.map(({ book, why }) => (
            <Face key={book.id} book={book} status={statusOf.get(book.id)} why={why.join(" · ")} onOpen={() => onOpen(book.id)}
              action={<button className="facebtn" onClick={() => toggle(book.id)} aria-label={ids.includes(book.id) ? "On this shelf" : `Add ${book.title} to this season's shelf`}>{ids.includes(book.id) ? "✓" : "＋"}</button>} />
          )) : <p className="shelfhint">No suggestions right now. Add more books to your want-to-read list.</p>}
        </RowShell>
        {rows.map((row, i) => (
          <RowShell key={i} i={i + 2} theme={theme} season={season} label={i === 0 ? "My picks" : undefined}>
            {row.map(b => <Spine key={b.id} book={b} status={statusOf.get(b.id)} edit={edit} onOpen={() => onOpen(b.id)} onRemove={() => toggle(b.id)} />)}
          </RowShell>
        ))}
      </div>
      <p className="small">Suggestions favor books on your want-to-read list that fit {theme.label.toLowerCase()} moods ({SEASON_MOODS[season].join(", ")}). Books with warnings you excluded are never suggested. Tap ＋ to add one to “My picks”.</p>
      <p className="small">{books.length === 0 ? "This shelf is empty. Choose books, or fill it from your journal." : `${books.length} book${books.length === 1 ? "" : "s"} on this shelf. Tap a spine to open the book. The dot at the top shows its status.`}</p>
      {picking && <Picker byId={byId} selected={ids} onToggle={toggle} onClose={() => setPicking(false)} />}
    </>
  );
}
