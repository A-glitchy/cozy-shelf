import { useMemo, useState } from "react";
import { moodById, pagesLabel, catLabel, verLabel, warningState, books, customToBook } from "./catalogue";
import { recommend } from "./recommend";
import type { Book, Session, Status } from "./types";
import { STATUSES, STATUS_STYLE, statusLabel, stars, RATINGS, newId, splitList } from "./format";
import { store, useLibrary } from "./store";

export function StatusBadge({ status }: { status: Status }) {
  const c = STATUS_STYLE[status];
  return <span className="badge status" style={{ background: c.bg, color: c.text }}>{statusLabel(status)}</span>;
}
export function FavBadge() {
  const c = STATUS_STYLE.favorite;
  return <span className="badge status" style={{ background: c.bg, color: c.text }}>♥ Favorite</span>;
}
export function MoodChip({ id }: { id: string }) {
  const m = moodById(id);
  return <span className="chip" style={{ background: m?.bg ?? "#EEE5D2", color: m?.text ?? "#4A3426" }}>{m?.label ?? id}</span>;
}
export function Cover({ b, small }: { b: Book; small?: boolean }) {
  const m = moodById(b.moods[0] ?? "");
  return <div className={`cover ${small ? "small" : ""}`} style={{ background: m?.bg ?? "#EEE5D2", color: m?.text ?? "#4A3426" }} aria-hidden><span>{b.title}</span></div>;
}
export function WarningBadge({ b, exCats }: { b: Book; exCats: string[] }) {
  const present = b.warnings.filter(w => w.presence === "present");
  const unassessed = exCats.filter(c => warningState(b, c) === "unassessed");
  return (
    <div className="badges">
      {present.length > 0 && <span className="badge warn">⚠ {present.length} warning{present.length > 1 ? "s" : ""} noted</span>}
      {b.warningsReviewed === "none" && !b.custom && <span className="badge unk">Warnings not assessed</span>}
      {unassessed.length > 0 && b.warningsReviewed !== "none" && <span className="badge unk">Not assessed for: {unassessed.map(catLabel).join(", ")}</span>}
    </div>
  );
}

