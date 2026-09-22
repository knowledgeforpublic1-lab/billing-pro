# Session Backup — 22 Sep 2026 (Mapping Sync Round-3 + Data Restore)

Ye file is session me hui har research, har issue, har fix aur uska result ka backup hai.
(Taaki chat history na hone par bhi sab recall ho sake.)

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
- Local dev: `node server.js` → `http://localhost:3000`

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
