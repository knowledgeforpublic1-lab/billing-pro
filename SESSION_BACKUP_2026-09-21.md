# Session Backup — 22 Sep 2026 (Mapping Sync Round-3 + Data Restore + Code Restructure)

Ye file is session me hui har research, har issue, har fix aur uska result ka backup hai.
(Taaki chat history na hone par bhi sab recall ho sake.)

---

## 8. CODE RESTRUCTURE — 15K line monolith → 20 modular files (22 Sep 2026)

### What happened
- User asked: "make better code structure for future best and fast correction and update and audit"
- index.html was 15,331 lines (631 KB) — single file containing ALL: HTML, JS, data, logic

### New folder structure
```
Billing2/
├── index.html          ← 1,742 lines (130 KB) — HTML template + script tags ONLY
├── mobile.html         ← Standalone mobile page (unchanged)
├── css/
│   └── style.css       ← 67 KB (same styles)
├── js/
│   ├── data/           ← 6 data files (global constants)
│   │   ├── default-sap-materials.js   (3,793 lines — 642 SAP items)
│   │   ├── default-activities.js      (3,729 lines — 11 activities, all materials)
│   │   ├── default-contractors.js     (2,443 lines — 162 contractors)
│   │   ├── default-master-abstract.js (20 lines)
│   │   ├── default-companies.js       (21 lines)
│   │   └── default-invoice.js         (39 lines)
│   ├── core/
│   │   └── app.js       ← 729 lines — Vue createApp, data(), computed, watch, mounted, mount
│   ├── sync.js          ← 416 lines — Cloud sync + localStorage (SyncModule)
│   ├── billing.js       ← 734 lines — Invoice, GST, contractors, billing calc (BillingModule)
│   ├── mapping.js       ← 241 lines — SAP item mapping (MappingModule)
│   ├── views.js         ← 443 lines — Reconciliation, locations, calculators (ViewsModule)
│   ├── utils.js         ← 197 lines — formatters, keyboard nav, paste (UtilsModule)
│   ├── history.js       ← 114 lines — Undo/redo snapshots (HistoryModule)
│   └── export.js        ← 1,154 lines — Excel export with ExcelJS (ExportModule)
├── api/index.js         ← 250 lines — Express API (structured logging, health check, validation)
├── vercel.json          ← Updated: js/** + css/** static builds, cache headers
└── package.json
```

### How modules combine in app.js
```javascript
const allMethods = Object.assign(
    {},
    window.UtilsModule || {},
    window.HistoryModule || {},
    window.SyncModule || {},
    window.BillingModule || {},
    window.MappingModule || {},
    window.ViewsModule || {},
    window.ExportModule || {}
);
const app = Vue.createApp({ data(), computed, watch, methods: allMethods, mounted });
app.mount('#app');
```

### Script load order in index.html
```
Vue 3 CDN → ExcelJS CDN →
js/data/*.js (6 files) →
js/utils.js → js/history.js →
js/sync.js → js/billing.js → js/mapping.js → js/views.js → js/export.js →
js/core/app.js (creates + mounts Vue)
```

### API improvements
- Structured logging with timestamps: `[2026-09-22T08:07:32.343Z] [INFO] [POST] Data saved`
- Health endpoint: `GET /api/health` → `{ ok: true, readyState: "connected" }`
- Input validation: rejects empty payloads (NOT the wrong docId/state validation that was fixed)
- Rate limit info in every JSON response

### Commits
- `5cfee80` — refactor: modular codebase (19 files, 15967 insertions, 13647 deletions)
- `b4f89d7` — fix: remove incorrect API validation (docId/state → empty payload check)
- `733a088` — feat: Excel-style paste support in activity detail grid
- `9b632e1` — fix: extra materials qty inputs now support paste + keyboard nav

