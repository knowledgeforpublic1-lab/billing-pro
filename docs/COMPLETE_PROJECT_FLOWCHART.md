# Billing Pro - Complete Project Flowchart

Date: 18 November 2026 | Code baseline: `71418d4`

Charts 1-10 map current repository behavior. Proposed Drive-first architecture and its five detailed flows are in [the storage review](DRIVE_FIRST_FLOWCHART_REVIEW.md). This distinction prevents treating planned behavior as already deployed.

## Poore project ka overview

Current code: pages, business data aur storage ki boundaries.

```mermaid
flowchart TB
    U["User: desktop / mobile"]
    AUTH["Login / role / access checks"]
    HOME["Dashboard and active contractor / RA context"]
    BILL["Tax Invoice, Activity Billing, Pole Schedule, Abstract"]
    RECO["Contractor Reconciliation"]
    MR["Master Reconciliation: separate dataset"]
    SAP["SAP catalogue, stock, work orders and mappings"]
    DP["Daily Progress: admin / worker / shared entry"]
    L[("Browser working copies and pending data")]
    API["Module-specific authenticated APIs"]
    DB[("Configured Firebase Firestore or MongoDB")]
    DRIVE[("Drive exports and selected Daily Progress payloads")]
    OUT["Excel / CSV / print / recovery downloads"]
    U --> AUTH
    AUTH --> HOME
    HOME --> BILL
    HOME --> RECO
    HOME --> MR
    HOME --> SAP
    HOME --> DP
    BILL --> L
    RECO --> L
    MR --> L
    SAP --> L
    DP --> L
    L --> API
    API --> DB
    API --> DRIVE
    BILL --> OUT
    RECO --> OUT
    MR --> OUT
    DP --> OUT
```

- Sab pages ek hi dataset nahi hain. RA bill, Master Reco aur Daily Progress ke save flows alag hain.
- Neeche CURRENT charts existing code dikhate hain; baad ke PROPOSED charts future storage migration hain.

Source: `index.html`, `js/core/app.js`, `api/index.js`.

## Login, startup aur access

Portal login, worker login aur token links ek jaise access paths nahi hain.

```mermaid
flowchart TB
    U["Requested route / page"]
    TYPE{"Kaunsa entry route?"}
    PORTAL["Billing desktop / mobile / Master Reco"]
    VERIFY["Server verifies portal session; login if required"]
    OWNER["Firebase Authentication owner verification"]
    COOKIE[("HttpOnly session cookie; private session record")]
    BOOT["Load permitted defaults, local state and cloud state"]
    CONFLICT{"Unsynced local data conflicts?"}
    HOLD["Preserve copies and resolve conflict"]
    OPEN["Open selected bill / workspace"]
    ADMIN["Admin reauthentication for privileged actions"]
    WORKER["Worker login / assigned contractors"]
    TOKEN["Opaque daily entry token"]
    PERM["Check worker assignment or token validity"]
    DAILY["Restricted Daily Progress view"]
    U --> TYPE
    TYPE -->|"Portal"| PORTAL
    PORTAL --> VERIFY
    VERIFY -->|"Login needed"| OWNER
    OWNER --> COOKIE
    COOKIE --> BOOT
    VERIFY -->|"Session valid"| BOOT
    BOOT --> CONFLICT
    CONFLICT -->|"Yes"| HOLD
    CONFLICT -->|"No"| OPEN
    OPEN -->|"Privileged action"| ADMIN
    TYPE -->|"Worker"| WORKER
    TYPE -->|"Token link"| TOKEN
    WORKER --> PERM
    TOKEN --> PERM
    PERM --> DAILY
```

- Owner login Firebase Authentication se verify hota hai; passwords billing database mein save nahi hote.
- Admin elevation structural/finalize/unlock actions ke liye alag check hai. Public catalog sanitized hai.

Source: `api/auth.js`, `api/daily-worker-auth.js`, `api/daily-progress-routes.js`, `js/core/app.js`.

## Navigation aur bill identity

Saved RA selection aur contractor identity calculation aur save target tay karte hain.

```mermaid
flowchart TB
    START["Dashboard / Saved RA Bills / New RA"]
    CHOOSE["Open existing bill or create draft"]
    ID["Active bill ID and revision"]
    CON["Company, contractor, work order and date"]
    MAP["Restore contractor-specific SAP overrides"]
    WORK["Measurements, activities and invoice working state"]
    VIEWS["Switch views without changing bill identity"]
    SAVE["Save snapshot for that bill ID"]
    MOBILE["Mobile view uses explicit bill ID"]
    DP["Daily Progress context: contractor / location / work date"]
    MR["Master Reco: independent imported dataset"]
    FINAL{"Finalized?"}
    LOCK["Block edits until authorized unlock"]
    START --> CHOOSE
    CHOOSE --> ID
    ID --> CON
    CON --> MAP
    MAP --> WORK
    WORK --> VIEWS
    WORK --> FINAL
    FINAL -->|"Yes"| LOCK
    FINAL -->|"No / permitted transition"| SAVE
    ID --> MOBILE
    VIEWS -->|"Separate report context"| DP
    VIEWS -->|"Separate dataset"| MR
```

