# Path4U AI quota review — 13 November 2026

## Release status

Implemented and tested in source and the protected Preview:
https://openpath-ai-demo-03531-erti5hkur-webwavework9-8838.vercel.app

Production remains https://path4u.vercel.app and has **not** been promoted as part of this review. It retains the previous quota behavior until a separate approved release. No database migration, quota reset, provider-limit override, billing activation, Production setting or deployment-protection change was performed.

## Findings before repair

- The durable PostgreSQL reservation RPC already uses `now() at time zone 'UTC'` for app daily keys. Thus the server's app day changes at 00:00 UTC / 08:00 Malaysia. Counters are selected by date: no cron or destructive counter reset is required.
- Guests had four daily interactions, plus a one-roadmap daily sublimit. Roadmap and flowchart both use the roadmap endpoint, so generating one could block the other even with interactions left.
- IP-keyed limits allowed only eight new guest sessions per UTC day and twenty guest generations per network/day. Judges sharing a network could block one another.
- The guest cookie was bound to the network address. Changing networks could create a new identity instead of retaining its balance.
- Open tabs did not refresh session status on daily rollover or resume. The browser also merged balances using a minimum, which could preserve yesterday's zero after a successful new-day response.
- Live mind maps returned fixed generic branches before reaching Gemini. This consumed an app interaction without producing a real AI map.

## Current source rules

| Gate | Rule | Window / scope |
| --- | --- | --- |
| Guest daily allowance | 4 accepted interactions | One server-signed browser session; UTC calendar day |
| Guest feature cost | 1 interaction each | Chat, new roadmap, new flowchart plan, new Gemini mind map |
| Guest roadmap sublimit | Replaced by the shared four-interaction allowance | All four can be used on any supported guest AI tools |
| Global admission | 80 accepted interactions | Shared PostgreSQL store, UTC calendar day |
| Global burst | 4 accepted interactions | Fixed UTC minute, across guests and accounts |
| New-session anti-abuse | 120 new sessions per network | Fixed ten-minute window; existing valid sessions continue |
| Cookie | Server-signed random UUID, signed issue time, 24-hour maximum | HttpOnly, SameSite=Lax, Secure on HTTPS, no IP binding |
| Provider-call safety budget | 400 attempted calls | Pacific calendar day, independent of app day |
| Provider-call burst | 10 attempted calls | Fixed UTC minute |
| Provider input budget | 200,000 estimated input tokens | Fixed UTC minute; estimate = ceil(UTF-8 request bytes / 2) + 512 |
| Account policy, retained | 12 accepted interactions and 2 roadmaps | Per verified eligible account / UTC day; account UI is disabled in the current public demo |

Each tool shares the same guest `subject:<UTC-day>:guest:<session>` counter and the atomic `path4u_reserve_ai` RPC. Guest generation uses its common interaction reservation, rather than the RPC's separate account-oriented roadmap gate. The SQL RPC and account roadmap policy are unchanged. There is no client-supplied identity, clock, quota override or unlimited mode.

Viewing, editing, saving or exporting an already generated plan does not generate a new plan. Browsing, local Resume Studio scoring and local draft work do not consume Gemini interactions. Guided legacy/local development and Redis-backed old deployments have different policies; the above applies to the durable live Supabase-backed deployment.

## Charging, retries and storage

- Invalid input, prohibited private input, missing configured Gemini key and failed quota reservation do not start a provider call.
- Once admitted, failures still consume that interaction. This bounds repeated failing requests. The server never refunds a request merely because a browser claimed failure.
- Request UUIDs are scoped to the signed session and fingerprinted. Same-ID/same-input replay does not charge twice; changed input is rejected. Successful results are retained for a five-minute replay window. A pending duplicate does not start another Gemini call.
- Six explicitly allowlisted, context-free public questions can reuse a 24-hour public cache without a new interaction/provider call. Goals, conversation history, attachments and resumes are excluded. Cached or replayed replies return today's actual balance instead of a stored old balance.
- Every actual Gemini attempt, including the single allowed retry after upstream 503, must reserve provider capacity. A provider 429 is reported separately and is not automatically retried or routed around.
- Per-counter provider CAS reservations are conservative: a later safety gate can fail after an earlier counter was charged. These are safety estimates, not a promise of Google's remaining quota.
- Usage storage failure returns 503 and blocks new Gemini calls. Existing database RLS/service-role restrictions remain intact.
- App admission is atomic across serverless instances. Preview and Production share the existing store, so shared capacity can be consumed by either environment.

