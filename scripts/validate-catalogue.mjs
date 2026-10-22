// Usage: node scripts/validate-catalogue.mjs
import fs from "node:fs"; import path from "node:path";
const dir = path.join(path.dirname(new URL(import.meta.url).pathname), "..", "data");
const errors = [];
const read = f => { try { return JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")); } catch (e) { errors.push(`${f}: malformed JSON (${e.message})`); return null; } };
const moods = new Set((read("moods.json") || []).map(m => m.id));
const cats = new Set(read("warning-categories.json") || []);
const PRES = ["present","absent","unknown"], VER = ["verified","unverified-research","community-report","disputed"];
const CONF = ["high","medium","low","unknown"], REV = ["none","partial","complete"], INT = ["mild","moderate","heavy"];
const ids = new Set(); let count = 0;
for (const f of fs.readdirSync(dir).filter(f => /^books-.*\.json$/.test(f))) {
  const list = read(f); if (!Array.isArray(list)) { errors.push(`${f}: must be an array`); continue; }
  list.forEach((b, i) => {
    const at = `${f}[${i}] ${b?.title ?? "?"}`; count++;
    if (!b.id || typeof b.id !== "string") errors.push(`${at}: missing id`);
    else if (ids.has(b.id)) errors.push(`${at}: duplicate id ${b.id}`); else ids.add(b.id);
    if (!b.title) errors.push(`${at}: missing title`);
    if (!Array.isArray(b.authors) || !b.authors.length) errors.push(`${at}: authors required (use ["Unknown"] explicitly)`);
    if (typeof b.summary !== "string" || !b.summary) errors.push(`${at}: summary required`);
    const p = b.pages;
    if (!p || !CONF.includes(p.confidence)) errors.push(`${at}: pages.confidence invalid`);
    else if (p.estimate !== null && (!Number.isInteger(p.estimate) || p.estimate < 1 || p.estimate > 5000)) errors.push(`${at}: invalid page count`);
    else if (p.estimate === null && p.confidence !== "unknown") errors.push(`${at}: null pages needs confidence "unknown"`);
    if (!Array.isArray(b.genres) || !b.genres.length) errors.push(`${at}: genres required`);
    if (!Array.isArray(b.moods) || !b.moods.length) errors.push(`${at}: moods required`);
    else b.moods.forEach(m => { if (!moods.has(m)) errors.push(`${at}: unknown mood ${m}`); });
    if (!REV.includes(b.warningsReviewed)) errors.push(`${at}: warningsReviewed invalid`);
    (b.warnings ?? []).forEach((w, j) => {
      const wa = `${at} warning[${j}]`;
      if (!cats.has(w.category)) errors.push(`${wa}: unknown category ${w.category}`);
      if (!PRES.includes(w.presence)) errors.push(`${wa}: unsupported presence ${w.presence}`);
      if (!VER.includes(w.verification)) errors.push(`${wa}: unsupported verification ${w.verification}`);
      if (w.intensity && !INT.includes(w.intensity)) errors.push(`${wa}: invalid intensity`);
      if (w.verification === "verified" && !(w.evidence?.length)) errors.push(`${wa}: "verified" requires evidence`);
    });
    if (!Array.isArray(b.sources) || !b.sources.length) errors.push(`${at}: sources required`);
    if (!b.research?.status || !b.research?.lastReviewed) errors.push(`${at}: research status/lastReviewed required`);
  });
}
if (errors.length) { console.error(errors.join("\n")); console.error(`\n${errors.length} problem(s) in ${count} book(s).`); process.exit(1); }
console.log(`OK: ${count} book(s) valid.`);
