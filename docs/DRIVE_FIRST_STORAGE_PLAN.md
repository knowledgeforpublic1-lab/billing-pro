# Billing Pro: Drive-first storage plan and review

Date: 18 November 2026 (Asia/Kolkata)

Status: planning and design review only. No application implementation, live migration,
cloud deletion, deployment, or push is authorized by this document.

Companion: [complete flowcharts and two-pass review](DRIVE_FIRST_FLOWCHART_REVIEW.md).
The safeguards from that review are part of this plan, including fencing all legacy
write routes before cutover, permission rechecks at commit, deletion tombstones,
operation-expiry recovery, and latest-version rollback.
Its additional recheck also distinguishes unknown commit results from confirmed
failures, preserves pending local snapshots during reads, handles cache-write
failure separately from cloud-read failure, and preserves prior cutovers when a
later migration batch is stopped.

## 1. Objective and scope

Apply one storage policy throughout Billing Pro: keep business payloads and files in
private Google Drive storage; use Firestore for the small records that require fast
lookups, authentication, authorization, transactions, or cross-device coordination.
Retain IndexedDB for the user's local working copy and pending saves.

Scope includes Tax Invoice, Activity Billing, Pole Schedules, Master Abstract,
contractor reconciliation, Master Reconciliation, SAP/work-order masters, contractor
profiles/mapping, Saved RA Bills, Daily Progress, public entry links, mobile views,
exports, and imported source workbooks. Derived views continue using the same data
and calculations; this project does not redesign the screens or alter billing math.

Firestore will become much smaller, not empty. Actual storage reduction must be
measured against the live database, including indexes and obsolete subcollections.
Moving copies to Drive alone does not free the old Firestore storage.

## 2. Findings from the current repository

| Area | Current behavior | Required treatment |
| --- | --- | --- |
| Bills | `api/db.js` stores complete `stateData`, with Firestore chunking for large documents. | Replace migrated business payloads with verified Drive references and compact list metadata. |
| Bill listing | `listBills()` can derive display fields and totals from `stateData`. | Materialize and verify the required small summary fields before removing payloads. Listing must not download every Drive file. |
| Bill concurrency | Firestore `saveBillingState()` reads/checks a revision before a separate write. | Use a genuine transaction/CAS for the final reference update, including first creation and deletion races. |
| Master Reconciliation | Whole dataset is in the database; browser backup now uses IndexedDB. | Preserve the new local backup while moving the online dataset to Drive. |
| Shared defaults | `default_configs` contains business masters AND login/session/security records. | Classify keys explicitly. A blanket rewrite of `getDefaultConfig`/`saveDefaultConfig` would endanger login and sessions. |
| Contractor mapping | Large serialized profiles are saved through shared config APIs. | Version by stable contractor identity and keep the existing contractor/bill isolation. |
| Daily Progress | Some public/admin saves already use Drive versions plus transactional database references. | Reuse the working pattern while preserving leases, finalization, permissions, and location boundaries. |
| Daily Progress legacy paths | `dailyProgressData`, `shared_report_*`, `baseReport`, and `entry_event_*` can still embed full report data or history. | Inventory and migrate every business-payload path; moving only the main report path would leave substantial copies behind. |
| Drive integrations | Existing Apps Script export/file-browser integration and a separate server-side Drive API adapter exist. | Do not confuse exported Excel backups with an authoritative editable dataset. Extend the authenticated Drive API path for application state. |
| Browser backup | IndexedDB already supports large bills, stock, Daily Progress, and Master Reco. | Keep pending snapshots and sync state together; no full business datasets in localStorage. |
| Hosting | The app runs through Vercel Functions, with current large-payload guards. | Design both upload AND download transport for the host limits. Raising Express's JSON limit alone is insufficient. |

Relevant source: `api/db.js`, `api/index.js`, `api/daily-drive.js`,
`api/daily-progress-service.js`, `api/daily-progress-routes.js`,
`api/daily-worker-auth.js`, `api/auth.js`, `js/sync.js`,
`js/core/storage.js`, `js/contractor-mapping.js`, and
`Reconciliation master/app.js`.

