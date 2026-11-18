# Setting up the master Google Sheet (version 2)

**Two kinds of tabs**

| Tabs | Who owns them | What the app does |
|---|---|---|
| Books, Trigger Warnings, Sources, Research Status | **You, in the Sheet** (the master catalogue and research) | Reads them. Never writes to them. |
| Journal, Own books, Settings | **The app** (your personal data) | Reads and writes, as before. |

Extra tabs (Start here, Lists, Original overview, CSV research raw, Checks) are ignored by the app.

## Keep your current Sheet (recommended: same web address, same token, no data to move)
1. Open your current Google Sheet. **File > Import > Upload**, choose `Cozy_Shelf_Master_Workbook.xlsx`.
   Import location: **Insert new sheet(s)**. Click **Import data**.
2. You now have the four master tabs plus Lists. Google renames any imported tab whose name already exists
   (for example "Journal (1)"). **Delete only those renamed copies** of Journal, Own books and Settings. Keep the original ones.
   You can also delete "Original overview" and "CSV research raw", or keep them; the app ignores them.
3. **Extensions > Apps Script.** Look at the `const TOKEN = '...'` line in the old code and copy your phrase.
   Select everything, paste the new `Code.gs`, put your own phrase back on the `TOKEN` line, click Save.
4. **Deploy > Manage deployments > pencil icon > Version: New version > Deploy.** The web address stays the same.
5. Reload the Sheet. A **Cozy Shelf** menu appears: **Add dropdown lists** (once) and **Check master data** (whenever you edit).
6. In the app: upload the new zip, open **Journal > Sync with Google Sheet > Sync now**.
   You should see "Master catalogue loaded from your Sheet: 311 books, 3179 triggers".

## Editing the master data
* Add or change a trigger: edit the **Trigger Warnings** row. One row = one pill. Use the Lists values for Intensity, Depiction and Abuse subtype.
* Several sources for one trigger: add rows to **Sources** with the same Book ID + Category + Trigger, or list them in the trigger row's
  "Evidence / source labels" separated by `;`. They all appear under the same pill.
* Sexual violence status lives in **Books / Research Status**. If it says Yes but there is no trigger row, the app adds the pill itself.
  A positive trigger row is always included, even if the status says No/Unsure.
* After editing, open the app and press **Sync now** (the app also checks by itself about every 10 minutes).

## What is never touched
* Your Journal, Own books and Settings tabs, and the removed warnings stored in Settings.
* Hiding a pill in the app only adds an entry to your personal "removed warnings" list. The Trigger Warnings tab is never edited.
