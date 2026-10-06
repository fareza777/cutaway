# Cutaway 0.13 Catalog, Localization, and Branding Design

## Objective

Ship one cohesive Cutaway release that adds three realistic educational objects, gives every object a distinct high-quality catalog icon, makes the entire application read naturally in Bahasa Indonesia, and replaces the current launcher icon with a memorable cutaway mark.

The release target is version `0.13.0`, Android version code `17`, with 26 total objects.

## Scope

### New objects

The new set deliberately covers three familiar mechanisms with different visual and teaching strengths:

1. **Automatic mechanical watch** (`mechanical-watch`, Mechanical): a conventional round wristwatch with case, crystal, dial, hands, crown, automatic winding rotor, mainspring barrel, gear train, escapement, balance assembly, bridges, and caseback. The animation must show gear rotation, hand ratios, balance oscillation, and rotor movement without implying impossible connections.
2. **Cordless drill** (`cordless-drill`, Mechanical): a recognizable pistol-grip drill with split housing, trigger, direction switch, brushless motor, cooling fan, two-stage planetary reduction, clutch, spindle, chuck and jaws, LED, battery cells, and battery-management board. The walkthrough follows electrical energy from the pack to torque at the bit.
3. **Cyclonic vacuum cleaner** (`cyclonic-vacuum`, Appliances): a compact bagless canister vacuum with hose inlet, dust bin, cyclone cone, shroud, pre-motor filter, motor, impeller, exhaust filter, seals, cord reel, controls, and wheels. The walkthrough follows dirty air through separation, filtration, and exhaust.

Each object must have:

- a familiar, proportionally believable silhouette at the default app camera;
- 15–24 named teaching parts with stable mesh names;
- 5–7 walkthrough steps that explain a complete operating cycle;
- 6–8 quiz questions covering identification and mechanism reasoning;
- English source content and a complete Indonesian overlay;
- differentiated plastic, metal, rubber, glass, and electronic materials;
- a deterministic procedural recipe and production GLB under the existing mobile performance envelope;
- five standard dark review renders, including the app and rear views;
- a quality-contract test that opens the production GLB rather than trusting only the recipe.

## Catalog icon system

The current `ObjectGlyph` repeats one abstract motif for every object in a category. It will be replaced with a unique image for each object.

Icons will be rendered from the actual shipped GLB, not invented separately. This guarantees that the catalog preview matches the object users open and avoids hallucinated product shapes.

### Rendering contract

- One `256×256` PNG per object at `assets/object-icons/<id>.png`.
- Transparent outer background with a tightly framed three-quarter model view.
- The same app lighting, rest rotation, tone mapping, and material rendering as the explorer.
- A subtle object-accent rim/glow may be added by the card, not baked into the image.
- No labels, logos, floor plane, cast shadow, or decorative background scene.
- Opaque-pixel bounds must occupy 62–88% of each dimension so every icon has comparable visual weight.
- The icon must remain legible at the approximately 100 px size used by a library card.

The registry will statically require each PNG alongside its JSON and GLB so Metro bundles every icon and TypeScript makes missing icon registrations visible. The card continues to use the object accent for its frame and background.

## Indonesian localization

Selecting Bahasa Indonesia must switch every user-facing sentence, including catalog metadata, part names and explanations, walkthroughs, quiz prompts/options/explanations, scales, categories, accessibility labels, onboarding, settings, saved parts, and explorer controls.

### Coverage contract

- All 26 English object files must have a corresponding `content/id/<id>.json` overlay.
- Every overlay must contain `title`, `subtitle`, `summary`, and `scale` when the English source has a scale.
- Every non-hidden and hidden part must contain `name`, `short`, and `detail`.
- Step and quiz arrays must exactly match the English source lengths.
- Every step must contain `title` and `body`.
- Every quiz item must contain `prompt`; choice questions must translate every choice and any explanation.
- The registry must attach the Indonesian overlay for every entry. No object may silently fall back to English when locale `id` is active.
- Validation failures, not warnings, enforce missing files or fields.

