import { useMemo, useState } from "react";
import Fuse from "fuse.js";
import { books, moods, warningCategories, warningState, pagesLabel, catLabel } from "./catalogue";
import { MoodChip, Cover, WarningBadge } from "./components";
import { store, useLibrary } from "./store";

type Tri = 0 | 1 | 2; // off / include / exclude

export default function Discover({ onOpen }: { onOpen: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [moodSel, setMoodSel] = useState<Record<string, Tri>>({});
  const [pMin, setPMin] = useState("");
  const [pMax, setPMax] = useState("");
  const lib = useLibrary();
  const exCats = lib.excluded; // saved with your library, so it also applies to your to-read list
  const setExCats = (f: (s: string[]) => string[]) => store.setExcluded(f(lib.excluded));
  const [hideUnassessed, setHideUnassessed] = useState(false);
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

  const cycle = (id: string) => setMoodSel(s => ({ ...s, [id]: (((s[id] ?? 0) + 1) % 3) as Tri }));
  const toggleCat = (c: string) => setExCats(s => (s.includes(c) ? s.filter(x => x !== c) : [...s, c]));

  return (
    <>
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
            <button key={b.id} className="card" onClick={() => onOpen(b.id)}>
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
    </>
  );
}