- Bill ID aur contractor ID preserve karna zaroori hai; sirf display name se records merge nahi karne.
- Daily Progress contractor context use kar sakta hai, lekin uski report key contractor + location + date hai.

Source: `js/sync.js`, `js/utils.js`, `js/billing.js`, `js/contractor-mapping.js`, `js/mobile.js`.

## Measurement se invoice aur reconciliation

Existing formulas aur one-way transfer ko storage change mein preserve karna hai.

```mermaid
flowchart TB
    CTX["Active contractor / RA and locations"]
    POLE["Contractor pole schedule quantities"]
    ACT["Activity material quantities"]
    VAL["Activity values: quantity x configured rate"]
    STAGE["Stage amounts and abstract summaries"]
    INV["Auto-linked activity invoice rows + manual rows"]
    TAX["Configured tax mode and invoice totals"]
    CONS["SAP mapped material consumption and unit conversion"]
    RECO["Contractor reconciliation: previous + current consumption"]
    DEPT["Departmental schedule / independent mapping checks"]
    REV["Optional reverse-entry edits"]
    EXPORT["Invoice, activity and reconciliation exports"]
    CTX --> POLE
    CTX --> ACT
    CTX --> DEPT
    POLE -->|"One-way transfer"| ACT
    ACT --> VAL
    VAL --> STAGE
    STAGE --> INV
    INV --> TAX
    ACT --> CONS
    POLE -->|"Direct schedule path; prevent double count"| CONS
    CONS --> RECO
    RECO -->|"Only if enabled"| REV
    REV --> ACT
    TAX --> EXPORT
    RECO --> EXPORT
```

- Pole Schedule -> Activity transfer one-way hai. Manual Activity entries Pole Schedule ko reverse overwrite nahi karti.
- Stage percentages configurable hain; defaults 85 / 10 / 5. GST/manual invoice-row behavior current rules se hi rahega.
- Departmental schedules contractor reconciliation se explicitly unlinked hain. Reverse-entry option limited reconciliation-to-activity edits hai.

Source: `js/pole-schedule.js`, `js/billing.js`, `js/core/app.js`, `js/views.js`, `js/reco-units.js`.

## SAP stock, mapping aur previous reconciliation

Available stock aur consumption ka same contractor context hona chahiye.

```mermaid
flowchart TB
    SEED["Protected SAP stock / old-reco defaults"]
    UPLOAD["User stock / previous-reco Excel upload"]
    PARSE["Parse code, unit, contractor and posting date"]
    LOCAL[("Custom import in IndexedDB")]
    ID["Selected contractor / work order + stock cutoff"]
    ISSUE["Resolve gross issue, MRN and net issue"]
    OLD["Previous reconciliation baseline"]
    MAP["Common mappings + contractor-specific overrides"]
    INPUT["Activity / pole schedule quantities"]
    CONVERT["Component factors and unit conversions"]
    CONSUME["Current consumption by material"]
    BAL["Cumulative balance and issued-stock warnings"]
    TABLE["Reconciliation filters, columns and export"]
    UPLOAD --> PARSE
    PARSE --> LOCAL
    SEED --> ID
    LOCAL --> ID
    ID --> ISSUE
    ID --> OLD
    MAP --> CONVERT
    INPUT --> CONVERT
    CONVERT --> CONSUME
    ISSUE --> BAL
    OLD --> BAL
    CONSUME --> BAL
    BAL --> TABLE
```

- Custom stock aur custom previous reconciliation browser-local stores use karte hain; server migration browser-only files ko khud discover nahi kar sakta.
- Posting-date cutoff aur explicit stock zero ko legacy issue quantity replace nahi karni chahiye. Fixed manual reconciliation quantities reusable mapping profile ka hissa nahi hain.

Source: `js/stock-importer.js`, `js/billing.js`, `js/mapping.js`, `js/contractor-mapping.js`, `js/old-reco-importer.js`.

## Master Reconciliation ka complete flow

Separate iframe application; uploaded master workbook is its source dataset.

