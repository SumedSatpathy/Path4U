> Current update — 12 November 2026: durable Supabase storage, live opportunities and bounded guest/account Gemini are implemented in a protected Preview. Read [HACKATHON_READINESS.md](HACKATHON_READINESS.md) for the current URL, evidence, remaining preflight checks and approval-gated Production release. Older temporary-Redis notes below are historical.

# Path4U deployment — 2026-11-11

- Public URL: https://openpath-ai-demo-03531.vercel.app/
- Deployment: dpl_DuUvQ4avbZtumvQvX93ThST7XUUb
- Target: production
- Status: READY
- Project: prj_YVwxx3wCDEaAV06AsaE3ujzyWAX5
- Team: webwavework9-8838
- Source: reviewed working directory based on 06f73ab, including the tested uncommitted Path4U changes.
- Build: TypeScript and Vite passed on Vercel; remote build completed in 28 seconds.
- Runtime flag: PATH4U_PUBLIC_DEMO=1, retaining the existing guided public mode.
- Credentials: public session reports account mode unavailable; Gemini false. See SETUP.md for activation steps.

The user explicitly authorized this deployment after the release review. No new framework, credentials, Supabase project, production database policies, or billing settings were changed.

Public browser checks passed on the final production alias: landing and API responses, six quick actions, exact AI-engineering goal with 26 weeks and 10 hours/week, guided roadmap saving and refresh, Coursera/Udemy links and free alternatives, mobile navigation, and no browser crashes. Existing resume PDF/DOCX roundtrip regression also passed publicly. The smoke check caught and resolved saved-plan URL selection after chat handoff; a narrow credit-badge header overflow was also corrected and verified locally.

## Back button update

Shared BackButton and PageContent now put one page-level control above content headings. Sidebar and global-header structure were preserved. The router tracks same-origin history and guards unsaved resume, roadmap, mind-map, profile, application and document edits, including native Back/Forward and saved-plan changes. Local validation passed TypeScript, pnpm build, 14 automated tests, strict UI audit, the navigation browser suite at desktop/tablet/mobile sizes, and the existing authenticated roadmap browser suite using mocked providers.

Public inspection on 2026-11-11 found account environment values now present (`mode: live`, signed out), but `/api/demo/session` returns 503: `The demo credit service is unavailable.` No credentials, backend code, database policies or schema were changed by this navigation task. Public generation/save integration therefore remains blocked by that service configuration; its navigation/unsaved-state handling is covered locally.

Final Back-button release: dpl_4gGe1e5a3BLRRHDbykRbFH3Ju8fo, production READY. Live navigation tests passed across main-content placement, desktop/tablet/mobile, internal/query history, reload/Forward, external-referrer fallback and unsaved-work cancellation. Public generation was explicitly skipped due to the 503 demo service; local generation/save and saved-plan edit protection passed.

## Resume and sidebar release

User approved publishing the tested updates. Deployment dpl_DuUvQ4avbZtumvQvX93ThST7XUUb is production READY at the existing public alias. Public Chrome checks passed resume validation, actual PDF/Word exports, edited-document guard, browser-local draft saving, promoted Dashboard/Resume Studio navigation, mobile layout and Back placement. No service credentials, database policies, saved account records or Vercel project settings were changed.
