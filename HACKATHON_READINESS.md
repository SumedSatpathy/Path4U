> Authentication/sidebar update — 12 November 2026: read [AUTH_SIDEBAR_REPAIR.md](AUTH_SIDEBAR_REPAIR.md) for the latest protected Preview, confirmed signup cause, live QA results and remaining Supabase email-quota blocker. Production is unchanged.

# Path4U judging-weekend readiness — 12 November 2026

Repository: `C:/Users/sumed/Downloads/MATH/OneDrive/Documents/projects/openpath-ai`.
Latest protected Preview: https://openpath-ai-demo-03531-ec73h3et2-webwavework9-8838.vercel.app
Deployment: `dpl_EXS2vUbsAw13XoT4Ed1H54ShyBtG` (READY). Vercel sign-in remains enabled.
Production has NOT been deployed or promoted during this task.

## 1. Architecture and issues discovered

React 19, TypeScript, Vite 6, pnpm, and the existing custom history/hash router remain in place. `src/main.tsx` mounts the app; `src/routes.ts` owns navigation. `api/index.mjs` runs `server/index.mjs` as a Node Vercel Function; `vercel.json` preserves the API rewrites and 120-second duration. This is a serverless backend, not a static-only deployment. Existing Supabase Auth and Gemini REST integration are retained.

The database had legacy `profiles`, `opportunities`, saved-opportunity and other tables, but not the `openpath_*` tables requested by the current application. Earlier Redis replacement storage expired during judging. Guest routing could select a missing legacy credit RPC despite selecting the new backend. The native Auth signup response can be a top-level User, rather than `{user}`, which prevented attestation from being saved. Email callbacks lacked standard PKCE exchange. Supabase's email redirect default was localhost. Discover substituted fictional fixtures for an absent catalog. One genuine event directory record had a broken registration URL.

## 2. Files changed for this task

