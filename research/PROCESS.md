# Catalogue research workflow

Goal: add books in batches of 25–50 without inventing anything. Unknown stays unknown.

## 1. Pick a batch
List 25–50 titles and authors you want added. Skip anything already in `data/` (the merge tool also catches duplicates).

## 2. Research (with Claude)
Ask Claude to research the batch and return ONE JSON file shaped like this:

```json
{
  "batchId": "batch-002",
  "humanReviewed": false,
  "books": [
    {
      "title": "…", "authors": ["…"],
      "summary": "Original, spoiler-free, 1–3 sentences written in our own words",
      "pages": { "estimate": 350, "confidence": "low|medium|high|unknown", "source": "how it was derived" },
      "genres": ["…"], "subgenres": ["…"],
      "moods": ["ids from data/moods.json"],
      "warnings": [
        { "category": "id from data/warning-categories.json", "presence": "present|absent|unknown",
          "verification": "unverified-research", "evidence": [{ "label": "…", "url": "…" }],
          "note": "spoiler-free explanation", "spoilerNote": "optional, hidden until revealed" }
      ],
      "warningsReviewed": "none|partial|complete",
      "sources": [{ "label": "where the metadata came from", "url": "…" }],
      "cover": null,
      "research": { "status": "draft", "lastReviewed": "YYYY-MM-DD" }
    }
  ]
}
```

Rules for the research step:
- Use legitimate sources and record them. Do not copy third-party descriptions, covers, or warning databases.
- If a page count, author, or warning cannot be confirmed, use `null` / `"unknown"` / leave it out. Never guess.
- A missing warning means "not assessed", never "safe". Use `presence: "absent"` only when a source says so.
- AI-proposed warnings are always `"verification": "unverified-research"`. Only a person who has read the evidence may change one to `"verified"`, and then set `"humanReviewed": true` in the batch.
- Leave `id` out; the merge tool assigns stable ids.

## 3. Save and check
Save the file as `research/batches/batch-002.json`.

## 4. Merge
```
node scripts/merge-batch.mjs research/batches/batch-002.json            # dry run, shows what would change
node scripts/merge-batch.mjs research/batches/batch-002.json --write    # applies it
```
The tool refuses to write if any record is invalid (use `--skip-invalid` to write only the valid ones), skips likely duplicates, and re-validates the whole catalogue afterwards. Existing ids are only replaced with `--update`.

## 5. Publish
Commit the changed files in `data/`. Your reading journal lives in your browser and is never touched by catalogue updates.

You can also skip the command line: send Claude the batch file and ask it to produce the merged `data/` files to upload.