## Reset behavior

At UTC midnight, the date changes and fresh daily keys apply. Existing valid signed cookies keep their identity. The session endpoint supplies the authoritative day, server timestamp and next reset. The browser schedules a status refresh for that reset and refreshes on focus/visibility resume; it does not automatically generate AI content. A new day restores the displayed balance, and delayed older responses cannot reduce it. Failed refreshes stay visible and retry conservatively; the user can retry manually. Inputs and saved work are retained.

An expired or invalid cookie cannot generate. The session endpoint may mint a replacement subject through the short mint throttle; legitimate 24-hour expiry is handled separately from the daily reset. This is browser-session fairness, not identity-grade anti-Sybil verification. Cookie clearing can create another session, but cannot evade shared app/provider caps.

## Gemini is independent

Google documents project-level RPM, input TPM and RPD, with RPD resetting at midnight Pacific time:
https://aistudio.google.com/docs/rate-limits

Pacific midnight is **16:00 Malaysia during Pacific standard time** (including November), or **15:00 during daylight saving time**. UTC midnight at 08:00 Malaysia therefore does not restore an exhausted Google daily quota or Path4U's Pacific-day provider safety budget. The helper handles Pacific DST transitions.

The owner previously reported Gemini limits of 15 RPM, 250,000 input TPM and 500 RPD. This review did not independently access the live AI Studio project settings. The 10 / 200,000-estimated / 400 safety budgets leave headroom against those reported limits; Google's actual active settings and availability remain authoritative. Other apps using the same Google project consume its quota too.

## Controlled verification

- `tests/quota-reset.test.mjs`: exhausted the four shared interactions; confirmed roadmap, flowchart generator and mind map are denied before UTC midnight; moved the isolated clock to midnight; confirmed balance four and all three generators work with the same cookie. No real waiting.
- Simulated 120 judges sharing one network with separate signed sessions; one judge's usage did not change another balance. Confirmed the 121st new mint is briefly throttled, existing sessions continue, and minting recovers in the next ten-minute window.
- Tested changed-network identity, legacy-cookie upgrade retaining consumed balance, forged/expired cookie rejection, duplicate replay/conflict, global concurrent/minute/daily denial, storage outages, provider 429, malformed mind-map responses, provider minute/input/daily budgets and Pacific DST boundaries.
- `tests/browser-quota-reset.mjs`: actual built UI and real durable route/generators with isolated storage/provider doubles. An open zero-balance tab refreshed to four at reset, generated roadmap/flowchart/mind map, and refreshed on focus after a later daily boundary. No runtime errors.
- Live protected Preview: session HTTP 200, four interactions; three native Gemini requests (chat, roadmap, mind map) HTTP 200, nonblank output, balances 3 → 2 → 1. Saving and opening the saved flowchart required no new provider request. Nine actual UI captures recorded, zero browser runtime errors. No artificial live exhaustion or quota resets.
- TypeScript, full unit suite and production build passed; local demo-only, navigation, learning upgrade and AI privacy browser regressions passed. The final full unit suite passed 46 tests.

Controlled storage/provider doubles prove the application path and timing rules, not the real provider's quality or availability. The SQL UTC keying and atomic caps were inspected directly in the existing migration; no deployed database clock or function was altered for a test.

## Other reasons access can still fail after 08:00 Malaysia

Global app capacity already used; a busy fixed-minute window; Pacific-day provider safety budget; Google's own project RPM/TPM/RPD; other project users; missing/revoked key; unavailable model or service; blocked/expired cookies; blocked session endpoint or offline browser; unavailable Supabase/permissions/RPC; wrong environment/backend flags; a stale deployment/service cache; or Vercel deployment protection on Preview. Error codes distinguish app daily, app minute, mint throttle, internal provider budgets and `gemini_provider_limit`; safe reset/retry metadata is returned. The reset is not an uptime guarantee.
