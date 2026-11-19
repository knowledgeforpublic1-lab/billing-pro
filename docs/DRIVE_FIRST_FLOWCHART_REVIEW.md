# Billing Pro storage flowcharts and two-pass design review

Date: 18 November 2026, Asia/Kolkata

Scope: every Billing Pro business module. Companion plan:
[DRIVE_FIRST_STORAGE_PLAN.md](DRIVE_FIRST_STORAGE_PLAN.md).

Status: proposed design, not implemented. These diagrams describe the intended
system. The reviews below are source-code inspection and failure-scenario analysis,
not evidence that the future implementation has already passed runtime tests.
Only planning documents were changed during this review.
Reviewed application baseline: Git commit `71418d4`.

## 1. Complete system and storage responsibilities

```mermaid
flowchart TB
    U[Desktop or mobile user] --> A[Existing login and permission checks]
    A --> P[Existing Billing Pro pages]
    P --> B[Bills and invoices]
    P --> S[Activities and pole schedules]
    P --> R[Master and contractor reconciliation]
    P --> M[Stock, SAP, work orders and contractor mappings]
    P --> D[Daily Progress, worker and share entry]
    B --> L[IndexedDB working copy and pending changes]
    S --> L
    R --> L
    M --> L
    D --> L
    L --> API[Authenticated storage API]
    API --> ROUTE{Storage mode of this entity?}
    ROUTE -->|Not migrated| OLD[Existing database path]
    ROUTE -->|Migrated| NEW[Drive save and load service]
    NEW --> G[(Private Google Drive)]
    NEW --> F[(Small Firestore records)]
    G --> GP[Versioned application data, source Excel and exports]
    F --> FP[File references, revisions, leases and list summaries]
    A --> AUTH[(Authentication, sessions and permissions)]
    AUTH -. Necessary small records .-> F
    API --> UI[Existing calculations, tables, exports and sync status]
```

Important boundaries:

- Every page uses the same policy, but modules are migrated separately.
- Firestore keeps necessary security/coordination records. It is not emptied.
- JSON snapshots preserve editable state; Excel/PDF files are separate assets.
- Existing billing formulas, source dates, units, quantities, rates and page designs
  are outside this storage change.
- An entity has one authoritative current revision; no independent Drive-versus-
  database choice based on which happens to answer first.

## 2. Save flow, including every confirmation boundary

```mermaid
flowchart TB
    S[User edits or imports data] --> V{Local validation passes?}
    V -->|No| E[Show validation error; keep existing data]
    V -->|Yes| L{IndexedDB backup committed?}
    L -->|No| LE[Keep edits in memory and offer recovery download]
    L -->|Yes| N{Online and logged in?}
    N -->|No| WAIT[Keep pending copy; reconnect or log in]
    N -->|Yes| ID[Freeze this snapshot and assign request ID plus hash]
    ID --> A{Server session and permissions valid?}
    A -->|No| AUTHERR[Keep pending copy; show login or access error]
    A -->|Yes| PRE{Revision, epoch and lock checks pass?}
    PRE -->|No| C[Conflict or lock error; preserve pending snapshot]
    PRE -->|Yes| RES[Reserve operation with expiring fencing token]
    RES --> UP[Upload immutable Drive version; bounded resumable transport]
    UP --> VERIFY{Bytes, checksum, schema and identity verified?}
    UP -->|Upload or network failure| RETRY
    VERIFY -->|No| RETRY[Keep old current reference and local pending copy]
    VERIFY -->|Yes| PERM[Recheck session and current permissions]
    PERM --> COMMIT{Atomic reference commit still allowed?}
    COMMIT -->|Confirmed rejection| ORPHAN[Keep old reference; retain recovery file; no success]
    COMMIT -->|Yes| ACK[Return committed revision and request ID]
    COMMIT -->|Result unknown or timed out| STATUS[Query operation by request ID]
    STATUS -->|Committed| ACK
    STATUS -->|Confirmed uncommitted| ORPHAN
    STATUS -->|Still unknown| UNKNOWN[Keep local snapshot pending; do not claim success or retry blindly]
    ACK --> LOCAL{Local acknowledgement committed?}
    LOCAL -->|No| ACKERR[Cloud confirmed; local status warning]
    ACKERR --> MORE
    LOCAL -->|Yes| DONE[Mark only this snapshot synced]
    DONE --> MORE{New edits arrived during save?}
    MORE -->|Yes| NEXT[Save the newer pending snapshot separately]
    MORE -->|No| FIN[Cloud saved]
```

