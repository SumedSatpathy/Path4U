> Current update — 12 November 2026: durable Supabase storage, live opportunities and bounded guest/account Gemini are implemented in a protected Preview. Read [HACKATHON_READINESS.md](HACKATHON_READINESS.md) for the current URL, evidence, remaining preflight checks and approval-gated Production release. Older temporary-Redis notes below are historical.

> Update — 12 November 2026: the protected temporary Preview now uses Redis for demo quotas and account data, preserving existing email identity. See [CHAT_REPAIR.md](CHAT_REPAIR.md) for the current repair, test evidence and 14 November storage expiry. The earlier Supabase database audit below is historical; applying SQL migrations is not required for this replacement Preview.

# Path4U AI readiness report — 11 November 2026

Repository: `C:/Users/sumed/Downloads/MATH/OneDrive/Documents/projects/openpath-ai`.

## Release status

The existing React 19 / TypeScript / Vite application has been upgraded in place. Custom history/hash routing, monochrome design, existing Supabase REST authentication/workspace adapter, document templates, Google integrations and Vercel Functions remain. No framework or database replacement, production release, paid activation or production database-policy change was made.

Final core-AI verification deployment: `dpl_Dee6jupne3jKUNoRhgWo3DGyCbaz` (Preview, READY):
https://openpath-ai-demo-03531-4t2oakguf-webwavework9-8838.vercel.app

Preview requires Vercel sign-in. A public share link has not been approved. A read-only backend-metadata audit is recorded separately below; passing provider tests does not establish that account/data setup is complete.

## Implemented changes and bugs fixed

- Model selection now lives in `server/geminiConfig.mjs`. `GEMINI_API_KEY` alone enables configuration; the old requirement for a separate, unset model variable could leave live AI unavailable. The default is **gemini-3.1-flash-lite**, verified against this key's model list and with real generation requests.
- Server-only REST requests retain the key in an HTTP header. No Gemini key is placed in React, URLs, logs or browser bundles. Missing credentials, invalid-key responses, unsupported model access, quota exhaustion, timeouts, upstream HTTP errors, malformed JSON, empty answers and truncated generations have controlled errors.
- Normal explanations bypass the extra function-router call. Explicit roadmap, study-plan, course and research intents retain deterministic routing into actual tools. Beginner AI engineering and learning-Python requests now retain the intended topic. Recent conversation context remains bounded and available to follow-ups.
- Retained pending/loading, edit-and-resend, regeneration, Markdown, source links, narrow layouts and explicit guided/live labels. No generated reply is substituted with a fake success when the provider fails.
- Client request IDs and bounded, per-user server deduplication coalesce identical retries on a warm instance for 60 seconds. Reusing an ID with different content returns a conflict. Input/action validation, request-size limits and existing database usage claims remain.
- Roadmaps use server-calculated phase schedules based on the user's duration and weekly hours, with strict validation of coverage, effort, lessons, resource IDs and text sizes. Added observable completion criteria. Existing expandable phases, lesson progress, explicit Save and private workspace persistence are retained. Existing roadmaps are not deleted or migrated.
- Course results use checked direct provider pages and explicit free/paid labels, without invented prices or links. Current Google grounding is supported in code but off for the unpaid configuration. Only grounded segments with real metadata citations are presented as research; retrieved content is treated as untrusted data.
- Stored opportunity fallback filters category, location/country, experience and topic. Unknown dates/verification remain unknown. Undated listings are not described as currently open. An unavailable stored source is reported rather than fabricated.
- Resume Rater remains deterministic on the device. Added the requested five-category score, selectable student/professional stage, missing-information guidance, job-description comparison and expandable verbatim evidence.
- Existing Resume Studio field validation, progress, wording edits, templates, saving and PDF/DOCX exports remain. No skills, employers, degrees, metrics or achievements are fabricated.
- Private resume processing is blocked server-side by default across chat/attachments, analysis and drafting. Learning requests also reject detected personal details before quota/provider calls. Private AI controls are hidden unless an approved arrangement exists; explicit consent is still required. Contact redaction is an additional minimization aid, not guaranteed anonymization.
- Preview origin handling recognizes only the exact Vercel-provided Preview host. Optional AI monitoring records known route name, status and duration, never prompts, resumes, identifiers or keys.

## Resume scoring audit and calculation

