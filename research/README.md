# Research notes

**Source of truth: the master workbook / Google Sheet** (tabs Books, Trigger Warnings, Sources, Research Status).
The app reads those tabs from your Google Sheet when it syncs and caches them on the device.
The files in `data/` are the copy built into the site (used offline and before the first sync). Refresh them from the
workbook with:

    python3 research/import_master_workbook.py Cozy_Shelf_Master_Workbook.xlsx
    node scripts/validate-catalogue.mjs

The importer reports anything it changes, keeps research details the workbook has no column for (verification, spoiler notes,
links, "not found"/"unsure" records) and never touches personal data. Journal, Own books and Settings are not part of `data/`.

## Rules the app follows
* Explicitly reported, conflicting and community-submitted triggers are shown. "Not found" and "unsure" are not.
* One pill per (book, category, trigger). Several sources never create several pills.
* Personal removals are stored with your library and never delete master research.

## Older files
`archive/` and `migrate_warnings_v2.py`, `import_pasted_results.py`, `source_names_round2.txt` are earlier, superseded import paths.
Do not re-run them over the current data.
