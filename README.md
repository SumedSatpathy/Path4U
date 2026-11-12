# Path4U

**Your future. Your path.**

Path4U is a career and learning workspace for students and early-career professionals. Discover source-linked opportunities, turn a learning goal into a practical roadmap, explore concepts visually, and prepare application material you can review yourself.

**Public demo:** [path4u.vercel.app](https://path4u.vercel.app)  
**Workflow video:** [Watch or download the narrated walkthrough](docs/video/path4u-workflow.mp4) · [Video guide and transcript](docs/video/README.md)

The public hackathon release is guest-first. Sign In and Create Account are marked Coming Soon. The repository retains the existing account implementation; guest mode does not impersonate a signed-in user or grant access to private account data.

## What you can do

- **Discover opportunities:** filter source-linked internships, jobs, hackathons and workshops; inspect provenance, requirements and known deadlines. Unknown details remain unknown.
- **Ask Path4U AI:** ask non-sensitive career and learning questions through a server-side Gemini integration. Provider failures show an error instead of a blank or invented answer.
- **Build a roadmap:** choose a role or skill, starting level, weekly hours and duration. Review structured phases, lessons, projects, completion criteria and original-provider resource links.
- **Follow a flowchart:** display a saved roadmap as a flowchart. Switching the view of an existing plan requires no new generation.
- **Create mind maps:** generate specific topic branches with Gemini, then edit and save the map.
- **Use Resume Studio:** read supported files on the device, review a transparent deterministic quality rubric, improve supported wording, and export editable documents. Scores do not predict hiring outcomes or guarantee ATS acceptance.
- **Prepare and track:** save notes and application drafts, track your own progress, and review official submission channels. Path4U does not automatically apply to LinkedIn jobs.

Guest progress stays in this browser tab's session storage. A separate explicit Save action persists generated plans and drafts. Closing the tab may remove this temporary work; export what you need.

## Workflow walkthrough

The video includes AI narration and baked English subtitles, with [SRT](docs/video/path4u-workflow.srt) and [VTT](docs/video/path4u-workflow.vtt) sidecars. It shows actual interface captures, real non-sensitive Gemini results from a protected Preview, and fictional sample resume/note text. It is an edited interface walkthrough, not an uninterrupted screen recording. See its guide for production notes, source assets, credits and limitations.

## Architecture

| Layer | Implementation |
| --- | --- |
| Frontend | React 19, TypeScript, Vite 6; custom internal browser-history/hash routing |
| Interface | Existing monochrome CSS design system, Lucide icons, Motion for React |
| API | Node.js HTTP handlers in `server/`, exposed on Vercel through `api/index.mjs` |
| AI | Server-side Gemini REST adapter; structured, validated learning results |
| Durable quota/data | Existing Supabase PostgreSQL tables and atomic service-only reservation RPC |
| Account implementation | Existing Supabase Auth, HttpOnly cookies, eligibility/onboarding checks and owner-isolated records |
| Guest workspace | Separate tab-scoped session storage; no access to account records |
| Hosting | Vercel Vite output plus Node serverless API, configured by `vercel.json` |

Core request flow: browser → `/api/demo/*` → signed guest session → atomic app quota → provider-call safety budget → Gemini → validated result → browser review → explicit Save.

## Run locally

Use Node.js 22+ and pnpm.

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm start
```

Open [127.0.0.1:4173](http://127.0.0.1:4173). Without cloud credentials, local development uses the explicitly guided implementation. It does not prove the live Gemini or durable hosted-quota integration. `pnpm dev` runs the Vite development frontend; the Node API is required for API-dependent actions.

To configure a guest-first local UI, copy `.env.example` to `.env` and set `DEMO_ONLY_MODE=true`. Never commit `.env` or any credential. All provider and Supabase keys remain server-side; no key needs a `VITE_` prefix.

## Hosted configuration

The live guest implementation requires:

```text
DEMO_ONLY_MODE=true
PATH4U_DATA_BACKEND=supabase
PATH4U_DEMO_BACKEND=supabase
PATH4U_PUBLIC_DEMO=1
SUPABASE_URL=<server-side project URL>
SUPABASE_ANON_KEY=<server-side legacy anon key>
SUPABASE_SERVICE_ROLE_KEY=<server-side service-role key>
GEMINI_API_KEY=<server-side Gemini key>
GEMINI_MODEL=gemini-3.1-flash-lite
OPENPATH_ORIGIN=<approved production HTTPS origin>
PUBLIC_SITE_URL=<approved production HTTPS origin at build time>
```

Set each variable in the intended Vercel environment. Preview and Production settings can differ. The full repository must be deployed so `/api/*` runs; a purely static upload cannot generate AI results.

Database schema changes are migrations under `supabase/migrations`. The existing shared project already has its repair applied. **Do not blindly replay historical migrations:** some install a project-wide Auth trigger. Audit the destination and apply only reviewed, pending migrations. The current quota repair reuses the existing atomic RPC and needs no new schema migration.

Keep paid features disabled: `GEMINI_SEARCH_ENABLED=false`, `GEMINI_SEARCH_BILLING_APPROVED=false`, `GEMINI_IMAGE_BILLING_APPROVED=false`, `GEMINI_PRIVATE_DATA_APPROVED=false`. Do not enable billing to run this demo. Live Google Sheets/Gmail require separately configured owner-scoped credentials; Calendar writes and enterprise orchestration remain unconfigured. Course directory links work independently of paid search grounding.

## AI fair use and reset

The source quota repair gives each signed browser session **4 shared interactions per UTC day** across chat, roadmap generation, flowchart generation and mind maps. Daily allowance renews at **00:00 UTC / 08:00 Asia/Kuala_Lumpur**. A saved roadmap can switch between roadmap and flowchart views without consuming an interaction.

Shared application admission remains **80 interactions per UTC day and 4 per fixed UTC minute**. Each provider attempt separately passes **400 calls per Pacific day, 10 per fixed UTC minute, and 200,000 estimated input tokens per fixed UTC minute**. Google's own project quota remains authoritative and can be lower. Failures after reservation still consume the admitted interaction. Safe public cache hits and successful request-ID replays do not start another provider call.

There is no daily Wi-Fi session or generation cap. A broad anti-abuse throttle permits **120 new guest sessions per network per fixed ten-minute window**; existing valid sessions can continue. Cookies are signed, HttpOnly, SameSite=Lax, Secure on HTTPS, valid for 24 hours, and independent of network changes.

See [AI_QUOTA_REVIEW.md](AI_QUOTA_REVIEW.md) for exact rules, affected paths, controlled reset tests, separate Gemini timing and deployment status. The existing public release is not automatically changed by a GitHub commit; the review identifies the tested Preview.

## Verification

```sh
pnpm typecheck
pnpm test
pnpm build
```

Controlled quota tests use isolated storage and provider doubles and an injected test clock. They do not exhaust or reset a live quota. Browser checks need an installed Playwright module and Chrome:

```sh
# Set PATH4U_PLAYWRIGHT_MODULE to your Playwright module when it is not installed locally.
node --test tests/browser-quota-reset.mjs
node tests/browser-demo-only.mjs
node tests/browser-navigation.mjs
node tests/browser-upgrade.mjs
node tests/browser-ai-privacy.mjs
```

Do not enable opt-in QA/migration environment flags in a normal build. Existing administrative scripts are guarded and are not part of routine local verification.

## Security and limitations

Never upload API keys, Supabase credentials, real resumes or private account records to a public repository or demo. Service-only quota tables are protected with RLS and service-role grants; admission is atomic across serverless instances. Storage failure blocks new provider calls. Server checks same-origin writes, validates input and prevents private free-tier AI processing.

Accounts, email delivery, private processing, OAuth, live Google writes and external provider availability must be verified in their intended environment before enabling them. The public hackathon does not advertise these as active. Age entry is self-declared eligibility, not identity verification. Opportunity availability and final submission requirements belong to the original organizer.

## Attribution

Path4U's candidate workflow was inspired by [AIHawk](https://github.com/feder-cr/Jobs_Applier_AI_Agent); this UI and application implementation were written independently. Third-party dependencies keep their own licences. The walkthrough uses [Brag](https://github.com/latent-spaces/brag), [Hyperframes](https://github.com/heygen-com/hyperframes), local Kokoro narration, and credited CC BY 4.0 music. See [video credits](docs/video/README.md).
