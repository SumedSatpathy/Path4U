> Current update — 12 November 2026: durable Supabase storage, live opportunities and bounded guest/account Gemini are implemented in a protected Preview. Read [HACKATHON_READINESS.md](HACKATHON_READINESS.md) for the current URL, evidence, remaining preflight checks and approval-gated Production release. Older temporary-Redis notes below are historical.

# Path4U chat and demo-credit repair — 12 November 2026

Repository: `C:/Users/sumed/Downloads/MATH/OneDrive/Documents/projects/openpath-ai`.

Protected Preview: https://openpath-ai-demo-03531-jlpe4b1l8-webwavework9-8838.vercel.app

Deployment: `dpl_fwyHE2qWZeZWTL4ixQTgXNw41rBM`, READY, Preview only. Production was not deployed or reconfigured. Production metadata still identified `dpl_FPps3UAww6XGauVZDgGUW1nkywWd` during this repair; opening the old production URL does not exercise this new release.

## Exact failure and trace

`src/Assistant.tsx` used the `useLearning`/`DemoProvider` path for a demo visitor. `src/demo.tsx` first posted to `/api/demo/session`. `server/index.mjs` delegated to `server/demo.mjs`, whose hosted credit initialization invoked the Supabase REST RPC `path4u_demo_session`. A non-integer result—including an HTTP error with no parsed integer—became the exact message **The demo credit service is unavailable.** The frontend displayed that API error and disabled submission because its session was not ready. Gemini was not reached in this initialization failure.

A separate error existed even after successful credits: `server/demo.mjs` called `runLearning` without its live-AI flag. That selected guided responses, and `src/Assistant.tsx` explicitly excluded demo users from its live branch. Adding GEMINI_API_KEY could not change either behavior.

The earlier read-only Vercel backend audit returned HTTP 200 from Supabase auth/settings and the REST schema, with email confirmation enabled, but none of the required Path4U table/RPC paths exposed. This supports a missing schema/exposure/grants failure, without proving that the underlying SQL objects do not exist. Production runtime-log retrieval was attempted but did not return usable records; the root-cause evidence is the actual code path, the schema audit, and reproduced API tests, not a guessed provider failure.

## What changed

- `server/liveDemo.mjs`: live guest-session/chat/roadmap route with real Gemini, preserved questions and bounded conversation context. No Supabase calls in this flow. Courses use checked provider records; unavailable live web research is explicitly reported.
- `server/redisStore.mjs`: server-only HTTPS REST transport for the replacement store, with controlled configuration, connectivity and authentication errors.
- `server/redisData.mjs`: opt-in replacement for missing Supabase database tables/functions, covering profiles, workspace revisions, private drafts/conversations and usage claims. It verifies the existing email identity, confirmed email, authoritative age flag and record ownership before reading account data. Workspace updates use atomic revision comparisons; library size remains bounded.
- `server/auth.mjs`: selects the replacement data adapter when configured; keeps existing Supabase Auth email identity, verification, recovery, session cookies, logout and age validation. Redis-mode signup records the server-checked age attestation through the provider admin API after a genuine new signup; it does not rely on nonexistent SQL ticket triggers. Duplicate/existing signup responses do not grant eligibility. Real email delivery still requires the existing provider configuration.
- `server/demo.mjs`: routes the configured live demo to the replacement instead of missing credit RPCs. The old deliberately guided path remains for configurations that explicitly use it.
- `src/demo.tsx`, `src/Assistant.tsx`, `src/api.ts`: consume live-demo readiness, route guest chat to the correct endpoint, label live/guided states accurately, preserve failed questions, avoid silent guided fallback and default signed-in chat to live Gemini when configured. Explicit HTTP failures can receive a new retry ID; ambiguous network failures retain their ID.
- `shared/intent.mjs`: accepts worded durations such as **six-month**, without changing the original submitted question.
- `server/integrations.mjs`: at most one retry of an explicit upstream Gemini HTTP 503, within the request deadline. No automatic timeout or 429 retries, no paid fallback, no new billing. Empty/unreadable/truncated answers remain errors.
- `src/Shell.tsx`, `src/Landing.tsx`: visible temporary-data expiry and updated privacy information. Existing Back placement, sidebar, resume templates and exports remain.
- `.vercelignore`: explicitly excludes local deployment/credential artifacts. New tests and opt-in `scripts/verify-demo.mjs` exercise the repair. Existing worktree changes were preserved.

