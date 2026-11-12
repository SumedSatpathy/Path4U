> Published — 13 November 2026: the approved public hackathon demo is live at https://path4u.vercel.app. The original URL stays active. Read [DEMO_PRODUCTION_RELEASE.md](DEMO_PRODUCTION_RELEASE.md) for Production verification and the retained AI quota limitation.

> Historical pre-release review: the sections below record the state before approval and publication. The Production release report above supersedes their pending approval/domain status.

# Path4U hackathon demo release review — 13 November 2026

Review URL: https://openpath-ai-demo-03531-kmu7wdljd-webwavework9-8838.vercel.app

Deployment: `dpl_5vzkNUGJMXaEhHUKuQca6PvnMKK3` — READY, Preview, Vercel Authentication retained. This is a reviewer Preview, not the final public judging URL.

The 17 changed runtime/build source files were hash-matched against the final deployed Preview.

No Production deployment, domain assignment, project rename, purchase, Supabase policy change, account creation/deletion or credential change was made in this task. Existing Production remains `dpl_FPps3UAww6XGauVZDgGUW1nkywWd` at https://openpath-ai-demo-03531.vercel.app and responds over HTTPS.

## 1. Welcome screen

The existing monochrome design and logo remain. Demo-only mode displays “Welcome to Path4U”, “Explore your future. Find your path.”, a larger white “Explore Path4U Demo” action with sparkle/arrow icons, an Available Now badge, and no-account supporting text. The action breathes with a restrained 3.6-second shadow; reduced motion removes the animation and transforms. Sign In and Create Account stay visible as native disabled buttons with lock icons and Coming Soon labels. Desktop, tablet and mobile layouts were inspected.

Screenshots: `.vercel/demo-welcome-desktop.png`, `.vercel/demo-welcome-tablet.png`, `.vercel/demo-welcome-mobile.png`, `.vercel/demo-resume-mobile.png` in the repository. These contain demo content only.

## 2. Demo Access

`DEMO_ONLY_MODE=true` is a server-owned, reversible flag. A minimal `/api/app-config` response exposes only its boolean value. The client uses this before account initialization. Enabled mode enters the existing guest workspace with `user: null`; it does not manufacture an authenticated user, request a Supabase session, or load account workspace/library records.

The main action opens `/dashboard?demo=1`. Normal hash routes and Dashboard refresh work without account login. Dashboard, Atlas Index, Discover, Resume Studio, local Resume Rater, roadmap tools, drafts and available guest AI retain the existing navigation and Back component.

## 3. Disabled authentication

Login, signup, recovery, callback and onboarding UI routes redirect to `/?accounts=coming-soon` with the explanation “Account registration and sign-in are not available in this demo version.” Auth URLs are removed from normal navigation in enabled mode. The implementation files remain intact.

The backend also denies account-mutating Auth actions in demo-only mode. Existing session/logout handling and all private API authorization checks remain; no Supabase configuration or RLS policy was weakened. With the flag false, existing authentication screens/handlers are restored. Reversibility was tested locally.

Restoring public accounts after the hackathon also requires finishing the earlier SMTP setup and adding the eventually approved new hostname's callback to Supabase's redirect allowlist. Those owner settings were not changed for this guest demo release.

## 4. Guest data and security

New hackathon progress uses `sessionStorage['path4u.demo.session.v1']`. Drafts/conversations use separate `path4u.demo.session.library.*` keys. The new mode does not load old localStorage demo records or cloud account data. Progress survives refresh in the same tab; it is not a permanent account save. Browser session restore may retain tab storage. Use sample, non-sensitive details, as the persistent in-product notice explains.

Resume parsing, advisory scoring and exports operate on the device. Private resumes/attachments are not enabled for the free guest Gemini service. Guest AI requests retain the existing signed cookie, backend validation, private-data checks, durable usage counters and request replay protections. Short-lived server AI replay/usage records are separate from browser-only workspace progress.

Private workspace, library and account assistant requests without authentication returned 401. The browser made zero Auth/private-account API requests during normal demo navigation. Source-backed public listings remain separate from protected account data.

## 5. Gemini status and limitation