The old rater already used weighted local text rules, rather than an LLM or an official ATS service. It had six categories and no dedicated contact-completeness criterion. The replacement keeps scoring deterministic and explains its limitations.

| Category | Weight | Observable checks |
| --- | ---: | --- |
| Contact information and completeness | 15% | Recognizable first-line name, syntactically valid email, Education section |
| Relevant technical skills | 25% | Bounded selected-role keyword coverage, with matching text evidence |
| Projects and experience | 25% | Action statements from projects, employment, research or volunteering; student threshold is three, experienced threshold five |
| Target job alignment | 20% | Supplied job-description terms, otherwise selected-role terms |
| Clarity and readability | 15% | Recognizable headings, long lines and detectable wording/spacing flags |

Each category is scored 0–10; total = sum(category score × weight / 100), rounded to one decimal. Label: **Path4U Resume Quality Score**. Students need neither professional employment nor numerical achievements to earn full project points. Matching terms do not prove competence. The heuristics do not assess every language, layout, grammar issue or hiring criterion and do not predict ATS/hiring outcomes.

PDF and DOCX selectable text is parsed on the device. Scanned PDFs cannot be reliably scored without text; no OCR quality claim is made. Private processing through free Gemini stays disabled. A configuration flag alone is not a legal assessment: the owner must first review an appropriate data-processing arrangement and record its reference before considering consent-based enablement. Sensitive information detection and contact redaction are incomplete safeguards; users are told not to submit private information to ordinary AI chat.

## Verification results

`pnpm test`: **24 passed, 0 failed**. Includes all eight exact requested prompts through actual API handlers using explicit Gemini/Supabase fixtures; authentication/authorization guards, duplicate calls, quotas, private-data rejection, provider errors, roadmap validation, topic preservation, opportunity filters, synthetic resume strengths/weaknesses, missing sections, invalid email, job matching and repeatability.

`pnpm typecheck` and `pnpm build`: passed. Build retains an existing large-chunk warning for the PDF/document tooling; no TypeScript errors.

Browser checks passed:

- `tests/browser-upgrade.mjs`: actual UI/API with mocked external providers; login/refresh, loading, blank-response error/input recovery, source cards, saved roadmap reload, lesson completion, mobile and logout protection.
- `tests/browser-ai-privacy.mjs`: real local synthetic PDF/DOCX parsing, five rubric categories, evidence, job-description scoring, mobile layout and **zero private AI requests**.
- `tests/browser-resume-validation.mjs`: mandatory/optional fields, international contacts, focus correction, completion, actual PDF/DOCX exports, edited-document guard, draft saving/reload, navigation and mobile.
- `tests/browser-navigation.mjs`: shared Back placement, same-origin history/query/hash behavior, refresh/Forward, external fallback, unsaved changes, saved plans and mobile.

Strict project UI audit: **0 findings**. Browser authentication/data tests use controlled fixtures; they do not prove live Supabase RLS configuration or real email delivery.

### Actual Gemini calls in Vercel Preview

All eight checks passed in the final core-AI Preview build. The distinctions below are deliberate:

| Exact requested prompt | Observed result |
| --- | --- |
| Hello, what can Path4U help me with? | Actual Gemini answer, 1,142 characters |
| Create a 6-month cybersecurity roadmap. | Actual Gemini roadmap, four validated phases |
| Build a beginner AI engineering roadmap. | Actual Gemini roadmap, four validated phases |
| Find free Python courses. | Two checked directory resources; no live search or unnecessary generation |
| Recommend paid Coursera and Udemy cybersecurity courses. | Two checked direct provider resources; no invented prices |
| Explain computer networking. | Actual Gemini answer, 1,543 characters |
| Create a study plan for learning Python. | Actual Gemini roadmap, four validated phases |
| Find relevant upcoming hackathons. | Correct research-unavailable state; no current hackathon verified |

Five requests genuinely invoked Gemini. The two course checks exercise the real directory/tool code, and the final check verifies truthful unavailability; these are not eight successful live-search responses. Build tests exercise the provider/learning engine, not a logged-in deployed browser session.

Earlier runs exposed 30/50-second timeouts with Gemini 3.8 Flash, intermittent upstream HTTP 503 failures with 3.5 Flash-Lite, and one rejected roadmap structure. These failed runs were not counted as successful. Explicit low thinking effort, a compatible efficient primary model and server-calculated schedules were used for the final successful run. There is no automatic paid retry/fallback. Temporary upstream failures can still occur.

