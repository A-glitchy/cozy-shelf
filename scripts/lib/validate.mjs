// Shared catalogue validation used by validate-catalogue.mjs and merge-batch.mjs
import fs from "node:fs"; import path from "node:path";

export const PRES = ["present", "absent", "unknown"], VER = ["verified", "unverified-research", "community-report", "disputed"];
export const CONF = ["high", "medium", "low", "unknown"], REV = ["none", "partial", "complete"], INT = ["mild", "moderate", "heavy"];

export function readJson(file, errors) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); }
  catch (e) { errors?.push(`${path.basename(file)}: malformed JSON (${e.message})`); return null; }
}
export function loadTaxonomies(dir, errors = []) {
  return {
    moods: new Set((readJson(path.join(dir, "moods.json"), errors) || []).map(m => m.id)),
    cats: new Set(readJson(path.join(dir, "warning-categories.json"), errors) || []),
  };
}
export const shardFiles = dir => fs.readdirSync(dir).filter(f => /^books-.*\.json$/.test(f)).sort();

/** Validates one book record (id checked by the caller). Returns an array of problem strings. */
export function validateBookRecord(b, at, { moods, cats }) {
  const errors = [];
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
  return errors;
}

export function validateAll(dir) {
  const errors = []; const taxo = loadTaxonomies(dir, errors); const ids = new Set(); let count = 0;
  for (const f of shardFiles(dir)) {
    const list = readJson(path.join(dir, f), errors);
    if (!Array.isArray(list)) { if (list !== null) errors.push(`${f}: must be an array`); continue; }
    list.forEach((b, i) => {
      const at = `${f}[${i}] ${b?.title ?? "?"}`; count++;
      if (!b.id || typeof b.id !== "string") errors.push(`${at}: missing id`);
      else if (ids.has(b.id)) errors.push(`${at}: duplicate id ${b.id}`); else ids.add(b.id);
      errors.push(...validateBookRecord(b, at, taxo));
    });
  }
  return { errors, count };
}
