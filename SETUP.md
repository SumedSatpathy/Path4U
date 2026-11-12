> Published — 13 November 2026: the approved public hackathon demo is live at https://path4u.vercel.app. The original URL stays active. Read [DEMO_PRODUCTION_RELEASE.md](DEMO_PRODUCTION_RELEASE.md) for Production verification and the retained AI quota limitation.

> Hackathon demo update — 13 November 2026: read [DEMO_RELEASE_REVIEW.md](DEMO_RELEASE_REVIEW.md) for the latest guest-first Preview, reversible DEMO_ONLY_MODE, test evidence, quota limitation and approval-gated short-hostname/Production release.

> Authentication/sidebar update — 12 November 2026: read [AUTH_SIDEBAR_REPAIR.md](AUTH_SIDEBAR_REPAIR.md) for the latest protected Preview, confirmed signup cause, live QA results and remaining Supabase email-quota blocker. Production is unchanged.

> Current update — 12 November 2026: durable Supabase storage, live opportunities and bounded guest/account Gemini are implemented in a protected Preview. Read [HACKATHON_READINESS.md](HACKATHON_READINESS.md) for the current URL, evidence, remaining preflight checks and approval-gated Production release. Older temporary-Redis notes below are historical.

> Update — 12 November 2026: the protected temporary Preview now uses Redis for demo quotas and account data, preserving existing email identity. See [CHAT_REPAIR.md](CHAT_REPAIR.md) for the current repair, test evidence and 14 November storage expiry. The earlier Supabase database audit below is historical; applying SQL migrations is not required for this replacement Preview.

# Activate Path4U accounts and AI

The existing production URL is https://openpath-ai-demo-03531.vercel.app/. As of this audit, Vercel contains Supabase credentials and GEMINI_API_KEY in Production and Preview. Credentials alone do not confirm that the application migrations and auth configuration are installed. See AI_READINESS.md for the latest test evidence. Production settings and database policies were not changed.

## 1. Review the existing Supabase project