## 3. Storage allocation

| Data | Primary durable storage | Small database record |
| --- | --- | --- |
| Each RA bill, invoice, activities and measurement quantities | Versioned JSON snapshots in Drive | Stable bill/project/contractor IDs, reference, revision, finalization flag, date, small verified list totals |
| Master Reco and previous reconciliation imports | Versioned JSON; original uploaded workbook retained separately when supplied | Current reference, revision, source dates, import status and counts |
| Stock, SAP materials, work orders, activity and pole masters | Versioned master snapshots in Drive | Current reference/version and necessary lookup summary |
| Contractor business profiles and reusable mappings | Versioned Drive records | Stable ID and minimal selector/permission/reference fields |
| Daily reports, manual issues, full activity/history payloads | Drive records, partitioned by contractor/location/date | Lease, epoch, version, finalized/deleted state, reference, limited recent coordination/audit metadata |
| Original Excel imports and generated Excel/PDF exports | Drive binary files, linked to their dataset revision | Asset reference, byte length, checksum and MIME type if needed |
| Login sessions, revocations, user permissions, link-token hashes | Firestore | These are required security records, not workbook/business snapshots |
| Pending edits and downloaded working snapshots | Browser IndexedDB | Small local UI preferences may remain in localStorage |

Firebase Authentication, if used by the current login system, remains separate from
Firestore payload storage. Moving business data does not remove the need for login.

## 4. Proposed architecture

Browser edits -> IndexedDB confirmed backup -> authenticated application API ->
private immutable Drive object -> content verification -> Firestore transaction
commits the new reference -> application confirms cloud save.

### Drive object rules

- Separate project/module folders beneath a configured application root.
- Use stable IDs, not display names, to identify contractors, work orders and bills.
  Duplicate names must never merge records.
- Preserve application snapshots as JSON (optionally compressed); retain original
  `.xlsx` imports and formatted exports as separate assets. Excel is not the only
  source used to reconstruct editable application state.
- Every snapshot carries schema version, entity ID/type, payload revision, content
  checksum and relevant source versions. No overwritten `latest.json` as the only copy.
- Old finalized bills retain the master/mapping versions they were saved with.
  Referencing a new current master must not change their historic quantities or rates.
- Initial rollout keeps complete compatible snapshots. Any later deduplication of
  shared masters is a separate verified step, not an implicit change to old bills.

### Firestore record rules

- A bounded head record contains `entityId`, `schemaVersion`, `revision`, `fileId`,
  checksum, byte length, update time, finalization state and minimal list metadata.
- Target roughly 1-4 KiB for a normal entity head, measured during implementation;
  this is a design budget, not a claim about existing cloud storage.
- Temporary save/upload records have expiry and bounded fields. Do not embed full
  reports, all versions, entire contractor lists, or chunk arrays in them.
- Keep security/coordination records in explicitly separate namespaces. Business
  config keys use an allowlist; unknown keys are not automatically moved to Drive.
- Keep one authoritative coordination database for the rollout. Preserve legacy
  MongoDB readers where needed; do not automatically switch writable coordination
  between Firebase and MongoDB during an outage and create competing latest records.

## 5. Save, read and failure behavior

### Save sequence

1. Validate entity identity, schema, quantities and the user's current permissions.
2. Confirm the local IndexedDB backup before starting a cloud mutation.
3. Create a stable request ID and content hash; send the expected entity revision.
4. Reserve an expiring operation with a small database transaction. Verify the
   expected revision, deletion epoch and finalization/lease state, including revision 0.
5. Upload a new Drive file outside the database transaction. Drive network calls must
   never occur inside a retryable Firestore transaction callback.
6. Verify the uploaded bytes/checksum, schema and entity identity. Read back migrated
   objects before cutover. An upload response without usable content is insufficient.
7. Commit the head reference in a second transaction that rechecks operation ownership,
   revision, epoch and finalization. Retain the old head until this commit succeeds.
8. Return the committed revision; acknowledge exactly that snapshot in IndexedDB.
   Edits made while a save is running remain pending for the next serialized save.

