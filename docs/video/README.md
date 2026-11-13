# Path4U workflow video

[Video](path4u-workflow.mp4) · [Poster](path4u-workflow.jpg) · [English subtitles: SRT](path4u-workflow.srt) · [VTT](path4u-workflow.vtt)

A 94.93-second, 1920×1080, 30fps interface walkthrough with narration and baked subtitles. It covers discovery, the assistant, roadmaps, a saved flowchart, mind maps, local resume review and preparation notes.

The video uses actual interface captures and fictional personal data. It is an edited walkthrough rather than an uninterrupted screen recording. The AI/quota improvements shown were verified on protected Preview; the public demo remains an earlier build. See [current limitations](../../README.md#demo-limitations-and-known-issues).

## Editable files

`scenes.json` contains narration and chapter timings. `composition/` contains the HTML scenes, screen captures, fonts and audio. `scripts/build-composition.mjs` rebuilds the composition and captions.

To render locally, use Node.js 22+, Chrome, FFmpeg/FFprobe and Hyperframes:

```sh
node scripts/build-composition.mjs
hyperframes check composition --json
hyperframes render composition --quality delivery --output path4u-workflow.mp4
```

## Credits and licences

- Product UI and logo: Path4U.
- Composition tools: [Brag](https://github.com/latent-spaces/brag) and [Hyperframes](https://github.com/heygen-com/hyperframes).
- Narration: [Kokoro](https://github.com/thewh1teagle/kokoro-onnx), `af_heart`.
- **Music: Sascha Ende, ende.app (CC BY 4.0)** — “Happy Beats / Business Moves Vol. 12”, [ende.app](https://ende.app/en), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Mixed under narration and faded at the end. Preserve this attribution when sharing the music.
- Inter and Space Grotesk: SIL Open Font License; included licence texts apply.
- GSAP retains its upstream copyright/licence header and [Standard License](https://gsap.com/standard-license/).

Original providers retain rights in listing text shown incidentally in the captures.