1. Open [Supabase Dashboard](https://supabase.com/dashboard) and identify the existing project matching SUPABASE_URL. Preserve that database. Review installed migrations before doing anything else; do not create a replacement project.
2. Open the project's **SQL Editor → New query**. Review each file in `supabase/migrations` in timestamp order against the existing migration history. Applying production migrations requires explicit approval. On an existing project, apply only pending migrations. The reviewed additive repair `20261112132337_durable_path4u_workspace.sql` is already applied to the shared project. Do not replay earlier migrations: those install a global signup-ticket trigger. Current signup defaults to server attestation and requires neither that trigger nor `openpath_signup_tickets`. No new schema change is needed for the authentication/sidebar repair.
3. Open **Project Settings → Data API** for the project URL, and **Project Settings → API Keys → Legacy API Keys** for `anon` and `service_role`. The existing REST adapter requires the JWT-format legacy keys; do not put a new `sb_secret_...` value in a Bearer header. Keep both values in server configuration. [Supabase API key documentation](https://supabase.com/docs/guides/getting-started/api-keys)

## 2. Configure email authentication

1. Open **Authentication → Sign In / Providers → Email**. Enable email/password signups and **Confirm email**. Keep confirmation enabled; the server rejects insecure auto-confirm registration.
2. Open **Authentication → URL Configuration**. Set **Site URL** to `https://openpath-ai-demo-03531.vercel.app` (no trailing slash). Add `https://openpath-ai-demo-03531.vercel.app/auth/callback` to the allowed redirect URLs. For a staging project, use that project's exact origin instead.
3. Keep the standard **Authentication → Email → Templates** `{{ .ConfirmationURL }}` links when using the default PKCE flow. Path4U exchanges the callback code with a secure verifier cookie in the browser that requested the email. Existing explicitly configured token-hash templates are also supported; their equivalent links are:

   ```html
   <a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email">Verify my Path4U account</a>
   <a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery">Reset my Path4U password</a>
   ```

4. Under **Authentication → Email → SMTP Settings**, configure your email provider's SMTP host, port, username, password and verified sender. Use the actual provider values. Supabase's built-in sender is restricted to organization team addresses; public judge signup needs custom SMTP. This task has not configured an email service. [SMTP documentation](https://supabase.com/docs/guides/auth/auth-smtp), [template documentation](https://supabase.com/docs/guides/auth/auth-email-templates)
5. Configure provider rate limits appropriate for the demo. The app also limits account requests per running instance; it does not replace Supabase's provider-level limits.

The existing self-attestation policy remains unchanged: 15+ policy, with live registration for ages 15–17 restricted pending guardian consent. February 29 anniversaries use March 1 in non-leap years, in Asia/Kuala_Lumpur. Full birth dates are not saved. Google OAuth is intentionally unavailable and cannot bypass this gate.

## 3. Set the Vercel server environment

Open [Vercel](https://vercel.com/) → the existing **openpath-ai-demo-03531** project → **Settings → Environment Variables**. Add values to the intended environment. A preview should use a matching dedicated staging origin and Supabase project.

| Name | Value |
| --- | --- |
| `OPENPATH_ORIGIN` | `https://openpath-ai-demo-03531.vercel.app` |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Your legacy `anon` JWT key |
| `SUPABASE_SERVICE_ROLE_KEY` | Your legacy `service_role` JWT key; mark sensitive |
| `GEMINI_API_KEY` | Your Gemini API key; mark sensitive |
| `GEMINI_MODEL` | Optional; defaults to `gemini-3.1-flash-lite`, supporting `generateContent`, JSON schemas and function calling |
| `GEMINI_SEARCH_ENABLED` | Keep `false` for this free-tier release; paid research also requires explicit approval and `GEMINI_SEARCH_BILLING_APPROVED=true` |
| `GEMINI_RESEARCH_MODEL` | Optional exact model ID supporting Google Search; defaults to `GEMINI_MODEL` |

No key values belong in `VITE_...` variables, browser code, Git or chat. Google Search uses the existing server-side Gemini REST integration. Search and structured generation are separate requests to avoid model-specific schema/tool combinations. The key and default model have been exercised with synthetic requests in Vercel Preview builds. Provider HTTP 503 failures occurred intermittently. Check your project-specific active quotas in [Google AI Studio](https://aistudio.google.com/usage). Private resume AI remains disabled; local scoring and document editing work without it. Search failures are shown honestly. [Google Search grounding](https://ai.google.dev/gemini-api/docs/generate-content/google-search?hl=en)

Optional existing integrations remain optional: Gemini image model, authorized Greenhouse boards, Google Sheets and Gmail tokens, integration owner ID. None is needed to save a roadmap. No Gmail message is sent automatically. Live Calendar writes and Gemini Enterprise orchestration are not implemented.

The live assistant, roadmap, resume analysis and drafting endpoints share an atomic Supabase quota of 18 units per UTC hour per account. Images cost three units; other live operations cost one. Provider errors consume an attempted unit to prevent abuse. This is an account quota, not a global spending cap; set the desired project-level quota in your provider dashboard before a public event.

## 4. Local and deployment checks

For local testing, copy `.env.example` to `.env` and fill the same server values, using `OPENPATH_ORIGIN=http://127.0.0.1:4173` and matching local Supabase email-template Site URL in a separate staging project. Run:

```sh
pnpm test
pnpm typecheck
pnpm build
pnpm start
```

The Vercel project remains **Vite**, build command `pnpm build`, output `dist`, package manager pnpm. The `api/index.mjs` function and `vercel.json` rewrites are required; uploading `dist` alone removes the backend.

After explicit deployment approval, use the existing linked project from this repository:

```sh
vercel deploy --prod
```

Environment changes take effect on a new deployment. This command is documented for review and has not been run for this release. [Vercel environment settings](https://vercel.com/docs/environment-variables/managing-environment-variables)

After deployment, verify `/api/auth/session` reports `mode: live`, `/api/status` reports Gemini available, create a new adult account, follow its real email link, complete onboarding, log out/in, request a real reset email and open it. Then enable Gemini sharing in the assistant, generate the two requested roadmaps, save a plan, mark a lesson, save and refresh. Test both account isolation and the exact public URL before submitting it to judges. Do not call the release complete before these real-service checks pass.

## Judge flow

1. Landing page → Create account → verify email → onboarding.
2. Open Path4U AI, enable Gemini sharing and select **Build My Roadmap**.
3. Review the cybersecurity plan → **Save & open roadmap** → expand a phase → follow a course link or its free alternative.
4. Mark a lesson → **Save roadmap** → reload to demonstrate persistence.
5. Ask `Build a 6-month AI engineering roadmap with 10 study hours per week.`

Without the service configuration, **Try Free Demo** demonstrates navigation, checked course links, editable guided templates and browser-local progress. It cannot create real accounts, perform live research, or generate AI explanations. Do not present it as the completed live AI demonstration.