- Authentication: `server/auth.mjs`, `src/Auth.tsx`, `src/main.tsx`.
- Sources: `server/feed.mjs`, `server/careerTools.mjs`, `src/Discover.tsx`, `src/data.ts`, `src/workspace.tsx`, `src/discover.css`, `src/Dashboard.tsx`.
- AI reliability: `server/aiQuota.mjs`, `server/durableDemo.mjs`, `server/demo.mjs`, `server/liveDemo.mjs`, `server/assistant.mjs`, `server/integrations.mjs`, `server/research.mjs`, `server/index.mjs`, `src/Learning.tsx`.
- Database: `supabase/migrations/20261112132337_durable_path4u_workspace.sql`; TLS/audit/migration and opt-in verification utilities under `scripts/`.
- Tests: `tests/auth.test.mjs`, `tests/redis-data.test.mjs`, `tests/live-opportunities.test.mjs`.
- Configuration/context: `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `.env.example`, `premium-ui.json`, `DESIGN.md`, `UX-CONTRACT.md`, `src/Landing.tsx`, and documentation pointers.

Resume Studio and Resume Rater implementation were preserved. Existing routes, sidebar design, Back button, and Google integration handlers remain.

## 3. Signup and login behavior

Registration validates the existing form and server age rules, then uses Supabase Auth for password storage and email confirmation. Both native signup response shapes work. The server writes self-declared age attestation to trusted `app_metadata`; it never stores DOB. New or existing eligible users without a current profile complete onboarding. Completed users reach their full account workspace.

Standard email PKCE now uses a random verifier in an HttpOnly cookie and server-side SHA-256 challenge/code exchange. The server establishes HttpOnly access/refresh cookies; recovery gets a separate restricted cookie. Caller-supplied recovery flags cannot change the PKCE cookie's flow. Existing token-hash email templates still work. Successful authentication and profile saving clear their own form guards. Password recovery, refresh, and logout remain genuine Supabase operations.

A real signup message reached the user-approved inbox, confirmed by the user. Its real account record and trusted age flag were audited; a separately admin-generated token successfully confirmed that synthetic account through the application. Automated reset/token tests likewise used admin-generated links. Clicking the exact delivered email link in a browser was not automated. PKCE requires the browser that initiated the request; cross-device users can confirm then sign in, or request recovery in their current browser.

A fresh redirect audit returned the exact Preview callback URL after the owner settings were updated. No email link, OTP, user password, service-role key, or Gemini key appears in this report.

## 4. Supabase changes and preservation

The user explicitly approved the additive repair on the shared existing project `dnyffcgspwzckpuztyzh`. TLS uses the official Supabase CA with hostname and certificate verification enabled.

Added owner-isolated `openpath_profiles`, `openpath_workspace`, `openpath_library`, public source-backed `openpath_opportunities`, and service-only feed/quota/request/public-cache tables. RLS and explicit grants are enabled. The atomic quota RPC is callable only by the service role. Eligibility checks use confirmed Auth records and trusted app metadata, not user-editable authorization claims.

No legacy table, account, policy, or `auth.users` trigger was replaced. The existing `on_auth_user_created` trigger remains. The migration is recorded with a checksum in `openpath_private.path4u_migrations`. Do not blindly run the three earlier unapplied migration files: they install a global Auth signup trigger and are not the migration applied here.

The non-overwriting Redis copy found no matching real-account records to copy; three orphaned synthetic records were skipped and retained in Redis. All newly created QA Auth accounts were removed after testing. No public judge account was created.

## 5. Providers integrated

- Cloudflare and Canonical through Greenhouse's official public Job Board API. Published employer listings support Verified Open at the recorded check time. [API documentation](https://docs.greenhouse.io/job-board.html).
- Grab's public SmartRecruiters postings API, Malaysia country filter, with employer-provided details and original application URLs. Only public active postings are accepted. [API documentation](https://developers.smartrecruiters.com/docs/endpoints).
- Hackalendar's documented unauthenticated events API, retaining original organizer registration URLs and attribution. Directory publication alone is Status Unverified. [API usage documentation](https://hackalendar.com/api).

No LinkedIn scraping, anti-bot bypass, or login-only extraction was added. MLH reuse restrictions prevented using its page content; Adzuna credentials were not available. New workshops are not invented when the sources return none.

## 6. Real listing and application-link results

Snapshot in the durable cache: **872 visible listings: 7 internships, 846 jobs, 19 hackathons, 0 workshops**. Includes **55 Malaysia-based Grab roles**. The raw event feed returned 20 records; one confirmed 404 registration was marked Closed and excluded.

22 original application URLs were checked at low concurrency: 20 succeeded, one event returned 404 and was excluded, and one SmartRecruiters page returned 403 to automated HEAD. The latter was not bypassed or described as link-verified; its employer's active posting API remains the source evidence. This sample does not prove all 872 URLs work. Counts and availability may change with real source refreshes.

Unknown dates, fees, duration, remote status and eligibility remain unknown. There are no fabricated match scores or fallback cards in live Discover. The three primary tabs are Internships, Hackathons & Workshops, Jobs, in that order. Search, filters, source status, saves, details, original application links, and date sorting use these records.

## 7. Actual refresh and cache behavior

The account's Vercel plan was checked: **active Hobby**. Hobby cron is limited to once daily, so a six-hour cron was not installed. [Vercel scheduling limits](https://vercel.com/docs/schedules/cron-jobs/usage-and-pricing).

Instead, a catalog request refreshes each due provider at most every six hours. Supabase retains the last successful payload. A conditional database update leases refresh work across function instances; failed providers get a 15-minute retry cooldown and a disclosed cached state. Source checks older than 24 hours lose Verified Open status. Missing/expired/closed records are excluded or archived. Reviewed event-platform hosts also receive bounded HEAD checks without arbitrary redirect following. The broken registration test and cache persistence were verified; there is no claim that a cron ran.

Timeline markers use genuine stored deadlines or event start dates, beginning in 2026 and continuing forward. Event dates are labeled separately from deadlines. Unknown times are not invented.

## 8. Gemini model, quotas and controls

The server's model metadata check confirmed **gemini-3.1-flash-lite** is available to the configured key and supports generation. Genuine guest chat, a 26-week AI-engineering roadmap, and a signed-in cybersecurity roadmap succeeded.

The user reported active AI Studio readings of RPM **3/15**, TPM **2.2K/250K**, RPD **28/500**: limits are 15 RPM, 250,000 input TPM and 500 RPD. These project limits were read by the owner, not independently retrieved from Google's management console. Limits apply across the project, not separately to each key; Google's daily boundary is Pacific time. [Quota documentation](https://aistudio.google.com/docs/rate-limits).

Application limits: 4 guest interactions and 1 roadmap per UTC day per signed guest session; 12 interactions and 2 roadmaps per account; 80 shared interactions/day and 4 interactions/minute. Guest starts have an additional 8/network/day cap and generated guest work a 20/network/day cap. Signed-in users have their own account allowances. Cookies are HMAC signed and network bound; raw IP addresses are not stored.

Every actual Gemini attempt, including a retry/tool call, also reserves a service-only compare-and-swap counter: 400 attempts per Pacific day, 10/minute, and a conservative estimated 200,000 input-token/minute cap. The estimate is not Google's tokenizer, and fixed-window pacing cannot guarantee the absence of provider 429s. Provider quotas remain authoritative.

Only six closed-list generic, context-free questions enter a shared public cache. Guest and account reply formats have separate namespaces. Conversations, goals, attachments and resumes are excluded. Duplicate request reservations are durable; accepted failures consume allowance. There is one retry for explicit upstream 503, none for 429 or transport timeout. Responses have output limits and bounded timeouts, and errors preserve input. Navigation does not generate AI requests.

Paid search, image generation, and private AI processing remain disabled. Search availability differs from generation: Gemini 3.1 Flash-Lite's free API tier does not include Google Search grounding. Cached public opportunities and checked learning resources remain available. [Model pricing](https://aistudio.google.com/docs/pricing#gemini-3.1-flash-lite).

## 9. Weekend capacity and optional cost

The app admits at most 80 uncached interactions per UTC day: roughly 240 across three full app quota days, or 20 guests using four interactions each per day. Kuala Lumpur's exact November 13–15 window crosses UTC/Pacific reset boundaries, so this is a planning figure, not a guaranteed number for that local window. External project usage and upstream outages can reduce capacity. Public cached replies avoid additional Gemini calls. The separate 400-attempt cap reserves 100 of the reported 500 daily provider requests for other project activity.

No billing was enabled. An illustrative future paid workload of 1,000 calls averaging 2,000 input and 2,000 output tokens would cost about **US$3.50** at the documented $0.25/$1.50 per-million text-token prices, excluding tools. Review a **US$5 maximum** before any paid activation; no spending setting was changed.

## 10. Verification evidence

- `pnpm install --frozen-lockfile`, TypeScript checks, `pnpm test`: **35 passed**, and `pnpm build` passed. The existing large PDF bundle warning remains.
- Strict UI audit: **0 findings**.
- Reviewed final Preview runtime monitoring shows guest sessions and assistant requests completing with HTTP 200; logs contain route, status and timing only.
- Live Supabase integration audit: **27 checks passed**, including missing-profile onboarding, two-user RLS isolation, workspace persistence, wrong password, recovery/reset, session refresh, revision conflict and logout. Both accounts were removed.
- Actual atomic quota/replay SQL: **5 checks passed**, all test changes rolled back.
- Actual signup record, server attestation, Supabase email confirmation/token exchange passed; inbox delivery separately confirmed by the user.
- Deployed isolated browser: complete onboarding, login, refresh, live tabs, event provenance, saved opportunity persistence, Remote filter, signed-in Gemini roadmap/save/reload, Resume Studio, mobile/desktop and UI logout passed. Zero browser runtime errors.
- Final protected API/browser smoke: durable sources, deduplication, excluded broken URL, signed guest cookie, cached public answer, source-backed guest search, real timeline markers/hover and no mobile overflow passed.
- All four existing browser regression scripts passed: Resume validation/export, navigation guards/Back/sidebar, learning/drafts/auth with mocked providers, and local private PDF/DOCX Resume Rater processing. Provider-mocked tests are not presented as live provider tests.

Earlier checks caught and corrected the guest backend selection, a PKCE gap, stale fixture timestamps, browser-test selectors and a cached attribution encoding issue. No unresolved failing test is being hidden.

## 11. Configuration and manual preflight

The latest Preview has these non-secret deployment overrides:

```dotenv
PATH4U_DATA_BACKEND=supabase
PATH4U_SIGNUP_MODE=server-attested
PATH4U_DEMO_BACKEND=supabase
PATH4U_PUBLIC_DEMO=1
PATH4U_AI_MONITORING=true
PATH4U_AUTH_MONITORING=true
```

Existing `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` and `GEMINI_API_KEY` remain server-side. No new Redis credentials are required. The PostgreSQL connection is used only by explicitly enabled migration/QA utilities, not by the public browser.

The owner was asked to set Site URL to `https://openpath-ai-demo-03531.vercel.app` and allow its `/auth/callback` plus `https://openpath-ai-demo-03531-*-webwavework9-8838.vercel.app/**`. A fresh generated-link check confirmed the exact Preview redirect is now accepted. Before public judging, test one unrelated external judge inbox and the delivered-link click flow; one controlled Gmail inbox does not prove all recipient delivery or SMTP throughput.

