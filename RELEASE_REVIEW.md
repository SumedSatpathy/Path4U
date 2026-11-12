# Path4U release review — 2026-11-11

The user approved publishing this update in the following message. Production deployment dpl_CV6GHqdRXHvDjtVa6ymSsGq96XXN reached READY on 2026-11-11 and was assigned to [the public demo](https://openpath-ai-demo-03531.vercel.app/). No production database, account creation, billing or secret-provisioning changes were made. Live signup and Gemini remain unconfigured. The evidence below describes local verification; post-deploy results are recorded in DEPLOYMENT.md.

## Findings and root causes

| Issue | Evidence | Resolution or required action |
| --- | --- | --- |
| Signup is unavailable | Vercel's read-only environment listing returned no variables. The public `/api/auth/session` returned `mode: unavailable`; `/api/status` showed all integrations disabled. The connected Supabase account listed no projects. | This is a missing backend configuration, not a form-only defect. Follow [SETUP.md](SETUP.md) to connect the correct dedicated project, migrations, SMTP and server credentials. Real account registration remains blocked until then. |
| Cybersecurity goal was lost | Guided processing transformed the request into a generic planner response and did not reliably carry the actual subject into the planner. Study-plan requests could be intercepted by a generic document template. | Shared intent parsing retains cybersecurity, AI engineering, Python, skill level, duration and weekly hours. Explicit roadmap requests reach structured generation when Gemini is connected. |
| Potential blank-response path | The UI accepted the API result without validating a nonempty `answer`. Provider errors and malformed structured results could leave no useful visible content. | Server and client both reject empty responses. Errors preserve the question and permit resubmission. Unconfigured guided mode does not pretend to explain topics or perform live research. |
| No internet research | The previous course tool used four fixed official links and opportunity search covered only stored records and approved feeds. | Added opt-in Gemini Google Search grounding with actual metadata citations and search attribution. Model support cannot be confirmed without the missing model/key configuration. |
| Simple roadmap output | Only milestone title, task, effort and resource ID were supported. | Added validated phases, week ranges, prerequisites, lessons, practice, projects, skills, portfolio evidence, certification recommendations and next steps. |
| Standalone roadmap API bypassed assistant quota | Only the chat endpoint claimed database usage units. | The assistant, standalone learning, resume analysis and drafting routes now claim the same atomic quota. Unauthorized or quota-exhausted calls never reach Gemini. |
| Password-reset revocation failure was ignored | The global logout response after changing a password was not checked. | Local cookies are cleared and a specific error reports if other sessions could not be revoked. |

## Preserved architecture

- React 19, TypeScript, Vite 6, Motion, existing CSS and custom browser-history/hash routing; pnpm remains the package manager. No framework or provider migration and no new application dependency.
- `api/index.mjs` invokes `server/index.mjs` as a Vercel Node function. `vercel.json` keeps `/api/*` rewrites and the `dist` frontend. The candidate manifest explicitly allows 60 seconds for that function.
- Supabase REST authentication, HTTP-only session cookies, server eligibility checks, onboarding and owner-scoped RLS remain in place. The 15+ policy and restriction on live registration for ages 15–17 are unchanged.
- Saved roadmaps continue in `openpath_workspace.state.roadmaps` with revision-checked updates. Old milestone-only plans still load. No replacement schema or production RLS change was necessary.
- Gemini remains direct server-side REST through native fetch. No API library was installed. Keys remain server-only.

## Request trace

`Create a cybersecurity roadmap for a complete beginner.` travels from `src/Assistant.tsx` to `/api/assistant` when the user opts into Gemini sharing. The handler verifies the account and completed onboarding, claims a usage unit, and forwards bounded multi-turn context. `server/careerTools.mjs` parses the exact goal and selects the roadmap tool. `server/roadmaps.mjs` optionally researches learning resources, asks Gemini for structured JSON, and validates the schedule, effort and resource IDs before returning a plan. The user explicitly saves the result into the existing private workspace and can expand phases, complete lessons, save and refresh.

In the public guided demo, the same subject and time inputs open the roadmap form. The demo explicitly identifies its editable template and does not call Gemini. It cannot perform the real AI-generation step without account and provider configuration.

## Implemented features

- Six assistant quick actions; multi-turn context; goal and time handoff; loading, stop, retry and empty-response feedback.
- Beginner/intermediate/advanced roadmap input, prior skills, study hours, duration and learning preferences.
- Structured generated phases with bounded, contiguous week ranges and effort within the user's weekly budget. Invented resource IDs, malformed JSON and unrealistic plans fail validation.
- Expandable lessons, assignments, projects and phase completion. Partial lesson progress appears on both the roadmap and dashboard. Saves preserve existing records and use the existing revision/conflict mechanism.
- Checked direct Coursera/Udemy links for cybersecurity and machine learning, free alternatives from Cisco, Google, Python and freeCodeCamp, plus existing MDN and Microsoft Learn resources. Cards show provider, known instructor/organization, level, skills and fee status without invented prices.
- Grounding metadata may add direct provider course cards with explicitly unconfirmed metadata. Redirect links stay citations; unknown course links become labeled platform searches. Free/paid queries do not infer an unknown price status. Sources and recommendations have different labels.
- Search citations and provider attribution, with Google search suggestions rendered in a script-free sandbox. Archived conversations retain the attribution. Search failure does not fabricate current events, fees or deadlines.
- Atomic per-account AI quota shared by assistant, roadmap generation, resume analysis and drafting, bounded upstream calls, no automatic paid retries, same-origin writes, authenticated API access and explicit saving.

## Verification evidence

| Check | Result and scope |
| --- | --- |
| `pnpm test` | 14 tests passed. Includes all six exact prompt requests through the actual local API with mocked Supabase and Gemini. |
| `pnpm typecheck` | Passed. |
| `pnpm build` | Passed. Existing warning: deferred PDF code slightly exceeds the 500 KB chunk warning threshold. |
| Strict premium UI audit | Zero errors, warnings or violations; output `premium-audit.json` (ignored local audit artifact). |
| Chrome desktop/mobile regression | Passed resume building/review, actual PDF/DOCX export and reimport, draft persistence, attachment feedback, voice UI, conversation history, guided roadmap saving and refresh, mocked login/logout and route protection. |
| `tests/browser-upgrade.mjs` | Passed the real UI/API against explicit provider fixtures: login survives refresh, six quick actions, loading, researched roadmap cards, free alternatives, private save/reload, individual lesson completion, narrow layout, empty-answer recovery and protected-route logout. |
| Local PostgreSQL migration check | PGlite execution of existing migrations passed cross-account draft/file isolation and persistent quota enforcement. This does not substitute for hosted Supabase verification. |
| Course URLs | Checked original provider pages using web retrieval. Python/MDN/Google/Microsoft official links are preserved. Cisco and freeCodeCamp pages are JavaScript-rendered; retrieval establishes the page URL, not a completed enrollment or credential. Current prices were not copied. |
| Public Vercel API | Existing deployment's read-only session/status responses confirmed services are unconfigured. The updated API has not been deployed or smoke-tested publicly. |
| Real SMTP and live Gemini/Search | Blocked by missing service configuration. No claim is made about actual email delivery, model compatibility, live AI quality or current opportunity availability. |

The first regression run found two old fixtures tied to the previous directory size/schema; those fixtures were replaced with tests for the richer contract, including malformed and invented data. Browser assertions were made to wait for the lazy-loaded assistant before checking its controls. Those failures are resolved in local verification. The attribution check also required scrolling the parent iframe into view rather than using the inner link's scrolling helper; its visible text, link, colors and screenshot were then verified in the sandbox.

## Six exact prompts

| Prompt | Verified local behavior with mocked providers |
| --- | --- |
| Create a cybersecurity roadmap for a complete beginner. | Exact goal `cybersecurity`, Beginner level, structured plan returned. |
| Build a 6-month AI engineering roadmap with 10 study hours per week. | Goal `AI engineering`, 26 planning weeks (rounded 52/12 weeks per month), 10 hours/week retained. |
| Recommend paid Coursera and Udemy cybersecurity courses. | Direct checked Coursera/Udemy cards, fee status, free alternatives and actual grounding-source fields. |
| Find free Python courses. | Free Python/freeCodeCamp resources; unknown-fee research results are excluded from free cards. |
| Explain computer networking from scratch. | Original question and history reach Gemini unchanged; generic live-answer path returns content. The actual explanation quality remains untested without credentials. |
| Help me prepare for a hackathon. | General preparation guidance path receives the original question and context. No invented event listing is created. |

These tests verify transport, routing, data shape and UI handling. Fixtures are confined to `tests/`; the application does not use them as AI answers.

## Changed files in this upgrade

| Area | Actual repository paths |
| --- | --- |
| Intent and course directory | `shared/intent.mjs`, `shared/intent.d.mts`, `shared/courseCatalog.mjs`, `shared/learning.mjs`, `shared/learning.d.mts` |
| Search and generation | `server/research.mjs`, `server/roadmaps.mjs`, `server/learning.mjs`, `server/careerTools.mjs`, `server/integrations.mjs` |
| Auth, API quota and history | `server/auth.mjs`, `server/index.mjs`, `server/assistant.mjs`, `server/library.mjs` |
| UI and requests | `src/Assistant.tsx`, `src/CourseCards.tsx`, `src/Learning.tsx`, `src/Dashboard.tsx`, `src/main.tsx`, `src/api.ts`, `src/assistant.css`, `src/learning.css` |
| Configuration and documentation | `.env.example`, `vercel.json`, `README.md`, `SETUP.md`, `RELEASE_REVIEW.md`, `DESIGN.md`, `UX-CONTRACT.md` |
| Regression tests | `tests/learning.test.mjs`, `tests/career-tools.test.mjs`, `tests/auth.test.mjs`, `tests/hackathon-flow.test.mjs`, `tests/fixtures/roadmap.mjs`, `tests/browser-upgrade.mjs` |

The working directory already contained earlier Path4U changes before this upgrade; they were preserved and are not all new changes from this request.

## Limitations and deployment readiness

The account UI and server flows are exercised with provider mocks, but real public signup, confirmation, password-reset delivery, hosted RLS and live Gemini are not verified. The connected account may differ from an account where another Supabase project exists. Connect the intended dedicated project rather than overwriting existing user data.

Roadmaps share the existing 50 KB aggregate payload limit and ten-plan maximum; a detailed researched plan can consume much of that budget. The account workspace itself retains its 90 KB database limit. Save errors are surfaced and roll back. Generated roadmap objects must be explicitly saved; chat history retains the summary and links, not the unsaved full plan. Course metadata and link availability can change. Search results alone do not prove enrollment or an open application. Current prices are not shown.

There is no configured live Calendar writer, general application auto-submission, Gemini Enterprise tenant or Google OAuth. Sheets/Gmail require their existing optional credentials. The account quota is not a global spending cap, and the in-memory auth throttle is only instance-local; Supabase/provider rate limits remain necessary.

Follow [SETUP.md](SETUP.md) for exact dashboard steps, required environment names, safe staging setup and the deployment command. Deployment requires explicit approval under the latest attached brief. After configuration and approval, deploy the full project and run real registration/email/reset/search/save tests on the resulting public URL before submitting it to judges.
