# OpenPath AI UX contract

The supplied product brief is the source for the user workflows. The demo starts with fictional listings and a sample profile. The loopback API enables optional providers when the owner configures credentials or an approved board allowlist.

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
| --- | --- | --- | --- | --- |
| Select/Listbox | Native select | Discover, profile, settings | Platform popup | Keyboard and narrow layout |
| Date | Shared formatDate | UTC date-only sample records | Compact and long | Source diff and cards |
| Form | Shared SearchBox and native labelled fields | Page field validation | Search, profile, task | Keyboard and invalid input |
| Scrollbar | Global styles | DESIGN.md | Document and internal dialog | Computed style |
| Toast | Shared application status region | Demo adapter result | Success and error | Status feedback |
| CRUD | Typed OpportunityAdapter | Browser-local sample store | Save, plan, task, profile, settings | Reload and recovery |

- Discover query, category, filters, sort, and page belong to the URL. Filter changes reset paging. Listing and detail use the same fixtures.
- A local write publishes its new state after successful storage and leaves the previous state intact on failure. Re-read storage before each mutation and sync storage events across tabs.
- Opening notifications leaves review pending. Dismissal marks the notification read while keeping review available. Cancel closes review. Confirmation records a simulated Calendar result for the same change exactly once.
- Source records and activity history identify the sample data. The public preview never updates the workspace. Google Calendar remains a simulation. Gemini API, Google Sheets, Gmail Drafts, and approved Greenhouse boards are optional server integrations.
- Native modal dialogs own focus and Escape. Buttons navigate only through actual links or explicit search submission. Feedback is visible and announced.


- The Studio holds résumé text, extracted evidence and draft edits in memory. Candidate actions explicitly request provider processing and control each tracker sync and unsent Gmail draft.
- Skills use an interpretable vector of supported skill terms. Profile checks sort ahead of skill similarity. The organizer remains the authority for eligibility and submission.
- Greenhouse reads only allowlisted job boards and shows live titles separately from the demo catalog. Catalog discipline, duration and sample match filters apply to fictional records with those fields.
