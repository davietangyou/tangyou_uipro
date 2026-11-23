# Authentication artwork

- `verification-source.png`: the user's supplied `ChatGPT Image 2026年9月21日 00_23_40.png`, 1448 × 1086. `auth.css` displays only source rectangle `(1100,258)–(1280,418)` at 176px wide. The original raster stays intact: the screen's text, logo, device chrome and corner foliage are outside this viewport. This deliberately retains the exact envelope, circle and leaves rather than a generated approximation.
- `google.svg`: Iconify `logos/google-icon`, https://api.iconify.design/logos/google-icon.svg. Google's multicolour brand mark, used to identify the unavailable Google sign-in entry.
- `apple.svg`: Iconify `simple-icons/apple`, https://api.iconify.design/simple-icons/apple.svg. Apple's brand mark, used to identify the unavailable Apple sign-in entry.
- Standard controls use the existing Lucide library (`Mail`, `UserRound`, `LockKeyhole`, `EyeOff`, `ChevronLeft`, `X`).

An initial built-in ImageGen extraction was inspected and rejected for a thicker envelope stroke and oversized transparent margins. Two subsequent refinement attempts failed with a network error. The generated alternative remains only in ignored `output/auth-qa/verification-generated.png` and is not bundled.

ImageGen prompt: isolate the rightmost screen's central verification illustration; preserve the sage circular background, white green-outlined envelope, watercolor leaves on both sides and two upper-right accent strokes; remove the UI, phones, text, logos and corner foliage; transparent PNG, compact 180:155 composition, original colours and proportions, no redesign. Refinement requested an envelope stroke roughly half as thick and lighter, smaller leaves. Built-in tool used; no external API/CLI fallback.