### Fixes during restructure
1. **API validation bug** (commit `b4f89d7`) — Restructure me galat validation add hua tha (`docId`, `state` check). Client `savedAt` + `baseRev` bhejta hai. Fixed to only reject empty payloads.
2. **Extra materials missing keyboard nav** (commit `9b632e1`) — Extra items ke qty inputs me `data-row`/`data-loc` + arrow/Tab/paste handlers missing the. Fixed using `item.origIndex`.

---

## 9. EXCEL-STYLE PASTE FEATURE (22 Sep 2026)

### Feature: Activity Detail Grid Paste
- User can copy data from Excel (tab-separated) and paste into the qty grid
- Supports multi-row AND multi-column paste
- Pasting starts from the focused cell and fills rightward + downward

### How it works
1. Click any Qty cell in the activity detail grid
2. Copy data from Excel (Ctrl+C)
3. Press Ctrl+V in the web app
4. `handleGridPaste()` parses tab-separated text, fills `activityQuantities[actKey][locIdx][matIdx]`
5. Shows toast "Pasted N values" + auto-saves + moves focus to next row

### Keyboard navigation (spreadsheet-style)
- Arrow keys: ← → ↑ ↓ (move between cells)
- Enter: move down
- Tab: move right, Shift+Tab: move left
- Ctrl+V: paste from clipboard

### Implementation
- `handleGridPaste(event, startRowIdx, startLocIdx)` in `js/utils.js`
- `@paste` + `@keydown` handlers on qty inputs in `index.html`
- "Paste Excel" button + instruction banner above the grid
- Uses `item.origIndex` for `data-row` (unique across regular + extra items)

---

## 1. ISSUE #1 — Mapping sheet changes dusre PC par nahi dikhte (Round-3)

### Symptom (user ne bataya)
- User ne Vercel link par mapping ki (SAP items add kiye)
- Dusra PC par changes nahi dikh rahe the

### Research (kya-kya check kiya)
- Pehla session backup padha — pehle 2 fixes already hue the:
  - `sendBeacon` → `fetch keepalive` fix (commit `195a011`)
  - `visibilitychange` listener (commit `195a011`)
  - Undo/Redo sync fix (commit `b8ce43e`)
  - Vercel 404 fix (commit `bd6c8db`)
- Live site size check: Live (613722 chars) vs Local (629015 chars) — **CODE ALAG THA!**
- Live `index.html` me key fixes verify kiye: `keepalive: true` ✓, `visibilitychange` ✓, `sendBeacon` absent ✓
- API test kiya: GET 200 ✓, POST test karne par **PowerShell escaping se 400 aaya** (galat command)
- File-based POST test: `curl -d @file.json` → 200 OK, rev 96 → **API working hai**

### Naye Root Causes Identified
1. **Auto-sync errors silently fail** — 401/network errors par sirf `console.warn`, user ko pata nahi chalta tha
2. **`cloudConflict` stuck** — ek baar 409 aaye toh saare syncs block, sirf refresh se theek hota
3. **Koi retry mechanism nahi** — sync fail hone par dubara try nahi hota tha
4. **No visible error feedback** — sidebar me sync status hota tha par error prominent nahi tha

### Fixes Implemented (commit `d1e32a3`)
1. **`syncToMongoNow()` — Sab errors par toast**:
   - 401: "Cloud sync FAIL: API key wrong/missing" toast (pehle sirf manual tha)
   - 429: "Cloud sync FAIL: Too many saves" toast
   - Network errors: "Cloud sync FAIL: [error]. Local copy safe, retrying..." toast
2. **`_scheduleSyncRetry()` — Auto retry with backoff**:
   - 3s → 6s → 9s → 15s → 30s (max 5 retries)
   - Successful sync par retry counter reset
3. **`cloudConflict` auto-recovery**:
   - Non-manual syncs par cloudConflict ho toh auto-fetch server rev
   - Server se naya rev mila toh `cloudConflict = false` + sync retry
4. **15-second heartbeat sync**:
   - `setInterval` se har 15s check hota hai ki koi unsynced change hai
   - Agar `lastSentHash` match nahi karta → auto `syncToMongoNow()` call