Use server-allocated/pre-generated Drive file IDs where applicable and persist the
operation's object identity before upload. A lost network response can then be
resolved without creating duplicate committed versions. Repeated request IDs must
match the same content digest; a different payload is rejected.

### Reads and cross-device use

- Fetch compact head metadata; download only changed payload versions.
- Cache by entity ID + committed revision + checksum, with private authorization-aware
  caching. No cross-user cache leakage and no downloading every historical bill to list bills.
- Existing small API responses retain their shape. Clients and APIs negotiate a
  versioned manifest/chunk transport for large datasets; old clients get a clear
  refresh message rather than an incomplete dataset.
- Offline users can work from a local copy. A cached version is labelled with its
  revision/pending status and must not silently replace newer cloud state.
- If pending edits are based on the current cloud revision, keep rendering those
  pending edits rather than replacing them with the unchanged cloud base. If their
  base differs, compare copies. An already-committed identical request can be
  acknowledged without losing subsequent edits.
- After a committed Drive reference exists, a missing/unreadable Drive object must
  not silently fall back to an older legacy payload and pretend it is current.

### Failure rules

| Failure | Expected result |
| --- | --- |
| Local backup fails | Keep the old displayed/persisted state; report the failure; no destructive cloud replacement. |
| Drive timeout, quota, revoked permission or invalid credentials | Keep the local pending copy and current committed head. Distinguish retryable errors from setup failures. |
| Drive succeeds but database commit fails | Keep old head; retain an unreferenced recovery file; retry/recover by request ID. Never display cloud-saved success. |
| Response is lost after a successful commit | Check request/revision identity and acknowledge the already committed save. |
| Commit result is unknown | Look up the operation by request ID; neither assume rollback nor repeat the mutation blindly. |
| Two computers edit the same revision | One commit wins; the other receives a conflict and retains its local changes. |
| Finalization/deletion occurs during upload | Final commit rejects stale operation ownership/epoch; no resurrection or alteration of the finalized bill. |
| Uploaded content is corrupt or belongs to another record | Reject reference publication; preserve current head and report verification failure. |
| Local acknowledgement fails after confirmed cloud save | Report cloud success and local status separately; retain recoverable state rather than retrying an already committed mutation blindly. |

Use capped exponential backoff with jitter for retryable rate-limit/server failures.
Treat login expiry, permission failures, validation errors and conflicts separately.

## 6. Large uploads and downloads

The Vercel request/ordinary response limit is 4.5 MB. This is independent of the
Express parser limit. Plan authenticated, bounded chunk upload/download (initial
target 256 KiB of raw bytes per chunk, with transport overhead budgeted), using Drive
resumable uploads for larger objects. Compression can help but is not the only solution.

- Store only upload ID, owner/entity ID, expected length/hash, next offset, expiry,
  and protected server-side session information in small coordination records.
- Do not expose Drive refresh tokens or arbitrary provider session URLs to the browser.
- Validate offsets, byte lengths, retry identity and final checksum; reject oversized,
  truncated, reordered or mismatched uploads.
- Download large objects in bounded parts (or a separately verified streaming path),
  then verify/reconstruct them locally. A successfully uploaded >4.5 MB dataset must
  also be reloadable on a second device.
- Set a measured application size limit and resource/time budget before rollout.
  Hosting/Drive limits and missing credentials are not solved just by moving storage.

## 7. Connection and security preflight

Before enabling Drive writes in production:

1. Verify the real Google account, target folder, quota and runtime credentials on
   the deployment host. Local environment settings do not prove production readiness.
2. Use OAuth for a human user's My Drive, or a properly accessible Shared Drive for
   service-account writes. A service account cannot simply own files in My Drive.
3. Reuse the existing authenticated server-side Drive API adapter with module-specific
   folders. Existing Apps Script exports can remain compatible, but their current
   overwrite/file-browser behavior is not the new transactional state store.
4. Confirm read, write, metadata verification and restore within the designated private
   application folder using a test record. Verify access after token refresh as well.