Additional error edges are described in section 6. No network write to Drive occurs
inside a Firestore transaction callback. The authoritative reference changes only
after the object is verifiable and the final database transaction succeeds.

If an import also promises to save the original Excel, both the original asset and
the parsed snapshot must be verified before that import is marked fully saved.
A retry uses the same operation identity rather than inventing another logical save.

## 3. Open, refresh, offline and second-device flow

```mermaid
flowchart TB
    O[Open a bill, report or master dataset] --> A{Authorized for this entity?}
    A -->|No| DENY[Reject access]
    A -->|Yes| P{Unsynced local changes exist?}
    P -->|Yes| KEEP[Preserve pending copy before loading cloud]
    P -->|No| HEAD[Read current entity metadata]
    KEEP --> HEAD
    HEAD --> MODE{Entity storage mode?}
    MODE -->|Legacy| LEG[Read existing database payload]
    MODE -->|Drive| CACHE{Verified local cache matches current revision and hash?}
    CACHE -->|Yes| HIT[Use matching cached payload]
    CACHE -->|No| GET[Download referenced Drive version in bounded parts]
    GET --> VALID{Checksum, schema and entity identity valid?}
    GET -->|Network or provider failure| ERR
    VALID -->|No| ERR[Show load failure; keep local copy; do not substitute stale data]
    VALID -->|Yes| STORE[Commit downloaded cache to IndexedDB]
    STORE -->|Success| DATA[Verified dataset]
    STORE -->|Cache write failure| MEM[Keep verified payload in memory; warn that local backup failed]
    MEM --> DATA
    HIT --> DATA
    LEG --> DATA
    DATA --> DRAFT{Local pending snapshot exists?}
    DRAFT -->|No| VIEW[Render existing page and calculations]
    DRAFT -->|Yes| MATCH{Same request or content already committed?}
    MATCH -->|Yes| ACKLOCAL[Acknowledge that exact snapshot; retain any later edits]
    ACKLOCAL --> VIEW
    MATCH -->|No| BASE{Pending base revision equals current revision?}
    BASE -->|Yes| LOCALVIEW[Render pending local snapshot; keep save pending]
    BASE -->|No| COMPARE[Show both copies; block automatic overwrite]
    HEAD -->|Offline or service unavailable| OFF{Previously verified cache exists?}
    OFF -->|Yes| OFFVIEW[Open cached version with offline and pending status]
    OFF -->|No| UNAVAILABLE[Explain unavailable data; retain edits; offer retry]
```

Loading a page must not itself publish a cached snapshot over cloud data. Historical
bill snapshots continue referencing their original master/mapping versions. Saved
Bills listing reads compact metadata, not every Drive payload.
Offline cached access must obey the existing unlocked-device/session policy and
contractor restrictions; an offline cache is not a bypass for expired login or
revoked permissions. If fresh authorization is required, retain the pending data
without displaying protected content until login can be verified again.

## 4. Migration while existing work continues

```mermaid
flowchart TB
    P[Approved design] --> INVENTORY[Inventory live records and local-only pending data]
    INVENTORY --> BACKUP[Create recovery export and revision manifest]
    BACKUP --> STAGE[Build and test in isolated staging; production unchanged]
    STAGE --> COMPAT[Deploy compatible reader and all write-route fences; flags off]
    COMPAT --> GATE{Tests, Drive setup and restore rehearsal pass?}
    GATE -->|No| HOLD[Stop further cutovers; preserve every entity's current committed mode]
    GATE -->|Yes| PILOT[Select one module and small approved pilot batch]
    PILOT --> READ[Read source entity and its revision]
    READ --> COPY[Copy complete payload to private Drive]
    COPY --> CHECK{Read-back hash, counts and totals match?}
    CHECK -->|No| HOLD
    CHECK -->|Yes| SWITCH{Atomically switch if source revision is unchanged?}
    SWITCH -->|No; edited meanwhile| READ
    SWITCH -->|Yes| FENCE[Verify old and new routes honor committed storage mode]
    FENCE --> TRIAL[Verify desktop, mobile, permissions, exports and offline recovery]
    TRIAL --> OK{Pilot acceptance passes?}
    OK -->|No| RECOVER[Pause affected writes and recover latest committed state]
    OK -->|Yes| BATCH[Expand in small resumable batches]
    BATCH --> REST{More modules or entities?}
    REST -->|Yes| PILOT
    REST -->|No| REPORT[Produce exact verified cleanup report]
    REPORT --> CLEAN{Separate approval to remove obsolete database payloads?}
    CLEAN -->|No| KEEP[Retain verified legacy backup; no cleanup]
    CLEAN -->|Yes| GC[Remove only verified obsolete payloads and chunks]
    GC --> MEASURE[Measure actual Firestore reduction]
```

