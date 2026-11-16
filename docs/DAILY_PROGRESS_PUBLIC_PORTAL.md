# Daily Progress public entry portal

## What is implemented

- `/daily-entry#link=...` is a separate page. It loads no billing data or historical seed records.
- An admin creates one opaque link per contractor. The server stores only its hash. Replacing or disabling it invalidates the previous link. Anyone holding the current link is a permitted entry user for that contractor; this is a bearer link, not personal authentication.
- Contractor and work date identify a record. Any unsaved valid work date is open, including past/future dates. No automatic midnight rewrite occurs.
- The first server-accepted claim reserves that record for five minutes. Active editors renew it every 30 seconds while there has been recent input; inactivity allows the five-minute reservation to expire. Other users can view that exact date's saved draft but cannot edit or save it. An expired lease can be claimed explicitly; the existing draft remains.
- Drafts autosave after an input pause. The viewer polls every seven seconds. Text still being typed before its autosave arrives will not appear on another device yet.
- Final Save locks the record only after Google Drive confirms a version and the database commits its reference. Only an authenticated, elevated admin can reopen or release the reservation.
- Each save makes an immutable JSON file in the configured Drive folder. Older versions remain there for recovery. No public Drive permission is created. Reports, drafts, new manual issues and newly added contractor records are written to Drive. Coordination records, link hashes, contractor access metadata, file pointers and recent audit events live in the existing Firebase/Mongo database.
- Transactions / compare-and-swap protect concurrent records. Stale versions and old reservation epochs are rejected. Repeating an acknowledged save request is idempotent. An interrupted operation can leave an unreferenced version in Drive; it cannot replace a newer committed report.
- Network failures retain pending inputs on the editor's device and show retry/download controls. A duplicate tab is prevented from sharing an editor identity using Web Locks. Without Web Locks, a distinct per-page identity is used and a refresh may require waiting for the old lease.
- The Billing page, mobile page, confidential `js/data` assets and existing APIs require the normal login. Confidential scripts are excluded from static deployment and served only by the authenticated backend.

## Required server configuration

Nothing should be added to client JavaScript or committed to Git.

1. Keep the existing Firebase or MongoDB configuration. It provides the cross-instance reservation and finalization transactions.
2. Set `DAILY_PROGRESS_DRIVE_FOLDER_ID` to the destination folder ID.
3. Choose one server authentication method:
   - OAuth: `GOOGLE_DRIVE_CLIENT_ID`, `GOOGLE_DRIVE_CLIENT_SECRET`, `GOOGLE_DRIVE_REFRESH_TOKEN`. The authorized account/application must have access to the chosen folder and permission to create files there.
   - Service account: `GOOGLE_DRIVE_SERVICE_ACCOUNT`, containing its JSON credentials or a local credential-file path. Grant the service account access to the destination, preferably a Shared Drive folder compatible with service-account file creation. The adapter includes `supportsAllDrives=true`.
4. Enable Google Drive API for that Google Cloud project. A ChatGPT Google Drive connector does not supply runtime credentials to the deployed website.
5. Configure the same variables on the deployment host. The local `.env` is not deployed automatically.

If credentials or folder permissions are missing, saves fail closed. A report is never marked final or successfully saved just because browser caching worked.

Google references: [Upload file data](https://developers.google.com/workspace/drive/api/guides/manage-uploads), [Shared Drive support](https://developers.google.com/workspace/drive/api/guides/enable-shareddrives).

## Enable and share

1. Log in to Billing Pro and open Daily Progress.
2. Expand **Public entry links & admin controls** and run **Check Google Drive** (admin password/elevation required).
3. Run **Import historical reports to Drive** from the browser containing the old reports before distributing links. Import skips existing cloud versions; it never bulk-overwrites them. Confirm import success before treating old dates as centrally locked. Existing legacy cloud reports are merged into the admin view; browser-only history remains on its original device until imported.
4. Select the contractor and create its link. Copy the shown URL. It is shown once; replacing it generates a new link and disables the old one.
5. To reopen: select contractor/date, use **Admin: Reopen selected date / release editor**. The public user then uses **Start / resume entry**. Reopening does not reserve the record for the admin; the first editor to press Start / resume receives it.
6. Activity history shows the recent reservation, draft-save, final-save and reopen events for that record.

No anonymous bulk history, stock issue ledger, Drive folder listing, Excel export or contractor selector is exposed by the public page.

## Deployment and regression checks

`npm test` runs the existing billing/reconciliation/auth tests and the new concurrency, Drive-adapter, browser-logic and export tests. `npm run audit` checks the repository's existing integrity/security assertions.

The new tests use isolated storage/HTTP fakes and do not write to the live database or Drive. Real credential verification uses the admin **Check Google Drive** action. A production trial with two browsers and ten independent contractor links remains necessary after credentials are configured; unit tests cannot prove live network/storage availability.

The clean export template is `public/daily-progress-template.xlsx`, served only through `/api/daily-progress/template`. `scripts/build_daily_progress_template.js` builds it from the local original's formatting while removing all historic values. The original workbook is neither published nor modified.