function SessionForm({ book, initial, onDone }: { book: Book; initial?: Session; onDone: () => void }) {
  const [status, setStatus] = useState<Status>(initial?.status ?? "want");
  const [start, setStart] = useState(initial?.startDate ?? "");
  const [finish, setFinish] = useState(initial?.finishDate ?? "");
  const [rating, setRating] = useState(initial?.rating?.toString() ?? "");
  const [review, setReview] = useState(initial?.review ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [fav, setFav] = useState(initial?.favorite ?? false);
  const [tags, setTags] = useState((initial?.tags ?? []).join(", "));
  const [err, setErr] = useState("");
  function save() {
    if (start && finish && finish < start) { setErr("The finish date is before the start date."); return; }
    store.upsertSession({
      id: initial?.id ?? newId("ses"), bookRef: book.id, status, startDate: start || undefined, finishDate: finish || undefined,
      rating: rating ? Number(rating) : undefined, review: review.trim() || undefined, notes: notes.trim() || undefined,
      favorite: fav, tags: splitList(tags), updatedAt: new Date().toISOString(),
    });
    onDone();
  }
  return (
    <div className="form">
      <label>Status
        <select value={status} onChange={e => setStatus(e.target.value as Status)}>{STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
      </label>
      <div className="two">
        <label>Started<input type="date" value={start} onChange={e => setStart(e.target.value)} /></label>
        <label>Finished<input type="date" value={finish} onChange={e => setFinish(e.target.value)} /></label>
      </div>
      {status === "read" && !finish && <p className="small">Add a finish date so this book counts in your monthly statistics.</p>}
      <label>Rating
        <select value={rating} onChange={e => setRating(e.target.value)}>
          <option value="">No rating</option>
          {RATINGS.map(r => <option key={r} value={r}>{stars(r)} ({r})</option>)}
        </select>
      </label>
      <label>Review<textarea rows={3} value={review} onChange={e => setReview(e.target.value)} /></label>
      <label>Private notes<textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} /></label>
      <label className="check"><input type="checkbox" checked={fav} onChange={e => setFav(e.target.checked)} /> Favorite</label>
      <label>Tags (comma separated)<input value={tags} onChange={e => setTags(e.target.value)} /></label>
      {err && <p className="notice">{err}</p>}
      <div className="row"><button className="btn primary" onClick={save}>Save</button><button className="btn" onClick={onDone}>Cancel</button></div>
    </div>
  );
}

function MyReading({ book }: { book: Book }) {
  const lib = useLibrary();
  const mine = lib.sessions.filter(s => s.bookRef === book.id).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <section>
      <h3>My reading</h3>
      {mine.length === 0 && editing !== "new" && <p className="small">You haven't added this book to your shelf yet.</p>}
      {mine.map(s => editing === s.id ? (
        <SessionForm key={s.id} book={book} initial={s} onDone={() => setEditing(null)} />
      ) : (
        <div className="session" key={s.id}>
          <div><StatusBadge status={s.status} /> {s.favorite && <FavBadge />} <span className="stars">{stars(s.rating)}</span></div>
          <div className="small">{s.startDate ?? "start date unknown"} → {s.finishDate ?? "no finish date"}</div>
          {s.review && <p className="small">“{s.review}”</p>}
          {s.notes && <p className="small">Notes: {s.notes}</p>}
          {s.tags.length > 0 && <div className="small">Tags: {s.tags.join(", ")}</div>}
          <div className="row">
            <button className="link" onClick={() => setEditing(s.id)}>Edit</button>
            <button className="link" onClick={() => { if (window.confirm("Delete this reading record?")) store.deleteSession(s.id); }}>Delete</button>
          </div>
        </div>
      ))}
      {editing === "new"
        ? <SessionForm book={book} onDone={() => setEditing(null)} />
        : <button className="btn" onClick={() => setEditing("new")}>{mine.length ? "＋ Log another reading (reread)" : "＋ Add to my shelf"}</button>}
    </section>
  );
}


function Similar({ book, onOpen }: { book: Book; onOpen: (id: string) => void }) {
  const lib = useLibrary();
  const [show, setShow] = useState(false);
  const recs = useMemo(() => {
    if (!show) return [];
    const custom = lib.customBooks.map(customToBook);
    const lookup = (id: string) => books.find(b => b.id === id) ?? custom.find(b => b.id === id);
    return recommend(book, [...books, ...custom], lib.sessions, lookup);
  }, [show, book, lib]);
  return (
    <section>
      <h3>Similar books</h3>
      {book.moods.length === 0 && book.genres.length === 0 ? (
        <p className="small">This book has no moods or genres yet, so there is nothing to compare. Similar books work from those tags, which come from the catalogue.</p>
      ) : !show ? <button className="btn" onClick={() => setShow(true)}>Find similar books</button> : recs.length === 0 ? (
        <p className="small">No similar books in the catalogue yet (books you've read, started or abandoned are left out).</p>
      ) : (
        <>
          <ul className="plainlist">{recs.map(r => (
            <li key={r.book.id}>
              <button className="link big" onClick={() => onOpen(r.book.id)}>{r.book.title}</button> <span className="small">by {r.book.authors.join(", ")}</span>
              <div className="small">{r.reasons.join(" · ")}</div>
              <WarningBadge b={r.book} exCats={[]} />
            </li>
          ))}</ul>
          <p className="small">Based only on tags in this catalogue (moods, genres, author) and your ratings. Check each book's warnings before reading.</p>
        </>
      )}
    </section>
  );
}

export function Detail({ b, onClose, onOpen }: { b: Book; onClose: () => void; onOpen: (id: string) => void }) {
  const [shown, setShown] = useState<Record<number, boolean>>({});
  return (
    <div className="overlay" onClick={onClose}>
      <article className="sheet" onClick={e => e.stopPropagation()} role="dialog" aria-label={b.title}>
        <button className="close" onClick={onClose} aria-label="Close">×</button>
        <h2>{b.title}</h2>
        <p className="by">by {b.authors.join(", ")}</p>
        {b.summary ? <p>{b.summary}</p> : <p className="small">No summary yet.</p>}
        <p className="meta">{pagesLabel(b)} {b.pages.estimate !== null && !b.custom && <em>({b.pages.confidence} confidence)</em>}</p>
        {!b.custom && <p className="meta small">{b.pages.source}</p>}
        <div className="chips">{b.moods.map(m => <MoodChip key={m} id={m} />)}</div>
        <p className="meta small">{[...b.genres, ...b.subgenres].join(" · ")}</p>
        <MyReading book={b} />
        {!b.custom && (
          <>
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
                      {w.spoilerNote && (shown[i] ? <div className="small spoiler">{w.spoilerNote}</div>
                        : <button className="link" onClick={() => setShown({ ...shown, [i]: true })}>Reveal spoiler details</button>)}
                      {w.evidence?.map((e, j) => <div className="small" key={j}>Source: {e.label}</div>)}
                    </li>
                  ))}
                </ul>
                {b.warningsReviewed !== "complete" && <p className="notice">Warning research is {b.warningsReviewed === "none" ? "not done" : "incomplete"} for this book; other topics may be present.</p>}
              </>
            )}
            <p className="meta small">Catalogue entry status: {b.research.status}, last reviewed {b.research.lastReviewed}.</p>
          </>
        )}
        <Similar book={b} onOpen={onOpen} />
        {b.custom && (
          <button className="link" onClick={() => {
            if (window.confirm("Remove this book and all your reading records for it?")) { store.removeCustomBook(b.id); onClose(); }
          }}>Remove this book from my library</button>
        )}
      </article>
    </div>
  );
}