Pilot order: Master Reco -> large masters and contractor mappings -> remaining
Daily Progress payload/history paths -> RA bills, invoices and measurement snapshots.
The policy applies to all modules; the cutover is intentionally incremental.

Original payloads must remain recoverable until verification and cleanup approval.
For legacy objects close to Firestore's document limit, a small new head record can
hold the storage marker while the unchanged original remains in a legacy namespace;
do not make the old document larger or destructively rewrite it merely to add a marker.
Every legacy write must check the authoritative storage mode in the same transaction
as its final mutation. A check performed earlier outside that transaction still races
with migration. These write fences must be deployed and tested before any cutover.

## 5. Rollback without losing newer work

```mermaid
flowchart TB
    F[Serious pilot or rollout failure] --> PAUSE[Pause new writes only for affected scope]
    PAUSE --> LOCAL[Keep device pending edits and recovery downloads]
    LOCAL --> SNAP[Capture current head, in-flight operations and latest revision]
    SNAP --> FORMAT{Entity migrated?}
    FORMAT -->|No| LEG[Continue its existing legacy path]
    FORMAT -->|Yes| GOOD{Latest committed Drive object verifiable?}
    GOOD -->|Yes| COMPAT[Use compatible reader or rehydrate latest version into database]
    GOOD -->|No| BACKUP[Locate verified recovery backup and report its exact revision]
    BACKUP --> LOSS{Latest acknowledged state fully recoverable?}
    LOSS -->|No| STOP[Keep writes paused; report missing revision; never claim full recovery]
    LOSS -->|Yes| COMPAT
    COMPAT --> VERIFY[Verify identity, totals, hash and permissions]
    VERIFY --> REV[Publish recovery with new revision and epoch]
    REV --> TEST[Run affected acceptance and cross-device checks]
    TEST --> READY{Checks pass?}
    READY -->|No| PAUSE
    READY -->|Yes| RESUME[Resume writes; compare pending local copies before saving]
```

Do not simply redeploy an old build that cannot understand Drive references. Do not
flip a flag to an old Firestore snapshot after users have made newer Drive saves.
Restoring an older backup without acknowledging missing newer changes is data loss,
not successful rollback. Drive versions are useful but not an independent disaster
backup for loss of the entire Google account; recovery policy must cover that too.

## 6. Failure-scenario walkthrough

This is a manual design walkthrough, not a production fault-injection test.

