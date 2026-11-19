# Daily Progress login performance — 19 November 2026

The deployed API was in iad1 (Washington) while the live Firestore database is in asia-south1 (Mumbai). This release pins the function to bom1 (Mumbai), matching the database location. Vercel documents the region mapping and recommends co-locating functions with data: https://vercel.com/docs/regions.

Worker user, email/mobile index and session reads now use fresh single-document reads instead of read-only transactions. The shortcut accepts only hashed worker-auth keys; shared business reports retain normal Drive routing. Commit authorization witnesses are retained. Password hashing, login limits, session writes, disabled-account checks and password-reset/logout revocation remain enforced. A duplicate email fallback read was removed.

The signup contractor directory is fetched only when Create Account is opened. Concurrent openings share a request; failed loads can retry. Sign In immediately shows Signing in… and disables duplicate submits until completion. Both standalone entry pages refresh their auth script cache version.

An isolated real Firestore benchmark alternated three before/after successful synthetic email logins: median 627 ms before, 432 ms after (about 31% improvement in this local staging measurement). This does not predict a fixed percentage for every device/network or Vercel cold start. No production account/password was used for that benchmark.

Focused tests verify fresh auth reads without transaction locks, permission witnesses, changed-user visibility, invalid key rejection, existing login/security workflows, lazy signup directory loading and immediate pending/error button states. Production deployment region and public endpoint smoke timings are recorded locally in backups/login-performance-20261119/.

Rollback source: 66e99e7a3a547e2f6f023b2d0555f7e0c3c3d7ae; prior production deployment: dpl_DisKbiZHDhnGq9ueSYgAveGqWcL8. This change does not migrate live records or enable Drive rollout.
