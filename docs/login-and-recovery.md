# Portal login and password recovery

The portal uses the registered owner's Firebase Authentication Email/Password account. The frontend contains no accepted password and does not trust a sessionStorage unlock flag.

The registered email lives privately in the database's `portalAuthOwnerV1` configuration. The public Firebase web key/project are in `api/auth-settings.js`. Login and admin reauthentication call Firebase from the server. Passwords are never saved in the billing database.

After verification, the browser receives an opaque HttpOnly, SameSite=Strict cookie (Secure on HTTPS). Provider tokens are encrypted in private server session records. A dedicated `AUTH_SESSION_SECRET` is recommended; existing private database credentials are used if it is absent. Rotating the encryption secret requires a new login.

Sessions expire after four hours without real activity by default (configurable via the `AUTH_IDLE_MINUTES` environment variable, 5-minute security floor), with a maximum lifetime of one day. Looking up the session or refreshing the page does not extend inactivity expiry. The frontend countdown uses the server's deadline. Local entries are saved before locking; no default/blank bill is saved while logged out. Activity touches cannot revive expired sessions.

Admin elevation requires server-side password verification and lasts five minutes. Bill deletion, shared-master writes, material-row structural changes and finalize/unlock transitions require valid elevation on the server. Routine bill quantity saves remain available to the authenticated owner.

Forgot password sends Firebase's password-reset confirmation only to the configured owner; a request body cannot supply a different destination. Firebase hosts the confirmation/code redemption page and validates reset codes. Password changes and disabling the account invalidate existing sessions during server validation. Reset requests and password attempts have separate rate limits.

Session revocation is stored separately so a delayed activity update cannot resurrect logout. Session fields are patched independently so activity requests cannot overwrite admin elevation or refreshed provider tokens.

`npm test` covers server/client login, wrong passwords, cookie policy, idle/admin expiry, reset destination, password-reset/logout revocation, local-entry preservation and the existing billing/filter calculations. Real email delivery is intentionally not triggered by automated tests.
