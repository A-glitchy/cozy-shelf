# Research notes

**The files in `data/` are the single source of truth for the catalogue.** They already contain every
warning, source name and description from all research rounds, in the current format:

* one record per reported trigger, with a display `name`, its category, optional `intensity`, optional `note`,
  optional `spoilerNote`, and `evidence` (source names, with a link where one exists);
* "not found" (`absent`) and "unsure" (`unknown`) entries are kept for the record but are never shown or counted by the app.

## What counts as a warning (rules the app follows)
* Explicitly reported = included. Conflicting reports = included. Community-submitted = included.
* Not found in the checked sources = not included. Unsure with no positive report = not included.
* A trigger does not need human verification to be included.

## Do not re-merge `archive/`
`archive/` holds the older batch files and the old sheet importer. They use the previous format
(comma-joined triggers, verification labels, "absent/unknown" entries) and would overwrite the cleaned data if merged again.

## Adding new results
1. Put one line per book in a text file: `Title @@ Y|short note  (or N, or U) @@ D:death,grief;V:violence;...`
   (codes: D death/grief, V violence/gore, S suicide/self-harm, A abuse, AD addiction, E eating disorders,
   M mental health, I illness, P pregnancy loss, AN animal cruelty, DI discrimination, W war, ST stalking, K kidnapping, IN infidelity, O other).
2. Add the book's source names to `source_names_round2.txt` (`Title @@ Name|Name|Name`).
3. Run `python3 research/import_pasted_results.py yourfile.txt`, then `python3 research/migrate_warnings_v2.py`, then `node scripts/validate-catalogue.mjs`.

Warnings you remove in the app are stored with your library (not in `data/`), so they stay removed after any catalogue update.