Supabase has **not** been completely removed: its working email identity service remains so existing accounts keep their credentials. The blocking Supabase **database dependency** has been replaced for the repaired flows. Original Supabase data was neither deleted nor migrated. If records exist in unexposed original tables, this fresh temporary store does not make them visible; migration would require a separate review.

## Security and limits

Guest identity is a random HttpOnly/SameSite cookie validated against Redis. No unauthenticated live request can skip session initialization. Network identifiers are HMAC-hashed; raw IPs and prompts are not stored in quota records. Atomic Lua enforces 20 daily units per guest network, 100 shared daily units across guest and account AI, three guest requests per minute, and bounded session creation. Account AI additionally retains 18 units/hour and 20/day per user. Failed accepted generations still consume a reservation.

A request ID plus input fingerprint prevents parallel/replayed requests from starting another generation. A matching successful reply can be replayed for five minutes; conflicting content returns 409. Older accepted requests without a cached reply fail closed. Redis is shared across serverless instances; in-memory counters are not substituted for durable limits.

Private resumes and attachments remain blocked from unpaid Gemini. Resume Studio local scoring/editing/export continue. No Gemini key is exposed in browser assets, responses or logs. A diagnostic inadvertently printed a credential for an unused temporary store; that store contained no user records and was discarded. A fresh store and fresh credentials were provisioned before deployment, with the new token stored as a sensitive Preview variable.

## Verification

- `pnpm install --frozen-lockfile`: dependency installation completed without lockfile changes. The package-manager update check encountered restricted network access; no package upgrade was performed.
- TypeScript checks and `pnpm build`: passed. Existing large document/PDF chunk warning remains.
- `pnpm test`: **29 passed, 0 failed**.
- Local browser tests passed: live guest mode, actual UI/API routing with mocked providers, preserved input on quota errors, mobile layout, account login/refresh, saved roadmap reload/progress, and logout protection.
- Real Redis tests passed: actual Lua execution, guest cookie validation, burst quota, replay/conflict handling, profile ownership, workspace revision conflicts, library storage and hourly usage cap. Identity and Gemini were simulated in this isolated storage test; no real user records were used.
- Vercel Preview-build integration test traversed actual HTTP chat endpoints with real Redis and real Gemini. Hello, Python loops, beginner cybersecurity roadmap and six-month AI engineering roadmap returned HTTP 200. The AI plan covered 26 weeks. Course request returned checked Coursera/Udemy records; it was not falsely described as live web research.
- A direct protected Preview check authenticated successfully with a short-lived project token. An initial real request succeeded and another returned upstream Gemini HTTP 503, which was accurately displayed as a provider failure; the bounded retry was added afterward.
- Final deployed API/browser checks: all five requested API prompts have returned successful responses; the final protected Preview passed a genuine mobile/desktop browser chat check. No public share link or persistent protection bypass was created.
- Strict UI audit: zero findings before the final provider-only retry/privacy wording changes. Real end-user email verification and a password-based login against the live identity provider were not exercised. Account-path tests use a verified identity fixture plus real Redis; this is not claimed as real email-delivery verification.

## Configuration and temporary lifetime

Preview now has `UPSTASH_REDIS_REST_URL`, sensitive `UPSTASH_REDIS_REST_TOKEN`, `PATH4U_DEMO_BACKEND=redis`, `PATH4U_DATA_BACKEND=redis`, and `PATH4U_TEMPORARY_STORAGE_EXPIRES=2026-11-14`. Existing GEMINI_API_KEY and Supabase Auth credentials are retained. Model: `gemini-3.1-flash-lite`. Search and private-resume AI remain disabled. No paid billing was activated.

You selected **Keep this as a temporary demo**. The free replacement store expires **14 November 2026**, and cloud-saved trial records will then be lost. Use synthetic/sample information. This is not a permanent production backend. The owner setup page is [temporary store owner claim link withheld from public source] ; claiming/moving to owned storage is required before a lasting release. Existing Supabase identity accounts are separate from the expiring trial store.