5. Keep credentials server-side. No public file sharing, browser secrets, raw report
   logging, raw session URLs, or arbitrary file IDs accepted from clients.
6. Authenticate every access, and authorize the requested project/contractor/entity.
   Preserve worker/public-link restrictions, admin elevation and finalized-bill rules.

## 8. Implementation and migration stages (after plan approval)

### Stage A: Inventory and baseline

- Inventory actual live provider/collections, payload bytes, index footprint, duplicate
  chunks, record counts, module writes, and all device-local pending copies.
- Export recovery snapshots and a manifest with IDs, revisions, counts and checksums.
- Record known existing data issues (missing rates, mixed source dates, duplicate names)
  separately. Migration preserves them; it does not invent rates or recalculate history.
- Confirm Google account/folder/auth method and define test credentials/environment.
- Isolate staging from production explicitly: `server.js` can proxy to the hosted
  production API when local database configuration is absent. Staging must not use
  that fallback or the production Drive root for test mutations.

### Stage B: Shared storage foundation

- Implement a server storage router, reusable Drive adapter, transactional head store,
  schema envelopes, idempotent save operations, bounded transport and verification.
- Add module feature flags, a storage health check, diagnostics, and a compatibility
  reader that understands both legacy full payloads and new Drive references.
- Keep existing module APIs stable where possible. Do not globally redirect all
  `default_configs` or change authentication storage semantics.

### Stage C: Isolated module rollout

Order: Master Reconciliation -> contractor mappings and large masters/stock ->
Daily Progress legacy/history paths -> active and saved RA bills/invoices/schedules.
All modules receive the policy; the order reduces the risk of a simultaneous change.

For each entity: copy legacy content to Drive, verify content/counts, then atomically
activate its reference only if the source revision is unchanged. If it changed,
re-read/re-copy it. New saves use the Drive path after that entity's cutover.
An interrupted migration resumes from a bounded checkpoint without duplicating records.

Before any entity cutover, all legacy writers (including bulk master-update routes
and older mobile/tab clients) must enforce its authoritative storage mode at the
final transactional write boundary. A feature flag or an earlier non-atomic check
alone cannot prevent legacy writes from racing with migration.

Browser-only stock, custom reconciliation and unsynced bills require explicit device
inventory/import: a server migration cannot discover data stored only on someone else's PC.

### Stage D: Cross-device verification and controlled deployment

- Run the acceptance matrix below on staging with representative real-size data.
- Trial two browsers/devices, desktop/mobile, admin/worker/public-link roles.
- Verify old and new bills, search, pagination, reopen/delete/finalize, and exported
  Excel quantities/formulas/layout against pre-migration baselines.
- Enable one module at a time; show separate local-saved, cloud-pending, conflict,
  cloud-confirmed and offline states. Do not change the existing page layout unnecessarily.

### Stage E: Free Firestore space after verification

- Produce an exact cleanup report: records, payload fields, chunk subcollections,
  versions, byte estimates, verified Drive backups and rollback references.
- Remove obsolete business payloads only after their backup/restore checks and a
  separate explicit cleanup approval. Keep the necessary security and coordination data.
- Apply a reviewed retention policy for obsolete indexes, expired operations/sessions,
  audit tails and old Drive versions. Initial rollout performs no automatic deletion
  of original workbooks or historical/finalized records.
- Measure actual Firestore storage and operation rates afterwards; report measured
  savings rather than promising a percentage before inventory.

## 9. Rollback and recovery

- A compatibility deployment capable of reading BOTH formats must be available before
  the first cutover. The old pre-migration build is not a safe universal rollback target.
- Disabling a module's new writes must not route reads to a stale legacy snapshot.
- For a migrated entity, recover its latest committed version using its manifest and
  verified Drive object. If necessary, rehydrate the current version into database
  storage with a new revision during a controlled recovery; this is a justified
  temporary Firestore-space use, not silent full-payload fallback on every error.
- Preserve local pending edits during rollback. Reconcile them against the recovered
  current revision before another save.
- Before any cleanup, demonstrate restoring a bill, a master dataset and a daily
  report, with matching checksums, totals, permissions and version relationships.