5. **Pulsing red dot** — sync error par sidebar dot flash hota hai (CSS `@keyframes pulse`)
6. **Error message improved** — "Offline (local only)" → "Sync FAIL — local safe"

### Git / Deploy
- Commit `d1e32a3` — "Fix: mapping sync not visible on other PCs - add sync error toasts, auto-retry, cloudConflict auto-recovery, periodic heartbeat sync, pulsing error indicator"
- Pushed to `origin/master` ✓
- Vercel `--prod` deploy hua ✓ — Live size: 631482 chars

### Verification
- Live code me sab naye features confirmed: `_scheduleSyncRetry` ✓, `_heartbeatTimer` ✓, `Auto-recovered` ✓, `pulse 1.5s` ✓
- Live API: Rev 97, 11 activities, 162 contractors ✓
- Site: 200 OK ✓

---

## 2. MongoDB Data Restore (Accidental overwrite fix)

### Kya hua
- Testing ke dauraan ek test POST gaya jisme `baseRev: 95` tha aur `activities` me sirf `{"907":{"title":"test"}}` tha
- Server ne `pickAllowedKeys()` ke through `activities` ko accept kar liya → **pura purana data overwrite** ho gaya
- MongoDB me ab sirf 1 activity (907 test) bacha, baaki sab gayab

### Restore Process
1. Pehle ki GET response ka backup tha (`tool_0c7346f97001ne5eozfSiSR1vF`) — par ye **truncated** tha (86012 chars, file end me cut)
2. Truncated file se extract kiya:
   - `isFinalized` ✓, `projectMeta` ✓, `selectedCompanyId` ✓
   - `contractorsList` — 162 contractors recover hue ✓
   - `selectedContractorId`, `pctStage1/2/3`, `locations`, `activityLocations` ✓
   - Activities: 907, 916, 919, 922, 924 fully recover hue (backup me the)
   - Missing activities: 1220, 1230, 6723, 603B, 934A, 1425A — `defaultActivities` se restore
3. `build_restore.js` script se full payload banaya:
   - Extracted data + defaultActivities merge
   - `baseRev: 96` (current rev)
4. POST se MongoDB me restore: **Rev 97** ✓
5. Verify: 11 activities, 162 contractors ✓

### Important Note
- **User ki personal mapping changes (SAP items jo unhone add kiye) backup me nahi thi** — wo sirf unke browser localStorage me hain
- Default activities se restore kiya gaya hai → user ko apni PC1 localStorage se changes dubara apply karne honge
- **Jab user PC1 par site kholega → uska localStorage data server data se OVERWRITE hoga** (localDirty logic se) → uski changes wapas aa jayengi

---

## 3. Git history (sab sessions ke commits)
- `d1e32a3` — mapping sync round-3 fix (error toasts + retry + cloudConflict recovery + heartbeat) **[NEW]**
- `ccca384` — session backup notes
- `b8ce43e` — undo/redo sync fix
- `bd6c8db` — Vercel 404 fix (static builds add)
- `195a011` — mapping sync fix (sendBeacon → fetch keepalive + visibilitychange)
- `bf656e4` — vercel.json filesystem handle fix
- Sab `origin/master` par pushed.

---

## 4. Important URLs
- Production site: `https://billing-pro-dusky.vercel.app`
- GitHub repo: `https://github.com/knowledgeforpublic1-lab/billing-pro.git` (branch `master`)
- Local dev: `node server.js` → `http://localhost:3456`

---

## 10. SESSION UPDATE — Material sync, mapping fixes, Excel audit format, animations (22 Sep, dopahar)

### 10a. SAP master list sync with material list.ods (`80cc6a2`)
- `material list.ods` (289 items) ko source of truth mana
- `js/data/default-sap-materials.js`: 756 → **289 items** (467 removed: vehicles, office, kitchen, spare parts)
- Comparison me 0 new items (sab ODS codes pehle se the)
- ODS file repo me committed (source of truth)