## Read-only backend metadata audit

Read-only audit deployment: dpl_5o1vCD6NWakY3SwFKYD1c4gwfDsq, Preview READY. Latest Preview: https://openpath-ai-demo-03531-ee73olaka-webwavework9-8838.vercel.app . Runtime application code is unchanged from the successful Gemini verification build; this build additionally ran the metadata audit.

Supabase REST schema and auth settings both returned HTTP 200. Email provider is enabled; email autoconfirm is false. Using the server role for schema metadata only, none of these required paths was exposed:

- /openpath_profiles
- /openpath_workspace
- /openpath_opportunities
- /openpath_library
- /rpc/openpath_claim_assistant_usage
- /rpc/path4u_demo_session

This is a release blocker for authenticated features and the database-backed guided demo. It indicates missing migrations or API exposure/grants; it does not prove that the underlying SQL objects do not exist. Existing SQL/schema must be inspected before applying anything. Actual live signup, onboarding, quota claims and authenticated saves cannot be claimed functional. The application is built and genuine Gemini works in isolated server-side checks, but the complete live product is **not hackathon-ready yet**.

The three existing migrations are concrete review material in supabase/migrations. They include owner-scoped RLS, a project-wide auth.users signup trigger, quota/demo functions and private storage policies. That trigger can affect other applications sharing the project; do not blindly apply all files or rerun non-idempotent migrations. No migration or policy was applied in this task. Explicit approval is required before production database changes.

The audit read only API schema and public auth settings, never user rows. It did not modify tables, policies, triggers or authentication settings.

## Privacy, quotas and limitations

- Existing application quota: 18 assistant units per account per UTC hour through the existing Supabase claim function. Ordinary requests use one unit; permitted image generation uses three. This depends on the existing database function being installed. Guests cannot invoke the live provider endpoints.
- General generation limit: 2,400 output tokens; structured roadmaps: 7,000; research: 3,000. Generation timeout: 50 seconds inside a 55-second assistant deadline and existing 60-second Vercel function budget. Search has a 20-second provider bound. Long operations can fail honestly without replacing user input.
- Duplicate protection is per warm server instance, not distributed exactly-once processing. Provider retries after a failed request may consume another unit. Multi-instance global deduplication would need a separately reviewed database migration.
- Actual Google project RPM/TPM/RPD cannot be inferred from the presence of a key or the public pricing page. The owner must inspect this model's active limits in AI Studio. No project-specific quota number is claimed here.
- Google Search grounding on the selected Gemini 3.x free tier is unavailable. The paid tier lists a shared monthly allowance and subsequent charges; no paid billing or search was activated. Current hackathon/internship discovery remains limited to stored records and configured approved feeds.
- Authenticated save/reload, email delivery, live cross-user RLS isolation and private storage policies still need a controlled live account/staging verification. Production policies were deliberately not changed. Google Sheets/Gmail require their existing server credentials and connected-account owner; no email was sent and no application submitted.
- Preview protection is enabled. The CLI unexpectedly created an automation bypass during a protected HTTP check; that exact newly created bypass was revoked and original protection confirmed. The protected HTTP check received a redirect, so it is not claimed as a successful deployed app end-to-end test.
- Automatic approval review rejected creating a 23-hour public Preview link because it grants access to anyone holding the URL. No share link was created. Explicit approval remains required for that external-access change.

## Required Vercel settings

Configure values directly in Vercel; never paste keys into chat or use `VITE_` names for secrets.

