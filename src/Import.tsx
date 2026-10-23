import { useMemo, useState } from "react";
import type { Book, CustomBook, Session, Status } from "./types";
import { STATUSES, newId, csvEscape, download, statusLabel, stars } from "./format";
import { FIELDS, emptyMapping, autoMap, parseCsv, parsePaste, analyze, plan, splitAuthors, type Field, type RowResult } from "./importer";
import { store, useLibrary } from "./store";

interface Summary { added: number; newBooks: number; dup: number; skipped: number; failed: number; lines: string[][] }

export default function Import({ byId, onClose }: { byId: Map<string, Book>; onClose: () => void }) {
  const lib = useLibrary();
  const [tab, setTab] = useState<"csv" | "paste">("csv");
  const [step, setStep] = useState<"input" | "map" | "preview" | "done">("input");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<Field, number>>(emptyMapping());
  const [paste, setPaste] = useState("");
  const [defaultStatus, setDefaultStatus] = useState<Status>("want");
  const [dateOrder, setDateOrder] = useState<"mdy" | "dmy">("mdy");
  const [choices, setChoices] = useState<Record<number, string>>({});
  const [err, setErr] = useState("");
  const [summary, setSummary] = useState<Summary | null>(null);
  const all = useMemo(() => [...byId.values()], [byId]);

  const results = useMemo<RowResult[]>(() => (step === "preview" ? analyze(rows, mapping, { dateOrder }, all) : []), [step, rows, mapping, dateOrder, all]);
  const plans = useMemo(() => plan(results, choices, lib.sessions, defaultStatus), [results, choices, lib.sessions, defaultStatus]);
  const count = (t: string) => plans.filter(p => p.type === t).length;

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; e.target.value = ""; if (!f) return;
    const parsed = parseCsv(await f.text());
    if (parsed.length < 2) { setErr("That file has no data rows."); return; }
    setHeaders(parsed[0]); setRows(parsed.slice(1)); setMapping(autoMap(parsed[0])); setErr(""); setStep("map");
  }
  function startPaste() {
    const parsed = parsePaste(paste);
    if (!parsed.length) { setErr("Paste at least one title."); return; }
    setRows(parsed); setMapping({ ...emptyMapping(), title: 0, author: 1 }); setErr(""); setChoices({}); setStep("preview");
  }
  function confirm() {
    const newBooks = new Map<string, CustomBook>(); const sessions: Session[] = []; const lines: string[][] = [];
    results.forEach((r, i) => {
      const p = plans[i];
      if (p.type !== "add") {
        lines.push([String(r.n), r.title, r.author, p.type === "dup" ? "skipped" : p.type === "error" ? "failed" : "skipped",
          p.type === "dup" ? "Already in your library (same book, status and dates)" : p.type === "error" ? p.reason : "Skipped by you"]);
        return;
      }
      let ref = p.ref;
      if (ref.startsWith("new:")) {
        let nb = newBooks.get(ref);
        if (!nb) { nb = { id: newId("usr"), title: r.title, authors: splitAuthors(r.author), pages: r.pages, genres: [], moods: [], createdAt: new Date().toISOString() }; newBooks.set(ref, nb); }
        ref = nb.id;
      }
      sessions.push({ id: newId("ses"), bookRef: ref, status: r.status ?? defaultStatus, startDate: r.startDate, finishDate: r.finishDate, rating: r.rating,
        review: r.review, notes: r.notes, favorite: r.favorite, tags: r.tags, updatedAt: new Date().toISOString() });
    });
    store.importBatch([...newBooks.values()], sessions);
    setSummary({ added: sessions.length, newBooks: newBooks.size, dup: count("dup"), skipped: count("skip"), failed: count("error"), lines });
    setStep("done");
  }
  const bookName = (id: string) => { const b = byId.get(id); return b ? `${b.title} — ${b.authors.join(", ")}${b.custom ? " (yours)" : ""}` : id; };
  const blocked = count("unresolved") > 0 || count("add") === 0;

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet wide" onClick={e => e.stopPropagation()}>
        <button className="close" onClick={onClose} aria-label="Close">×</button>
        <h2>Import books</h2>

        {step === "input" && <>
          <div className="chips">
            <button className={`chip btn-chip plain ${tab === "csv" ? "s1" : ""}`} onClick={() => setTab("csv")}>CSV file</button>
            <button className={`chip btn-chip plain ${tab === "paste" ? "s1" : ""}`} onClick={() => setTab("paste")}>Paste a list</button>
          </div>
          {tab === "csv" ? <>
            <p className="small">Choose a CSV file with a header row. Common column names (title, author, status or shelf, date read, rating, pages…) are detected automatically, and you can adjust the mapping in the next step. Nothing is imported until you confirm.</p>
            <label className="btn filebtn">Choose CSV file…<input type="file" accept=".csv,text/csv,text/plain" hidden onChange={onFile} /></label>
          </> : <>
            <p className="small">One book per line: <em>Title by Author</em>, <em>Title - Author</em>, <em>Title | Author</em>, or just a title.</p>
            <div className="form"><textarea rows={8} value={paste} onChange={e => setPaste(e.target.value)} placeholder={"Piranesi by Susanna Clarke\nThe Night Circus - Erin Morgenstern"} />
              <label>Add them as<select value={defaultStatus} onChange={e => setDefaultStatus(e.target.value as Status)}>{STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
              <div className="row"><button className="btn primary" onClick={startPaste}>Preview</button></div></div>
          </>}
          {err && <p className="notice">{err}</p>}
        </>}

        {step === "map" && <>
          <p className="small">Match your file's columns to the app's fields. {rows.length} data rows found.</p>
          <div className="form">
            {FIELDS.map(f => (
              <label key={f.id}>{f.label}
                <select value={mapping[f.id]} onChange={e => setMapping({ ...mapping, [f.id]: Number(e.target.value) })}>
                  <option value={-1}>— not in my file —</option>
                  {headers.map((h, i) => <option key={i} value={i}>{h || `(column ${i + 1})`} — e.g. {rows[0]?.[i]?.slice(0, 30) ?? ""}</option>)}
                </select>
              </label>
            ))}
            <label>Dates like 03/04/2025 mean
              <select value={dateOrder} onChange={e => setDateOrder(e.target.value as "mdy" | "dmy")}><option value="mdy">March 4 (month first)</option><option value="dmy">3 April (day first)</option></select></label>
            <label>If a row has no status, add it as
              <select value={defaultStatus} onChange={e => setDefaultStatus(e.target.value as Status)}>{STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
            {mapping.title < 0 && <p className="notice">Choose which column holds the title.</p>}
            <div className="row"><button className="btn primary" disabled={mapping.title < 0} onClick={() => { setChoices({}); setStep("preview"); }}>Preview import</button>
              <button className="btn" onClick={() => setStep("input")}>Back</button></div>
          </div>
        </>}

        {step === "preview" && <>
          <p><strong>{count("add")}</strong> to add · <strong>{count("dup")}</strong> already in your library · <strong>{count("error")}</strong> with problems · <strong>{count("skip")}</strong> skipped by you{count("unresolved") > 0 && <> · <strong className="warnText">{count("unresolved")} need your decision</strong></>}</p>
          <p className="small">Your existing records are never changed. A book you've read before is added as a new reading only when its dates differ.</p>
          <div className="tablewrap"><table className="pv"><thead><tr><th>#</th><th>Book</th><th>Details</th><th>What happens</th></tr></thead><tbody>
            {results.map((r, i) => {
              const p = plans[i];
              const value = choices[r.n] ?? (r.match.kind === "matched" ? r.match.id : r.match.kind === "new" ? "new" : "");
              return (
                <tr key={r.n} className={p.type === "error" ? "bad" : ""}>
                  <td>{r.n}</td>
                  <td><strong>{r.title || "(no title)"}</strong><div className="small">{r.author}</div></td>
                  <td className="small">{statusLabel(r.status ?? defaultStatus)}{r.rating ? ` · ${stars(r.rating)}` : ""}<br />{r.startDate ?? "?"} → {r.finishDate ?? "—"}{r.warnings.map((w, j) => <div key={j}>ⓘ {w}</div>)}</td>
                  <td>
                    {p.type === "error" ? <span className="warnText">Will fail: {p.reason}</span> : <>
                      <select value={value} onChange={e => setChoices({ ...choices, [r.n]: e.target.value })}>
                        {r.match.kind === "ambiguous" && <option value="">Choose a match…</option>}
                        {r.match.candidates.map(id => <option key={id} value={id}>Match: {bookName(id)}</option>)}
                        <option value="new">Add as a new book of mine</option>
                        <option value="skip">Skip this row</option>
                      </select>
                      {p.type === "dup" && <div className="small">Already in your library, will be skipped</div>}
                    </>}
                  </td>
                </tr>
              );
            })}
          </tbody></table></div>
          <div className="row"><button className="btn primary" disabled={blocked} onClick={confirm}>Import {count("add")} reading record{count("add") === 1 ? "" : "s"}</button>
            <button className="btn" onClick={() => setStep(tab === "csv" ? "map" : "input")}>Back</button></div>
          {count("unresolved") > 0 && <p className="small">Choose a match (or add as new / skip) for each highlighted row before importing.</p>}
        </>}

        {step === "done" && summary && <>
          <p className="notice">Imported {summary.added} reading record{summary.added === 1 ? "" : "s"} and created {summary.newBooks} new book{summary.newBooks === 1 ? "" : "s"}.
            Skipped as duplicates: {summary.dup}. Skipped by you: {summary.skipped}. Failed: {summary.failed}.</p>
          {summary.lines.length > 0 && <>
            <ul className="plainlist">{summary.lines.slice(0, 15).map((l, i) => <li key={i} className="small">Row {l[0]}: {l[1] || "(no title)"} — {l[3]}: {l[4]}</li>)}</ul>
            {summary.lines.length > 15 && <p className="small">…and {summary.lines.length - 15} more in the download.</p>}
            <button className="btn" onClick={() => download("cozy-shelf-import-report.csv", "\ufeff" + [["Row", "Title", "Author", "Outcome", "Reason"], ...summary.lines].map(r => r.map(csvEscape).join(",")).join("\r\n"), "text/csv;charset=utf-8")}>Download skipped/failed rows (CSV)</button>
          </>}
          <div className="row"><button className="btn primary" onClick={onClose}>Done</button></div>
        </>}
      </div>
    </div>
  );
}