### 10b. Orphan mapping remap (`4390a9e`)
- Activities me 23 codes aise jo master me nahi the (19 pehle se orphan + 4 sync se hue)
- 17 ka sahi remap kiya (poles 8/10/11m, GI wire, paint, top cleat, disc 70KN, HG fuse, copper wire, weasel, shackle, stay, bobbin, PG clamp, jointing sleeve, covered conductor)
- 6 bina replacement ke chhode (DIESEL, DISTILLED WATER, BINDING×2, WEASEL-strain, PT)

### 10c. Galat code = blank (`5340319`)
- User demand: galat code dikhe hi nahi, blank dikhe taaki pata chale kahan fix karna hai
- Defaults me 6 orphans blanked (10 rows: sapItems [] + row fields cleared)
- One-time migration `patch_orphan_remap_v4` in mounted(): saved bills (MongoDB data) par bhi 17 remaps + unknown blank — master 200+ entries hone par hi chalta hai (safety guard)

### 10d. Genuinely-wrong mappings slooved (`ac2807d`)
- 1425A R8 Shackle hardware → PG CLAMP laga tha → LT SHACKLE HARDWARE
- 1425A R12 Stay sets → TOP BRKT laga tha → MS-LT STAY SET 16MM
- 907 R5 / 934A R4 V-cross-arm → BARBED CLAMP laga tha → V-CROSS ARM (`17005050`)
- 907 R4 / 934A R3 Cut Point → row-level BARBED CLAMP → CUT POINT CH (`17005042`)
- Red Oxide paint 5 rows → BLACK paint laga tha → RED OXIDE (`17000778`)
- 603B R6 CT → PANTHER conductor laga tha → blank (CT master me nahi)
- ~30 truncated descs normalized (TY→TYPE, POLY→POLYMER, AR→ARM, WSHR, 5KN POLY, 12.5KA OD)
- UOM mismatches (MTR/KM, SET/NO) NOT touched — display-only, hisab par asar nahi
- Saved-bill migration me desc-scoped rules add (sahi jagah lage codes ko haath nahi)

### 10e. Mapping UX fixes (`e334391`)
- SAP search box: blur turant list hatata tha → 250ms delayed hide (pehli try me select)
- Mapping Qty me Enter/↑/↓ navigation (activity grid jaisa), locked cells skip

### 10f. Animations (`d66f219`, `6f684b9`) — CSS-only, perf safe
- Paste flash (hare glow), view fade-in (5 views), modal pop-in, button press scale
- Input focus glow, sidebar/tab press feel, row hover
- Dropdowns: contractor panel slide-down + item hover slide, extra-item suggest pop, select focus glow
- `prefers-reduced-motion` support
- NOTE: SAP/reverse datalist native hai (browser-controlled) — usme animation possible nahi

### 10g. Activity Excel audit format (`f18198c` → `3acf43e` → `e153170` → `83a0c26` → `5ddc34a`)
- Final format: Sr | Desc | Unit | Loc1..N | Rate | 100% | 85% | 10% | 5% (Qty column HATAYA per user)
- Amounts live formulas: `SUM(locs)×Rate`
- Extra Items: banner (no gap, no header row, no Qty col), tinted rows, Sr from 1, static amounts
- Single grand ACTIVITY TOTAL (multi-range SUM formulas)
- Ye format single + all-activities + tax-invoice workbook teeno me

### 10h. Cache fix (`0545f0c`)
- PROBLEM: vercel.json me JS/CSS 1-saal immutable cache → users purana code chalate rahe, naye fixes nahi pahunche (5% issue isi se tha — code sahi tha!)
- FIX: cache 1 hr + must-revalidate. Users ko ek baar Ctrl+Shift+R karna pada.

