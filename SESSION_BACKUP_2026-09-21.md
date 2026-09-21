# Session Backup — 21 Sep 2026 (Mapping Sync + Vercel 404)

Ye file is session me hui har research, har issue, har fix aur uska result ka backup hai.
(Taaki chat history na hone par bhi sab recall ho sake.)

---

## 1. ISSUE #1 — Mapping sheet changes dusre PC par nahi dikhte

### Symptom (user ne bataya)
- PC1 par mapping sheet me change karo (material qty add, item add/remove) → refresh karo → changes dikhte hain ✓
- Dusra vyakti dusre PC/place se login kare → sirf DEFAULT (purani) values dikhti hain, naye changes NAHI ✗

### Research (kya-kya check kiya)
- `index.html` me mapping code: VIEW 4 template (line ~915-1017), `defaultActivities` (~5520+), `filteredMappingMasterList` (~11902), mapping methods `addSapItemToActivityMaterial` / `removeSapItemFromActivityMaterial` / `onMappingRateChange` / `onMappingQtyChange` (~13044-13170)
- Save flow: `saveToStorage()` (~14033) → localStorage + `scheduleRemoteSync()` (2500ms)
- Mapping fast sync: `scheduleMappingSync()` (~13892) → 800ms me `syncToMongoNow()` (~13912)
- Cloud push: `syncToMongoNow()` → `buildSyncPayload()` (~13865, includes `activities` + `mappingLocks` + `baseRev`) → `POST /api/billing`
- Server: `api/index.js` — `ALLOWED_SYNC_KEYS` me `activities` hai, single doc `main-billing-state` me upsert, optimistic concurrency (`baseRev` vs `rev`, mismatch par 409)
- Load flow: `loadFromStorage()` (~14080) — server vs local compare karke jeetne wala data lagta hai
- Tab-close flush: `flushPendingSync()` (~14014) — `pagehide` / `beforeunload` par chalta hai
- `server.js` — local dev server, `/api/*` ko `api/index.js` par bhejta hai

### Root cause
- `flushPendingSync()` me `navigator.sendBeacon()` use ho raha tha.
- **sendBeacon custom headers NAHI bhej sakta** (matlab `x-api-key` header kabhi server tak pahunchta hi nahi tha).
- Isliye tab close/refresh par pending cloud sync **silently fail** ho jata tha (server 401 de deta hai, par beacon ka response code dekhta hi nahi — fire-and-forget hai).
- Result: changes sirf PC1 ke **localStorage** me rehte the, **MongoDB tak pahunchte hi nahi the** → dusra PC hamesha default/purana data dekhta tha.

### Fix (index.html me 2 changes)
1. **`flushPendingSync()` (~line 14014-14032):**
   - `sendBeacon` hata kar `fetch('/api/billing', { method:'POST', headers, body: json, keepalive: true })` lagaya (keepalive = tab band hone par bhi request poori hoti hai, AUR custom headers bhi jaate hain).
   - `_mappingSyncTimer` ko bhi clear kiya (pehle sirf `_syncTimer` clear hota tha).
2. **`mounted()` (~line 15199-15207):**
   - Naya `visibilitychange` listener add kiya — tab switch/minimize par bhi `saveToStorage()` + `flushPendingSync()` chalta hai (sirf close/refresh par nahi).

### Git / Deploy
- Commit `195a011` — "Fix: mapping sheet changes not visible on other PCs - replaced sendBeacon with fetch keepalive for reliable cloud sync, added visibilitychange listener"
- Pushed to `origin/master` ✓
- Vercel deploy hua ✓

### Status
- Fix applied + deployed. **User testing PENDING** — PC1 par mapping change karke PC2 par check karna baaki hai.

### Re-verification (user ke dobara kehne par, live site par direct check)
- Live `index.html` (629219 chars) me naya code CONFIRMED: `keepalive` fetch ✓, `sendBeacon` absent ✓, `visibilitychange` ✓, `flushPendingSync` ✓
- Live API: `success True`, `rev 92` (92 syncs MongoDB pahunch chuke), aaj ka `updatedAt` ✓
- Live MongoDB data me 11 activities, `907` mat0 me `sapItems` present (code `17000004`) ✓
- Matlab: site + code + API + MongoDB — chaaro level par sab sahi hai. Baaki sirf end-to-end test (PC1 change → PC2 check).

---

## 2. ISSUE #2 — Vercel par site gayab (404 NOT_FOUND)

### Symptom (user ne screenshot bheja)
- `https://billing-pro-dusky.vercel.app` kholne par Vercel 404 page: "This page doesn't exist" (`404 NOT_FOUND`, edge code `bom1::...`)

### Research (kya-kya check kiya)
- `vercel.json` padha — purana `builds` + `routes` format tha.
- `vercel inspect` chalaya → Builds me sirf `λ api/index.js (function)` dikha, static (`.`) **empty/0ms** — matlab `index.html` deployment output me gaya hi nahi.
- `curl.exe` se 3 test (user ki machine se):
  - `GET /` (alias) → **404** (site gayab — confirmed)
  - `GET /api/billing` (alias) → **200** (API mast chal raha tha!)
  - `GET /` (direct deployment URL) → **302** → Vercel SSO login (ye normal hai — deployment URLs protection-gated hote hain, production alias public hota hai)
