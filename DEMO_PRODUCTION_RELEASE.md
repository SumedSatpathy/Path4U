# Path4U public demo — Production release, 13 November 2026

**Public submission URL: https://path4u.vercel.app**

The user explicitly approved Production publication and short-URL assignment. Vercel accepted and verified `path4u.vercel.app` for the existing `openpath-ai-demo-03531` project. No project rename, new project, domain purchase or paid service was introduced.

Production deployment: `dpl_12tCqk8bPk6fucBfQUkvuhjfT6Dh` (READY).
Immutable deployment: https://openpath-ai-demo-03531-kw2yq9rqn-webwavework9-8838.vercel.app

Both aliases were verified to point to that same Production deployment:

- https://path4u.vercel.app
- https://openpath-ai-demo-03531.vercel.app

Neither public hostname requires Vercel login. The original hostname remains active without a redirect. Preview protection was not disabled.

## Release configuration

Production environment variables were saved on the existing project: DEMO_ONLY_MODE=true, PATH4U_DATA_BACKEND=supabase, PATH4U_DEMO_BACKEND=supabase, PATH4U_PUBLIC_DEMO=1, and the existing safe monitoring flags. OPENPATH_ORIGIN and PUBLIC_SITE_URL now use https://path4u.vercel.app. OPENPATH_ALLOWED_ORIGINS explicitly retains https://openpath-ai-demo-03531.vercel.app.

These configuration variables are non-secret. Supabase/Gemini credential values were not read, changed or exposed. The Gemini key remains the existing sensitive variable shared by Production and Preview. No synthetic-QA or provider-diagnostic flags are configured in Production. Existing accounts/private records, Auth implementation and RLS policies were preserved.

## Public verification

**36 Production smoke checkpoints passed** in a fresh browser without Vercel credentials, including:

- Valid HTTPS and publicly accessible HTML/API responses on both hostnames.
- Correct path4u.vercel.app canonical, og:url and share-image metadata; share image loads.
- Demo-only configuration enabled and guest welcome/entry working.
- Disabled Sign In/Create Account controls and clear redirects from all old authentication screens.
- Breathing animation and reduced-motion behavior.
- Guest Dashboard, Atlas Index navigation, source-backed Discover cards and refresh.
- 872 genuine opportunity records at the test snapshot.
- Resume Studio access and actual local sample Resume Rater scoring.
- Guest progress saved in tab storage and restored after refresh.
- Mobile navigation, shared Back button and no horizontal overflow.
- Anonymous private workspace/library/assistant requests rejected.
- Same-origin API handling on both aliases; cross-origin writes remain rejected.
- Zero normal-browser Auth/private-account API requests and zero browser runtime errors.

The unchanged source had already passed TypeScript, 39 automated tests, six browser regression scripts, a strict UI audit with zero findings, and pnpm build. The Production build also completed successfully. Review details: DEMO_RELEASE_REVIEW.md.

## AI limitation retained

The actual Production guest-session test returned the expected 429 because this test network exhausted its existing 8 new guest sessions per UTC day. The interface explicitly explains the reset at **00:00 UTC / 08:00 Malaysia time** and keeps browsing/local resume tools available. It does not claim to switch to guided AI. No quota counter or protection was bypassed or reset.

A separate quota-controlled server-side Gemini generation passed on the tested Preview, but a fresh Production guest generation is not claimed as passed while this network is limited. Retest after the daily reset. The underlying guest interaction, shared provider and private-data protections remain in force.

## Operation and restoration

Use https://path4u.vercel.app for the hackathon submission. No manual domain/DNS configuration is required. Demo progress is temporary browser-tab data, not a permanent account save. Use sample details.

To restore retained account access after the hackathon, set DEMO_ONLY_MODE=false in Production and deploy again. Complete the previously identified SMTP work and approve/configure the new Supabase callback hostname before reopening public email signup/recovery. No account or database migration is needed merely to restore the retained implementation.

Proof artifacts: `.vercel/demo-production-result.json`, `.vercel/production-welcome-desktop.png`, `.vercel/production-welcome-mobile.png`, `.vercel/production-resume-mobile.png`. They contain demo content only.
