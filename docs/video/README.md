# Path4U narrated workflow

[Watch or download the MP4](path4u-workflow.mp4) · [Poster](path4u-workflow.jpg) · [English SRT](path4u-workflow.srt) · [English VTT](path4u-workflow.vtt)

A **94.93-second, 1920×1080, 30fps** edited interface walkthrough. Includes a local AI voice, baked English subtitles, matching sidecar captions, quiet background music, original Path4U branding and an editable Hyperframes composition.

## What the walkthrough shows

| Start | Chapter |
| --- | --- |
| 0 s | Your future. Your path. |
| 6.8 s | Discover and compare |
| 17.03 s | Ask Path4U AI |
| 25.87 s | Build a learning roadmap |
| 38.23 s | Save and follow the path |
| 48.83 s | Explore the branches |
| 58.77 s | Keep resume work local |
| 71.87 s | Review before you submit |
| 83.1 s | A fair daily AI allowance |

The walkthrough shows guest entry and source-backed opportunities, a live Gemini answer, a cybersecurity roadmap, the saved plan's flowchart view, Gemini mind-map branches, local sample-resume review, saved preparation notes and daily AI fair use.

## Capture and verification

The product captures came from the actual protected quota-repair Preview. Chat, roadmap and mind-map generation each returned HTTP 200 with nonblank Gemini output; the four-interaction balance fell 4 → 3 → 2 → 1. Saving/opening the flowchart reused the saved plan. The resume-score image was recaptured from the same application locally using its built-in fictional sample, without a Gemini request. Discovery was captured after its source-backed listings loaded. No real user resume, credentials, access tokens or private account records appear.

This is an edited sequence of actual interface images with narration, **not an uninterrupted screen recording**. It demonstrates the reviewed actions; it is not a claim that every visible feature is a live external integration. Public account actions remain Coming Soon. Calendar writes, paid search grounding, private free-tier resume processing and automatic job submissions are not demonstrated or claimed.

The quota repair was verified on protected Preview; Production was not promoted by this video or repository upload. See [the quota review](../../AI_QUOTA_REVIEW.md) for exact behavior and known limitations.

## Files and editing

- `path4u-workflow.mp4`: H.264 video with AAC audio and baked captions; poster baked into frame zero.
- `path4u-workflow.jpg`: settled opening poster for sharing.
- `.srt` / `.vtt`: scene-level captions covering the exact narration text.
- `scenes.json`: narration text, measured voice lengths, chapter starts and scene lengths.
- `composition/`: editable HTML scenes, original screen captures, local fonts, narration WAVs, music and required animation runtime.
- `scripts/build-composition.mjs`: rebuilds HTML scenes and caption files from the supplied inputs.
- `brag-plan.md` and `composition-brief.md`: creative direction, privacy constraints and capture notes.

To edit, install Node.js 22+, FFmpeg/FFprobe, Chrome and Hyperframes separately from the website project. This render used **Hyperframes 0.9.34**; 0.9.39 was available during creation, but the renderer was not upgraded mid-run. Brag was installed from [latent-spaces/brag](https://github.com/latent-spaces/brag). Local Kokoro narration used Python 3.12, `kokoro-onnx` and `soundfile`, with the `af_heart` voice. No paid voice API, cloud render or Gemini quota was used for narration.

From this directory:

```sh
node scripts/build-composition.mjs
hyperframes check composition --json
hyperframes preview composition --no-open
hyperframes render composition --quality delivery --output path4u-workflow.mp4
```

Use `HYPERFRAMES_BROWSER_PATH` for an existing Chrome binary and `HYPERFRAMES_CACHE_DIR` for a writable local cache if necessary. The composition references local assets; it does not fetch live site data or credentials when rendering. Regenerating narration requires a free local Kokoro model download; do not add an AI key to these files.

The walkthrough is longer than Brag's default launch clip because the user requested a full explained workflow. Visual gates passed with zero lint, runtime, layout, contrast, craft and audio findings, with 20 actual text contrast checks. Decoded final frames and audio/duration were checked before delivery.

## Credits and licences

- Product UI, logo and copy: Path4U.
- Workflow tooling: [Brag](https://github.com/latent-spaces/brag) and [Hyperframes](https://github.com/heygen-com/hyperframes).
- AI voice: local [Kokoro / kokoro-onnx](https://github.com/thewh1teagle/kokoro-onnx), `af_heart`. Model weights are not included.
- **Music: Sascha Ende, ende.app (CC BY 4.0)** — “Happy Beats / Business Moves Vol. 12”, from [ende.app](https://ende.app/en), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Mixed quietly under narration and faded at the end. Keep this attribution if sharing or re-editing the music.
- Inter and Space Grotesk: SIL Open Font License; licence texts are included.
- GSAP 3.15.0 runtime retains its upstream copyright/licence header; [GSAP Standard License](https://gsap.com/standard-license/).

Original providers retain rights in source opportunity text shown incidentally in the product capture. Verify availability and deadlines on the linked organizer pages.
