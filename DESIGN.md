---
version: alpha
name: Path4U
description: A monochrome workspace for finding opportunities and planning career moves.
colors:
  background: "#080808"
  primary: "#FFFFFF"
  secondary: "#B8B8B8"
  surface: "#111111"
  text: "#FFFFFF"
  muted: "#B8B8B8"
typography:
  display:
    fontFamily: "Space Grotesk Variable, Inter Variable, system-ui, sans-serif"
  sans:
    fontFamily: "Inter Variable, system-ui, sans-serif"
  mono:
    fontFamily: "ui-monospace, monospace"
rounded:
  control: "0.65rem"
  panel: "1rem"
components:
  button: {}
  card: {}
  dialog: {}
---

# Path4U design system

Path4U helps students and early-career professionals discover opportunities, plan what to learn, and track work. Keep the terminology short and consistent across landing, account, and workspace screens.

- Space Grotesk carries headlines, Inter handles reading and controls, and monospace is reserved for sequence markers and dates.
- CSS custom properties in `src/styles.css` own the runtime palette and spacing. The public landing stays dark. Workspace settings offer a monochrome light theme. Calendar dots pair a small category accent with a text label.
- The compact P mark uses two continuous curves and a right-facing arrow. The editable symbol, wordmark, favicon, and install icons share the same geometry. Use the light and dark SVGs for contrast and pair the mark with the Path4U wordmark.
- Concentric rings on the landing page, account page, and roadmap card provide depth. Use restrained blur with an opaque fallback and keep every content panel readable over its background.
- The workspace uses a narrow desktop rail with hover menus and a mobile drawer. Authentication actions sit below the navigation. The assistant keeps its composer visible and gives chat history its own scroll area. The draft editor pairs editing controls with a light page preview. The document owns scrolling. The assistant and dialogs scroll internally.
- Show demo and provider states explicitly. Reserve success feedback for actions the server or browser storage confirmed. Respect reduced motion and visible keyboard focus.

- Course recommendations reuse shared panels, buttons and text links. Roadmap phases retain the existing road sequence, expand with native details, and reveal labeled lesson checklists and original-provider course cards. Search attribution is shown in its own sandboxed provider surface.

- Page-level Back sits above the title, aligned with the content edge. It reuses neutral ghost-button tokens and a small left arrow; hover moves the arrow by two pixels, disabled under reduced motion. Sidebar and header navigation stay unchanged.

- Resume validation retains monochrome controls and adds scoped muted-red invalid borders (#cf7070), paired with text errors. Required markers, progress and helper formats reuse the existing form typography. Dashboard and Resume Studio are direct rail/drawer destinations; grouped tools keep the existing hover/focus behavior.

- Resume Rater retains the existing layout and uses the exact Path4U Resume Quality Score label. Each of five deterministic categories includes its weight, explanation and expandable verbatim evidence. Career stage uses the existing native select; private AI controls appear only when an approved arrangement is configured.

- Temporary cloud-storage trials display their expiry in the shared workspace notice. Demo chat distinguishes live Gemini from deliberately guided mode; a failed live connection never silently selects guided output.

- The repaired judging Preview uses durable Supabase storage. Temporary-expiry notices apply only to older Redis-backed Previews. Discover retains the existing monochrome panels, type and controls while presenting live provenance, explicit registration status, the three required category tabs and native deadline filtering.

- Hackathon entry keeps the existing monochrome hero and uses one larger white demo action with a restrained 3.6-second breathing shadow; reduced motion removes it. Account actions use shared disabled native buttons with lock icons and Coming Soon labels. Public landing variables stay dark independently of the workspace theme.

- The shared demo balance labels live usage as AI interactions and explains the 08:00 Malaysia reset. Roadmap and mind-map forms distinguish live Gemini output from guided suggestions; generation and saving remain separate.
