# Resume validation and sidebar review

Implemented and deployed after the user explicitly approved deployment. Production deployment dpl_DuUvQ4avbZtumvQvX93ThST7XUUb reached READY on 2026-11-11 at https://openpath-ai-demo-03531.vercel.app/. No Supabase, Gemini, Vercel configuration, Back button, saved user record or roadmap was changed.

## Rules

Required: actual name, formatted email, education (qualification and institution), technical skills, and target role. Name validation accepts Unicode, mononyms, spaces, apostrophes and hyphens, and rejects obvious placeholder labels. Optional phone accepts 7–15 digits with international prefix and common separators. URL checks require HTTP(S), reject credentials and malformed hosts, and verify LinkedIn/GitHub domains including legitimate subdomains. Skills reject empty entries and case-normalized duplicates.

Work, internships, projects and certifications remain optional. Supplied entries use the displayed format: Role | Organization | Description; Project title | Description; Certificate | Issuer. Education uses Qualification | Institution. One entry per line; optional dates use YYYY-MM to YYYY-MM or Present. Parsed ISO date ranges reject invalid dates and reverse chronology. This is format/completeness validation, not credential, phone ownership or identity verification. Arbitrary natural-language date text is not a verified date range. Existing saved documents are not rewritten.

Inline errors appear on blur or Continue/Build, clear on correction and preserve inputs. The first invalid field receives focus, including returning to the appropriate wizard step. Progress counts only required fields. Required markers are visually present and exposed accessibly without changing field names.

Generation uses the shared validator in browser and buildResume on the server. The server career tool asks for missing/invalid information instead of generating an incomplete document. Resume Studio exports validate both form data and the current editable document, so deleting required content blocks PDF/Word output. Incomplete drafts can still be saved for later correction. Generic non-resume Draft Library documents retain their original export behavior.

## Navigation

Desktop expanded/collapsed rail and mobile drawer now order Dashboard, Atlas Index, Resume Studio, Field Tools, Account. Dashboard and Resume Studio were removed from their old grouped menus. Existing routes, active highlights, hover controls, remaining items and mobile quick-navigation bar remain intact. The shared content Back button is unchanged.

## Modified files

- shared/resumeValidation.mjs and shared/resumeValidation.d.mts: shared validation/completion/export rules.
- shared/resume.mjs and server/careerTools.mjs: server-side generation gate and missing-input response.
- src/ResumeStudio.tsx: field errors, progress, focus, required markers and export validation.
- src/DraftEditor.tsx: optional validation extension for Resume Studio exports; saving retained.
- src/Shell.tsx and src/styles.css: top-level navigation and compact rail labels.
- src/documents.css: scoped invalid borders.
- tests/resume-validation.test.mjs, tests/browser-resume-validation.mjs and tests/browser-navigation.mjs: validation, export and navigation checks.

## Verification

16 automated tests passed, including shared/server validation, optional sections, multilingual names, international phone formats, malformed URLs, duplicate skills and invalid/reversed date ranges. TypeScript checks and pnpm build passed. Existing deferred PDF chunk warning remains. Strict UI audit passed without findings.

Chrome checks passed actual PDF/DOCX downloads, current-document export blocking, errors/corrections/focus/progress, preserved inputs, saved drafts, independent Atlas Index and Field Tools menus, unique top-level links, refresh, mobile layout and unchanged Back placement. Additional navigation/authenticated-roadmap regression checks are run with host-supplied Playwright; external auth/AI providers use test fixtures.

Design/behavior documentation was also updated in DESIGN.md and UX-CONTRACT.md. The first broad navigation run found that new helper/error text changed a field's accessible label; explicit stable labels corrected that regression. Final navigation and resume browser checks passed, including the unchanged Back control.

No new failures are known in the tested workflows. Existing production email/AI/demo backend configuration was not modified or revalidated in this task. ISO ranges and Present use Malaysia calendar time; naturally written dates outside the displayed format are not semantically verified. The existing deferred PDF bundle-size warning remains non-blocking.

Post-deployment Chrome checks passed on the public production URL: required/optional rules, international contact fields, corrections/focus/progress, real PDF/DOCX downloads, edited-document export protection, browser demo draft persistence, unique top-level navigation, refresh, mobile reflow and unchanged Back placement. No live identity-provider or AI-provider quality claim is made by these UI checks.