```mermaid
flowchart TB
    OPEN["Open Master Reco iframe with selected theme"]
    LOCAL["Read IndexedDB snapshot + pending flag"]
    CLOUD["Read /api/reconciliation and revision"]
    PICK["Choose usable local/cloud snapshot; preserve pending imports"]
    VIEWS["Overview, contractor, item balance, material, debit rates"]
    UPLOAD["Upload contractor-details master Excel"]
    VALID["Parse and validate contractors / quantities / columns"]
    BACKUP["Commit full local backup + pending status"]
    POST["POST dataset with expected revision"]
    DB[("Configured database reconciliation state")]
    ACK["Confirm cloud revision; acknowledge local snapshot"]
    ERROR["Keep local pending import; show actual error"]
    OUT["Excel / CSV / missing-rate / data-check downloads"]
    OPEN --> LOCAL
    OPEN --> CLOUD
    LOCAL --> PICK
    CLOUD --> PICK
    PICK --> VIEWS
    VIEWS --> OUT
    UPLOAD --> VALID
    VALID --> BACKUP
    BACKUP --> POST
    POST --> DB
    DB -->|"Confirmed"| ACK
    POST -->|"Rejected / failed"| ERROR
    ACK --> VIEWS
```

- Current source mein RA bill saves se Master Reco ko automatic live update karne ka connection nahi hai.
- Missing rates, mixed stock/consumption dates aur negative balances data-quality issues hain; migration inhe invent karke fix nahi karegi.

Source: `Reconciliation master/app.js`, `Reconciliation master/analytics.js`, `api/index.js`, `js/core/storage.js`.

## Daily Progress aur shared entry

Daily reports aur RA bill quantities alag save paths hain.

```mermaid
flowchart TB
    ADMIN["Authenticated admin daily view"]
    WORKER["Assigned worker view"]
    SHARE["Valid token / share entry"]
    LEGACY["Legacy standalone / aggregate data path"]
    CAT["Permitted contractor, location, stock and item catalog"]
    KEY["Select contractor + location + date"]
    ENTRY["Consumption, manpower, charges and remarks"]
    LEASE["Claim / renew report edit reservation"]
    SAVE["Save draft or request final save"]
    DRIVE[("Immutable Drive report version")]
    CONTROL[("Database lease, epoch, version and file reference")]
    FINAL["Final locked report; admin can reopen"]
    HISTORY["Admin history and aggregated report view"]
    OLDDB[("Legacy aggregate / shared / event payload records")]
    EXPORT["Daily Excel template export"]
    ADMIN --> CAT
    WORKER --> CAT
    SHARE --> CAT
    CAT --> KEY
    KEY --> ENTRY
    ENTRY --> LEASE
    LEASE --> SAVE
    SAVE --> DRIVE
    DRIVE --> CONTROL
    CONTROL --> FINAL
    CONTROL --> HISTORY
    HISTORY --> EXPORT
    LEGACY --> OLDDB
    OLDDB --> HISTORY
```

- Report identity contractor + location + work date hai. Data entry, manpower, charges aur remarks report payload mein hain.
- Selected report paths Drive payload + database reference use karte hain. Legacy aggregate/shared/history paths abhi full business copies bhi rakhte hain.
- Daily Progress storage ko RA bill storage samajhkar merge karna ya automatic invoice quantity transfer add karna is plan ka hissa nahi hai.

Source: `js/daily-progress.js`, `js/daily-progress-standalone.js`, `api/daily-progress-service.js`, `api/daily-worker-auth.js`.

## Current local backup aur cloud sync

Current source behavior; proposed Drive-first policy abhi enabled nahi hai.

```mermaid
flowchart TB
    EDIT["Edit current working data"]
    HISTORY["Undo / redo working snapshots"]
    LOCAL[("BillingStorage: IndexedDB + small-cache policy")]
    PENDING["Pending local snapshot"]
    VALID["Allowed fields and stable content identity"]
    API["Module API with login / revision checks"]
    CHECK{"Conflict / locked / validation failure?"}
    KEEP["Retain local data; show conflict or error"]
    DB[("Current Firebase/Mongo full business payloads")]
    ACK["Cloud acknowledgement for sent snapshot"]
    NEW["Later edits remain pending"]
    DP["Daily Drive path uses payload + database reference"]
    EDIT --> HISTORY
    EDIT --> LOCAL
    LOCAL --> PENDING
    PENDING --> VALID
    VALID --> API
    API --> CHECK
    CHECK -->|"Yes"| KEEP
    CHECK -->|"No"| DB
    DB --> ACK
    ACK --> NEW
    API -->|"Selected Daily Progress routes"| DP
```

