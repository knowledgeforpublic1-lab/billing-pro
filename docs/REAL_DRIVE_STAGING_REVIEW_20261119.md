# Real Drive staging verification — 19 November 2026

Result: PASS. All 11 external staging checks passed. Local storage regression: 43/43 passed. JavaScript syntax and git diff --check passed.

## Verified environment

Firebase project: `billing-pro-staging-ba9a8`, Firestore `(default)`, Mumbai (`asia-south1`). User OAuth scope: `drive.file`; credentials remain in the git-ignored local staging environment. No production environment changed, no push/deployment, no production migration or deletion.

The user delegated the folder choice. The app-created private root is [Billing-Pro-Staging-App](https://drive.google.com/drive/folders/1K8pF7E4RCjd0ZYz5HHOInZnosYtqDglF). The earlier manually created folder was not used or modified. Real folder capability/privacy checks passed; this is limited access to app-created/selected files, not unrestricted Drive access.

## External checks passed

- Private folder access and fresh OAuth token refresh.
- Bill, reconciliation, master, mapping and Daily Progress: two immutable versions, exact readback, same-request retry and previous-version checksum verification.
- Real concurrent Firestore reservations: exactly one racing save committed, the stale writer received a conflict.
- 8 MiB Unicode payload: resumable upload, full readback and exact content equality.
- Binary payload of 1 MiB + 17 bytes: 256 KiB upload portions, HTTP range downloads and full SHA-256 equality.
- New Firebase app/repository/Drive connections restored all five modules and the large payload while rollout flags were disabled.
- A synthetic corrupted response against a real committed head failed closed. The actual Drive file was not modified.

Only synthetic test data was transmitted/written in this run; retained test artifacts were not deleted. This verifies the real storage repository and Drive adapter, rather than hosted Vercel/browser transport.

## Evidence and recovery checkpoint

External report: `backups/drive-staging-20261119/9a706824-767c-44c1-948b-2a865447c865/report.json`.
Restored synthetic payloads: same directory, `restored-synthetic-data.json`.
Local regression: `backups/drive-staging-20261119/local-storage-regression.log`.

Verified read-only staging backup: `backups/drive-staging-20261119/verified-firestore-snapshot/`.
Documents: 8; lossless REST archive bytes: 7888; SHA-256: `ddb85bee00f831ebef0e28107fb4af0a969555caf4ea91fb9cdf5e1932f266b2`.
The seven stored heads contain metadata, not business payload fields. Archive byte size is not billed Firestore storage/index size.
Original live backup remains unchanged at `backups/pre-drive-first-20261118/`.

## Remaining production gates

- Hosted Vercel transport/execution limits and deployed two-device/role checks require a preview deployment; no deployment was performed under the user's no-push/no-deploy instruction.
- Production OAuth/folder configuration, fresh live backup and a reviewed production cutover remain separate work. Existing live data has not been migrated or cleaned up.
- Verify OAuth audience/token lifetime before long-running production use. Google documents a seven-day refresh-token limit for External apps in Testing mode; production authorization must not silently depend on that temporary setup. [Official OAuth app state documentation](https://developers.google.com/identity/protocols/oauth2/production-readiness/overview).
- Earlier source-data warnings (11 balance mismatches, 116 missing/zero rates, 320 negative-balance rows) still require record verification.

A Google authentication dependency emitted deprecation notices, but all checks completed successfully; no credential values were logged.
