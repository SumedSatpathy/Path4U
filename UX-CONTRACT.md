# Path4U UX contract

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
| --- | --- | --- | --- | --- |
| Select/Listbox | Native select | Workspace and onboarding forms | Shared component or native control | Keyboard and narrow layout |
| Date | Native date input for calendar-date filters; Birthday dialog for age attestation | Discover URL filters and `shared/age.mjs` | Native mobile calendar for non-sensitive deadline filtering; shared Birthday dialog retains fast month/year selection | Date filtering, mobile keyboard, age boundaries and leap dates |
| Form | Native labelled fields and shared SearchBox | Screen and API validation | Shared component or native control | Invalid input and clear behavior |
| Scrollbar | Global styles | DESIGN.md | Shared component or native control | Document and internal scroll |
| Toast | Workspace feedback region | Confirmed operation | Shared component or native control | Error and success announcements |
| CRUD | Workspace adapter with revisioned account writes | Browser demo or Supabase | Shared component or native control | Reload and conflict checks |
| Demo balance | Demo provider | `src/demo.tsx`, `server/durableDemo.mjs`, `server/aiQuota.mjs` and atomic database ledger | Shared component or native control | Deduplication, exhaustion, cross-origin checks |

- Discovery filters live in the URL. Each listing and its detail share one record. Discover uses live source-backed records and an honest empty state. Legacy fixtures remain available only as source data for unrelated explicitly labeled demonstrations; they are never the live catalog fallback.
- Desktop menus use pointer entry and delayed dismissal. Keyboard and touch use native buttons. The mobile drawer uses the shared dialog.
- The roadmap assistant opens proposals in the editable form. A separate Save action writes the resulting roadmap.
- Reviewable application actions preserve existing provider restrictions. Resume scoring and wording edits remain on the device. Private provider analysis requires a reviewed processing arrangement, deployment approval flags, and explicit per-request consent; contact redaction is an additional minimization aid. Deadline changes in the demo record a simulated Calendar result.

- Resume Studio and Draft Library share the same Markdown editor and document exporters. A draft is marked saved only after browser storage or the account API confirms the write.
- The assistant explicitly distinguishes guided replies, local attachment text, and Gemini processing. Private uploads are disabled on the unpaid service. Under an approved processing arrangement, permitted uploads are removed after processing when storage is reachable. Voice dictation only changes the input.
- The main Home action follows the confirmed session. Log Out calls the auth endpoint before leaving the workspace.

- Roadmaps preserve goal and time inputs across chat handoff. Gemini phases are validated before display. Lesson and milestone checkboxes share one progress calculation with the dashboard. Save writes the existing private workspace; provider-directory and Google Search metadata have distinct labels.
- Google Search suggestions use a script-free sandbox with an explicit light color scheme. Live research can fail independently; the UI then labels checked directory links and does not assert current availability.

- Page navigation: one shared PageContent/BackButton precedes headings in main content, including workspace, account, information and landing layouts. It is never a sidebar item or global-header action. Wizard controls use Previous step.
- Back follows only instrumented same-origin browser entries, including hash/query history and refresh. A direct entry falls back to Dashboard; it never trusts document.referrer or a return URL parameter.
- Unsaved work: shared navigation guards protect resume inputs, roadmap/mind-map drafts, profile edits, document edits, application preparation and account forms. In-app links and Back use the shared leave dialog with Stay initially focused. Native Back/Forward restores the current entry before asking. Only actual document unload uses the browser lifecycle prompt. No form or credential values are saved in navigation history/storage.

- Resume Studio requires name, email, qualification/institution, technical skills and target role. Shared validation owns inline errors, mandatory-only progress and generation/export gates. Optional entry formats are shown next to their fields. Draft saving remains available for correction.
- Dashboard and Resume Studio are top-level sidebar and mobile-drawer links, preceding Atlas Index and Field Tools respectively. Existing group features retain their routes and shared hover behavior.

- Live Discover has exactly three primary tabs: Internships, Hackathons & Workshops, Jobs. Unknown source fields stay unknown. Event publication is Status Unverified until registration evidence supports Verified Open. Failed providers use disclosed last-good caches; expired and confirmed broken registrations are excluded.
- Durable Preview accounts use existing Supabase Auth, HttpOnly cookies and owner-isolated PostgreSQL records. Successful sign-in and onboarding clear only their own unsaved form guards. Generic public AI cache entries never include resumes, goals or conversation history.

- Authentication preserves provider error codes for actionable invalid-password and unverified-email states. Verification resends share a visible 60-second cooldown and server/provider rate limits. No provider messages or secrets are sent to the browser.
- Atlas Index omits the six duplicate opportunity-category links on desktop and mobile. Discover retains its three primary tabs and all existing filter URLs.

- DEMO_ONLY_MODE is server-owned and exposed through a minimal public app-config endpoint. Enabled mode never requests an account session in the UI and never represents a guest as authenticated. Old auth routes return to the welcome page with an explanation. Backend Auth actions are unavailable; existing private API authorization and RLS remain enforced. Setting the flag false restores the account UI.
- Hackathon guest progress and sample drafts use separate sessionStorage namespaces and survive refresh in the same tab. They never load account data or previous localStorage demo records. Account saving is unavailable; exports and local resume analysis remain available.

- Durable live guest AI uses one shared interaction per generation and four per UTC day. The shared provider refreshes its server-reported balance at UTC reset and on focus/visibility resume, without automatically generating content or losing inputs. A new day can increase balance; delayed old responses cannot roll it back. Quota errors expose safe reason codes and reset/retry metadata. No daily balance is keyed to the judge’s network.
