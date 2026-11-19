# Drive-first implementation and local validation

18 November 2026. Branch: `codex/drive-first-storage`.

## State of this work

The approved storage architecture is implemented locally behind disabled flags.
Nothing has been pushed, deployed, migrated in production, or deleted from either
cloud. Production Drive credentials/folder are not configured, so genuine Google
Drive account access, Vercel execution time and two physical devices remain staging
acceptance gates. Local tests do not establish those external properties.

## Verified recovery baseline

- Production deployment: `dpl_5Etop7Uv6TXWnAET7bpe741gd6Ln`.
- Deployment Git SHA and source ZIP: `71418d403a9c1a40dc087880ab86d5681d373551`.
- Directory: `backups/pre-drive-first-20261118/` (ignored by Git).
- Source: `local-source-71418d4.zip`; deployment metadata and source manifest are
  alongside it. Planning PDF/documents are copied separately under `planning/`.
- Firestore snapshot: `live-firestore/documents.ndjson`, same read time for every
  collection and subcollection: `2026-11-18T07:14:36.441Z` / 12:44:36 IST.
- 299 documents, 7 collection paths, 178,517,556 bytes, lossless typed REST values.
- SHA-256: `3b8fe2ac4263f0e79b0e3cbd587ec3013286da5d8ca18bf65d1418ba74ed6724`.
- Verified parsed count and archive checksum; backup performed zero database writes.
- No current Drive file references were found in this snapshot. Historical invoice
  exports in the separate Apps Script Drive integration are outside this Firestore
  export; this is not a backup of all files in a person's Google Drive account.

The offline inventory found 21 bills, 1 reconciliation dataset, 3 business masters,
5 mappings, 4 Daily Progress business records and 24 security/coordination records.
It identified 234 bill chunks outside the currently referenced versions, occupying
160,732,058 bytes in the REST backup representation. These are not measurements of
Firestore billing/index storage. No chunks were removed.

## Runtime coverage

| Boundary | Implementation |
| --- | --- |
| Bills, invoice, activity quantities, schedules, abstracts, contractor profiles | Compatible complete bill snapshot in private immutable Drive JSON; compact Firestore head and list totals. Existing calculation and one-way transfer rules remain. |
| Master Reconciliation | Versioned Drive payload; existing IndexedDB pending/acknowledgement logic retained. Source workbook retained separately when transport is enabled. |
| Contractor mapping | Stable contractor key, version plus legacy source timestamp, private Drive payload; isolation and replacement semantics retained. |
| Pole/activity/SAP masters | Explicit allowlist; cloud-first success for routed masters, private dynamic seed scripts, no stale disk substitution after a migrated read fails. |
| Custom stock and previous reconciliation | Explicit import establishes a cloud copy; local IndexedDB backup first, original workbook archive, pending revision retained. Other devices without a local custom copy can load the cloud dataset. Existing unclassified device-only copies are preserved for explicit inventory/import. |
| Daily Progress | `dailyProgressData`, `shared_report_*`, `entry_event_*`, `report_*` payloads use the router. Small leases, epochs, finalization and ownership remain in Firestore; unchanged report content reuses the exact Drive bytes. Existing direct Daily Progress Drive objects remain readable. |
| Login, worker auth, token revocation, permissions and unknown config keys | Original database authority; never implicitly migrated by a blanket config replacement. |
| Excel/PDF exports | Existing export generation and Apps Script Drive integration retained. New application-state transport does not change workbook formulas, formatting or the existing file browser. |
| Original source files | Master Reco, stock, previous reconciliation and locally opened bill workbooks can be retained byte-for-byte with a hash and opaque asset reference linked to the dataset. Old imports without the original file cannot reconstruct it automatically. |

## Save and recovery guarantees exercised locally

1. Existing module code confirms local backup before cloud save. Custom stock now
   checks `BillingStorage.setItem(...).saved` instead of ignoring its result.
2. A stable request identity, expected revision and legacy update timestamp prevent
   stale overwrite. A same-ID/different-content replay is rejected.
3. A Firestore transaction reserves an expiring operation/epoch; Drive network calls
   occur outside transactions. Uploads use preallocated file identities.
4. SHA-256 and byte length are checked after reading the immutable object back.
5. Permissions are re-read after upload. Their database update timestamps are read
   again inside the final metadata transaction to detect concurrent revocation.
6. Legacy writers recheck migration/reservation mode inside their final transaction.
   Bill creation/revisions use CAS, including revision zero. Deletes use tombstones,
   a membership guard and a transactional last-bill check.
7. A lost commit response is resolved by request identity. API-level replay happens
   before a now-stale base revision can obscure a previously successful save.
8. Corrupt/missing Drive data fails visibly; legacy content is never silently used
   as the current version after cutover. Disabling module flags retains Drive reads.
