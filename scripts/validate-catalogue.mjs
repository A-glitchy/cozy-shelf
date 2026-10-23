// Usage: node scripts/validate-catalogue.mjs [dataDir]
import path from "node:path";
import { validateAll } from "./lib/validate.mjs";
const dir = process.argv[2] ?? path.join(path.dirname(new URL(import.meta.url).pathname), "..", "data");
const { errors, count } = validateAll(dir);
if (errors.length) { console.error(errors.join("\n")); console.error(`\n${errors.length} problem(s) in ${count} book(s).`); process.exit(1); }
console.log(`OK: ${count} book(s) valid.`);
