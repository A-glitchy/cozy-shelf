import { useMemo, useState } from "react";
import Fuse from "fuse.js";
import { books, moods, moodById, warningCategories, warningState, pagesLabel, catLabel, verLabel } from "./catalogue";
import type { Book } from "./types";

type Tri = 0 | 1 | 2; // off / include / exclude

function MoodChip({ id }: { id: string }) {
  const m = moodById(id);
  return <span className="chip" style={{ background: m?.bg, color: m?.text }}>{m?.label ?? id}</span>;
}

function Cover({ b }: { b: Book }) {
  const m = moodById(b.moods[0]);
  return (
    <div className="cover" style={{ background: m?.bg, color: m?.text }} aria-hidden>
      <span>{b.title}</span>
    </div>
  );
}

function WarningBadge({ b, exCats }: { b: Book; exCats: string[] }) {
  const present = b.warnings.filter(w => w.presence === "present");
  const unassessed = exCats.filter(c => warningState(b, c) === "unassessed");
  return (
    <div className="badges">
      {present.length > 0 && <span className="badge warn">⚠ {present.length} warning{present.length > 1 ? "s" : ""} noted</span>}
      {b.warningsReviewed === "none" && <span className="badge unk">Warnings not assessed</span>}
      {unassessed.length > 0 && b.warningsReviewed !== "none" && (
        <span className="badge unk">Not assessed for: {unassessed.map(catLabel).join(", ")}</span>
      )}
    </div>
  );
}

function Detail({ b, onClose }: { b: Book; onClose: () => void }) {
  const [shown, setShown] = useState<Record<number, boolean>>({});
  return (
    <div className="overlay" onClick={onClose}>
      <article className="sheet" onClick={e => e.stopPropagation()} role="dialog" aria-label={b.title}>
        <button className="close" onClick={onClose} aria-label="Close">×</button>
        <h2>{b.title}</h2>
        <p className="by">by {b.authors.join(", ")}</p>
        <p>{b.summary}</p>
        <p className="meta">
          {pagesLabel(b)} {b.pages.estimate !== null && <em>({b.pages.confidence} confidence)</em>}
        </p>
        <p className="meta small">{b.pages.source}</p>
        <div className="chips">{b.moods.map(m => <MoodChip key={m} id={m} />)}</div>
        <p className="meta small">{[...b.genres, ...b.subgenres].join(" · ")}</p>
        <h3>Content warnings</h3>
        {b.warnings.length === 0 ? (
          <p className="notice">No warnings have been recorded for this book. That does not mean it is warning-free.</p>
        ) : (
          <>
            <ul className="warnings">
              {b.warnings.map((w, i) => (
                <li key={i}>
                  <strong>{catLabel(w.category)}{w.subcategory ? ` – ${w.subcategory}` : ""}</strong>{" "}
                  <span className={`badge ${w.verification === "verified" ? "ok" : "unk"}`}>{verLabel[w.verification]}</span>
                  {w.intensity && <span className="badge unk">{w.intensity}</span>}
                  {w.note && <div className="small">{w.note}</div>}
                  {w.spoilerNote && (shown[i]
                    ? <div className="small spoiler">{w.spoilerNote}</div>
                    : <button className="link" onClick={() => setShown({ ...shown, [i]: true })}>Reveal spoiler details</button>)}
                  {w.evidence?.map((e, j) => <div className="small" key={j}>Source: {e.label}</div>)}
                </li>
              ))}
            </ul>
            {b.warningsReviewed !== "complete" && (
              <p className="notice">Warning research is {b.warningsReviewed === "none" ? "not done" : "incomplete"} for this book; other topics may be present.</p>
            )}
          </>
        )}
        <p className="meta small">Catalogue entry status: {b.research.status}, last reviewed {b.research.lastReviewed}.</p>
      </article>
    </div>
  );
}