Use the new Preview link and choose the demo from the landing page, or open `/dashboard?demo=1`. It remains protected by Vercel sign-in as requested. Signed-in account users additionally use the existing application email login/onboarding. To release publicly or update Production, first approve the intended release and choose permanent owned storage; Production was intentionally left unchanged.

References: [Upstash REST API](https://upstash.com/docs/redis/features/restapi), [temporary free-store lifetime](https://upstash.com/docs/agent-resources/cli), [Gemini model](https://aistudio.google.com/docs/models/gemini-3.1-flash-lite), [Vercel OIDC](https://vercel.com/docs/oidc).

The final direct deployed run uses short-lived project-scoped OIDC authentication with a header restricted to this Preview origin. This preserves Vercel sign-in and creates no public share link. Real account passwords and existing browser profiles are not accessed.

## Final verification observations

Direct serverless Preview requests returned HTTP 200 with real Gemini output for Hello, Python loops and the beginner cybersecurity roadmap. One six-month AI roadmap request reached Gemini but timed out with an accurate HTTP 504; it did not fall back to guided content. The targeted retry and remaining course/browser checks subsequently passed, as recorded below. The same six-month prompt already succeeded through the real HTTP API in the earlier Vercel build integration test. Provider timeouts remain a limitation even after the missing-credit dependency is removed.

The targeted direct serverless retry returned HTTP 200 for the six-month AI engineering roadmap, with four validated phases across 26 weeks. The Coursera/Udemy request also returned HTTP 200 using checked directory records. All five requested prompts have therefore succeeded on the actual protected Preview, with the earlier 503/504 attempts retained as failures in this report rather than counted as first-attempt successes. A fresh credential scan found no Redis token or Google API-key-shaped value in browser assets; the GEMINI_API_KEY variable name appears only in an actionable error message.

Preview runtime logs were subsequently retrieved through the authorized Vercel connection. They confirmed successful HTTP 200 chat requests, an application HTTP 504 at the former 50-second deadline, and HTTP 429 on the former four-session network cap. The final correction uses a 95-second Gemini transport bound inside a 105-second application deadline, a 120-second client/function budget, and eight sessions per network/day. Daily AI units, burst controls, global units and duplicate protection remain enforced; no counter was reset to make tests pass.

## File inventory for this repair

Server: server/liveDemo.mjs, server/redisStore.mjs, server/redisData.mjs, server/auth.mjs, server/demo.mjs, server/assistant.mjs, server/integrations.mjs, server/index.mjs. Client/shared: src/Assistant.tsx, src/demo.tsx, src/api.ts, src/Shell.tsx, src/Landing.tsx, shared/intent.mjs. Verification/config: tests/live-demo.test.mjs, tests/redis-data.test.mjs, tests/ai-hardening.test.mjs, scripts/verify-demo.mjs, package.json, vercel.json, .env.example, .vercelignore. Documentation: README.md, SETUP.md, AI_READINESS.md, DESIGN.md, CHAT_REPAIR.md. No new application dependency or framework was installed.

## Final observed browser outcome

The final protected deployment dpl_fwyHE2qWZeZWTL4ixQTgXNw41rBM passed the isolated mobile and desktop browser check with real Gemini and real Redis. The temporary notice and Live Gemini demo label appeared, Hello returned a real response, the composer cleared, mobile layout had no horizontal overflow, and no browser runtime error was observed. Short-lived authentication headers were confined to the Preview origin; protection was not weakened. Original-browser access was not used. Live end-user password/email verification remains untested; authenticated account-path coverage uses controlled identity fixtures plus real Redis.

Local credential provisioning artifacts were removed after server configuration and testing. Fresh replacement credentials remain only in Vercel Preview and the provider. The discarded unused store contains no user data and will expire.

Visual inspection found and corrected unrelated roadmap controls on the greeting. The general-answer branch now forces a text artifact and empty roadmap proposal; actual roadmap branches retain their controls. The 29-test suite includes regression coverage for extraneous model proposal fields.

Final verification after the greeting-control correction: protected deployment dpl_fwyHE2qWZeZWTL4ixQTgXNw41rBM again returned a genuine Gemini reply in mobile/desktop browser testing, with zero unrelated roadmap artifacts, a cleared composer and no runtime errors. The final unit/integration run remains 29/29 passing; TypeScript and pnpm build passed. Production was not released.
