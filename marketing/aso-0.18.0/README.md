# Cutaway — production ASO package

Status: **LOCAL PREPARATION ONLY. NOT UPLOADED OR PUBLISHED.**

## Upload package

- `en-US/`: eight ordered phone screenshots, feature graphic, app icon and text.
- `id/`: the same eight feature stories with Indonesian UI and marketing copy.
- `listing.json`: canonical localized metadata, release notes and captions.
- `preview.html` / `contact-sheet.png`: review all assets together.
- `captures/`: unaltered screenshots of the actual locally exported app.
- `source/`: generated icon and banner masters, preserved for reproducible export.
- `asset-manifest.json`: capture lineage and dimensions.

The eight screenshot stories are exploration, exploded components, hidden
layers, moving mechanisms, component explanations, step-by-step stories,
quizzes, and the searchable bilingual library. Artwork comes from the built-in
image generation tool. Screenshot UI and 3D models are rendered by the real
app, not generated. Captures use the web renderer; native ad fill and Android
system UI are not demonstrated by these images.

## ASO choices

Retain the Cutaway brand and clearly state the learning intent in the title.
Use relevant phrases naturally: interactive 3D models, how things work,
machines, anatomy, aerospace, components and quizzes; use natural Indonesian
equivalents in the Indonesian listing. No ranking claims, false functionality,
keyword lists, misleading ratings or guaranteed download improvements.
Search-volume data was not available; this package optimizes relevance and
clarity, not a guaranteed ranking position.

## Release safeguards

1. Restore browser control and inspect the current app/production-access state.
2. Check that version code 23 is unused before uploading the new signed AAB.
3. Confirm current privacy-policy URL and declarations still match actual SDK use.
4. Upload localized title/descriptions and replace all eight phone screenshots,
   the feature graphic, and the store icon for each locale.
5. Retain legitimate existing country, pricing and audience settings.
6. Upload the new AAB to Production only if that track is enabled. Do not invent
   tester feedback or answers to production-access application questions.
7. Inspect the complete change list; publish only this requested release and
   ASO revision, not unrelated pending changes.
8. Submit for review and verify the returned status. Do not equate submission
   with availability on Google Play.

No changes to Play Console were possible in this turn: both available browser
control entry points failed to initialize their local runtime. Reconnecting the
browser/desktop session is required before upload and publication can resume.

## Rebuild

`npm run build:brand` exports the versioned icon into app/adaptive/splash formats.
`node tools/aso-capture.mjs` captures a fresh local web export.
`node tools/build-aso-assets.mjs` exports the complete bilingual asset package.
`node tools/premium-brand-test.mjs` checks icon dimensions, opacity, safe areas,
and deterministic output. `node tools/verify-aso-assets.mjs` checks store limits.

Google references checked on 12 September 2026:

- [Preview asset requirements](https://support.google.com/googleplay/android-developer/answer/9866151?hl=en-GB)
- [Metadata policy](https://support.google.com/googleplay/android-developer/answer/9898842?hl=en-GB)
- [Production-access testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en-GB)