export default function App() {
  const [q, setQ] = useState("");
  const [moodSel, setMoodSel] = useState<Record<string, Tri>>({});
  const [pMin, setPMin] = useState("");
  const [pMax, setPMax] = useState("");
  const [exCats, setExCats] = useState<string[]>([]);
  const [hideUnassessed, setHideUnassessed] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const fuse = useMemo(() => new Fuse(books, { keys: ["title", "authors", "genres", "subgenres"], threshold: 0.3, ignoreLocation: true }), []);

  const results = useMemo(() => {
    const incl = Object.keys(moodSel).filter(k => moodSel[k] === 1);
    const excl = Object.keys(moodSel).filter(k => moodSel[k] === 2);
    const list = q.trim() ? fuse.search(q.trim()).map(r => r.item) : [...books].sort((a, b) => a.title.localeCompare(b.title));
    const min = pMin ? Number(pMin) : null, max = pMax ? Number(pMax) : null;
    return list.filter(b => {
      if (incl.length && !incl.some(m => b.moods.includes(m))) return false;
      if (excl.some(m => b.moods.includes(m))) return false;
      if (min !== null || max !== null) {
        const p = b.pages.estimate;
        if (p === null || (min !== null && p < min) || (max !== null && p > max)) return false;
      }
      for (const c of exCats) {
        const s = warningState(b, c);
        if (s === "present" || (s === "unassessed" && hideUnassessed)) return false;
      }
      return true;
    });
  }, [q, moodSel, pMin, pMax, exCats, hideUnassessed, fuse]);

  const open = books.find(b => b.id === openId) ?? null;
  const cycle = (id: string) => setMoodSel(s => ({ ...s, [id]: (((s[id] ?? 0) + 1) % 3) as Tri }));
  const toggleCat = (c: string) => setExCats(s => (s.includes(c) ? s.filter(x => x !== c) : [...s, c]));

  return (
    <div className="app">
      <header>
        <h1>Cozy Shelf</h1>
        <nav className="tabs" aria-label="Sections">
          <span className="tab active">Discover</span>
          <span className="tab off" title="Planned">Journal · soon</span>
          <span className="tab off" title="Planned">Stats · soon</span>
        </nav>
      </header>
      <main>
        <div className="searchrow">
          <input type="search" placeholder="Search title, author, genre…" value={q} onChange={e => setQ(e.target.value)} />
          <button className="btn mobile-only" onClick={() => setShowFilters(v => !v)}>{showFilters ? "Hide filters" : "Filters"}</button>
        </div>
        <section className={`filters ${showFilters ? "open" : ""}`}>
          <h3>Moods <small>(tap once to include, twice to exclude)</small></h3>
          <div className="chips">
            {moods.map(m => {
              const s = moodSel[m.id] ?? 0;
              return (
                <button key={m.id} className={`chip btn-chip s${s}`} style={{ background: m.bg, color: m.text }} onClick={() => cycle(m.id)} aria-pressed={s > 0}>
                  {s === 1 ? "✓ " : s === 2 ? "✕ " : ""}{m.label}
                </button>
              );
            })}
          </div>
          <h3>Pages</h3>
          <div className="pages">
            <input type="number" min={0} placeholder="min" value={pMin} onChange={e => setPMin(e.target.value)} />
            <span>to</span>
            <input type="number" min={0} placeholder="max" value={pMax} onChange={e => setPMax(e.target.value)} />
          </div>
          <h3>Exclude books with these warnings</h3>
          <div className="chips">
            {warningCategories.map(c => (
              <button key={c} className={`chip btn-chip plain ${exCats.includes(c) ? "s2" : ""}`} onClick={() => toggleCat(c)} aria-pressed={exCats.includes(c)}>
                {exCats.includes(c) ? "✕ " : ""}{catLabel(c)}
              </button>
            ))}
          </div>
          {exCats.length > 0 && (
            <label className="check">
              <input type="checkbox" checked={hideUnassessed} onChange={e => setHideUnassessed(e.target.checked)} />
              Also hide books not yet assessed for these categories (otherwise they stay visible, marked “not assessed”)
            </label>
          )}
        </section>
        <p className="count">{results.length} of {books.length} books</p>
        <div className="grid">
          {results.map(b => (
            <button key={b.id} className="card" onClick={() => setOpenId(b.id)}>
              <Cover b={b} />
              <div className="info">
                <h2>{b.title}</h2>
                <p className="by">{b.authors.join(", ")}</p>
                <p className="meta small">{pagesLabel(b)}</p>
                <div className="chips">{b.moods.slice(0, 3).map(m => <MoodChip key={m} id={m} />)}</div>
                <WarningBadge b={b} exCats={exCats} />
              </div>
            </button>
          ))}
          {results.length === 0 && <p className="notice">No books match these filters.</p>}
        </div>
      </main>
      {open && <Detail b={open} onClose={() => setOpenId(null)} />}
    </div>
  );
}