## 10. Acceptance matrix

These are REQUIRED FUTURE TESTS, not tests already performed on the proposed implementation.

| Test | Pass condition |
| --- | --- |
| Upload ordinary and large source Excel/JSON | Correct rows/units/totals and source file linkage after reload. |
| Payload over hosting limit | Upload AND second-device download succeed through bounded transport. |
| Unicode, decimal quantities, zero/negative balances, duplicate names | Values and stable entity identities survive exact round trips. |
| Full localStorage; available IndexedDB | Save succeeds without losing other browser data. |
| IndexedDB unavailable/full | Visible failure and old data retained; no false success. |
| Network cut before/after Drive upload and database commit | Recoverable pending state; no missing committed content or duplicate logical save. |
| Same/different request ID, replay, double-click, repeated retries | Idempotent acknowledgements; altered-content replay rejected. |
| Concurrent devices, initial revision 0, delete/reopen/finalize races | Exactly one valid current head; no stale overwrite or resurrection. |
| Missing file, changed bytes, wrong folder/entity, token expiry | Correct error handling without serving a stale or unauthorized record as current. |
| Permission and role boundaries | Cross-contractor/project reads and mutations rejected. |
| Saved Bills list and dashboard | Read compact indexes, display verified summaries, avoid full-file fan-out. |
| Legacy config/authentication sessions | Login, reset/logout, expiry and admin elevation remain correct. |
| Daily Progress all paths | Admin, token/share links, worker history, location and leases converge on the same versions. |
| Offline edits during cloud save and later reload | Exact acknowledged snapshot separated from subsequent pending edits. |
| Historic bill/master references and exports | Quantities, mapping, GST totals and exported formulas remain unchanged. |
| Migration pause, restart, source edit and rollback | Resume safely and restore latest committed data, never an older snapshot silently. |
| Storage-budget checks | Migrated Firestore records contain no embedded business payloads/chunks; operation/audit metadata stays bounded. |
| Performance/quota | Representative usage meets agreed save/load limits with bounded retries and controlled API/database calls. |

## 11. Plan review result and current validation

Design review: feasible with the safeguards above; NOT ready for a live bulk switch.
The current adapter, legacy payload paths, revision checks, hosting transport and
production credentials need work/verification before implementation can pass the gates.

Baseline on 18 November 2026:

- Full existing `npm test`: PASS (the final calculations suite reports 49/49; other
  suites, including the 15 Master Reco tests, also completed in the same run).
- `npm run audit`: PASS, 11 checks, 0 failures.
- No new storage implementation was written or live cloud data changed for this plan.
- Actual production Drive account/folder/quota, live cloud payload inventory,
  multi-device trials, and the new transport/migration/failure tests remain unverified.
- No promise of zero future errors: the release gate is passing evidence, recoverability
  and a rehearsed rollback, rather than an assurance based only on a design document.

Execution can start after the user reviews this plan. Live cutover additionally
requires verified runtime Drive configuration and the applicable acceptance tests.

## 12. Official references checked during review

- [Vercel Function payload limits](https://vercel.com/docs/functions/limitations):
  request/ordinary response size constraints affect the transport design.
- [Firestore transactions](https://firebase.google.com/docs/firestore/manage-data/transactions):
  callbacks can retry, so Drive side effects belong outside them.
- [Firestore document limits](https://firebase.google.com/docs/firestore/quotas):
  payload chunking does not remove overall storage/index growth.
- [Drive uploads and retry identity](https://developers.google.com/workspace/drive/api/guides/manage-uploads):
  resumable uploads and pre-generated IDs support recovery from uncertain responses.
- [Drive service-account ownership constraints](https://developers.google.com/workspace/drive/api/guides/folder):
  choose Shared Drive or user OAuth appropriately.
- [Drive error handling](https://developers.google.com/workspace/drive/api/guides/handle-errors):
  distinguish rate limits, permissions, missing files and transient failures.

These sources validate platform constraints. They do not establish that this project's
future implementation or the user's production configuration is already correct.
