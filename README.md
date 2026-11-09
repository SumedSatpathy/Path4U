# OpenPath AI

OpenPath helps candidates find opportunities, understand their fit, personalize applications, and track progress. The candidate reviews drafts and submits through the organizer’s authorized channel.

## Run the demo

Use Node.js 22 or newer and pnpm.

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm start
```

Open [the local workspace](http://127.0.0.1:4173/). For frontend development with hot reload, use `pnpm dev`. The static production build in `dist/` runs the demo independently of the Node API.

## Try the workflow

1. In Discover, filter sample internships by Kuala Lumpur or Riyadh, Software, AI, or Data Science, and a 4–6 month duration.
2. In Application Studio, load the fictional résumé or paste your own text. The analyzer extracts evidence, then ranking separates eligibility and preferences from skill-vector similarity.
3. Select a role and generate a résumé tailoring guide, cover letter, or email. Edit the drafts, then track the role through Preparing, Applied, Interview, Rejected, or Offer.
4. Review the Orbit Labs deadline change in My Path or Notifications. Confirmation records a simulated Calendar update and its result in agent activity.

## Architecture and configuration

React + TypeScript + Vite → Node HTTP API → OpenPath’s analysis, source, drafting, and tracker adapters → optional provider APIs.

Copy `.env.example` to `.env` before starting the server to configure any of the following. The local server binds to 127.0.0.1 and accepts same-origin API writes.

| Integration | Configuration | Behavior |
| --- | --- | --- |
| Gemini API | `GEMINI_API_KEY`, `GEMINI_MODEL` | Explicit buttons request structured extraction from résumé text and draft suggestions from extracted evidence. Local tools work independently. |
| Greenhouse | `OPENPATH_GREENHOUSE_BOARDS` | Comma-separated authorized Job Board API tokens. Discover separates approved live titles from sample listings. |
| Google Sheets | `OPENPATH_SHEETS_TOKEN`, `OPENPATH_SHEET_ID`, optional `OPENPATH_SHEET_TAB` | Explicitly sync an application’s status to a configured tab (default `Applications`). The tab must exist. An empty tab receives headers. An existing tab must have `Opportunity ID` in cell A1. The token needs Sheets write access. |
| Gmail Drafts | `OPENPATH_GMAIL_TOKEN` | Creates an unsent draft after the candidate reviews the email. The token needs the `gmail.compose` OAuth scope. |
| Google Calendar | Demo mode | The deadline review records a simulated result. |

Keep credentials server-side. The optional Sheets and Gmail tokens are short-lived OAuth access tokens. Provider connections are intended for this single-user loopback demo. Résumé text and drafts live in the Studio session. Saves, plans, tracker status and preferences persist in browser storage. The hosted static demo uses sample opportunities and local tools.

See the [Gemini API](https://ai.google.dev/api/generate-content), [Greenhouse Job Board API](https://docs.greenhouse.io/job-board.html), [Sheets Values API](https://developers.google.com/workspace/sheets/api/guides/values), and [Gmail drafts API](https://developers.google.com/workspace/gmail/api/guides/drafts).

## Attribution

OpenPath’s candidate workflow was inspired by AIHawk. The supplied MIT license covers the upstream code and its notice identifies separate terms for upstream data. OpenPath uses independently written code, original UI, and fictional demo records. [AIHawk license](https://github.com/feder-cr/Jobs_Applier_AI_Agent/blob/main/LICENSE) · [AIHawk notice](https://github.com/feder-cr/Jobs_Applier_AI_Agent/blob/main/NOTICE).