9. Existing Firestore chunk fallback now preserves UTF-8 character boundaries, so Unicode spanning
   a chunk boundary is preserved. Older plain-text chunks remain readable.

Stock/previous-reconciliation pending notices provide retry, load-cloud and explicit
replace-cloud choices. Retry retains the original base; choosing the cloud copy
first saves an independent conflict backup. Only an explicit replace-cloud action
adopts the freshly read cloud revision for a pending local snapshot.

Each master is an independent versioned entity. If a request updates both activity
and SAP masters and the second fails, the API reports failure, retains pending state
and lets the identical request resume the already committed first entity. This is
not a multi-entity all-or-nothing database transaction.

## Bounded transport and storage budgets

Browser uploads and downloads use 256 KiB binary portions carried as bounded JSON.
The server keeps upload session URLs and credentials private. Firestore transfer
records contain ownership, permission fingerprint, offsets, length, checksum and
expiry, never business bytes. Original workbooks and temporary response bytes are
also private Drive objects. Client download reconstruction checks the full checksum.

The JSON dataset budget is 32 MiB; original source assets have a separate 128 MiB budget. Source assets still use bounded chunks and SHA-256 readback. Larger datasets fail explicitly and
retain pending data. The server's JSON envelope consumes a small part of that budget.
Increasing Express's body limit is not the solution to a Vercel hosting limit.
Immutable JSON envelopes also link the previous committed Drive file identity and
checksum, so payload versions can be traced without a growing Firestore history.

Drive heads are bounded at 32 KiB (typical tested heads under 4 KiB). Expired transfer
metadata, abandoned uploads, old Drive versions, source assets and legacy database
payloads are retained. An exact reviewed retention/cleanup pass is needed later;
initial implementation intentionally has no automatic deletion job.

## Configuration for isolated staging

Keep production variables unchanged. The default is:

```text
BILLING_DRIVE_MODULES=
BILLING_DRIVE_TRANSPORT=0
```

For a separate staging Firebase project and private Drive folder, configure:

```text
BILLING_STORAGE_AUTHORITY=firestore
BILLING_DRIVE_TRANSPORT=1
BILLING_DRIVE_MODULES=reconciliation
BILLING_DRIVE_FOLDER_ID=<private staging folder>
FIREBASE_SERVICE_ACCOUNT=<staging credential, server only>
GOOGLE_DRIVE_CLIENT_ID=<user OAuth client>
GOOGLE_DRIVE_CLIENT_SECRET=<server secret>
GOOGLE_DRIVE_REFRESH_TOKEN=<server secret>
```

Alternatively use `GOOGLE_DRIVE_SERVICE_ACCOUNT` with a Shared Drive folder. The
Billing adapter rejects service-account-owned My Drive storage. No secrets belong
in browser scripts, repository files or logs. Daily Progress can use its explicit
`DAILY_PROGRESS_DRIVE_FOLDER_ID`; when that is absent and its module is enabled, it
can use the configured Billing Drive root.

After initial cutover, retain `BILLING_STORAGE_AUTHORITY=firestore` and
`BILLING_DRIVE_TRANSPORT=1`, including when module rollout flags are disabled.
Writable Mongo fallback is disabled for this authority to prevent competing heads.

Do not start `server.js` as a staging server using this workspace's production
credential files. Its historical no-database proxy can also reach production.
Use an isolated checkout with explicit staging credentials and no production keys.
Setting `BILLING_STORAGE_STAGING_PROJECT` additionally blocks mismatched Firebase
projects, writable Mongo fallback and the local server's production proxy. Drive
access in that mode must match `BILLING_STORAGE_STAGING_FOLDER` explicitly.

Authenticated admin diagnostics: `GET /api/storage/config`,
`POST /api/storage/check` (folder access only), and `GET /api/storage/status`.
No endpoint accepts arbitrary Drive file identities or exposes resumable session URLs.

## Migration tooling and gates

`npm run storage:inventory` verifies the backup and produces an offline inventory.
`npm run storage:migrate:dry-run` is also offline and read-only.

`scripts/migrate-drive-staging.js --apply` deliberately refuses the production
project. Applying to isolated staging additionally requires an explicit staging
project, matching verified backup SHA, `BILLING_STORAGE_STAGING_PROJECT`, an explicit
staging Drive root matching `BILLING_STORAGE_STAGING_FOLDER`, and the storage flags.
It copies and verifies each entity, preserves successful earlier cutovers when a
later entity fails, and never deletes legacy documents/chunks. It is not run as part
of the test suite or this implementation task.

Before a production cutover: test real OAuth refresh or Shared Drive access, actual
Vercel execution limits, two-device/role workflows, representative real-size imports
and exports, and restoration from the latest committed Drive heads. Prepare the
production migration from that verified staging checkpoint. Do not roll back to the
old pre-compatibility build after cutover; it cannot understand new heads.