| Scenario walked through | Required outcome | Acceptance evidence needed before release |
| --- | --- | --- |
| LocalStorage full | IndexedDB snapshot can still save; unrelated browser data retained. | Existing baseline test plus new all-module paths. |
| IndexedDB transaction aborts | No cloud replacement; keep old persisted state and offer a download of in-memory edits. | Inject abort before and after UI update boundary. |
| Login or permission revoked mid-upload | Final commit rejected; pending data retained. | Revoke permission after operation reservation. |
| Two clients save revision 0 | Exactly one valid entity creation; loser cannot replace it. | Simultaneous first-create test. |
| Two clients save revision N | One commit succeeds; the other retains a conflict copy. | Parallel saves across separate server instances. |
| Operation expires during a long upload | Expired operation cannot commit after a newer operation starts. | Expire/renew lease and change fencing token during upload. |
| Network fails before Drive upload | No published reference or false success. | Disconnect before upload acknowledgement. |
| Drive creates file but response is lost | Retry resolves the preassigned operation/file identity. | Drop response and retry same request. |
| Drive succeeds; Firestore commit fails | Old committed head remains; new file retained for recovery. | Fail the final transaction explicitly. |
| Commit succeeds; browser loses response | Request-ID lookup acknowledges existing save; no extra logical revision. | Drop final response, then refresh/retry. |
| More edits arrive while saving | Acknowledge sent snapshot only; later edits remain pending. | Type after request starts but before response arrives. |
| Another client finalizes or deletes during save | Final commit rejects stale epoch/permissions; no resurrection. | Race finalize/delete with an upload. |
| Two concurrent deletes approach the last bill | Preserve the existing minimum-bill rule atomically at project level. | Parallel deletion of the last two live bills. |
| Old tab/mobile sends an old-format save after migration | Legacy route consults the authoritative storage mode; no competing database payload write. | Keep an old browser build open during pilot migration. |
| Source changes while migration copies it | Source-revision check fails; copy again without switching stale data. | Edit between copy and cutover. |
| Metadata and Drive hash disagree | No load or publication as current verified data. | Alter/truncate a test file. |
| Same contractor display name in different records | Stable contractor/work-order/project identities remain separate. | Duplicate-name and mapping-isolation fixtures. |
| Large upload succeeds but subsequent download is oversized | Bounded download reconstructs the same bytes on another device. | Upload and second-device reload above host body limit. |
| Shared stock/master changes after bill finalization | Historic bill stays pinned to its original snapshot. | Compare historic export before and after master update. |
| Contractor mapping save succeeds but bill save fails | No false all-saved result; bill snapshot explicitly pins the intended mapping version. | Partial multi-record save test. |
| Drive permissions or quota fail | Local pending data retained; bounded retry or setup error; no silent database payload fallback. | Real test-folder permission and quota/error simulation. |
| Drive file manually moved/deleted/modified | Identity/integrity check detects it; reference and recovery status reported accurately. | Use disposable test files only. |
| Browser reloads while local acknowledgement is failing | Cloud commit discoverable; pending status cannot trigger a blind stale overwrite. | Abort acknowledgement transaction, then reload. |
| Cleanup runs while another operation is in flight | Current heads, active operations, retained versions and backup manifests are protected. | Dry-run only in initial rollout; test reachability before any later cleanup. |

## 7. Review pass 1: data consistency and dependency review

Method: trace existing callers and required API contracts, then walk the proposed
save/read paths against those dependencies. This review did not change runtime code.

| ID | Finding | Plan correction / required gate |
| --- | --- | --- |
| R1-01 | Shared config APIs store security records as well as business data. | Explicit business-key allowlist; auth/session/revocation records remain separate. Contract-test login, expiry, reset and admin elevation. |
| R1-02 | Bill summaries currently derive fields from full payloads. | Verify compact list metadata before removing payloads; preserve bill-list API fields. |
| R1-03 | Finalized bills and active contractor mapping have different update semantics. | Pin bill snapshot/master versions; reuse mapping does not rewrite history. |
| R1-04 | Existing billing Firestore revision check is separate from its write. | Both normal saves and migration cutover require atomic revision/fencing checks, including creation. |
| R1-05 | Module feature flags alone cannot stop older clients and legacy bulk-update endpoints. | Every write endpoint, including `updateAllBillsPoleSchedules` / `updateAllBillsActivities`, must consult authoritative entity storage mode. Old routes cannot bypass migration fences. |
| R1-06 | Daily Progress has several full-payload/history paths in addition to its Drive path. | Migrate `dailyProgressData`, shared reports, base reports and event payloads while preserving location/token/worker permissions. |
| R1-07 | Independent Firebase/Mongo writable failover could create competing heads. | One coordination authority; explicit provider recovery instead of automatic split writers. |
| R1-08 | Bytes and references alone do not establish semantic consistency. | Validate schema, stable IDs, counts, source versions, quantities, units, totals and finalized status. |

Pass 1 result: design issues identified and incorporated into this proposed flow.
All implementation acceptance gates remain open until implemented and tested.

## 8. Review pass 2: interruption, rollout and recovery review

Method: walk success and failure branches independently of the happy path, including
old clients, operations spanning deployments, and rollback after new user saves.