## 12. Deployment verification

Preview: https://openpath-ai-demo-03531-ec73h3et2-webwavework9-8838.vercel.app
It retains Vercel sign-in; no public share or persistent bypass link was created. Automated tests used a scoped short-lived OIDC header sent only to the Preview origin.

Production still serves **dpl_FPps3UAww6XGauVZDgGUW1nkywWd**, URL `openpath-ai-demo-03531-6bh4hgq4b-webwavework9-8838.vercel.app`, through https://openpath-ai-demo-03531.vercel.app/. Its unauthenticated homepage returned HTTP 200. It has not received the repaired code. Shared database additions were separately approved; Production website settings/deployment were not changed.

## 13. Remaining limits

Source coverage is finite, not the entire job market. No workshops were returned. Closing dates are often absent. Events remain Status Unverified unless genuine registration evidence exists; jobs can close between checks. One employer application page blocks automated HEAD. Sender throughput, unrelated-inbox delivery, and the exact delivered email link's browser click remain manual preflight checks. The connected Supabase MCP account lacks this project's management permissions; scoped database credentials already present on Vercel enabled the approved repair.

Resume scoring and parsing remain local; saved drafts use the existing owner-isolated library. There is no new persistent rating-history feature. Existing Google Sheets/Gmail owner integrations were preserved but not exercised with a live Google account in this task. No OAuth identity provider, private upload bucket, paid grounding service or public judge credentials were introduced. Free upstream service availability cannot be guaranteed for an entire weekend.

## 14. Exact release steps — only after explicit approval

1. Review this protected Preview and complete the external-inbox/delivered-link preflight above.
2. Obtain explicit approval to publish Production. Do not run a production deployment merely because this report exists.
3. Carry the six non-secret Preview flags above into a fresh Production deployment. Preserve the existing Production Supabase and Gemini credentials and set `OPENPATH_ORIGIN=https://openpath-ai-demo-03531.vercel.app`. Leave paid/private flags disabled. Do not blindly apply older migrations or promote a Preview assuming its environment becomes Production configuration.
4. Run frozen install, tests, typecheck and build from this reviewed workspace. Deploy the existing project with `vercel deploy --prod --project openpath-ai-demo-03531 --scope webwavework9-8838` and the approved non-secret overrides (or equivalent configured Production environment).
5. Check the public alias without Vercel credentials, then test signup/confirmation/login/logout, a real saved item and a bounded Gemini request. Inspect runtime logs for actual failures. Keep Preview protection enabled.
6. Give judges the stable Production URL only after these checks pass. Retain the previous Production deployment as the rollback candidate; the new schema additions are backward compatible and must not be deleted for rollback.