### Open threads (bada update se pehle yaad rakhna)
1. **1220 pole recon me nahi dikha tha** — root cause: recon sirf qty>0 rows dikhata hai + reverse ON ho to sirf invoice activities. User se confirm pending (qty dali? reverse ON/OFF?).
2. **19 blank mapping rows** hath se jodne hain (Sundries/DIESEL, WATER, BINDING, strain, PT, CT, 603B R15–R22).
3. **Master recon + RA snapshot design** discuss hua (section 11 dekho) — RA dimension abhi nahi hai.
4. **Google Drive save** — Option 1 (Save to Drive button) vs Option 2 (auto-backup), user decision pending.

---

## 11. MASTER RECONCILIATION DESIGN (discussed, NOT implemented)

- Goal: pure project ka master reconciliation dataset (activity-wise + RA-wise consumption)
- rf.gd site bot-check ke peeche hai — andar nahi dekh paya; user se pucha (manual entry ya Excel upload?)
- Proposed grain: one row per (SAP code × Activity × Location × RA)
- Blocker: app me RA dimension nahi hai (activityQuantities cumulative hai)
- Proposed solution: **RA Snapshot** — har RA finalize par quantities freeze; is RA ka consumption = current − pichhla snapshot
- Link options staged: A. File export/import (SAP Code key) → B. API (`GET /api/reconciliation`) → C. Shared MongoDB
- Google Drive: main khud file nahi daal sakta; app me Save-to-Drive button (opt 1) ya auto-backup (opt 2, needs Google Cloud API key) — decision pending

---

## 5. Sync Flow Summary (current code)

```
User edits mapping → addSapItemToActivityMaterial() etc.
  ↓
saveToStorage() → localStorage + scheduleRemoteSync() (2500ms)
scheduleMappingSync() → cancels 2500ms, sets 800ms fast timer
  ↓
Vue deep watcher → debouncedSave() → 120ms → saveToStorage()
  ↓
Either timer fires → syncToMongoNow()
  ↓
buildSyncPayload() → POST /api/billing (JSON + baseRev)
  ↓
Server: pickAllowedKeys → baseRev check → findOneAndUpdate (upsert)
  ↓
Client: cloudRev updated, lastSentHash updated, syncStatus = 'synced'
  ↓
ON FAIL: _scheduleSyncRetry() → 3s/6s/9s/15s/30s retry
ON TAB CLOSE: flushPendingSync() → fetch(keepalive:true)
ON TAB SWITCH: visibilitychange → saveToStorage + flushPendingSync
HEARTBEAT: every 15s → check for unsynced changes → auto sync
```

---

## 6. User ke liye test checklist
1. PC1 par site kholo → Mapping sheet me item add/remove/qty change karo.
2. **Sidebar me "☁️ Synced" green dikhna chahiye** — agar "⚠️ Sync FAIL" dikhe toh F12 console me error dekho.
3. Thoda ruko (800ms auto-sync) ya tab switch karo.
4. PC2 par site kholo (Ctrl+Shift+R hard refresh) → wahi changes dikhne chahiye.
5. Agar "⚠️ Sync FAIL" dikhta hai → F12 console me kya error aa raha hai wo mujhe batao.

## 7. Agar problem wapas aaye to ye check karna
- **Sidebar "⚠️ Sync FAIL"** = sync nahi ho raha — F12 Console me error dekho
- `Sync 401` = API key galat/missing (`localStorage billing_api_key` vs server `API_KEY` env)
- `Sync 409 conflict` toast = dusre PC ne beech me save kiya → auto-recovery se theek hona chahiye
- `Bill locked` (423) = bill finalized hai → Unlock karke sync karo
- `Payload too large` = data 800KB se upar → purana data saaf karo
- `Heartbeat: unsynced change detected` = 15s heartbeat ne catch kiya → automatic sync hoga
- Agar kuch bhi na dikhe → PC1 ka localStorage copy karo: F12 Console me `localStorage.getItem('lk_billing_app_state_v10')` run karo → output mujhe do
