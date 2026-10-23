import { useMemo, useState } from "react";
import type { Book } from "./types";
import { useLibrary, store } from "./store";
import { isDate, stars } from "./format";
import { moodById } from "./catalogue";

const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
function top(counts: Map<string, number>, n = 5) { return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n); }
function bump(m: Map<string, number>, k: string) { m.set(k, (m.get(k) ?? 0) + 1); }

export default function Stats({ byId }: { byId: Map<string, Book> }) {
  const lib = useLibrary();
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const [goalInput, setGoalInput] = useState("");

  const s = useMemo(() => {
    const finished = lib.sessions.filter(x => x.status === "read");
    const dated = finished.filter(x => isDate(x.finishDate));
    const years = new Set<number>([thisYear]); dated.forEach(x => years.add(Number(x.finishDate!.slice(0, 4))));
    const perYear = new Map<number, number>(); dated.forEach(x => { const y = Number(x.finishDate!.slice(0, 4)); perYear.set(y, (perYear.get(y) ?? 0) + 1); });
    let pages = 0, noPages = 0;
    const authors = new Map<string, number>(), mood = new Map<string, number>(), genre = new Map<string, number>();
    for (const x of finished) {
      const b = byId.get(x.bookRef); if (!b) { noPages++; continue; }
      if (b.pages.estimate) pages += b.pages.estimate; else noPages++;
      b.authors.forEach(a => bump(authors, a)); b.moods.forEach(m => bump(mood, m)); b.genres.forEach(g => bump(genre, g));
    }
    const rated = lib.sessions.filter(x => x.rating);
    const avg = rated.length ? rated.reduce((a, x) => a + (x.rating ?? 0), 0) / rated.length : null;
    const history = [...finished].sort((a, b) => (b.finishDate ?? "").localeCompare(a.finishDate ?? ""));
    return { finished, dated, years: [...years].sort((a, b) => b - a), perYear, pages, noPages, authors, mood, genre, avg, ratedCount: rated.length, history, dnf: lib.sessions.filter(x => x.status === "dnf") };
  }, [lib, byId, thisYear]);

  const months = Array.from({ length: 12 }, (_, i) => s.dated.filter(x => x.finishDate!.startsWith(`${year}-${String(i + 1).padStart(2, "0")}`)).length);
  const maxM = Math.max(1, ...months);
  const goal = lib.goals.find(g => g.year === thisYear);
  const doneThisYear = s.perYear.get(thisYear) ?? 0;
  const title = (id: string) => byId.get(id)?.title ?? "Book no longer in the catalogue";

  return (
    <>
      <h2 className="pagetitle">My reading stats</h2>
      {lib.sessions.length === 0 && <p className="notice">No reading records yet. Statistics are calculated from your own records, so they will appear once you add books and dates.</p>}

      <section className="panel"><h3>Reading goal for {thisYear}</h3>
        {goal ? <>
          <p>{doneThisYear} of {goal.target} books finished.</p>
          <div className="progress"><div style={{ width: `${Math.min(100, (doneThisYear / goal.target) * 100)}%` }} /></div>
        </> : <p className="small">No goal set.</p>}
        <div className="row"><input type="number" min={1} placeholder="Books this year" value={goalInput} onChange={e => setGoalInput(e.target.value)} />
          <button className="btn" onClick={() => { const n = Number(goalInput); if (Number.isInteger(n) && n > 0) { store.setGoal(thisYear, n); setGoalInput(""); } }}>Set goal</button>
          {goal && <button className="btn" onClick={() => store.setGoal(thisYear, 0)}>Clear</button>}</div>
        <p className="small">Counts books marked Read with a finish date in {thisYear}.</p>
      </section>

      <section className="panel"><h3>Books finished</h3>
        <div className="chips">{s.years.map(y => <button key={y} className={`chip btn-chip plain ${y === year ? "s1" : ""}`} onClick={() => setYear(y)}>{y} · {s.perYear.get(y) ?? 0}</button>)}</div>
        <div className="bars" role="img" aria-label={`Books finished per month in ${year}`}>
          {months.map((n, i) => <div key={i} className="barcol"><span className="small">{n || ""}</span><div className="bar" style={{ height: `${(n / maxM) * 100}px` }} /><span className="small">{MONTHS[i]}</span></div>)}
        </div>
        {s.finished.length > s.dated.length && <p className="small">{s.finished.length - s.dated.length} finished book(s) have no finish date, so they are not in the monthly view.</p>}
      </section>

      <section className="panel"><h3>At a glance</h3>
        <p>Books finished: <strong>{s.finished.length}</strong></p>
        <p>Estimated pages read: <strong>{s.pages.toLocaleString()}</strong>{s.noPages > 0 && <span className="small"> ({s.noPages} finished book(s) without a page count are not included)</span>}</p>
        <p>Average rating: <strong>{s.avg === null ? "no ratings yet" : `${s.avg.toFixed(2)} ${stars(Math.round(s.avg * 2) / 2)}`}</strong>{s.avg !== null && <span className="small"> (from {s.ratedCount} rated)</span>}</p>
      </section>

      <section className="panel"><h3>Most frequent in books you finished</h3>
        {s.finished.length === 0 ? <p className="small">Finish a book to see this.</p> : <>
          <p className="small">Authors</p><div className="chips">{top(s.authors).map(([a, n]) => <span key={a} className="chip plain">{a} · {n}</span>)}</div>
          <p className="small">Moods</p><div className="chips">{top(s.mood).map(([m, n]) => <span key={m} className="chip" style={{ background: moodById(m)?.bg, color: moodById(m)?.text }}>{moodById(m)?.label ?? m} · {n}</span>)}{s.mood.size === 0 && <span className="small">No mood data for these books.</span>}</div>
          <p className="small">Genres</p><div className="chips">{top(s.genre).map(([g, n]) => <span key={g} className="chip plain">{g} · {n}</span>)}{s.genre.size === 0 && <span className="small">No genre data.</span>}</div>
        </>}
      </section>

      <section className="panel"><h3>Reading history</h3>
        {s.history.length === 0 ? <p className="small">No finished books yet.</p> : <ul className="plainlist">{s.history.map(x => <li key={x.id}><strong>{title(x.bookRef)}</strong> <span className="small">{x.finishDate ?? "no finish date"}</span> <span className="stars">{stars(x.rating)}</span></li>)}</ul>}
      </section>

      <section className="panel"><h3>Did not finish</h3>
        {s.dnf.length === 0 ? <p className="small">None.</p> : <ul className="plainlist">{s.dnf.map(x => <li key={x.id}><strong>{title(x.bookRef)}</strong> <span className="small">{x.finishDate ?? x.startDate ?? ""}</span></li>)}</ul>}
      </section>
    </>
  );
}