| ID | Finding | Plan correction / required gate |
| --- | --- | --- |
| R2-01 | A long/resumed upload may outlive a reservation. | Operation renewals and fencing tokens; late attempts cannot publish an expired save. |
| R2-02 | Authorization at upload start may be obsolete at commit time. | Recheck session, permissions, finalized state and epoch at the final commit boundary. |
| R2-03 | Hard deletion removes revision evidence and can permit stale recreation. | Tombstones/epochs for migrated entities; enforce last-bill invariant transactionally if retained. |
| R2-04 | Rolling back a feature flag can lose newer Drive changes. | Compatible reader plus latest-version rehydration; no stale legacy fallback. |
| R2-05 | A valid backup of revision N does not recover a lost acknowledged revision N+1. | Report recovery-point accuracy; pause writes when exact latest state cannot be recovered. |
| R2-06 | Copying to Drive does not itself reduce Firestore storage. | Separate verified cleanup report and approval; protect references and active operations. |
| R2-07 | Small-file tests do not test the host body limit on reload. | Exercise large upload AND download, retry offsets, encoding overhead and Unicode boundaries. |
| R2-08 | Many small autosaves can grow versions and API usage even with small Firestore heads. | Debounce/coalesce pending saves, skip unchanged content, measure operation rates, and define retention separately. |
| R2-09 | Drive metadata and source Excel can finish at different times. | Publish an import only when all required asset references are verified; retain partial uploads as recoverable uncommitted objects. |
| R2-10 | Shared service changes can disturb modules even with migration flags off. | Run old-format API contract tests in staging with all flags off, then test one module enabled while all others remain legacy. |

Pass 2 result: the safe rollout must include these conditions; migration must stop
at a failed gate rather than expand to the rest of the application.

## 9. Protecting the working system

1. Implementation happens in a separate branch and isolated staging deployment.
   Production remains unchanged while compatibility code is developed and tested.
2. No UI/formula refactor is bundled with storage migration.
3. Test both feature-flags-off and mixed legacy/Drive operation before pilot cutover.
4. No global conversion of `getDefaultConfig`, no migration of authentication data,
   and no automatic deletion of original business payloads in the initial rollout.
5. Require before/after snapshots and exports for each pilot module, plus a real
   restore drill on disposable staging data.
6. Expand only after two-device acceptance; one failed invariant pauses that module.
7. Keep a known compatible rollback deployment, immutable recovery manifests and
   latest-head evidence. Do not rely only on a Git code rollback.
8. Produce a production change report identifying records switched, previous/current
   revisions, verified backups and pending operations, without exposing credentials.

## 10. What has been checked versus what has not

- DONE: two design-review passes documented above and 24 failure-scenario walkthroughs.
- DONE: all five diagram definitions passed Mermaid 12.3.0 syntax parsing in a
  temporary isolated tool directory. This checks diagram grammar, not rendered
  layout or correctness of an unimplemented storage system.
- DONE: repository call paths checked; special handling identified for auth,
  summaries, bulk writes, Daily Progress history, concurrency, delete and rollback.
- BASELINE FROM PREVIOUS PLANNING STEP: full `npm test` passed; health audit 11/11.
  Runtime code has not changed since those checks, so repeating the same suite would
  not prove the proposed migration works.
- NOT YET DONE: new storage implementation, staging tests, production Drive account
  and credentials verification, live inventory, multi-device pilot, or restore drill.
- CURRENT DECISION: ready for user review of the design; not ready to migrate live data.

The target is to keep existing behavior stable and make failures recoverable.
Two design reviews reduce overlooked risks; they do not guarantee zero future errors.

## 11. Additional recheck requested by the user

The storage diagrams were checked again before drawing the whole-project map.
Four missing or ambiguous branches were corrected in the diagrams:

1. An unknown database-commit result must be looked up by request ID. A timeout does
   not prove that the old head is still current, so blind retry is unsafe.
2. Local pending edits based on the current cloud revision must stay visible as the
   local working snapshot. Loading the same base revision must not erase those edits.
3. A valid downloaded dataset can be viewed in memory when its local cache write
   fails, with a visible warning. A provider read failure has an explicit error path.
4. Stopping a later migration batch preserves the already-migrated entities' current
   modes. It cannot truthfully promise that all production remains unchanged after
   earlier successful cutovers.

These are documentation corrections. Future implementation tests must cover each
branch; no production code was changed to implement them during this recheck.