- Isse prove hua: **API sahi hai, sirf static files serve nahi ho rahi thi.**

### Root cause
- `vercel.json` ka legacy `builds` config sirf `api/index.js` ko `@vercel/node` se build kar raha tha.
- Static files (`index.html`, `mobile.html`, `style.css`) kisi build me cover nahi the → output me aaye hi nahi → `/` par 404.

### Fix (vercel.json me 1 change)
- `builds` array me 3 entries add ki (API wala part bilkul same rakha taaki chalta hua API na toote):
  - `{ "src": "index.html", "use": "@vercel/static" }`
  - `{ "src": "mobile.html", "use": "@vercel/static" }`
  - `{ "src": "style.css", "use": "@vercel/static" }`
- `routes` section ko haath nahi lagaya.

### Git / Deploy
- Commit `bd6c8db` — "Fix: Vercel 404 - add explicit static builds for index.html, mobile.html, style.css so site serves again"
- Pushed to `origin/master` ✓
- Vercel `--prod` deploy hua, alias `https://billing-pro-dusky.vercel.app` par ✓

### Verification (deploy ke baad curl se)
- `GET /` → **200** ✓ (pehle 404 tha)
- `GET /api/billing` → **200** ✓ + MongoDB ka real data (contractors, activities, sapItems) aa raha hai ✓

### Status
- **FIXED ✓** — site wapas live hai. (Note: browser me purana 404 cache ho sakta hai → Ctrl+Shift+R hard refresh karna.)

---

## 3. Git history (is session ke commits)
- `195a011` — mapping sync fix (sendBeacon → fetch keepalive + visibilitychange)
- `bd6c8db` — Vercel 404 fix (static builds add)
- `b8ce43e` — undo/redo sync fix (neeche round-2 dekho)
- Sab `origin/master` par pushed. (Repo me `index.zip` naam ki untracked file hai — commit/push me include NAHI ki.)

## 7. ROUND-2 — Pura code dobara check (user ke kehne par)

### Check kiya (sab sahi mila)
- Vue `data()` init: `cloudRev: 0`, `lastSentHash: ''`, `cloudConflict: false` ✓
- Saare mapping methods (`addSapItem`, `removeSapItem`, `onSapItemDropdownChange`, `onMappingRateChange`, `onMappingQtyChange`, `onItemCodeManualChange`) → `saveToStorage()` + `scheduleMappingSync()` call karte hain ✓
- Timer chain: mapping 800ms / normal 2500ms / watcher 120ms debounce — cancel/priority logic sahi ✓
- `loadFromStorage` decision (localDirty/server-wins) + apply (sirf missing fields fill) ✓
- Server `api/index.js`: 800KB guard, empty-overwrite block, baseRev check, finalize lock ✓
- Live proofs: site 200, API 200 + rev 92 + aaj ka timestamp, MongoDB me 11 activities sapItems ke saath ✓

### Naya bug mila + fix kiya — Undo/Redo sync (applySnapshot ~line 13802)
- **Bug:** Undo/Redo ke baad direct fire-and-forget POST hota tha — response padha hi nahi jata tha, isliye `cloudRev` stale reh jata tha → agla auto-sync 409 khata → `cloudConflict=true` → saare syncs Refresh tak block.
- **Fix:** Raw fetch hata kar `this.scheduleMappingSync()` lagaya (tested path — rev/hash/conflict sahi handle hota hai). Commit `b8ce43e`, deploy + verify: site 200, api 200, naya code live confirmed.
- Note: ye mapping-add/remove wale main flow ka bug NAHI tha (wo pehle se sahi tha), par sync system ka asli bug tha.

## 4. Important URLs
- Production site: `https://billing-pro-dusky.vercel.app`
- GitHub repo: `https://github.com/knowledgeforpublic1-lab/billing-pro.git` (branch `master`)
- Local dev: `node server.js` → `http://localhost:3000`

## 5. User ke liye test checklist (baaki hai)
1. PC1 par site kholo → Mapping sheet me item add/remove/qty change karo.
2. Thoda ruko (800ms auto-sync) ya tab switch/refresh karo.
3. PC2 par site kholo (ya mapping view me 🔄 Refresh dabao) → wahi changes dikhne chahiye.
4. Agar phir bhi na dikhe → PC1 par F12 → Console me error dekho (401 / 409 / network) aur batao.

## 6. Agar problem wapas aaye to ye check karna
- F12 Console me `Sync 401` = API key galat/missing (`localStorage billing_api_key` vs server `API_KEY` env).
- `Sync 409 conflict` toast = dusre PC ne beech me save kiya → Refresh karke changes dobara karo.
- `Bill locked` (423) = bill finalized hai → Unlock karke sync karo.
- `Payload too large` = data 800KB se upar → purana data saaf karo.
- Vercel par phir 404 aaye → `vercel inspect` me Builds check karo (static `.` empty to nahi), `curl` se `/` aur `/api/billing` status dekho.