## Local verification

- Full `npm test`, including existing auth, permissions, mapping, Master Reco,
  mobile, Daily Progress, sync conflicts and 49/49 calculation checks.
- `npm run test:storage`: isolated Firestore/Drive doubles and real local HTTP,
  including 8 MB Unicode upload/download, binary workbook retention, checksum
  corruption, racing creation, stale bases, deleted records, permission revocation,
  mounted worker routes, request replay and production-migration refusal.
- Final focused storage suite: 33/33; Drive adapter checks: 5/5.
- `npm run audit`: 11/11 checks.
- `git diff --check` and JavaScript syntax checks.

No live Drive write, Vercel deployment test, production migration, cleanup, push or
deployment is claimed by those local results.

## Resume checkpoint — 19 November 2026

Read-only configuration discovery confirmed the linked Vercel project billing-pro has
only FIREBASE_SERVICE_ACCOUNT, scoped to Production. Its local Firebase key also
belongs to production billing-pro-e6241. No separate staging project credential,
private Drive folder or Drive server OAuth/Shared Drive credential was found in
workspace environment files, the saved production environment, or relevant local
credential filenames. No staging or production flags were changed.

Run `npm run storage:preflight -- --env-file=<private staging env file>` to validate
an explicitly isolated configuration offline. Exit 2 means required setup is missing;
exit 0 means ready for external checks, not that those checks have passed. Reports
contain check names/statuses only, never credential values. Automatic production
credential fallback is intentionally absent. The tracked blank configuration template is in
`docs/STAGING_STORAGE.env.example`; fill only an ignored private copy.

An additional cold-restart regression checks all five module kinds: latest committed
heads remain readable with rollout flags off, Unicode/zero/negative values and daily
coordination fields survive restoration, previous immutable bytes are retained,
and unavailable Drive files fail closed. This is a local regression, not a real
external staging restore claim.

Remaining real checks require an isolated staging Firebase project, a private Drive
folder and server Drive credentials. Hosted Vercel checks require a preview deployment;
these remain pending under the user's no-push/no-deploy instruction. No production
migration or cleanup has been performed.

Resume verification: final `npm test` exited 0 on 19 November 2026, including
41/41 storage tests. `npm run audit` passed 11/11; changed JavaScript syntax checks
and `git diff --check` passed. Logs are retained in
`backups/pre-drive-first-20261118/resume-regression-20261119.log` and the offline
configuration report in `resume-preflight-20261119.json`. The report correctly
returns not-ready for missing isolated setup; it is not an application test failure.

### Staging key supplied later on 19 November

Verified the newly supplied local key belongs to `billing-pro-staging-ba9a8`.
Created git-ignored `.env.drive-staging.local` with explicit staging settings and
the user-selected Drive folder (folder access not yet verified). No production
settings changed. Authenticated read-only Firestore database discovery succeeded
and returned an empty database list: the staging Firestore database still needs
creation. Database writes: zero. Offline preflight now passes six checks; Drive
server credentials are still absent. Do not use the Firebase service-account key
as personal My Drive storage credentials.

### Drive OAuth connected on 19 November

The user completed Google consent for the staging OAuth web client using the Drive
account. Server credentials are stored only in ignored `.env.drive-staging.local`.
The setup uses PKCE, a one-time state and browser-bound HttpOnly cookie, fixed
loopback callback, explicit project checks and the limited `drive.file` scope.
The user delegated the folder choice; the app created `Billing-Pro-Staging-App`
so it can use app-created files without broader access to unrelated Drive files.
The earlier manually created folder is not used or modified. The adapter's real
folder check passed, including rejection checks for public/anyone sharing.

`npm run storage:verify:staging` uses explicit staging credentials only. It retains
synthetic test records and immutable Drive objects; no deletion or production
migration is performed. Its per-run results are in the ignored
`backups/drive-staging-20261119/` directory. This is an opt-in external check and
is deliberately excluded from `npm test`.

### Real external verification completed

19 November 2026: all 11 real Drive/Firestore staging checks passed. Fresh adapter
connections restored all five modules and the 8 MiB Unicode dataset; bounded binary
ranges and checksums passed. Local storage regressions passed 43/43. A verified
read-only staging Firestore backup contains 8 documents (7 metadata heads plus
coordination), with no business payload fields embedded in the heads.

See [real staging review](REAL_DRIVE_STAGING_REVIEW_20261119.md) for exact evidence,
folder, recovery checkpoint and remaining hosted/production gates. Earlier missing
staging/Drive setup notes above are historical and have now been resolved. No
production migration, cleanup, push or deployment was performed.