The existing `gemini-3.1-flash-lite` integration is preserved. A synthetic server-side generation test on the final Vercel build passed, returning a nonblank 2,093-character answer through the existing provider budget. No paid tools or new services were enabled.

The actual guest UI test encountered the application's existing **8 new sessions per network per UTC day** cap before reaching Gemini. It returned 429. This is not reported as a passed guest-generation test, and no counter was reset or bypassed. The cap resets at **00:00 UTC / 08:00 Malaysia time**; other networks have their own allowance. Existing guest cookies reuse their session, and AI still has its separate per-session/shared quotas.

The interface now explains that reset and keeps browsing/local resume tools available. An unavailable live session is explicitly labeled “Demo AI unavailable”; it does not pretend to switch to guided AI. Local tests separately passed the guided fixture's chat and roadmap creation/save/reload flow.

Live guest chat/roadmap generation should be retested after the network allowance resets. Provider health passing and a quota-blocked guest UI are distinct findings.

## 6. Requested hostname checks

| Hostname | Evidence | Assignment status |
| --- | --- | --- |
| openpath.vercel.app | HTTPS 200 serves “The Trade Desk”; not assigned to this team/project | Occupied; do not use |
| path4u.vercel.app | HTTPS 404 / DEPLOYMENT_NOT_FOUND; not in this project's domains | Next candidate; claimability not confirmed |
| openpath4u.vercel.app | HTTPS 404 / DEPLOYMENT_NOT_FOUND; not in this project's domains | Alternative; claimability not confirmed |
| path4u-demo.vercel.app | HTTPS 404 / DEPLOYMENT_NOT_FOUND; not in this project's domains | Alternative; claimability not confirmed |

Authenticated Vercel project-domain/alias reads, domain configuration checks, HTTPS responses and the existing project's Domains form were inspected. A 404 does not establish that a name is free: Vercel may still reserve it for another account/team. The form accepted the format `path4u.vercel.app`, but final acceptance happens when adding the domain. That would assign a live hostname, so it was not submitted without approval. The form was cancelled; the original domain remains the only assigned domain.