### Writing standard

Indonesian copy is rewritten for Indonesian readers rather than translated word-for-word. It uses direct modern sentences, everyday terms where they are more natural (`kulkas`, `freezer`, `bor`, `filter HEPA`), and introduces technical terms in context instead of replacing them with obscure calques. It avoids English syntax, unnecessary passive voice, literary pronouns for objects, and metaphors that sound unnatural in Indonesian.

Terminology must remain consistent across objects and UI. Examples: `kumparan`, `poros`, `roda gigi`, `bantalan`, `cangkang`, `papan kontrol`, `daya`, `panas`, `tekanan`, and `aliran udara`. Decimal scales use Indonesian commas. Sentences must be concise enough for mobile sheets without removing the mechanism being taught.

The existing refrigerator overlay is rewritten in full; awkward phrases such as literal “heat uphill,” “the squeeze,” or an inanimate “dia” are replaced with clear explanations of compression, heat transfer, and pressure change.

## Application icon and brand assets

The existing sliced circle is replaced by an original isometric cutaway mark: a compact dark outer shell with one corner removed to reveal three nested structural layers and a warm orange core. It must read as “an object opened to reveal how it works,” not as a pie chart, camera shutter, or generic letter.

### Brand contract

- No text, initials, gradients that disappear at small sizes, fine outlines, or borrowed brand shapes.
- Strong asymmetric silhouette that is recognizable at 48 px.
- Core palette stays compatible with the app: near-black navy, cool light shell, restrained steel blue, warm orange, and coral only as a small focal point.
- `icon.png` is opaque and full bleed at `1024×1024`.
- Android adaptive foreground is transparent, centered inside the safe middle two-thirds, and paired with a solid background asset.
- Android monochrome is a true single-color alpha mask derived from the mark silhouette.
- Splash and favicon use the same mark, not independent artwork.

Image generation may be used to explore the app-mark form. Final shipping assets must be cleaned, centered, safe-zone checked, and converted into deterministic foreground/background/monochrome variants.

## Integration and data flow

`src/content/registry.ts` remains the static bundling boundary. Each entry owns a source document, GLB module, icon module, and required Indonesian overlay. `getLibrary(locale)` returns localized text plus the icon module. Explorer screens continue to fetch the localized full document by ID.

The English JSON remains the structural source of truth: IDs, mesh nodes, layers, focus lists, motions, and correct quiz indices never live in translation files. Indonesian overlays contain prose only.

## Testing and review

Automated checks must prove:

- TypeScript compilation succeeds.
- All 26 English documents match production GLB mesh contracts.
- All 26 Indonesian overlays are structurally complete and registered.
- Switching locale changes every representative UI and content field without mutating structural IDs or quiz answers.
- All 26 icon files exist, are square PNGs with alpha, meet size/coverage limits, and are registered.
- Each new object passes a dedicated production-GLB geometry/material/semantic contract.
- Existing engine smoke tests still pass.
- Release APK contains all 26 current GLBs and all 26 icons, uses only `arm64-v8a`, and has valid signing.

Visual review is mandatory for every new object in app, front, side, rear, exploded, peeled, and cut states. The three objects are iterated until their closed silhouettes are immediately recognizable and no outer shell hides the intended opening view. Catalog icons are reviewed together as a contact sheet to catch inconsistent scale, crop, or lighting. App assets are reviewed at 1024, adaptive-mask previews, and 48 px.

## Delivery

The work lands as focused commits for localization contracts, each new object, Indonesian content batches, object icons, and app branding. A verified `0.13.0` ARM64 APK is produced after the final source commit. Generated diagnostics and rejected visual variants remain ignored; production GLBs, final catalog icons, final brand assets, and standard review renders are tracked.

## Non-goals

- Adding a third language.
- Replacing the current lightweight i18n store with a dependency.
- Using live GL contexts inside every catalog card.
- Shipping AI-invented object thumbnails that disagree with the 3D models.
- Reworking unrelated existing 3D geometry unless a catalog render exposes a critical presentation defect.