- Local-saved aur cloud-confirmed alag states hain. Master Reco ke large uploads ab localStorage ke bajay IndexedDB use karte hain.
- Bill saves snapshot identity / revision ke saath serialize hote hain; stale tabs ka conflict automatic overwrite ko rokta hai.
- Current billing Firestore revision check ko future migration ke liye final atomic commit mein strengthen karna baaki hai.

Source: `js/core/storage.js`, `js/sync.js`, `api/db.js`, `api/index.js`, `Reconciliation master/app.js`.

## Imports, exports aur Google Drive backups

Original files, editable state aur formatted exports ko ek cheez nahi maana gaya hai.

```mermaid
flowchart TB
    IN["User-provided Excel workbook"]
    WHICH{"Import kis module mein?"}
    STOCK["Stock import -> custom stock cache"]
    OLD["Previous reconciliation -> custom baseline"]
    MASTER["Master Reco -> parsed independent dataset"]
    DATA["Existing module data and calculations"]
    EXCEL["ExcelJS / SheetJS export"]
    DOWNLOAD["Browser Excel / CSV download or print"]
    GAS["Server /api/gdrive-upload -> Apps Script"]
    FOLDER[("Configured invoice backup folders in Drive")]
    BROWSE["Saved Bills Drive file browser"]
    RESTORE["Validate supported workbook before import / restore"]
    DAILY[("Daily API report snapshots in private Drive")]
    IN --> WHICH
    WHICH -->|"Stock"| STOCK
    WHICH -->|"Previous reco"| OLD
    WHICH -->|"Master Reco"| MASTER
    DATA --> EXCEL
    EXCEL --> DOWNLOAD
    EXCEL -->|"Drive export action"| GAS
    GAS --> FOLDER
    FOLDER --> BROWSE
    BROWSE --> RESTORE
    DATA -->|"Separate daily save path"| DAILY
```

- Excel export browser mein generate hota hai; downloaded workbook automatically authoritative cloud dataset nahi ban jata.
- Invoice Drive export/file-browser Apps Script path aur Daily Progress Drive API path alag integrations hain.
- Master Reco ka current upload parsed data save karta hai; original source workbook ka separate Drive asset abhi proposed improvement hai.

Source: `js/export.js`, `js/stock-importer.js`, `js/old-reco-importer.js`, `js/sync.js`, `google-drive/BillingDriveWebApp.gs`.

## Runtime, API aur reference package boundaries

Root project aur handover package ko production ka ek hi runtime nahi dikhaya gaya hai.

```mermaid
flowchart TB
    BROWSER["Browser pages: index, mobile, Master Reco, daily entry"]
    FRONT["Vue core + feature modules + CSS"]
    HOST["Vercel routing / local Express server"]
    STATIC["Static permitted scripts, styles and templates"]
    API["api/index.js Express routes and auth middleware"]
    AUTH["Firebase Authentication owner verification"]
    DB[("api/db.js -> configured Firestore / MongoDB")]
    DRIVE["Google Drive API / Apps Script backup"]
    LOCAL["server.js local development"]
    PROXY["Hosted API proxy if local DB is not configured"]
    REF["Separate handover package: Daily-Progress-Integration"]
    D1["Reference Next / Cloudflare Workers + D1; not root runtime"]
    BROWSER --> HOST
    HOST --> STATIC
    STATIC --> FRONT
    FRONT --> API
    HOST --> API
    API --> AUTH
    API --> DB
    API --> DRIVE
    LOCAL --> HOST
    LOCAL -->|"Fallback configuration"| PROXY
    REF --> D1
```

- Root app Vue + Express/Vercel stack hai. Daily-Progress-Integration ek separate Next/Cloudflare D1 handover/reference package hai.
- Local server missing DB configuration mein hosted production API ko proxy kar sakta hai. Staging tests ke liye yeh fallback isolate/disable karna zaroori hai.
- Secrets server-side rahenge; private seed scripts authenticated route se serve hote hain.

Source: `server.js`, `vercel.json`, `api/index.js`, `js/core/app.js`, `Daily-Progress-Integration/README.md`.

## Third review - complete project coverage

1. Source mapping: portal/mobile, public token, worker/admin, active bill, computations, mappings, separate imports, all save APIs and deployment boundaries were cross-checked.
2. Failure-path recheck: unknown commit outcome, preserved pending edits, failed local cache and stopped migration batches were corrected in the companion plan.
3. Document QA: diagram syntax, graph references, exported PDF text and rendered page layouts are checked before delivery. This is not a live migration test.

Important new safeguard: isolate `server.js` hosted-production proxy during staging so a local test cannot accidentally use live data.
No application implementation, data migration, deletion, deployment or push was performed for this report.