Vercel documents that `.vercel.app` names are first-come, first-served. No name has been reserved. [Working with domains](https://vercel.com/docs/domains/working-with-domains).

## 7. Domain/publication configuration prepared

No rename, new project or paid custom domain is needed for the proposed workflow. After explicit approval, attempt the candidates in the user's order and retain the old domain. If `path4u.vercel.app` is rejected, try `openpath4u.vercel.app`, then `path4u-demo.vercel.app`. If all fail, retain the existing URL and report the exact errors rather than inventing availability.

For the hostname actually accepted by Vercel, configure:

| Setting | Intended value |
| --- | --- |
| DEMO_ONLY_MODE | true |
| PATH4U_DATA_BACKEND | supabase |
| PATH4U_DEMO_BACKEND | supabase |
| PATH4U_PUBLIC_DEMO | 1 |
| OPENPATH_ORIGIN | https:// followed by the accepted hostname |
| OPENPATH_ALLOWED_ORIGINS | https://openpath-ai-demo-03531.vercel.app |
| PUBLIC_SITE_URL (build time) | https:// followed by the accepted hostname |

Existing Supabase/Gemini credentials remain server-side and unchanged. Do not copy diagnostic or synthetic-QA build flags into the Production release.

The additional-origin setting accepts only explicit HTTPS origins. Writes must still have an Origin matching the hostname used. This lets the old and new addresses work without adding permissive CORS. Unit tests covered the accepted old/new hosts and rejected foreign origins.

The HTML build now derives canonical, og:url and share-card URLs from PUBLIC_SITE_URL. Until a short hostname is actually approved/assigned, the Preview's canonical remains the existing real Production URL. All internal navigation uses the existing relative routes.

## 8. Files changed

Repository: `C:/Users/sumed/Downloads/MATH/OneDrive/Documents/projects/openpath-ai`.

- Welcome/shared UI: `src/Landing.tsx`, `src/landing.css`, new `src/DemoAccess.tsx`, `src/styles.css`, `src/Shell.tsx`.
- Mode/access: `src/main.tsx`, `src/session.tsx`, `src/AccountWorkspace.tsx`, new `server/demoMode.mjs`, `server/index.mjs`.
- Temporary guest storage: `src/workspace.tsx`, `src/library.ts`.
- Honest AI quota feedback only: `src/Assistant.tsx`, `server/durableDemo.mjs`, `server/aiQuota.mjs`. Quota values and Gemini integration were not loosened or replaced.
- URL metadata/config: `index.html`, `vite.config.ts`, `.env.example`.
- Tests: new `tests/demo-only.test.mjs`, new `tests/browser-demo-only.mjs`, updated `tests/live-opportunities.test.mjs`.
- Documentation/context: `DESIGN.md`, `UX-CONTRACT.md`, `README.md`, `SETUP.md`, this review.

## 9. Tests

- TypeScript check: passed.
- `pnpm test`: **39 passed**.
- `pnpm build`: passed; existing PDF bundle-size warning remains.
- Strict UI audit: **0 findings**.
- New local demo-only browser regression: passed disabled accounts, breathing/reduced motion, old-auth redirects, guest entry/refresh, separate tab storage, existing-value isolation, Discover tabs, Resume Rater access, draft persistence, mobile navigation, guided chat and roadmap saving/reload, zero Auth/private API calls and zero browser runtime errors.
- Existing browser regressions passed: authentication/navigation; learning/blank-response recovery with mocked providers; Back/Forward and unsaved-work guards; Resume validation, PDF/DOCX export and mobile behavior; and synthetic PDF/DOCX Resume Rater privacy tests with zero private AI requests.
- Final protected Preview: **28 checkpoints passed**, including live catalog (872 records at inspection), welcome, disabled controls, motion preferences, auth redirects, guest Dashboard, discovery refresh, actual local resume scoring, profile refresh, desktop/mobile navigation, private API denial and no browser runtime errors. Tablet welcome was also checked.
- Server-side Gemini generation: passed. Live guest AI generation: **blocked by the existing network quota**, not marked passed.
- Existing Production remained HTTPS 200. New short-domain routing/certificate/public-access tests are pending approved assignment and Production publication.

Initial browser-test waits/selectors were corrected to use actual loaded controls and the assistant's Minimize button; the final local browser test passed. No unresolved local test failure remains.

## 10. Remaining issues

The shared test network cannot start another fresh guest AI session until its daily reset. Limits are deliberately intact. The earlier SMTP issue remains relevant only when account access is restored; the demo does not require Supabase Auth. Short-hostname claimability and its public Production routing cannot be confirmed before an approved live assignment. The protected Preview should not be submitted as the final public judging URL.

## 11. Exact release steps after approval

1. In the existing Vercel project, open **Domains → Add Existing**. Submit the first accepted candidate, connected to **Production**, with no redirect away from the old hostname. Do not remove the current domain or buy anything. The connector can perform this after approval; the UI is a fallback.
2. Set the reviewed Production values in the table above, using only the hostname Vercel actually accepts. Leave existing secret values and deployment protection settings unchanged.
3. Deploy the current local source to the existing project using `vercel deploy --prod --project openpath-ai-demo-03531 --scope webwavework9-8838` after the approved environment configuration is set. This is the current working tree, not an old Production redeploy. No diagnostic test flags are required.
4. Verify the new hostname and old hostname both serve the new demo over HTTPS, without Vercel sign-in. Check `/api/app-config`, Dashboard/hash-route refresh, API Origin handling on both domains, real Discover cards and private API rejection. Retest a guest AI session/generation when quota permits.
5. Share only the verified public Production hostname with judges. Keep the old hostname active.

To restore account access later: set DEMO_ONLY_MODE=false and deploy again, then verify SMTP/confirmation callbacks for the approved hostname. No account/data migration is needed to restore the retained code.

Approval boundary comes directly from the user's attached brief: “Do not deploy to Production or change live domain assignments without my explicit approval.” Source: `C:/Users/sumed/.codex/attachments/6c83c1bb-fd5b-458d-acc4-60f941cee289/Pasted text.txt`.
