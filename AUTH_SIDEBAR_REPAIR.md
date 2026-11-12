# Path4U authentication and sidebar repair — 12 November 2026

Protected Preview: [Open Path4U Preview](https://openpath-ai-demo-03531-jw90gbnb7-webwavework9-8838.vercel.app). Deployment `dpl_dHcjPZRaQVAj2d5oXNc5tPYogH7r` is READY and requires Vercel sign-in.

Production has not been deployed, promoted, or reconfigured. Its public URL continues serving the old deployment. Supabase, existing accounts, existing private records, Gemini, routing and the monochrome design are preserved. Only the two explicitly approved synthetic QA accounts and their test data were changed; both accounts were retained.

## 1. Confirmed causes

**Public signup:** immutable Production source `server/auth.mjs` unconditionally writes `public.openpath_signup_tickets` before calling `/auth/v1/signup`. The shared database has no such table and no ticket-validation Auth trigger. A TLS-verified, read-only schema audit confirmed its absence; the required Data API relation returned **HTTP 404 / PGRST205**. The old handler therefore stops registration before Supabase Auth account creation. No Production signup probe was sent: automatic approval review rejected that proposed mutation, and inspection continued read-only.

**Login feedback:** the old deployed handler replaces every provider login error with the same email/password/verification message. Native Supabase REST errors can contain a numeric `code` and the actionable string `error_code`; the repaired handler explicitly prefers `error_code` and also supports string `code`. Live checks now distinguish `email_not_confirmed` from `invalid_credentials`. The historical generic message cannot establish which condition caused the user's particular attempt; no password was requested and no cause was invented.

**Email delivery:** after the two successful QA signups, a fresh confirmation request and recovery delivery attempt returned **429 / over_email_send_rate_limit**. This is a separate provider quota blocker. The application now reports email sending limits honestly rather than claiming an email was sent.

Vercel runtime logs were inspected. Supabase management access lists no accessible project for this connection, so the Auth dashboard's historical logs could not be inspected. A read-only aggregate Auth audit-log query returned no actions in its inspected window; that is not evidence that historical login attempts succeeded.

## 2. Authentication fixes

- Signup defaults to server-side age attestation; it no longer depends on the missing legacy ticket table or an environment-mode switch. Explicit `legacy-ticket` mode remains available only for deliberately configured dedicated projects. The full DOB is validated server-side and not sent to Supabase or retained.
- Existing Supabase email/password Auth, verified-email requirement, onboarding and ownership policies remain in place. No migration or trigger change was applied in this task.
- API errors expose only safe machine codes and curated messages. The frontend preserves those codes and offers verification resend for unconfirmed accounts. Wrong credentials receive a distinct safe message.
- Signup confirmation says “Check your email to verify your account.” Resends show a disabled countdown. A bounded server-instance cooldown supplements Supabase's project-wide limits; it is not represented as a distributed limiter.
- Auth errors log action/status/safe code only when monitoring is enabled. Cookies remain Secure, HttpOnly and SameSite=Lax. Existing PKCE and token-hash callbacks, recovery-only sessions, refresh and logout are retained.
- Unsuccessful email requests now surface failures rather than silently returning success, except intentionally indistinguishable absent/already-confirmed-account cases.

## 3. Files changed in this repair

| Area | Files |
| --- | --- |
| Server | [auth.mjs](C:/Users/sumed/Downloads/MATH/OneDrive/Documents/projects/openpath-ai/server/auth.mjs), [index.mjs](C:/Users/sumed/Downloads/MATH/OneDrive/Documents/projects/openpath-ai/server/index.mjs) |
| UI/API | [Auth.tsx](C:/Users/sumed/Downloads/MATH/OneDrive/Documents/projects/openpath-ai/src/Auth.tsx), [api.ts](C:/Users/sumed/Downloads/MATH/OneDrive/Documents/projects/openpath-ai/src/api.ts), [Shell.tsx](C:/Users/sumed/Downloads/MATH/OneDrive/Documents/projects/openpath-ai/src/Shell.tsx) |
| Regression tests | [auth.test.mjs](C:/Users/sumed/Downloads/MATH/OneDrive/Documents/projects/openpath-ai/tests/auth.test.mjs), [browser-auth-navigation.mjs](C:/Users/sumed/Downloads/MATH/OneDrive/Documents/projects/openpath-ai/tests/browser-auth-navigation.mjs), [browser-navigation.mjs](C:/Users/sumed/Downloads/MATH/OneDrive/Documents/projects/openpath-ai/tests/browser-navigation.mjs) |
| Opt-in diagnostics | [audit-auth-readonly.mjs](C:/Users/sumed/Downloads/MATH/OneDrive/Documents/projects/openpath-ai/scripts/audit-auth-readonly.mjs), [read-retained-qa-tokens.mjs](C:/Users/sumed/Downloads/MATH/OneDrive/Documents/projects/openpath-ai/scripts/read-retained-qa-tokens.mjs) |
| Configuration/docs | package.json, .env.example, SETUP.md, UX-CONTRACT.md, README.md, HACKATHON_READINESS.md and this report, in the repository root |

The build-only QA utility is restricted to a marked, explicitly approved run and Preview. Its optional credential regeneration affects only those two synthetic accounts. Generated credentials/tokens are transported encrypted to a local test key; temporary local key/credential files were removed after testing. No QA admin endpoint was added to the website.

## 4. Manual configuration still required

Open the existing [Supabase project](https://supabase.com/dashboard/project/dnyffcgspwzckpuztyzh). The owner must review **Authentication → Email → SMTP Settings** and **Authentication → Rate Limits**. If custom SMTP is absent, configure a verified sender and the provider's host, port, username, password, sender email and sender name. Enter credentials only in Supabase, never in chat. If SMTP is already configured, investigate the actual sending quota and sender restrictions with that provider.

Supabase documents that its built-in sender is restricted to organization-team addresses and currently allows only two messages per hour; custom SMTP is the supported route for public-user delivery. The exact SMTP configuration of this project could not be inspected through the connected management account. [SMTP documentation](https://supabase.com/docs/guides/auth/auth-smtp), [Auth rate limits](https://supabase.com/docs/guides/auth/rate-limits).

Email confirmation is already enabled (settings endpoint HTTP 200). Read-only invalid-token redirect probes confirmed all three: Production callback allowance, current Preview callback allowance, and default Site URL resolve to the correct deployed domains. The former localhost issue is resolved; no further URL change was found necessary.

Required server variables remain `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`; they stay server-side. No new secret is required for this code repair. The tested Preview explicitly selects `PATH4U_DATA_BACKEND=supabase`, `PATH4U_DEMO_BACKEND=supabase` and `PATH4U_PUBLIC_DEMO=1`; its monitoring flags are enabled. Any approved Production release must use the reviewed durable configuration, not inherit an old temporary Redis setting.

## 5. New signup and verification results

Two real synthetic registrations through the protected Preview returned HTTP 200 and created the corresponding Auth records with server age attestation. No further accounts were created. Confirmation delivery was accepted for those requests; inbox receipt was not independently checked in this run. Later mail attempts hit the provider quota.

Real Supabase-generated, admin-issued test confirmation links were used to complete token verification. The application established verified sessions for both accounts; no auto-confirm setting was changed. **This tests provider token verification, not clicking the originally delivered confirmation email.** The original signup email/PKCE click remains unverified live after the mail quota interrupted fresh-link testing. PKCE cookie/challenge/exchange behavior passed local integration tests with a mocked provider.

Associated app profiles were saved on onboarding using each authenticated Auth user ID. The legacy Auth trigger was retained and did not block the successful registrations.

## 6. Existing-user login results

After verification, both retained QA accounts signed in successfully with their generated passwords. Repeat login and login after QA password recovery succeeded. Wrong passwords returned `invalid_credentials`; an unverified QA login returned `email_not_confirmed`. No unrelated real user's credentials or password were used or changed.

## 7. Session, saved-data and security results

Secure HttpOnly cookies, browser refresh, refresh-token rotation, profile reload, saved roadmap reload, draft persistence, logout and anonymous-data denial passed against the actual Preview/Supabase backend.

Each QA account's workspace/library stayed isolated through the application. With real populated owner records in `openpath_profiles`, `openpath_workspace` and `openpath_library`, read-only PostgreSQL checks under the other account's authenticated role returned zero cross-owner rows for all three tables. Existing RLS policies were not changed.

A provider-generated recovery token established a restricted recovery session that could not read the workspace. Resetting only a newly generated QA password, then signing in with that password and logging out, passed. **Delivered recovery email remains blocked by provider quota and is not claimed as passed.**

## 8. Exact sidebar entries removed

Only these six entries were removed from the shared `sections` configuration: **Internships, Hackathons, Jobs, Workshops, Certifications, Scholarships**. Desktop and mobile consume that same configuration.

Dashboard, Atlas Index, Resume Studio, Field Tools, Account, Discover Opportunities and all other existing entries remain. No routes, filters, category records, source data or APIs were removed. No redirects were introduced.

## 9. Discover Opportunities

The live Preview still exposes **Internships**, **Hackathons & Workshops**, **Jobs**. The final source read returned **872** genuine listings from the Supabase-backed source cache. Actual cards, tabs, category query navigation and refresh were checked. Counts are a snapshot and can change with source refreshes.

## 10. Desktop and mobile navigation

Local browser regressions passed hover menus, shared category removal, mobile drawer links, category URL refresh, browser Back/Forward, internal-only Back fallback, unsaved-work warnings and narrow layouts. The Back button remains in shared main content above headings.

Deployed browser checks passed login/refresh/logout, desktop and mobile duplicate-link removal, Discover tabs and mobile Resume navigation, shared Back and no horizontal overflow. A separate loaded-page visual check waits for the actual Resume heading before capture; zero browser runtime errors were observed in the completed live checks.

## 11. Automated checks and remaining issues

- `pnpm typecheck`: passed.
- `pnpm test`: **36 passed**, including native numeric-code/string-error-code regression coverage.
- `pnpm build`: passed. Existing large PDF-chunk warning remains.
- `tests/browser-auth-navigation.mjs`: passed with mocked upstream Auth.
- `tests/browser-navigation.mjs`: passed, including unsaved forms and Back/Forward behavior.
- `tests/browser-upgrade.mjs`: passed with mocked Auth/Gemini providers; it is not a live Gemini test.
- Strict UI audit: **0 findings**.
- Live QA: verified-account login, session persistence, provider-issued confirmation/reset tokens, saved data, ownership and desktop/mobile navigation passed. Email delivery and the original delivered signup-link click require a fresh test after SMTP/quota correction.

Gemini integration was not changed or represented as newly live-tested in this repair. There are no new mock product integrations; mocks are confined to local tests.

## 12. Deployment readiness

The protected Preview is available at the link above. SHA-1 source identifiers for the five changed runtime files match the local tested files. The fully loaded mobile Back button was measured below the sticky header and above the Resume heading at zero scroll. Vercel sign-in remains enabled; no public bypass/share link was created. The public Production deployment remains `dpl_FPps3UAww6XGauVZDgGUW1nkywWd` and still has the old signup behavior.

**Public authentication is not fully ready until the email sending blocker is corrected and delivered verification/recovery links are retested. Production deployment also requires the user's explicit approval.** No Production release was attempted.