| Setting | Current requirement |
| --- | --- |
| `GEMINI_API_KEY` | Present as sensitive in Production and Preview; real generation verified inside Preview |
| `GEMINI_MODEL` | Optional; default `gemini-3.1-flash-lite`; pin this explicitly for reproducible releases if desired |
| `GEMINI_SEARCH_ENABLED` | Omit or `false` for the current free setup |
| `GEMINI_SEARCH_BILLING_APPROVED` | Omit or `false`; enable only after explicit approval and a supported paid arrangement |
| `GEMINI_RESEARCH_MODEL` | Optional; defaults to primary model |
| `GEMINI_PRIVATE_DATA_APPROVED` | Omit or `false`; do not enable for real resumes on the unpaid service |
| `GEMINI_DATA_PROCESSING_REFERENCE` | Required documented arrangement reference before any future private-AI enablement |
| `GEMINI_IMAGE_MODEL`, `GEMINI_IMAGE_BILLING_APPROVED` | Optional; image generation remains unavailable unless model and explicit cost approval are configured |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Present in Preview/Production; verify existing migrations and auth setup before claiming live accounts work |
| `OPENPATH_ORIGIN` | Exact HTTPS production origin for a future production release; Preview accepts only its own Vercel-provided host |
| `PATH4U_PUBLIC_DEMO` | `1` on this Preview; guided demo remains explicitly labelled and separate from genuine Gemini |
| `PATH4U_AI_MONITORING` | `true` on this Preview; status/timing only |
| `PATH4U_VERIFY_GEMINI` | Build-only `1` for opt-in synthetic provider checks; normally omitted to avoid repeat usage |
| `PATH4U_VERIFY_PROMPTS` | Optional build-only comma-separated prompt numbers for targeted diagnosis |

## Files created or updated in this task

Server: `server/geminiConfig.mjs`, `server/aiPrivacy.mjs`, `server/integrations.mjs`, `server/assistant.mjs`, `server/careerTools.mjs`, `server/research.mjs`, `server/roadmaps.mjs`, `server/learning.mjs`, `server/index.mjs`.

Shared/client: `shared/intent.mjs`, `shared/resume.mjs`, `shared/resume.d.mts`, `shared/learning.d.mts`, `src/Assistant.tsx`, `src/Studio.tsx`, `src/ResumeStudio.tsx`, `src/Learning.tsx`, `src/api.ts`.

Verification/config/docs: `scripts/verify-gemini.mjs`, `scripts/inspect-backend.mjs`, `tests/ai-hardening.test.mjs`, `tests/browser-ai-privacy.mjs`, policy-aware fixtures/expectations in existing tests, `package.json`, `.env.example`, `README.md`, `SETUP.md`, `DESIGN.md`, `UX-CONTRACT.md`, this report. Existing unrelated worktree changes were preserved.

## Final hackathon release steps

1. Review the protected Preview and the backend audit below. Keep production credentials/configuration unchanged until review is complete.
2. In the existing Supabase project, compare the repository's three migration files with installed migrations, grants, signup trigger and RLS. Apply only missing changes to a dedicated staging project first. Applying production schema/policy changes requires explicit approval; none were applied here. Follow SETUP.md for email confirmation, callback allow-list and custom email templates.
3. Use controlled test accounts to verify signup/verification, login, onboarding, cross-user isolation, roadmap save/reload and logout against staging. Confirm that private Gemini controls remain disabled and the guest mode is labelled.
4. In AI Studio, inspect active limits for `gemini-3.1-flash-lite` and ensure capacity for the demonstration. Keep paid search/image features off. Check the original provider pages for any courses shown to judges.
5. Run `pnpm test`, `pnpm typecheck`, `pnpm build`, browser checks, and the opt-in synthetic Preview verification. Confirm Vercel reports READY and assess runtime errors. Do not pull all production environment secrets locally just to test Gemini.
6. After explicit production-release approval, deploy the reviewed source with the intended Production variables, team `webwavework9-8838`, project `openpath-ai-demo-03531`: `vercel deploy --prod --project openpath-ai-demo-03531 --scope webwavework9-8838`. Confirm the production URL, authentication redirects and runtime behavior. Promoting a Preview can rebuild with Production variables, so its previous test result alone does not verify the production build.
7. For a public judge demonstration before production release, explicitly approve a time-limited Preview share link. That approval is separate from publishing a protected Preview.

## Official sources checked

- [Gemini 3.1 Flash-Lite capabilities](https://aistudio.google.com/docs/models/gemini-3.1-flash-lite)
- [Gemini API pricing and Google Search charges](https://aistudio.google.com/docs/pricing)
- [Gemini active rate limits](https://aistudio.google.com/docs/rate-limits)
- [Gemini unpaid-service data handling](https://aistudio.google.com/docs/terms)
- [Gemini thinking and token limits](https://aistudio.google.com/docs/thinking)
- [Supabase API key handling](https://supabase.com/docs/guides/getting-started/api-keys)
- [Coursera Google Cybersecurity certificate](https://www.coursera.org/professional-certificates/google-cybersecurity/)
- [Udemy cybersecurity course](https://www.udemy.com/course/cybersecurity-from-beginner-to-expert/)
