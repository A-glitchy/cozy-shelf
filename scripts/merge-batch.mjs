// Merge a research batch into the catalogue.
//   node scripts/merge-batch.mjs research/batches/batch-001.json            (dry run: reports only)
//   node scripts/merge-batch.mjs research/batches/batch-001.json --write    (applies if every record is valid)
// Flags: --update (replace records whose id already exists), --skip-invalid (write the valid records, report the rest),
//        --data <dir> (use another data folder, for testing)
// Only files in data/ are touched. Personal reading data is never part of the catalogue.
import fs from "node:fs"; import path from "node:path";
import { loadTaxonomies, validateBookRecord, validateAll, readJson, shardFiles } from "./lib/validate.mjs";

const args = process.argv.slice(2);
const flag = n => args.includes(n);
const di = args.indexOf("--data");
const dataDir = di >= 0 ? args[di + 1] : path.join(path.dirname(new URL(import.meta.url).pathname), "..", "data");
const batchFile = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--data");
if (!batchFile) { console.error("Usage: node scripts/merge-batch.mjs <batch.json> [--write] [--update] [--skip-invalid]"); process.exit(2); }

const batch = readJson(batchFile, []);
if (!batch || !Array.isArray(batch.books)) { console.error('Batch must look like {"batchId": "...", "humanReviewed": false, "books": [...]}'); process.exit(2); }
const taxo = loadTaxonomies(dataDir);

const norm = s => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/^(the|a|an) /, "");
const keyOf = b => `${norm(b.title)}|${norm((b.authors ?? [""])[0]).split(" ").pop()}`;

const shards = shardFiles(dataDir).map(f => ({ file: f, list: readJson(path.join(dataDir, f), []) ?? [] }));
const existingById = new Map(), existingByKey = new Map();
shards.forEach(s => s.list.forEach(b => { existingById.set(b.id, s); existingByKey.set(keyOf(b), b.id); }));

const newId = () => { let id; do { id = "bk_" + Math.random().toString(36).slice(2, 10).padEnd(8, "0"); } while (existingById.has(id)); return id; };
const report = { added: [], updated: [], skipped: [], problems: [] };
const toAdd = [], toUpdate = [];

batch.books.forEach((raw, i) => {
  const b = JSON.parse(JSON.stringify(raw)); const at = `batch[${i}] ${b.title ?? "?"}`;
  const problems = validateBookRecord(b, at, taxo);
  if (!batch.humanReviewed) (b.warnings ?? []).forEach((w, j) => {
    if (w.verification === "verified") problems.push(`${at} warning[${j}]: AI-assisted batches cannot contain "verified" warnings (set humanReviewed: true only after a person has checked the evidence)`);
  });
  if (problems.length) { report.problems.push(...problems); return; }
  if (b.id && existingById.has(b.id)) {
    if (flag("--update")) toUpdate.push(b); else report.skipped.push(`${at}: id ${b.id} already exists (use --update to replace)`);
    return;
  }
  const dup = existingByKey.get(keyOf(b));
  if (dup) { report.skipped.push(`${at}: looks like a duplicate of ${dup} (same title and author surname); give it that id and use --update to change it`); return; }
  if (!b.id) b.id = newId();
  existingByKey.set(keyOf(b), b.id); existingById.set(b.id, null);
  toAdd.push(b);
});

const show = (label, arr) => arr.length && console.log(`${label} (${arr.length}):\n  ` + arr.join("\n  "));
show("Will add", toAdd.map(b => `${b.id}  ${b.title}`));
show("Will update", toUpdate.map(b => `${b.id}  ${b.title}`));
show("Skipped", report.skipped);
show("Invalid", report.problems);

const blocked = report.problems.length > 0 && !flag("--skip-invalid");
if (!flag("--write")) { console.log(`\nDry run only. ${blocked ? "Fix the invalid records first." : "Re-run with --write to apply."}`); process.exit(report.problems.length ? 1 : 0); }
if (blocked) { console.error("\nNothing written: some records are invalid (or use --skip-invalid)."); process.exit(1); }

for (const u of toUpdate) { const s = existingById.get(u.id); const i = s.list.findIndex(x => x.id === u.id); s.list[i] = u; s.dirty = true; }
const MAX = 500;
let target = shards[shards.length - 1];
for (const b of toAdd) {
  if (!target || target.list.length >= MAX) {
    const n = shards.length + 1; target = { file: `books-${String(n).padStart(3, "0")}.json`, list: [] }; shards.push(target);
  }
  target.list.push(b); target.dirty = true;
}
for (const s of shards) if (s.dirty) fs.writeFileSync(path.join(dataDir, s.file), JSON.stringify(s.list, null, 2) + "\n");
const { errors, count } = validateAll(dataDir);
if (errors.length) { console.error("Merged, but the catalogue now has problems:\n" + errors.join("\n")); process.exit(1); }
console.log(`\nDone. Catalogue now has ${count} books, all valid.`);
