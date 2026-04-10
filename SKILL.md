---
name: ads-gen
description: End-to-end AI commercial/ad production pipeline. Takes a creative brief through strategy, copy, storyboard, brand-aware visual production, video, sound, and final 16:9 master. Built on the short-film-gen pipeline but governed by a fundamentally different video prompting philosophy — compound-action clips, in-clip transformations, film shot vocabulary, stylized metaphor, and multi-tool routing (Kling for realism, Dreamina for transformation). If you use this skill with short-film-gen's restrained one-scene-per-clip voice, you will produce a boring ad. Read "THE FUNDAMENTAL PHILOSOPHY DIFFERENCE" section before writing any prompt. Use for ads, commercials, brand films, product launch videos, social spots.
---

# AI Ads Generator

World-class-agency-standard end-to-end pipeline for producing commercials using AI. Follows professional ad agency workflow: brief → strategy → concept/copy → pre-production → visual production → picture lock → audio post → final master.

**Fixed output format (v1):** 16:9 master only. Multi-aspect variants (9:16, 1:1, 4:5) are out of scope for now.

**This skill is a fork of `short-film-gen`.** The underlying pipeline — Kling waves of 5, Gemini draft → Gemini API watermark-free pipeline, /production-consistency, Cinematographer Agent, picture-lock workflow, QC gates, frame-accurate audio, generative music (Minimax/ElevenLabs) — is **unchanged**. What differs is the front of the pipeline (brief instead of free-form concept), the creative team (Creative Strategist + Copywriter + Art Director alongside the Screenwriter), the Hook Lab, and ads-specific QC (Brand + Hook). Any section below not explicitly re-scoped for ads behaves identically to short-film-gen — follow it as-is.

## When This Skill Activates

Use this skill when the user wants to:
- Produce an ad, commercial, or brand film from a brief or product description
- Create a product launch video, demo, or explainer spot
- Build a scroll-stopping social spot with a strong hook and brand presence
- Generate a storyboarded commercial with consistent product, brand, talent, and sound

## Setup Requirements

### API Keys (check at start)
```bash
echo "KLING_ACCESS: $(echo $KLING_ACCESS_KEY | head -c 10)"
echo "KLING_SECRET: $(echo $KLING_SECRET_KEY | head -c 10)"
echo "MINIMAX: $(echo $MINIMAX_API_KEY | head -c 10)"
echo "ELEVENLABS: $(echo $ELEVENLABS_API_KEY | head -c 10)"
echo "GEMINI: $(echo $GEMINI_API_KEY | head -c 10)"
echo "HUME: $(echo $HUME_API_KEY | head -c 10)"
echo "SYNC: $(echo $SYNC_API_KEY | head -c 10)"
echo "EPIDEMIC: $(echo $EPIDEMIC_SOUND_API_KEY | head -c 10)"
```

| Key | Required For | Get It |
|-----|-------------|--------|
| `KLING_ACCESS_KEY` + `KLING_SECRET_KEY` | Video clips, lip sync (two-part JWT auth) | [platform.klingai.com](https://platform.klingai.com) |
| `MINIMAX_API_KEY` | Music (5-min scores), TTS fallback | [platform.minimax.io](https://platform.minimax.io) |
| `ELEVENLABS_API_KEY` | TTS dialogue, SFX, music (primary audio provider) | [elevenlabs.io](https://elevenlabs.io) |
| `GEMINI_API_KEY` | Watermark-free storyboard images | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| `HUME_API_KEY` | Emotional TTS dialogue (primary, semantic emotion) | [platform.hume.ai](https://platform.hume.ai) |
| `SYNC_API_KEY` | High-quality lipsync (primary, replaces Kling lipsync) | [sync.so](https://sync.so) |
| `EPIDEMIC_SOUND_API_KEY` | Professional SFX library (supplementary) | [developers.epidemicsound.com](https://developers.epidemicsound.com) |

### Tools
- `ffmpeg` / `ffprobe`: `brew install ffmpeg`
- Node.js scripts: `~/.claude/skills/ads-gen/scripts/tools/kling-video.js`, `~/.claude/skills/ads-gen/scripts/tools/minimax-audio.js`
- Gemini API: `~/.claude/skills/ads-gen/scripts/tools/gemini-api.js`
- Gemini Web (drafting only): `~/.claude/skills/ads-gen/scripts/tools/gemini-upload.js`

---

## ADS-GEN SCOPE OVERRIDES (read before anything else)

These overrides apply across every phase of this skill. Where they conflict with text inherited from short-film-gen, **these win**.

1. **Aspect ratio is locked at 16:9.** Every storyboard frame, every Kling clip, every render, and the final master is 16:9. Never ask the user for aspect ratio. Never generate 9:16 / 1:1 / 4:5 variants. If a frame or clip comes back non-16:9, it is a FATAL QC failure and must be regenerated.
2. **The "story" is a brief, not a screenplay.** The Screenwriter Agent still writes a tight narrative script, but it is *in service of* the brief: single-minded proposition, product-as-protagonist, and a CTA at the end. "Emotional arc" is replaced by "behavior change arc": viewer walks in skeptical → walks out wanting the product.
3. **The product is a main character.** Treat the product with the same consistency rigor as human characters: product reference sheet, Kling elements where possible, product visibility tracked per frame in storyboard.json. A frame without the product on-screen must be justified.
4. **The first 1.5s is sacred.** Scroll-stop hook. See the Hook Lab (Phase 1.7) below.
5. **No compliance, legal, licensing, or multi-platform work.** Explicitly descoped for v1. Don't insert claim QC, caption burn-in, LUFS-per-platform, or license manifests. Music continues to use the existing generative pipeline (Minimax/ElevenLabs) — no Epidemic Sound integration.
6. **Every creative/QC agent defined in short-film-gen still runs.** Ads-gen adds agents; it does not remove any. In particular: /production-consistency, Cinematographer Agent, Storyboard Continuity QC, Video Clip Quality QC, Audio Cue QC, Mix QC — all mandatory.
7. **One clip ≠ one scene.** This is the single biggest philosophical override — see the next section. Short-film-gen thinks "one clip = one shot = one camera move". Ads-gen thinks "one clip = a compound sequence with transformation, speed ramps, and in-clip transitions". If you inherit short-film-gen's restrained one-scene-per-clip mental model into an ads production, you will waste the generative video model's capability and produce an ad that looks like a slow film.

---

## ██ THE FUNDAMENTAL PHILOSOPHY DIFFERENCE ██
## (Ads vs Short Films — read this before writing a single Kling prompt)

**This section overrides every Kling / Dreamina / video-model prompt guidance inherited from short-film-gen. If the inherited text says "one shot, one camera move, one scene", ignore it for ads. Ads are built differently.**

### The core insight

A short film unfolds. An ad *seizes*. You have 45 seconds to stop a thumb, sell an insight, make someone feel something, and deliver a brand mark — and the model on the other side of the API is not a restrained documentary camera. It is a **compound-action engine** capable of transformation, in-clip scene changes, speed ramps, metaphorical morphs, and 360 product reveals inside a single 5-second generation. Short-film-gen's "one scene per clip, naturalistic motion, observational camera" philosophy is correct for cinema and catastrophically under-powered for ads.

**The rule:** If your Kling prompt for an ad shot could be delivered to a DP and shot on a real set in one take, you are under-prompting. Ads use the generative model's ability to do things a real camera *can't* — because that is the only reason to use generative video for ads in the first place.

### The "compound clip" framework

An ad clip is a **sequence**, not a scene. A single 5-second Kling generation should often contain:

1. A **micro establishing beat** (0.0–0.8s) — an extreme detail, a texture, a still object
2. A **transformation or transition** (0.8–2.5s) — the detail changes state, dissolves, morphs, or transports to a new location
3. A **payoff** (2.5–5.0s) — the product in its final hero context, with speed-ramp motion or a camera reveal

Think of each clip as a **shot list inside a shot**. One clip can legitimately do the work of three or four short-film shots. The model is trained on ad footage and responds to this compound vocabulary.

### The film-industry shot vocabulary the models are trained on

Use these terms explicitly in prompts — they are learned tokens from real ad/commercial footage in the training data. Bare descriptive language ("the shoe is on the ground") leaves capability on the table. Shot-list vocabulary unlocks it.

| Term | What it means | Use when |
|---|---|---|
| **Detail macro** | Extreme close-up on texture/material at the start of a sequence | Opening any compound clip |
| **360 hero shot** | Camera orbits the product 360° showing all sides | Product reveal, finale, hero inserts |
| **Speed ramp** | Variable playback — real-time → slow-mo → real-time, within one clip | Action moments, impact beats, hero reveals |
| **Rack focus** | Pull focus from foreground to background element | Introducing a new subject inside the same frame |
| **Whip pan transition** | Fast directional blur between two scenes | Compound clips transitioning between locations |
| **Match cut** | Cut on a shape/motion that carries across scenes | Transformation transitions inside a clip |
| **Push through** | Aggressive dolly-in that passes the subject | Dramatic reveal behind/beyond the subject |
| **Dolly zoom / Vertigo** | Dolly in + zoom out (or vice versa) — warps perspective | Emotional peaks, psychological moments |
| **Morph transition** | One object transforms into another | Metaphorical imagery, product-as-X |
| **Crash zoom** | Sudden zoom in on action peak | Impact moments |
| **Pull back reveal** | Starts on detail, pulls back to show full context | Context reveal, scale shots |
| **Crane up** | Camera rises revealing environment | Scale, arrival, resolution |
| **Time-lapse compression** | Environment changes (day→night, weather, crowd) | Passage of time in one clip |
| **Slow-mo crown** | Slow-motion water droplet / particle crown | Impact payoffs, physicality proof |

Include **one of these terms per clip minimum**, preferably two or three stitched together. Example: *"Detail macro into 360 hero shot with speed ramp, crash zoom on impact, match cut to exterior street."*

### Stylized metaphor is encouraged, not avoided

Short-film-gen's instinct is naturalistic: "a running shoe on wet pavement". Ads-gen's instinct should be metaphorical: *"the running shoe transforms into a fire tornado as it strikes the pavement and resolves back to the real shoe mid-stride on the street"*. The model can do this. A real camera cannot. **That asymmetry is the only reason to use generative video for ads.**

Permitted and encouraged stylized elements:
- **Transformation** — product turns into fire, water, light, smoke, ink, shatter, particles, ribbons, then re-forms
- **Alive inanimate objects** — laces moving like snakes, fabric rippling on its own, surfaces breathing
- **Exaggerated physics** — water droplets suspended in mid-air, impact shockwaves visible, ground pulsing
- **Environment morph** — the floor becomes a running track, the wall becomes a city skyline, the desk dissolves into asphalt
- **Speed ramps at emotional peaks** — slow-mo on the action beat, snap back to real-time on the release
- **Particle systems** — sparks, embers, dust, rain, sand, glass shards surrounding the product
- **Light as a character** — rim lights that animate, god rays that pulse, sun flares that bloom on action

**Guardrail:** The product's shape, colorway, logo, and silhouette must remain recognizable AFTER the transformation. Metaphor is allowed; brand erasure is not. A shoe can become a fire tornado and come back, but when it comes back it must be unambiguously the same shoe with the same colorway and branding. The Brand Compliance QC agent enforces this on the last frame of every transformation clip.

### In-clip scene/location transitions

Ads routinely move through multiple locations inside a single clip. This is not a mistake — it's the most efficient use of a generation.

Pattern: `[Location A, detail] + transition verb + [Location B, payoff]`

Example prompts that work:
- *"Extreme macro of the product on a studio turntable, then whip pan transition to the same product on a wet city street at blue hour, a runner's foot entering frame."*
- *"Detail macro of the product in a matte black void, push through past the product revealing a dawn running track stretching to the horizon."*
- *"Golden hour office desk macro of the product, match cut on the silhouette to the same product on a rain-soaked street at blue hour, runner crossing frame."*

The model can handle 2–3 locations per clip reliably. More than 3 begins to degrade.

### Explicit body mechanics (anatomy anchoring)

Generative video models routinely mangle running gaits: missing legs, doubled legs, wrong foot lifted, arms out of sync, impossible joints. **Every clip containing a running human must include an explicit body-mechanics anchor.**

Required phrasing (add to every running/walking shot prompt):

> *"Make sure both legs are visible and in normal natural running form throughout the clip. Standard human running gait: heel-to-toe strike, alternating legs, arms swinging in counter-rhythm to the legs. No missing limbs, no overlapping legs, no impossible joint angles. Full anatomically correct running motion from first frame to last."*

This is a Kling/Dreamina pain point specifically — models trained on static imagery drift into broken anatomy under motion. Explicit instruction fixes it ~80% of the time. Combined with the `ref_images` face crop and character spec, it approaches 100%.

### Speed ramps and motion variability

Short-film-gen teaches "ALREADY in continuous motion, steady pace, no acceleration." That's correct for documentary realism. **Ads invert this rule.** Ads want:

- **Snap starts** — first frame is already at peak motion, zero cold-start
- **Speed ramps within the clip** — real-time → slow-mo on the action peak → snap back to real-time
- **Dynamic pacing** — a single clip can contain fast, slow, and fast again
- **Impact peaks** — one frame of the clip is the "hero" frame and the motion arcs toward and away from it

Prompt vocabulary:
> *"Starts at full real-time speed. At the action peak (~2 seconds in), speed ramp to 50% slow-motion for one second to emphasize the impact. Snaps back to real-time for the release."*

Kling V3 Pro and Dreamina both respect speed-ramp instructions. Use them.

### Tool routing — Kling vs Dreamina vs other

Different generative video models have different sweet spots. Route shots to the right tool.

| Tool | Best at | Weak at | Route to it for |
|---|---|---|---|
| **Kling V3 Pro** | Cinematic realism, human body mechanics, naturalistic lighting, product photography realism | Stylized transformations, fire/metaphor, aggressive in-clip scene changes | Realistic product heroes, character-driven shots, documentary beats, final beauty shots |
| **Dreamina** (ByteDance) | Stylized/surreal content, transformations, fire/water/particle effects, aggressive compound actions, metaphorical imagery | Strict product consistency across frames, photoreal skin | Pattern-interrupt hooks, transformation beats, stylized b-roll, energetic montages |
| **Runway Gen-4** | Controlled camera moves, specific directorial intent, editorial continuity | Raw physicality, impact beats | Interstitials, bridging shots, controlled camera moves |
| **Veo 3** | Photoreal human faces, natural dialogue, cinematic dramatic realism | Surreal stylization | Emotional character beats, face-dominant shots (if budget permits) |

**Default routing for ads-gen v1:**
- **Hook (Shot 01):** Dreamina (stylized, transformational, scroll-stop)
- **Product heroes (macro inserts):** Kling V3 Pro (realism) OR Dreamina (if transformation is desired)
- **Character-in-motion shots:** Kling V3 Pro + explicit body-mechanics anchor
- **Documentary/realistic beats:** Kling V3 Pro
- **Transformation / metaphor beats:** Dreamina
- **Final product finale:** Kling V3 Pro (clean beauty) OR Dreamina (360 hero with speed ramp)

The orchestrator should explicitly declare tool routing per frame in storyboard.json via a `video_tool` field: `"video_tool": "kling_v3_pro" | "dreamina" | "runway_gen4" | "veo3"`. Default is `kling_v3_pro` unless the frame is marked `is_hook_frame: true` or `needs_transformation: true`, in which case default is `dreamina`.

### The "under-prompting" anti-pattern

This is the single most common failure mode in ads-gen. Symptom: Kling clips come back looking restrained, documentary, and visually quiet when the ad needed to be aggressive. Root cause: the prompt was written in short-film-gen's observational voice.

**Under-prompting example (short-film-gen voice — WRONG for ads):**

> *"Extreme macro of a shoelace being pulled tight on a matte black ASICS running shoe at golden hour. Static locked off, 100mm macro. Warm amber highlights, crushed blacks, shallow DOF. Cinematic, intimate, restrained."*

This produces a beautiful but boring 5-second clip where almost nothing happens.

**Over-prompting for ads (compound action — CORRECT):**

> *"STORY CONTEXT: The opening 2 seconds of a premium running shoe ad. Pattern-interrupt hook.*
>
> *DETAIL MACRO into 360 HERO SHOT with SPEED RAMP. Starts as an extreme macro of the shoelace and brushed steel eyelet on a matte black ASICS shoe at golden hour — the lace is ALIVE like a snake, slowly tensioning itself. Over 1 second, the camera pushes aggressively forward and begins a 360 hero orbit around the shoe as the lace cinches tight. At the 1.5-second mark SPEED RAMP into slow-motion for 0.5 seconds as a crown of golden embers erupts around the shoe, then the shoe MORPHS briefly into a fire tornado outline. At 2.5 seconds, MATCH CUT on the silhouette to the same shoe now on wet blue-hour city asphalt, a runner's foot in frame mid-stride, water droplets crowning around the shoe from the impact. Camera pulls back to reveal the full running gait — both legs visible, natural human running form, heel-to-toe strike, arms swinging in counter-rhythm.*
>
> *MAKE SURE BOTH LEGS ARE VISIBLE AND IN NORMAL NATURAL RUNNING FORM THROUGHOUT. Standard human running gait, no missing limbs, no impossible joint angles.*
>
> *Golden hour warm amber on the studio half, cool blue-hour cyan with warm amber street lamp accents on the city half. The ASICS tiger stripes remain crisp and recognizable throughout the transformation — brand identity must survive the metaphor."*

This is a single 5-second clip that does the work of 4 short-film shots, contains a transformation, a speed ramp, an in-clip location change, an explicit body mechanics anchor, and a brand-continuity guardrail. **This is the ads-gen voice.**

### The prompt-writing checklist for every ads-gen Kling clip

Before submitting any clip generation, confirm the prompt contains:

- [ ] **Story context** — 1–2 sentences of what this clip does for the overall film
- [ ] **At least one shot-vocabulary term** from the glossary above (detail macro / 360 hero / speed ramp / match cut / etc.)
- [ ] **Compound action** — the clip does more than one thing (detail → transition → payoff ideally)
- [ ] **Explicit motion from frame 1** — "ALREADY in motion" or "starts at full speed" (no cold start)
- [ ] **Camera command in brackets** `[Dolly in]` `[Crash zoom]` `[Push through]` `[Orbit right]` etc.
- [ ] **Speed ramp instruction** if the clip has an action peak — explicit real-time → slow-mo → real-time
- [ ] **Body mechanics anchor** if the clip contains a human in locomotion — the standard phrasing above
- [ ] **Stylized element** if the shot is a hook, product hero, or transformation — fire, particles, morph, alive-inanimate, etc.
- [ ] **Brand continuity guardrail** — the product must remain recognizable after any transformation
- [ ] **Atmosphere & lighting** — matches the film's color arc for this beat
- [ ] **NO watermark, NO logo, NO text, NO sparkle icon** (still mandatory)

If fewer than 6 of these are present, the prompt is under-written and the clip will come back boring. Rewrite before submitting.

### The reference failure that prompted this section

In the ASICS "One Pair" production (`~/Desktop/asics_city_chase/`), the first pass of Kling clips used restrained short-film-gen-style prompts ("Static locked off, subtle settling of droplets over 2 seconds"). The results were beautiful but flat — they looked like a Nespresso ad from 2018, not a 2026 scroll-stop social spot. When the user provided a Dreamina reference clip using compound-action vocabulary ("detail macro → 360 hero → speed ramp → fire tornado → external runner"), the difference was immediate and undeniable: Dreamina's 5-second clip delivered more visual information, more attention-grab, and more brand energy than three of the Kling clips combined.

The learning, formalized: **ads require a different prompting philosophy than short films, and inheriting short-film-gen's prompt voice into ads-gen is the single biggest process failure this skill has to prevent.** This section exists specifically to prevent that failure on every future run.

---

## ██ THE SIGNATURE FRAMEWORK ██
## (What separates a beautiful ad from a memorable one — read after the philosophy section)

The previous section (Compound Action) is about **how each clip is generated**. This section is about **how the 45–60s film is unified across all clips into a single memorable signature**. They are different problems and both must be solved.

### The core insight, learned the hard way

Producing 14 individually-beautiful clips and concatenating them gives you a 45-second portfolio reel. It does not give you an ad anyone remembers. The ASICS "One Pair" production (`~/Desktop/asics_city_chase/`) and the HOKA "Bird's Eye" reference film, watched side by side, demonstrate the gap exactly:

- **ASICS "One Pair":** smart 3-act narrative, 11 different framings, no recurring formal device. Beautiful, defensible, forgettable. Reads as a thoughtful film student's portfolio.
- **HOKA "Bird's Eye" (2024, 60s, dir. for HOKA TV, music by Eamon):** ONE recurring visual idea — literal bird POV, FPV drone aerials, wing-blur on edges of frame — committed to for ~80% of the runtime. Tagline ("Fly Human Fly") is enacted by the camera itself, not narrated. **The audience pattern-matches the visual signature within 5 seconds and remembers it for years.**

The HOKA ad isn't better-shot than ASICS. It is better **decided**. It picked one big visual idea and refused to dilute it across the runtime. ASICS picked nothing.

**The rule:** Every ad must declare a Visual Signature in pre-production. Without it, you will produce 14 beautiful disconnected clips.

### The Five Dials of an Ad Signature

Every ad-gen production must explicitly set **all five dials** in `brief.json` before script generation. Skipping any one of these is the single most reliable way to produce a forgettable spot.

#### Dial 1 — Visual Conceit (the recurring formal device)

The single visual idea that recurs across ≥60% of shots. This is what the audience pattern-matches. Examples from the canon:

| Brand / Spot | Visual Conceit |
|---|---|
| HOKA "Bird's Eye" | Literal bird POV / FPV drone aerial in every shot |
| Apple "Shot on iPhone" | First-person POV from the device itself |
| Nike "You Can't Stop Us" | Split-screen match cuts across sports/race/gender |
| Old Spice "The Man Your Man" | Continuous one-take camera with impossible scene transitions |
| Adidas "Impossible is Nothing" | Monochrome athletic portraits with archival voice |
| Cadbury "Gorilla" | Static lock-off on a single subject for 90s, payoff is a drum solo |
| RedBull Stratos | First-person extreme-vertical POV |

In the brief, declare:

```json
"visual_conceit": {
  "name": "short tagline name for the conceit",
  "device": "the literal recurring formal element (POV / framing / motion / treatment)",
  "ubiquity_target_pct": 70,
  "rationale": "why this conceit serves the brief's single-minded proposition"
}
```

The Cinematographer agent reads this and is **forbidden from designing any shot that breaks the conceit** without flagging it as an exception with written justification. The Visual Conceit QC Agent (new — see below) verifies ≥60% of shots actually deliver the conceit before proceeding to Kling generation.

#### Dial 2 — Cinematography Toolset (the kit declaration)

Real ads are shot with one dominant cinematography toolset that creates a specific feel. Generative video must mimic the language of that toolset. Pick ONE primary toolset for the spot:

| Toolset | Visual signature | Generative prompt vocabulary | Best for |
|---|---|---|---|
| `static_observational` | Locked off on tripod, slow drifts, cinema verité | "static locked off, dead still, slow gentle drift, observational" | Premium quiet brands, documentary tone, ASICS-style restraint |
| `fpv_drone_aerial` | Banking aerials, low-altitude high-speed swoops, wing-blur edges | "FPV drone shot, banking aerial, low altitude high speed, swooping cinematic, wing-blur frame edges" | Sport/lifestyle, scale, freedom, HOKA-style energy |
| `handheld_documentary` | Chest-level micro-shake, intimate observational | "handheld micro-shake at chest level, documentary observational, natural breath" | Authenticity, real people, raw moments |
| `anamorphic_dolly` | Smooth dolly tracks, anamorphic lens flares, 2.39:1 letterbox feel | "smooth dolly tracking, anamorphic horizontal lens flares, 2.39:1 cinematic widescreen feel" | Premium auto, fashion, cinematic prestige |
| `macro_studio` | 100mm macro, controlled studio light, shallow DOF | "100mm macro, studio product lighting, shallow DOF, controlled key + rim" | Product launch, beauty, jewelry |
| `gopro_pov_action` | First-person chest mount, wide angle, fisheye distortion | "GoPro chest-mount POV, wide-angle fisheye, action camera energy" | Action sports, extreme experiences |
| `phone_first_person` | Vertical-feel framing, slight rolling shutter, casual handheld | "phone selfie-cam first person, slight handheld wobble, casual intimate" | UGC-style, social-native, Gen Z |
| `surreal_morph` | Generative-only — transformations, impossible cuts, metaphor | "morph transition, transformation, impossible camera, surreal" | Brand films, hooks, art direction-led |

The Cinematographer reads this and uses the matching vocabulary in EVERY Kling/Dreamina prompt. Mixing toolsets is allowed for transitions but should not exceed 20% of shots — the dominant toolset must read in 80%.

#### Dial 3 — Product Positioning Model

Two valid models. The brief MUST pick one explicitly.

| Model | Product on-screen | Heroism resides in | Best for |
|---|---|---|---|
| `product_as_protagonist` | 60–90% of shots | The object itself | Premium SKU launches, Apple, single-product films, design-led brands |
| `product_as_vehicle` | 15–30% of shots | The human emotion the product unlocks | Sport/lifestyle, brand films, community/feeling-led brands (HOKA, Nike, Patagonia) |

This decision drives every storyboard frame's `product_in_frame` field. ASICS used `product_as_protagonist` (correct for premium positioning, ASICS heritage). HOKA used `product_as_vehicle` (correct for sport-lifestyle community positioning). Picking the wrong one for the brand category produces a tonally-broken film.

The Brand Compliance QC agent enforces the model: if `product_as_vehicle` is selected and product appears in >40% of shots, that's a FAIL — the film has drifted into a product catalog. If `product_as_protagonist` is selected and product appears in <50% of shots, also FAIL.

#### Dial 4 — Audio Architecture Mode

Two modes. The brief picks one:

| Mode | Audio philosophy | Production order |
|---|---|---|
| `picture_first_audio_last` | Film-style. Build the visual cut, then score. Music may enter only in part of the spot. | Storyboard → Kling clips → silent cut → picture lock → audio (default short-film-gen behavior, inherited) |
| `music_first_picture_to_music` | Ad-style. Generate or license the music track FIRST. Lock music. Edit picture TO musical accents. Cuts land on beats. Music runs 100% of runtime. | **Brief → music generation/licensing → music lock → storyboard timed to music → Kling clips matched to musical beats → mix-down trivial because picture is already cut to music** |

**HOKA "Bird's Eye" is unambiguously `music_first`.** Eamon's track was chosen first; the cuts are tempo-locked to it. The ad would not work otherwise. ASICS "One Pair" was `picture_first` — defensible for the cinematic-intimate genre but objectively a quieter, less driving result.

**This is a major process inversion.** When `music_first` is selected, the pipeline reorders:

```
PHASE 0: Brief
PHASE 0.6 (NEW): Music generation/lock — generate 45–60s track via ElevenLabs Music, get user approval, FROZEN
PHASE 1.1: Script — written to fit the musical structure of the locked track
PHASE 1.2: Camera plan — beat sheet aligned to musical accents in the locked track (each shot's start/end aligned to a musical event)
PHASE 2: Storyboard + clips — durations match musical beats, not narrative beats
PHASE 4: Mix is trivial — music already locked, only SFX + VO need adding
```

The orchestrator must recognize `audio_architecture: "music_first"` and execute this reordered pipeline. Failing to reorder produces an ad where the music is fighting the picture instead of driving it.

#### Dial 5 — Brand Reveal Strategy

When does the brand mark appear in the runtime?

| Strategy | Logo placement | Best for |
|---|---|---|
| `delayed_payoff` | Logo appears only in the final 3–5 seconds | Premium heritage (Apple, Rolex, ASICS — earned brand reveal) |
| `early_title_card` | Logo as a full-frame title card in the first 5–8 seconds, then film unfolds | Sport/lifestyle (HOKA, Nike, RedBull — confident upfront branding) |
| `bookended` | Logo at start AND end | Brand films, mid-tier brands, anything that wants to be safe |
| `ambient_throughout` | Brand mark visible in 40%+ of shots (on product, on jersey, on signage) | UGC-style, retail, where brand recognition is the primary goal |
| `tagline_only` | No logo, only the tagline as type — brand identifiable by tone | Bold heritage brands, art-direction-led campaigns |

The Art Director reads this dial and produces the end card / title card / ambient placement spec accordingly. The Brand Compliance QC agent verifies the chosen strategy is actually executed.

### Bonus: The Three Sub-Dials (per-shot setting)

These are not brief-level dials — they are per-frame settings in `storyboard.json` that the camera plan declares for each shot:

#### Sub-dial A — Cast Size

`cast_size: "singular" | "duo" | "small_group_3_5" | "community_6_plus"`

Defaults from brief: premium product films → singular; sport/lifestyle → community; conversation/relationship → duo. Drives /production-consistency to source the right number of character refs.

#### Sub-dial B — Motion Blur Intent

`motion_blur_intent: "minimal" | "natural" | "stylized_speed_lines"`

- `minimal` — every motion sharp, no blur. Default for premium/static.
- `natural` — physically-correct motion blur from shutter angle. Default for handheld/documentary.
- `stylized_speed_lines` — exaggerated blur as aesthetic device, edges of frame streaked, body sharp. For action/energy shots.

The Kling/Dreamina prompt vocabulary changes accordingly: `"motion blur on the limbs and edges of frame, body sharp, speed-line effect"` for stylized; `"crisp sharp throughout, no motion blur"` for minimal.

#### Sub-dial C — Closing Beat Strategy

`closing_beat: "product_hero" | "emotional_payoff" | "community_celebration" | "tagline_only" | "logo_only" | "transformation_complete"`

Brief-level decision but lives on the final frame's storyboard.json entry. Drives the last 5 seconds entirely.

### The Visual Signature QC Agent (new MANDATORY GATE)

After camera plan generation and again after storyboard generation, a new **Visual Signature QC Agent** runs and verifies:

1. **Visual conceit ubiquity:** at least `brief.visual_conceit.ubiquity_target_pct` of shots actually deliver the declared conceit. Count manually frame by frame. If under target → FAIL → camera plan rewrite.
2. **Cinematography toolset consistency:** at least 80% of shots use the dominant toolset's vocabulary. If under target → FAIL → prompt rewrite.
3. **Product positioning model adherence:** the on-screen percentage matches the chosen model's range (60–90% for protagonist, 15–30% for vehicle). If outside range → FAIL.
4. **Audio architecture compliance:** if `music_first`, the music lock has happened before storyboard generation. If not → BLOCK and reorder pipeline.
5. **Brand reveal strategy execution:** the actual brand placement matches the chosen strategy.

This agent is `██ MANDATORY GATE ██` in all modes (supervised, autonomous, dangerously-auto). It runs after every storyboard rework. It is the single most important new QC agent in this version of the skill because the entire HOKA-vs-ASICS gap is what it catches.

### The reference film: HOKA "Fly Human Fly | Bird's Eye" (2024, 60s)

For future ads-gen runs, this film is the canonical reference for what "ad-shaped" looks like. Its dial settings, decoded from observation:

```json
{
  "visual_conceit": {
    "name": "Bird's Eye",
    "device": "literal bird POV — FPV drone banking aerials, wing-blur on frame edges, vertical drops, swooping low-altitude high-speed flight, occasional 360° barrel-roll camera",
    "ubiquity_target_pct": 80,
    "rationale": "the tagline 'Fly Human Fly' is enacted by the camera being a bird, not just spoken about. The audience pattern-matches the conceit by 0:08 and the film delivers it for the next 52 seconds."
  },
  "cinematography_toolset": "fpv_drone_aerial",
  "product_positioning_model": "product_as_vehicle",
  "audio_architecture": "music_first",
  "brand_reveal_strategy": "early_title_card",
  "cast_size_default": "community_6_plus",
  "motion_blur_intent_default": "stylized_speed_lines",
  "closing_beat": "community_celebration",
  "duration_seconds": 60,
  "single_minded": "We are all born to fly — running is human flight",
  "tagline": "Fly Human Fly"
}
```

When in doubt about ad-shape vs film-shape, ask: *"Could I describe my film's signature in five dial values like the HOKA decode above? If not, the signature isn't decided."*

### Updated brief.json schema (Five Dials added)

The Phase 0 brief intake (Step 0.1) MUST collect all five dials. The brief.json schema gains:

```json
{
  "visual_conceit": { /* see Dial 1 */ },
  "cinematography_toolset": "fpv_drone_aerial | static_observational | handheld_documentary | anamorphic_dolly | macro_studio | gopro_pov_action | phone_first_person | surreal_morph",
  "product_positioning_model": "product_as_protagonist | product_as_vehicle",
  "audio_architecture": "music_first_picture_to_music | picture_first_audio_last",
  "brand_reveal_strategy": "delayed_payoff | early_title_card | bookended | ambient_throughout | tagline_only",
  "cast_size_default": "singular | duo | small_group_3_5 | community_6_plus",
  "motion_blur_intent_default": "minimal | natural | stylized_speed_lines",
  "closing_beat": "product_hero | emotional_payoff | community_celebration | tagline_only | logo_only | transformation_complete"
}
```

The intake `AskUserQuestion` flow gains 5 new questions (one per dial) before any of the existing brief questions. **Default values are NEVER acceptable for Dials 1–5** — the user (or the orchestrator in dangerously-auto mode after analyzing the brand category) must make an explicit decision with logged rationale. Sub-dials (cast size, motion blur, closing beat) can default per the genre preset.

### The reference failure that prompted this section

The ASICS "One Pair" production failed to set ANY of the five dials. The result was beautiful but signature-less — fourteen well-shot clips with no recurring formal idea, no declared cinematography toolset, no product-positioning model, picture-first audio that meant the music could only sweep in for the last 15 seconds, and a delayed-payoff brand reveal that worked for the premium positioning but couldn't compensate for the missing visual signature. When watched alongside HOKA "Bird's Eye" — which explicitly committed to all five dials — the gap was immediate. **The lesson, formalized:** signature is not an aesthetic afterthought, it is a pre-production decision that must be made in Phase 0 before a single shot is designed. This section exists to force that decision on every future run.

---

## ██ THE END CARD SYSTEM ██
## (How the brand mark actually lands — read before designing the final beat)

The end card is **the single most important 3 seconds of the spot.** It is the only frame the audience consciously commits to memory, it carries the brand mark, and it is where a beautiful film either pays off or undoes itself with a cheap-looking graphic slate. Most ads-gen productions get the rest of the film right and then drop the end card on a black void with type centered, calling it done. **That is the failure mode this section exists to prevent.**

### The core insight

Look at the HOKA "Fly Human Fly" end card decoded above (image referenced in the production log). What HOKA did, and what most ads-gen runs fail to do:

1. **The end card IS the final shot of the film, not a separate slide.** The inverted barrel-roll frame (from the 0:55 camera rotation) is still moving softly underneath the logo. The brand mark composites OVER live footage, not over a void.
2. **The camera move set up the resting frame.** The 360° barrel-roll at 0:55 was not a stunt — it was the run-up to the end card. The film *earns* the inverted aerial that the logo lands on. Without the barrel-roll, there is no resting frame for the logo to compose against.
3. **Logo lands on a musical accent.** The final musical beat lands precisely on the logo onset. The audience feels the resolution of the music as the visual resolution of the brand.
4. **Brand color is chosen against the underlying frame, not in isolation.** HOKA's brand yellow (#FFEC00) was selected with the soft-blue inverted-sky backdrop in mind — high-contrast brand color against a low-contrast cool field. The end card backdrop and the brand color are designed *together*.
5. **Supporting elements are present without breaking the design.** Channel bug bottom-right, copyright bottom-center — there but invisible. Most ads-gen productions either omit these (correct for one-offs but missing the framework) or add them as afterthoughts that fight the design.
6. **Conceptual discipline:** the inversion is a payoff for the literal "Bird's Eye" visual conceit declared in the brief. The end card *delivers the same idea as the rest of the film* — it doesn't break the conceit to show the logo.

The ASICS "One Pair" end card violated all six. It was a graphic composite on pure matte black with type centered and a fade. It looked like a PowerPoint slide. **The mistake was treating the end card as a separate problem from the film instead of the film's final beat.**

### The Five Composition Modes for an End Card

Every ads-gen production must declare an `end_card_mode` in `brief.json`. None of these are universally "best" — each fits different brand strategies. But ONE must be chosen explicitly.

| Mode | What it is | Best for | Example |
|---|---|---|---|
| `over_live_footage` | Logo + tagline composited OVER the still-moving final shot of the film. The film never cuts to a separate slide. | Brand films, sport/lifestyle, anything with a strong visual signature the brand wants to claim | HOKA "Bird's Eye" — logo over the inverted aerial |
| `match_cut_to_void` | The film cuts on a shape/motion to a pure black or pure white void with the logo dead-center. The cut is invisible because the shapes match. | Premium heritage, design-led brands | Apple film endings, Bose product films |
| `product_dissolves_to_logo` | The product itself morphs/dissolves into the logo mark over 1–2 seconds. The transformation IS the brand reveal. | Single-product launches, design-led brands where the product silhouette echoes the logo shape | Nike Swoosh forming from a stride, Apple icon from a click |
| `still_held_with_overlay` | The final shot of the film holds completely still (locked-off, no motion underneath) and the logo + tagline composite over it. Less dynamic than `over_live_footage` but more controlled. | Premium product films, considered/quiet brands | Tiffany, Hermès, Aesop |
| `graphic_void_card` | Pure black or pure white background, logo + tagline graphic composite, no underlying footage. The classic end slate. | Heritage logos that already carry meaning by themselves, broadcast-style commercials, anything where the rest of the film cannot accommodate an overlay | Coca-Cola Christmas, classic broadcast spots, the WRONG choice for ASICS "One Pair" |

**Default mapping by brand category** (orchestrator picks if user skips, but must log the decision):

| Brand category | Default mode |
|---|---|
| Sport / lifestyle / community | `over_live_footage` |
| Premium heritage product | `still_held_with_overlay` |
| Single-product launch | `product_dissolves_to_logo` or `match_cut_to_void` |
| Design-led / minimalist | `match_cut_to_void` |
| Mass-market broadcast | `graphic_void_card` (only acceptable use) |
| Brand film / manifesto | `over_live_footage` |

### The End Card Spec — what the Art Director Agent must produce

After the camera plan is locked, the Art Director generates `end_card_spec.json` with EVERY field below populated. This document is read by the ffmpeg compositor in Phase 4 to produce the final 3 seconds.

```json
{
  "end_card_mode": "over_live_footage | match_cut_to_void | product_dissolves_to_logo | still_held_with_overlay | graphic_void_card",
  "duration_seconds": 3.0,
  "underlying_frame": {
    "source": "shot15_video.mp4 (the final clip) | held_still_from:shot15.png | pure_void | custom_generation",
    "treatment": "natural | inverted | desaturated | slowed_to_stop | held_still | crossfade_from_previous",
    "motion_during_card": "live_motion_continuing | frozen | very_slow_drift | gentle_zoom_in | gentle_zoom_out"
  },
  "brand_mark": {
    "logo_file": "pre-production/brand/logo_primary.png",
    "logo_color_hex": "#FFEC00",
    "logo_color_rationale": "chosen against the underlying frame's dominant tone — high-contrast warm yellow against the soft cyan inverted sky",
    "logo_position": {"x_pct": 50, "y_pct": 50, "anchor": "center"},
    "logo_width_pct_of_frame": 18,
    "logo_entry": "instant | fade_in_500ms | scale_in_with_easing | track_in_from_motion",
    "logo_hold_duration_s": 2.5,
    "logo_exit": "fade_to_black_200ms | hard_cut | match_cut_to_next | hold_until_end"
  },
  "tagline": {
    "copy": "Sound mind, sound body.",
    "color_hex": "#FFEC00",
    "position": {"x_pct": 50, "y_pct": 62, "anchor": "center"},
    "font_family": "BrandSans-Light",
    "font_size_pct_of_frame_height": 3.2,
    "tracking_em": 0.05,
    "case": "uppercase | titlecase | sentencecase",
    "entry": "instant | fade_in_with_logo | fade_in_after_logo_300ms | type_on",
    "hold_duration_s": 2.5
  },
  "supporting_elements": {
    "channel_bug": {"present": false, "file": null, "position": "bottom_right", "size_pct": 5, "opacity": 0.85},
    "copyright": {"present": true, "text": "© 2026 Brand Name. All rights reserved.", "position": "bottom_center", "size_pct": 1.2, "color_hex": "#FFEC00", "opacity": 0.6},
    "regional_legal": {"present": false, "text": null, "position": "bottom_left", "size_pct": 1.0}
  },
  "music_sync": {
    "logo_onset_ms": 42500,
    "musical_beat_at_onset": "the resolving piano chord at the end of the music track",
    "rationale": "logo lands ON the beat, not before or after — the audience feels the music's resolution as the brand's resolution"
  },
  "camera_setup": {
    "earned_by_shot": "shot14 (the rooftop MWS holds long enough to settle into the end card composition)",
    "rationale": "the previous shot must end on a composition that ACCOMMODATES the logo placement — empty negative space where the logo will live, no critical content under the logo position"
  }
}
```

The orchestrator must not generate a final master without `end_card_spec.json` populated. The Brand Compliance QC agent reads it as the source of truth for the brand mark execution and verifies the rendered end card matches the spec.

### The "earned resting frame" rule

This is the rule the ASICS production violated. **The shot immediately before the end card must end on a composition that the logo can land into.** That means:

1. **Negative space at the logo position.** If `logo_position` is center, the previous shot's final frame must have the center of frame empty enough that a logo overlay won't fight the underlying content. Plan this in the camera plan, not after the fact.
2. **Motion that resolves into stillness or steady drift.** Aggressive motion under the logo makes the logo feel like a window decal slapped onto a moving scene. Either the underlying motion must be slow and unidirectional (HOKA's gentle inverted drift), or the previous shot must explicitly slow-to-still-frame on its final beat.
3. **A camera setup that makes the resting frame inevitable.** HOKA's barrel roll at 0:55 was not a stunt — it was the camera setup for the end card. The film moved into the inverted position so the logo could land in it. **The Cinematographer must design the final pre-end-card shot specifically as the runway into the end card.** The end card is not designed in isolation; the shot that delivers it is part of the design.

The Cinematographer agent's camera plan now MUST include a **"Runway Shot" callout** for whichever shot is the last one before the end card. The callout specifies:
- What the resting frame looks like (composition, where the negative space is for the logo)
- How the motion resolves (slow drift / freeze / continued drift)
- Why this shot earns the end card (what it visually sets up that the logo lands into)

### Music sync — the logo-onset alignment rule

If `audio_architecture: music_first` is set in the brief, the logo onset MUST align to a musical accent in the locked music track. The end card's `music_sync.logo_onset_ms` field is computed by:

1. After music lock, the Music Beat Detection Agent (new — runs in `music_first` mode only) analyzes the locked track and outputs a beat map: `beats.json` with timestamps of every kick/snare/downbeat/melodic resolution.
2. The Art Director picks the beat closest to the planned end card onset (or pulls the end card forward/backward by ≤500ms to align).
3. ffmpeg composites the logo with `enable='gte(t,X.YYY)'` where X.YYY is the locked beat timestamp in seconds.

If `audio_architecture: picture_first_audio_last`, the music is generated AFTER picture lock and the music must be commissioned to LAND on the existing logo onset — instruct the music generation prompt with: *"The track's final resolving beat must land at exactly N seconds — the musical resolution is the brand reveal moment."*

Either way, **logo onset and musical accent must coincide within ±50ms.** Outside that window, the audience perceives the brand as floating untethered from the music.

### Brand color selection — the underlying-frame contrast rule

The brand color used in the end card must be chosen AGAINST the underlying frame's dominant tone, not in isolation from a brand book. Rules:

1. **Sample the underlying frame's dominant 3 colors** (use ImageMagick `convert` or Python PIL with k-means clustering — or a Vision LLM call on the frame).
2. **Pick the brand color variant that maximally contrasts** with those dominants. Most brands have 2–4 official color variants (HOKA has yellow, white, black, sometimes coral) — pick the one that pops hardest.
3. **Verify WCAG AA contrast ratio ≥4.5:1** against the underlying frame's dominant tone in the logo region. Below 4.5 = FAIL = pick a different brand color variant or add a subtle scrim.
4. **If no brand color variant achieves AA contrast**, the underlying frame is wrong for an `over_live_footage` end card — switch to `still_held_with_overlay` with a 30% opacity dark scrim under the logo region, OR fall back to `graphic_void_card`.

This is the difference between HOKA's confident yellow-on-soft-cyan and a careless white-on-busy-photograph that nobody can read.

### Implementation pattern — ffmpeg compositing for `over_live_footage` mode

The most sophisticated end card mode and the one most commonly executed badly. Here is the canonical implementation:

```bash
# Inputs:
# - silent_cut.mp4: the assembled film up to the start of the end card
# - shot15_video.mp4: the final clip (~5s, will become the end card backdrop)
# - logo_primary.png: brand logo with transparent background
# - end_card_spec.json: the Art Director's spec
# - master_audio.wav: the locked music track

# Step 1: Take the last clip and apply the underlying treatment
# (here: invert vertical for the HOKA-style barrel-roll-resolved frame)
ffmpeg -y -i shot15_video.mp4 \
  -vf "vflip,scale=1920:1080,setpts=PTS-STARTPTS" \
  -t 3.0 -an end_card_backdrop.mp4

# Step 2: Composite logo + tagline + supporting elements over the backdrop
LOGO_W=$(echo "1920 * 0.18" | bc)  # 18% of frame width
LOGO_X="(W-w)/2"                   # center X
LOGO_Y="H*0.50-h/2"                # 50% Y centered

ffmpeg -y -i end_card_backdrop.mp4 -i logo_primary.png \
  -filter_complex "
    [1:v]scale=${LOGO_W}:-1[logo];
    [0:v][logo]overlay=${LOGO_X}:${LOGO_Y}:enable='gte(t,0)'[bg1];
    [bg1]drawtext=text='FLY HUMAN FLY':
      fontfile=/path/to/BrandSans-Bold.ttf:
      fontcolor=0xFFEC00:
      fontsize=58:
      x=(w-text_w)/2:
      y=h*0.62:
      enable='gte(t,0.1)'[bg2];
    [bg2]drawtext=text='© 2026 Brand. All rights reserved.':
      fontfile=/path/to/BrandSans-Light.ttf:
      fontcolor=0xFFEC00:
      fontsize=18:
      alpha=0.6:
      x=(w-text_w)/2:
      y=h-30:
      enable='gte(t,0.5)'
  " \
  -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -an \
  end_card_composite.mp4

# Step 3: Concatenate the silent cut up to the end card start, then the composite
# Step 4: Mux with the locked master audio (logo onset already aligned to musical beat)
```

Key implementation rules:
- **Always work with the final clip's actual pixels as the backdrop**, not a synthesized still — the subtle continuing motion is half the appeal.
- **Use `enable='gte(t,X)'` for staggered onsets** — logo at 0.0s, tagline at 0.1s, copyright at 0.5s. Staggering reads as sophistication; everything onset at once reads as a slate.
- **Logo width as percentage of frame**, never pixel values — works at any output resolution.
- **Font files must be available locally** — store brand fonts in `pre-production/brand/fonts/`. Drawtext fails silently with the wrong font and falls back to ugly defaults.
- **Logo position references the brand's actual logo_position spec**, not centered by default. Some brands lock-up corner-aligned, some center.
- **Music sync via `enable='gte(t,X.YYY)'`** with the beat timestamp from `beats.json`.

### Supporting elements treatment

Most ads-gen runs either omit supporting elements entirely (channel bug, copyright, regional legal lines) or add them as afterthoughts. Both are wrong. The framework:

- **Copyright line** — present by default at 60% opacity in the brand color, bottom-center, font size ~1.2% of frame height, set during the second-half of the end card hold (entry at 0.5s into the 3.0s card)
- **Channel bug** — only present if the spot is being delivered to a specific channel/network that requires it. When present: bottom-right, 5% width, 85% opacity, in brand color (NOT a separate channel logo unless specified)
- **Regional legal** — for spots that need disclaimer text (terms, age restrictions, financial disclaimers) — bottom-left, even smaller, ~1.0% of frame height. Currently descoped per ads-gen v1 (no compliance) but the field exists in the spec for forward compatibility
- **Social handles** — only if the brand explicitly requested. When present: above the tagline, in body type, smaller than tagline

All supporting elements use the **same brand color as the logo and tagline** — visual unity. They are all part of the same brand block, not floating elements competing for attention.

### Brand-adaptive design — making the spec work for any brand

The end card spec must work for HOKA's bright yellow + sport-lifestyle confidence AND for ASICS's quiet premium restraint AND for Apple's minimalist void AND for Patagonia's earthy heritage. The spec adapts via these 8 axes:

| Axis | HOKA-shaped value | ASICS-shaped value | Apple-shaped value | Patagonia-shaped value |
|---|---|---|---|---|
| `end_card_mode` | `over_live_footage` | `still_held_with_overlay` | `match_cut_to_void` | `over_live_footage` |
| `underlying_frame.treatment` | `inverted` | `held_still` | `pure_void` | `natural` |
| `brand_mark.logo_color_hex` | `#FFEC00` (yellow on soft cyan) | `#EDEBE6` (off-white on warm wood) | `#FFFFFF` (pure white on pure black) | `#1A1612` (dark brown on warm landscape) |
| `tagline.case` | `uppercase` | `sentencecase` | `none (no tagline)` | `sentencecase` |
| `tagline.font_family` | bold geometric sans | restrained editorial serif/sans hybrid | SF Pro thin | rugged display serif |
| `logo_entry` | `instant` (lands on beat) | `fade_in_500ms` | `fade_in_with_logo` | `instant` |
| `motion_during_card` | `live_motion_continuing` | `frozen` | `frozen` | `live_motion_continuing` |
| `music_sync.alignment` | tight (±20ms) | loose (±150ms) | tight (±20ms) | loose (±150ms) |

The Art Director reads the brief's brand category and the chosen `end_card_mode` and produces the spec accordingly. **Defaults must be category-appropriate, not universal.**

### The new Brand Mark QC sub-check

The Brand Compliance QC Agent gains a sub-check that runs after the end card is composited but before final mux:

1. **Logo present at the spec'd position** (template-match against `logo_primary.png`)
2. **Logo color matches the spec'd hex** within ΔE < 5 (perceptual color distance)
3. **Logo width matches the spec'd percentage** within ±2%
4. **Tagline text matches `tagline.copy` exactly** (OCR check)
5. **Supporting elements present per the spec** (copyright readable, channel bug present if specified)
6. **Underlying frame treatment matches** (inverted/desaturated/etc. as spec'd)
7. **WCAG AA contrast ratio ≥4.5:1** between the logo color and the underlying frame at the logo position (sample the average pixel color in the logo bounding box, compute contrast ratio against the logo color)
8. **Music onset alignment within ±50ms** of the spec'd `logo_onset_ms` (verified against `master_audio.wav` waveform — find the nearest peak energy event)

Any of these failing = FATAL = end card regenerated with corrected spec. The agent runs in all modes (supervised, autonomous, dangerously-auto). Marked `██ MANDATORY GATE ██`.

### The reference: HOKA "Fly Human Fly" end card decoded

For the canonical worked example, the HOKA end card spec decoded from the screenshot:

```json
{
  "end_card_mode": "over_live_footage",
  "duration_seconds": 3.0,
  "underlying_frame": {
    "source": "final_clip_inverted_aerial.mp4",
    "treatment": "inverted",
    "motion_during_card": "very_slow_drift"
  },
  "brand_mark": {
    "logo_file": "hoka_primary_logo.png",
    "logo_color_hex": "#FFEC00",
    "logo_color_rationale": "high-contrast warm yellow against the soft cyan inverted sky — sampled from the underlying frame's dominant tone (#9CC9DC) and chosen for maximum perceptual contrast",
    "logo_position": {"x_pct": 50, "y_pct": 50, "anchor": "center"},
    "logo_width_pct_of_frame": 22,
    "logo_entry": "instant",
    "logo_hold_duration_s": 2.5,
    "logo_exit": "hard_cut"
  },
  "tagline": {
    "copy": "FLY HUMAN FLY",
    "color_hex": "#FFEC00",
    "position": {"x_pct": 50, "y_pct": 62, "anchor": "center"},
    "font_family": "HOKA brand sans, bold",
    "font_size_pct_of_frame_height": 3.0,
    "tracking_em": 0.10,
    "case": "uppercase",
    "entry": "fade_in_with_logo",
    "hold_duration_s": 2.5
  },
  "supporting_elements": {
    "channel_bug": {"present": true, "file": "hoka_tv_bug.png", "position": "bottom_right", "size_pct": 6, "opacity": 0.95},
    "copyright": {"present": true, "text": "© 2024 Deckers Brands. All rights reserved.", "position": "bottom_center", "size_pct": 1.2, "color_hex": "#FFFFFF", "opacity": 0.5}
  },
  "music_sync": {
    "logo_onset_ms": 56000,
    "musical_beat_at_onset": "Eamon track's resolving final beat / outro accent",
    "rationale": "the camera barrel-roll at 0:55 settles into the inverted resting position by 0:56 — the logo lands on the musical resolution"
  },
  "camera_setup": {
    "earned_by_shot": "shot_marathon_barrel_roll_360 (the 360° camera rotation at 0:55)",
    "rationale": "the camera move physically delivers the inverted resting frame that the logo composites onto. The end card is the consequence of the camera move, not a separate slate."
  }
}
```

Compare against ASICS "One Pair":

```json
{
  "end_card_mode": "graphic_void_card",
  "duration_seconds": 3.0,
  "underlying_frame": {"source": "pure_void", "treatment": "pure_black", "motion_during_card": "frozen"},
  "brand_mark": {
    "logo_color_hex": "#EDEBE6",
    "logo_color_rationale": "(none — chosen in isolation from a brand book without considering the underlying frame)",
    "logo_position": {"x_pct": 50, "y_pct": 40, "anchor": "center"},
    "logo_width_pct_of_frame": 18,
    "logo_entry": "instant",
    "logo_exit": "fade_to_black_200ms"
  },
  "tagline": {"copy": "Sound Mind, Sound Body.", "color_hex": "#EDEBE6", "position": {"x_pct": 50, "y_pct": 72, "anchor": "center"}},
  "music_sync": {
    "logo_onset_ms": 42000,
    "musical_beat_at_onset": "(none — picture-first audio means the music never landed on this moment intentionally)",
    "rationale": "(none — the logo onset was driven by film duration arithmetic, not music)"
  },
  "camera_setup": {
    "earned_by_shot": "(none — shot15 is a separate void-background product hero, NOT a runway shot designed for the end card)",
    "rationale": "(none — end card was designed in isolation as a graphic composite)"
  }
}
```

The ASICS end card is technically clean and was rendered correctly. **It is also conceptually disconnected from the rest of the film and reads as an afterthought.** The HOKA end card is the same handful of layers but every layer is conceptually load-bearing. That's the difference. Any future ads-gen run that produces an end card without filling EVERY field of `end_card_spec.json` with a load-bearing rationale will be flagged as `signature_unfinished` by the Brand Mark QC sub-check.

### The reference failure that prompted this section

The ASICS "One Pair" end card was a 3-second graphic composite of off-white type on matte black, generated via an ffmpeg `drawtext` call over a `lavfi color` source. It had no relationship to the film, no music sync, no underlying frame, no contrast logic, no earned camera setup. It was technically correct and conceptually empty. When watched against the HOKA end card — type composited over a continuing inverted aerial, brand color chosen against the underlying tone, logo landing on a musical beat the camera move had set up 5 seconds earlier — the ASICS end card looked like a slate from a 1998 broadcast spot. **The lesson, formalized:** the end card is the film's final beat, not a separate problem. It must be designed by the Cinematographer (runway shot), the Art Director (composition + brand color logic), the Music Editor (beat alignment), and the Brand Mark QC agent (contrast + execution check) as a coordinated handoff. Treating it as "the last 3 seconds where we put the logo" is the failure mode this section prevents.

---

## PHASE 0 — The Brief (ads-gen only)

Before the existing Phase 1, ads-gen runs a brief intake. The brief is the highest-authority document in the production — it overrides camera plan conflicts the same way the camera plan overrides individual frame choices.

### Step 0.1: Intake the brief

If the user drops a full brief, parse it. Otherwise use `AskUserQuestion` to fill in the blanks. Smart defaults if the user skips anything; log every assumption as a `pipeline_decision` event.

Write to `{project}/brief.json`:

```json
{
  "brand":           {"name": "", "category": "", "tone_of_voice": ""},
  "product":         {"name": "", "key_features": [], "hero_shot_ref": null, "one_liner": ""},
  "audience":        {"primary_persona": "", "insight": "", "current_behavior": "", "desired_behavior": ""},
  "objective":       "awareness | consideration | conversion | launch | rebrand",
  "single_minded":   "The ONE thing the viewer should remember (≤12 words)",
  "rtb":             ["reason to believe 1", "reason to believe 2", "reason to believe 3"],
  "mandatories":     {"logo_end_card": true, "product_on_screen_by_seconds": 3, "cta": ""},
  "nevers":          ["off-brand tone", "competitor mention", "..."],
  "duration_seconds": 15,
  "hook_strategy":    "pattern_interrupt | question | bold_claim | demo | transformation",
  "budget_tier":      "indie | mid | premium"
}
```

**Intake questions (use AskUserQuestion, one-by-one or compact multi-select):**

1. **Brand name + category** (text)
2. **Product + one-liner** (text)
3. **Primary audience + the single insight that unlocks them** (text) — default: orchestrator drafts from brand/product if skipped
4. **Objective** — Awareness / Consideration / Conversion / Product Launch / Rebrand
5. **Single-minded proposition** — "If viewers only remember ONE thing, what?" (≤12 words)
6. **Duration** — 6s / 15s / 30s / 60s (default 15s)
7. **Hook strategy** — Pattern interrupt / Bold question / Bold claim / Product demo / Transformation reveal / "Surprise me"
8. **CTA** — exact words + where the viewer should go
9. **Mandatories** — must the logo appear on an end card? Must the product appear by second N? (defaults: yes + 3s)
10. **Budget tier** — maps directly to Kling tier (indie=std, mid=std+pro, premium=pro/master)

All other short-film-gen intake questions (genre, music mood, dialogue style, character descriptions, control level, save location) still run — they come AFTER brief intake, and **genre selection is now constrained by the brief's brand tone_of_voice**.

### Step 0.2: Brand Kit ingestion

If the user provides a brand book / logo / color tokens (PDF, image folder, or URL), extract them into `{project}/pre-production/brand/brand_kit.json`:

```json
{
  "logo": {"primary": "logo_primary.png", "lockups": ["lockup_light.png", "lockup_dark.png"]},
  "colors": {"primary_hex": "#...", "secondary_hex": "#...", "accent_hex": "#..."},
  "type_system": {"headline": "", "body": ""},
  "tone_of_voice": "",
  "forbidden_imagery": []
}
```

If the user provides nothing, derive a minimal brand kit from the product + category (Gemini vision on the hero shot ref if provided) and present it back for confirmation (or auto-accept in dangerously-auto mode). The brand kit is referenced by the Art Director Agent, the storyboard prompts, and the Brand QC agent.

### Step 0.3: ★ Creative Strategist Agent

Launch a background agent that reads brief.json and writes `{project}/creative_strategy.md`:

- Restated insight (one sentence)
- Single-minded proposition (rewritten for punch if needed)
- Tone & manner
- **3 territory options** — three distinct creative angles for the same brief. Each with a one-paragraph pitch, a working title, and why it lands on the audience insight.
- Recommended territory + why
- Risks & watch-outs (purely creative — boring, derivative, on-trend-but-hollow, etc. — NOT legal)

**Supervised mode:** user picks a territory. **Autonomous / dangerously-auto:** orchestrator picks the recommended one and logs a `pipeline_decision`.

The chosen territory feeds into Phase 1.1 (Narrative Script / Screenwriter) as the creative direction the screenwriter must execute.

### Step 0.4: ★ Copywriter Agent

Parallel to or after the Screenwriter. The Copywriter owns:
- VO lines (if any)
- On-screen text frames (kinetic type moments — headline, product benefit, CTA)
- End-card copy (brand line + CTA)
- **3 copy variants** per VO / on-screen line for A/B-ability

Output: `{project}/copy_variants.json`. In supervised mode, user picks a variant per beat. In auto, orchestrator picks variant index 0.

All copy must respect brand_kit.json `tone_of_voice` and brief `nevers`.

### Step 0.5: ★ Art Director Agent

Runs alongside the Cinematographer in Phase 1.2. The Art Director owns:
- Brand world translation (brand_kit colors → scene palette / LUT direction)
- **Product hero treatment** — how the product is lit, framed, and revealed. This is the single most important deliverable. Think Apple product films. Spec: hero angle, hero lighting (rim? top? practical?), first-reveal moment, reveal duration in frames, background separation strategy.
- End-card design spec (layout, logo position, CTA typography, duration in frames)
- On-screen text frame specs (which beats get kinetic type, font from brand kit, color, motion direction)

Output: `{project}/art_direction.md` + updates `storyboard.json` per-frame fields (see Phase 1.7 and the extended storyboard schema below).

---

## PHASE 1.7 — Hook Lab (ads-gen only, runs between Phase 1 and Phase 2)

**The first 1.5 seconds decides whether anyone watches the rest.** It is too important to trust to a single pass.

Process:
1. The Cinematographer + Art Director + Copywriter generate **3 alternative first-1.5s hook concepts** based on brief.hook_strategy.
2. Each hook gets a mini-storyboard: 2–3 frames covering 1.5s, generated to final (watermark-free) quality via `/img-ctrl-api`.
3. Optionally, each hook is rendered as a 2s Kling clip (premium tier — hooks deserve the best tier regardless of budget tier).
4. Store under `{project}/hook_lab/hook_a/`, `hook_b/`, `hook_c/`.
5. **Supervised mode:** user picks one. **Autonomous:** Hook QC Agent picks (see Brand + Hook QC below). **Dangerously-auto:** orchestrator picks hook_a and logs a `pipeline_decision`.

The chosen hook becomes Clip 01 of the final spot and its frame becomes Frame 01 of the locked storyboard. The other two hooks are kept on disk for later A/B testing.

---

## ADS-SPECIFIC QC AGENTS (ads-gen only — run in addition to all short-film-gen QC)

### ★ Brand Compliance QC Agent (MANDATORY GATE in ALL modes)

Runs after storyboard generation and again after clip generation. Reads brand_kit.json + brief.json and checks every frame/clip:

- **Logo/end-card:** if `brief.mandatories.logo_end_card == true`, the final frame MUST contain the brand logo lockup from brand_kit. Missing = FATAL.
- **Product presence timing:** if `brief.mandatories.product_on_screen_by_seconds == N`, the product must be visible by frame (N * fps). Late = FATAL.
- **Color fidelity:** product hero shots must not drift outside brand palette tolerance (±15% hue on brand-colored products).
- **Tone-of-voice:** on-screen text and VO copy match brand_kit.tone_of_voice. Off-tone = FATAL.
- **Nevers list:** no forbidden imagery from `brief.nevers` or `brand_kit.forbidden_imagery`.

Output: `{project}/qc_reports/brand_compliance_qc.md`. Same MANDATORY GATE enforcement as storyboard QC — the orchestrator MUST launch this via the Agent tool; it will not run passively.

### ★ Hook QC Agent (MANDATORY GATE in ALL modes)

Runs on Hook Lab outputs and again on Clip 01 after video generation. Checks:

- **Motion in frame 1** — a static opening is an auto-fail for scroll-stop hooks. Exception: if hook_strategy is "bold_claim" with kinetic type, static with moving text is OK.
- **Brand or product visible by 1.5s** — unless hook_strategy is "pattern_interrupt" (then first 0.8s can be pure hook, product by 1.5s).
- **Pattern interrupt strength** — frame 1 visual should not look like a generic stock ad opener (no slow sunrise, no generic lifestyle b-roll, no corporate blue gradient).
- **Claim/copy readability** — on-screen hook text legible at 360p (ad viewers scroll fast and often on bad connections).

Output: `{project}/qc_reports/hook_qc.md`. In autonomous mode, this agent also picks the winning hook from Hook Lab if the user didn't choose.

---

## EXTENDED storyboard.json SCHEMA (ads-gen)

Every frame object inherits all existing short-film-gen fields and adds:

```json
{
  "product_in_frame": true,
  "product_coverage_pct": 35,
  "brand_elements": ["logo", "color", "type"],
  "onscreen_text": {"copy": "", "position": "lower_third", "font": "brand.headline", "color": "#..."},
  "is_hook_frame": false,
  "is_end_card": false,
  "video_tool": "kling_v3_pro",
  "needs_transformation": false,
  "compound_action": true,
  "shot_vocabulary": ["detail_macro", "360_hero", "speed_ramp"],
  "in_clip_locations": ["studio_macro", "street_wet_pavement"],
  "body_mechanics_required": false,
  "stylized_elements": [],
  "delivers_visual_conceit": true,
  "cinematography_toolset_match": true,
  "cast_size": "singular",
  "motion_blur_intent": "minimal",
  "musical_beat_alignment_ms": null,
  "is_runway_shot": false,
  "runway_shot_spec": null
}
```

Where a frame is the **runway shot for the end card** (the last shot before the end card whose composition and motion are designed to deliver the end card backdrop), set `is_runway_shot: true` and populate `runway_shot_spec`:

```json
"runway_shot_spec": {
  "resting_frame_composition": "centered upper-third negative space where logo will land — sky/horizon dominant, no critical content in the middle",
  "motion_resolution": "very_slow_drift | freeze_to_still | continued_drift",
  "earns_end_card_because": "the camera barrel-roll between 0:55–0:56 settles into the inverted resting position by the start of the end card — the logo composites onto the inverted aerial which is still drifting softly",
  "logo_position_in_this_frame_pct": {"x_pct": 50, "y_pct": 50},
  "negative_space_verified": true
}
```

The Cinematographer Agent must mark exactly one frame as `is_runway_shot: true` and populate the spec. The Visual Signature QC Agent verifies the runway shot's composition actually accommodates the end card's logo position (negative space at the spec'd coords) and refuses to advance to clip generation if the runway shot is unfilled or fails the negative-space test.

Field reference:
- **`video_tool`** — which generative video model to route this clip to. Options: `kling_v3_pro` (default, cinematic realism), `dreamina` (stylized/transformation/hooks), `runway_gen4`, `veo3`. The orchestrator reads this field to select which API to call. Default routing per the tool matrix in the "THE FUNDAMENTAL PHILOSOPHY DIFFERENCE" section.
- **`needs_transformation`** — true if the clip contains a morph, transformation, or in-clip scene change. Auto-routes to `dreamina` if the tool field is unset.
- **`compound_action`** — true if the clip is a compound sequence (detail → transition → payoff). Should be true for hooks, product heroes, and montage beats. False only for pure observational beats.
- **`shot_vocabulary`** — array of shot-vocabulary terms used in this clip's prompt. Used by the Prompt QC checklist to verify the prompt isn't under-written. At least 1 term required on every frame, 2+ preferred for hooks/heroes.
- **`in_clip_locations`** — array of locations visible within a single clip. Length 1 = single-scene clip, length 2+ = in-clip transition. Max 3.
- **`body_mechanics_required`** — true if the clip contains a human in locomotion (running, walking, climbing, etc.). When true, the prompt MUST include the standard body mechanics anchor phrasing.
- **`stylized_elements`** — array of stylized elements the clip contains: `["fire_morph", "particle_crown", "alive_laces", "environment_morph", "light_bloom", etc.]`. Empty array = naturalistic shot.

The Brand Compliance QC Agent reads these fields to verify mandatories. The Art Director populates them during Phase 1.2. The **Prompt QC check** (run before each Kling/Dreamina submission) verifies every frame's prompt passes the 10-item prompt-writing checklist in "THE FUNDAMENTAL PHILOSOPHY DIFFERENCE" — any frame that fails (fewer than 6 checklist items satisfied) is rejected back to the Cinematographer for rewrite before generation. Orchestrator must not generate storyboard.json without these fields.

---

## FILE STRUCTURE (ads-gen overrides)

On top of the short-film-gen file structure, ads-gen adds:

```
{project}/
├── brief.json                         # Phase 0 output
├── creative_strategy.md               # Creative Strategist Agent
├── copy_variants.json                 # Copywriter Agent
├── art_direction.md                   # Art Director Agent
├── pre-production/
│   ├── brand/
│   │   ├── brand_kit.json
│   │   ├── logo_primary.png
│   │   ├── logo_lockups/
│   │   └── end_card_template.png
│   └── product/                       # Treat product as a character
│       ├── product_hero.png
│       ├── product_360/               # if multiple angles needed for consistency
│       └── product_lockup.png
├── hook_lab/
│   ├── hook_a/  (frames + optional 2s clip)
│   ├── hook_b/
│   └── hook_c/
└── qc_reports/
    ├── brand_compliance_qc.md         # NEW
    ├── hook_qc.md                     # NEW
    └── (all short-film-gen QC reports as-is)
```

Everything else (storyboard/, clips/, audio/, master/, production_log.jsonl) stays identical to short-film-gen.

---

## Getting Started

You only need **one thing**: a brief, a product, or even a rough pitch. Even "ad for my coffee brand, make it feel premium" works. Everything else I'll handle — but you can steer any part of it.

**Trigger phrases for dangerously-auto mode:**
- "just do everything"
- "full auto" / "full autopilot"
- "don't ask me anything"
- "no stops"
- "dangerously auto"
- "zero interaction"
- "end to end, no review"

After receiving the concept, present the user with the following intake using `AskUserQuestion` with multi-select where noted. These are **suggestions, not requirements** — the user can skip any of them and I'll use smart defaults.

### Intake Questions (use AskUserQuestion tool)

**Question 1: Genre Selection (MANDATORY — two-step AskUserQuestion)**

Use the **two-step AskUserQuestion genre funnel** defined in Appendix A below under "Genre Selection Funnel". The flow is:

1. **Step 1A — Visual Temperature** (AskUserQuestion with 4 options + previews): Warm & Intimate, Cool & Atmospheric, Raw & Authentic, Grand & Mythic
2. **Step 1B — Specific Genre** (AskUserQuestion with 2-3 options + camera/lens/color spec previews, based on Step 1A answer)
3. If user selects "Other" at either step, ask them to describe the look and map to the closest preset

The selected genre controls ALL downstream generation:
- Storyboard images get the genre's `technical`, `scene`, `style_modifiers`, and `negative_prompt` fields via /img-ctrl-api
- Video clip motion prompts use the genre's preferred camera commands and motion style
- Music and VO defaults are pre-filled from the genre's `audio_defaults`
- If skipped, analyze the story concept and pick the best-fit genre automatically — but tell the user which genre you chose

**The full genre preset definitions live in Appendix A below under "Genre Cinematography Presets".

**Question 2: "How long should the film be?"** (single-select)
- header: "Duration"
- options:
  - **"~30 seconds"** — Single scene or moment
  - **"~60 seconds"** — Short narrative arc
  - **"~90 seconds"** — Full short film with setup/conflict/resolution
  - **"~2-3 minutes"** — Extended narrative, multiple scenes
- Default if skipped: I'll match duration to the story's natural pacing.

**Question 3: "What should the music / mood feel like?"** (single-select)
- header: "Music mood"
- Pre-fill the description with the genre preset's `audio_defaults.music_mood` as the recommended option
- options:
  - **"[Genre default]" (Recommended)** — Pre-fill from the selected genre's music mood (e.g., Sci-Fi → "Dark ambient electronic, sub-bass, Johann Johannsson"; Horror → "Drone, infrasound, reversed textures")
  - **"Minimal piano / ambient"** — Restrained, emotional, space between notes
  - **"Orchestral / cinematic"** — Strings, building intensity, classic film score
  - **"Electronic / modern"** — Synths, beats, contemporary feel
- Default if skipped: Use the genre preset's music mood.

**Question 4: "Should there be dialogue or speech?"** (single-select)
- header: "Dialogue"
- options:
  - **"No dialogue"** — Pure visual storytelling with sound design only
  - **"Minimal speech"** — A few key words or lines (e.g., a character calling out)
  - **"Full dialogue"** — Characters speak throughout
- Default if skipped: Analyze the concept and make a conscious stylistic choice (see Dialogue Style Guide below).

**Dialogue Style Guide — When to use each option:**

The choice between dialogue and visual storytelling is one of the most important creative decisions. It must be made consciously, not defaulted.

| Story Type | Recommended | Why |
|-----------|-------------|-----|
| Character rivalry/relationship study | **Minimal speech** | 1-3 key lines that crystallize the dynamic. Silence between characters says more than conversation. Think Lauda/Hunt — the rivalry is in the looks, not the words. |
| Action/chase/sports | **No dialogue** | Motion IS the story. Music and SFX carry emotion. Dialogue breaks the rhythm. |
| Emotional drama (loss, reunion, discovery) | **No dialogue** or **Minimal speech** | A single line at the climax ("I'm sorry", "Come home") has more power than a scene of dialogue. Pure visual storytelling with music is the strongest tool for emotion. |
| Comedy/wit/banter | **Full dialogue** | Comedy lives in delivery, timing, and wordplay. The voice IS the joke. |
| Thriller/mystery/negotiation | **Full dialogue** | Tension comes from what's said vs unsaid. Dialogue carries subtext. |
| Documentary/explainer | **Full dialogue** | Information requires speech. But use VO narration, not character dialogue. |
| Brand/concept video | **No dialogue** | VO narration over visuals. Character dialogue in product videos feels forced. |
| Music video / mood piece | **No dialogue** | Music is the voice. Adding speech fights the music. |

**The golden rule:** If cutting all dialogue would make the story STRONGER, cut it. Dialogue should only exist when its absence would make the story weaker. A 60-second film with zero dialogue and a powerful visual arc will always outperform a 60-second film with forced conversation.

**In dangerously-auto mode:** The orchestrator MUST analyze the concept against this guide and make an explicit choice, logging it as a `pipeline_decision` event: `{"event": "pipeline_decision", "detail": "Dialogue style: minimal speech — rivalry film, 2 key radio lines crystallize the dynamic, silence carries the tension"}`.

**Question 5: "Do you have specific character descriptions?"** (single-select)
- header: "Characters"
- options:
  - **"Yes, I'll describe them"** — User provides character details
  - **"No, design them for me"** — I'll create characters that fit the story and show you reference sheets
- Default if skipped: I'll design characters and show reference sheets for approval.

**Question 6: "How much creative control do you want?"** (single-select)
- header: "Control"
- options:
  - **"Supervised"** — Show me each storyboard frame one by one. I approve every creative decision.
  - **"Autonomous"** — Generate everything with QC checks, only pause at major milestones (storyboard, visual lock, final mix).
  - **"Dangerously Auto"** — Full autopilot. Generate EVERYTHING end-to-end with zero interaction. No approval gates, no milestone reviews. I review only the final output. Maximum speed, maximum risk.
- Default if skipped: Supervised.

**Question 7: "Any specific shots or moments you envision?"** (single-select)
- header: "Key shots"
- options:
  - **"Yes, I have some in mind"** — User describes specific shots they want
  - **"No, surprise me"** — I'll storyboard the whole thing
- Default if skipped: I'll design the full storyboard.

**Question 8: "Where should I save everything?"** (single-select)
- header: "Save location"
- options:
  - **"Desktop"** — `~/Desktop/{film-title}/`
  - **"Specify a path"** — User provides a custom directory
- Default if skipped: `~/Desktop/{film-title}/`

### After intake

Summarize the creative brief back to the user in 5-6 lines, confirm, and proceed to Phase 1. Any question the user skipped gets a smart default noted in the summary.

### What I handle automatically (no input needed)
- Narrative script with story beats and emotional arc
- Cinematographer Agent camera plan with shot-by-shot composition and lens choices
- Pre-production assets via /production-consistency (characters, products, locations, wardrobe, brand, cinematography dept)
- Storyboard with QC continuity checks
- All video clips generated in parallel
- Sound design: SFX, music, and dialogue — frame-accurately synced to visuals

### Autonomous Mode QC — Fatal vs Artistic

**CRITICAL: QC agents are NOT optional in autonomous mode OR dangerously-auto mode. They MUST be explicitly launched via Agent tool even though the user doesn't see the results.** The orchestrator must: (a) launch the Storyboard Continuity QC agent after storyboard generation, (b) launch the Cinematographer QC agent after storyboard generation, (c) launch the Video Clip Quality QC agent after clip generation. "Launched" means calling the Agent tool with a prompt that includes ALL generated frame/clip paths and the QC checklist. It does NOT mean "thinking about QC" or "glancing at a few frames yourself." In MULTIPLE prior productions, all QC agents were defined but never actually launched — broken anatomy, wrong wardrobe, and inconsistent characters reached the final output, forcing the user to catch errors manually. This is a REPEATED process failure. The ██ MANDATORY QC GATE ██ markers in the pipeline diagram exist specifically because this step keeps getting skipped.

**In autonomous mode, QC agents still run on every generated image/clip.** The difference is what gets flagged vs silently handled:

| Issue Type | Autonomous Behavior | Supervised Behavior |
|-----------|-------------------|---------------------|
| **FATAL** — wrong aspect ratio, character has extra limbs, character wardrobe doesn't match spec, product shape completely wrong, text hallucination, broken composition | QC agent flags → auto-rework via img-ctrl-api → re-QC | Same — flag + rework |
| **WARNING** — slight color drift, minor lighting inconsistency, small prop detail change | Logged in QC report → proceeds | Shown to user inline |
| **ARTISTIC** — "does this mood feel right?", composition preferences, emotional tone of the frame | Skipped — trade-off of autonomous mode | Shown to user for approval per-frame |

**At each milestone gate** (storyboard complete, picture lock, final mix), show the accumulated QC report with all warnings. User can request rework on specific items.
- Multiple rounds of mixing until it sounds right

### Dangerously Auto Mode — Zero Interaction

When the user selects "Dangerously Auto" (or says "just do everything", "full auto", "no stops", "don't ask me anything"), the ENTIRE pipeline runs without ANY user interaction:

**What changes:**
- ALL approval gates are SKIPPED — no pausing at storyboard, picture lock, or final mix
- ALL milestone reviews are SKIPPED — user does NOT see intermediate outputs
- Genre selection uses the best-fit based on concept analysis (no AskUserQuestion)
- Music mood, voice character, and all creative decisions are made by the system
- QC agents still run internally but NEVER pause for user input
- Fatal QC issues trigger automatic rework (max 2 rounds, then proceed with best available)
- Artistic QC issues are logged but never shown mid-production
- The system presents ONLY the final assembled output at the very end

**What stays the same:**
- All QC agents MUST be explicitly LAUNCHED via Agent tool — they do not run passively. "QC runs internally" means the orchestrator LAUNCHES the agent, the agent runs without user review, and fatal issues are auto-reworked. It does NOT mean QC happens magically.
- Production log still captures everything (production_log.jsonl)
- All assets still saved locally (nothing ephemeral)
- All pre-production steps still execute (character refs, camera plan, etc.)
- /production-consistency MUST run (character refs, face crops, location establishing shots, Kling elements) — this is the FOUNDATION of visual consistency and CANNOT be skipped
- Cost gates are logged but do NOT pause for approval

**The risk:**
- If the system makes a bad creative decision early (wrong genre, wrong character look), everything downstream is built on that mistake
- Regeneration of individual clips still costs money — and you only discover issues after the full pipeline completes
- The final output might need 2-3 complete reruns if fundamental choices were wrong
- This mode is best when: you trust the system, the concept is clear, and speed matters more than per-frame control

**How the pipeline behaves:**

```
DANGEROUSLY AUTO PIPELINE:
  1. Concept received → genre auto-selected based on concept analysis
  2. Narrative script written → no review
  3. Cinematographer designs camera plan → no review
  4. Audio design drafted → no review
  5. /production-consistency runs all departments → MANDATORY, NEVER SKIP → QC Director auto-resolves, no user review
  6. Storyboard frames generated
  7. ██ MANDATORY QC GATE ██ Launch Storyboard QC Agent (via Agent tool) → reads EVERY frame →
     checks: anatomical errors (extra limbs, broken joints = FATAL), character consistency,
     wardrobe match, location continuity, camera composition vs plan.
     FATAL items → auto-rework (regenerate frame, max 2 rounds). Log all results.
     DO NOT PROCEED TO STEP 8 UNTIL QC PASSES. This is not optional in ANY mode.
  8. Video clips generated (Kling, all tiers from camera plan)
  9. ██ MANDATORY QC GATE ██ Launch Video Clip QC Agent (via Agent tool) → checks EVERY clip →
     composition match, character consistency, frozen frames, text hallucination, duration.
     FATAL items → auto-rework. Log all results.
  10. Silent cut assembled → NO picture lock pause
  11. Audio generated (music + SFX + voice if applicable) → Audio QC runs internally
  12. Final mix assembled → Mix QC runs internally
  13. >>> FIRST AND ONLY USER TOUCHPOINT: Final video presented <<<
  14. User reviews and requests changes (iteration from here is normal)
```

> **REPEAT FAILURE WARNING:** QC agents have been SKIPPED in dangerously-auto mode in MULTIPLE prior productions despite being defined in the pipeline. The pattern is: the orchestrator generates all frames, then proceeds directly to video generation without ever launching the QC agent. This results in broken anatomy, inconsistent characters, and wrong wardrobe reaching the final output — forcing the user to catch errors that the system should have caught automatically. Steps 7 and 9 above are marked with ██ MANDATORY QC GATE ██ specifically because they have been skipped before. They are NOT descriptions of what happens passively — they are ACTIONS the orchestrator must explicitly take by launching Agent tools.

---

## PRODUCTION LOG

Every production run MUST maintain a continuous event log at `{project}/production_log.jsonl`. This is a JSONL file (one JSON object per line) that captures every significant event during the production.

### Log Format

Each line is a JSON object:
```json
{"ts": "2026-03-26T12:45:00.000Z", "phase": "1.2", "agent": "cinematographer", "event": "task_start", "task": "Shot Design & Camera Plan", "detail": "14 shots planned for 90s film", "cost_usd": null, "duration_ms": null, "status": "started"}
```

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `ts` | string | ISO 8601 timestamp |
| `phase` | string | Pipeline phase (e.g., "1.1", "2.3", "3.5") |
| `agent` | string | Responsible agent or skill (e.g., "orchestrator", "cinematographer", "character-dept", "img-ctrl-api", "kling-video", "qc-storyboard") |
| `event` | string | Event type (see Event Types below) |
| `task` | string | Human-readable task name |
| `detail` | string | Specific details, parameters, or notes |
| `cost_usd` | number/null | Estimated cost of this action (null if free or unknown) |
| `duration_ms` | number/null | How long this action took (null if not yet complete) |
| `status` | string | "started", "completed", "failed", "retried", "skipped" |

### Event Types

| Event | When to Log |
|-------|------------|
| `phase_start` | Beginning of a pipeline phase (Phase 1, 2, 3, 4) |
| `phase_complete` | Phase completed successfully |
| `task_start` | Any discrete task begins (script writing, image generation, clip generation) |
| `task_complete` | Task completed successfully |
| `task_failed` | Task failed — include error in detail |
| `task_retried` | Task is being retried after failure |
| `agent_launch` | An agent is spawned (name, purpose) |
| `agent_complete` | An agent finished its work |
| `api_call` | External API called (Kling, Gemini, ElevenLabs, Minimax) — include endpoint, model, parameters |
| `api_response` | API returned result — include status, task_id if applicable |
| `asset_generated` | A file was created (image, video, audio, document) — include path and file size |
| `asset_rejected` | QC rejected an asset — include reason and planned rework |
| `asset_approved` | QC approved an asset |
| `qc_start` | QC agent begins review |
| `qc_report` | QC report generated — include pass/fail/warning counts |
| `user_input` | User provided feedback or approval |
| `user_approval` | User approved a milestone (storyboard, picture lock, final mix) |
| `skill_invoked` | A sub-skill was called (/production-consistency, /img-ctrl-api, /vid-gen) |
| `cost_gate` | Cost checkpoint — show estimated spend before proceeding |
| `error` | Any error that doesn't fit other categories |
| `rework` | An asset is being regenerated due to QC failure or user feedback |
| `tier_upgrade` | Kling tier upgraded (draft → standard → premium) for a clip |
| `pipeline_decision` | A workflow decision was made (e.g., "skipping wardrobe dept — no color conflicts") |

### When to Log

**Log EVERY significant action. Err on the side of over-logging.** Specifically:

1. **At every phase transition** — log phase_start and phase_complete
2. **Before and after every API call** — log api_call (with parameters) and api_response (with result)
3. **For every generated asset** — log asset_generated with file path, size, and what it is
4. **For every QC check** — log qc_start, then individual asset_approved/asset_rejected, then qc_report
5. **For every agent launched** — log agent_launch with name and purpose
6. **For every user interaction** — log user_input or user_approval
7. **For every sub-skill invocation** — log skill_invoked
8. **For every error or retry** — log task_failed, then task_retried
9. **For every cost gate** — log cost_gate with estimated and actual costs
10. **For every workflow decision** — log pipeline_decision with reasoning

### How to Write Logs

The orchestrator and all agents write to the same log file using append:

```bash
echo '{"ts":"'$(date -u +%Y-%m-%dT%H:%M:%S.000Z)'","phase":"1.1","agent":"orchestrator","event":"task_start","task":"Narrative Script","detail":"Writing script for Wheat Field concept","cost_usd":null,"duration_ms":null,"status":"started"}' >> "{project}/production_log.jsonl"
```

Or in the agent prompt, instruct agents to write their events:
```
After completing each task, append a log entry to {project}/production_log.jsonl using Bash:
echo '{"ts":"...","phase":"...","agent":"your-name","event":"task_complete","task":"...","detail":"...","cost_usd":...,"duration_ms":...,"status":"completed"}' >> {project}/production_log.jsonl
```

### Log Analysis (Post-Production)

After a production run, the log can be analyzed to:

1. **Timeline reconstruction** — replay the entire production sequence
2. **Cost audit** — total actual spend vs estimated spend
3. **Bottleneck identification** — which phases/tasks took the longest
4. **Failure analysis** — which assets were rejected and why, how many retries
5. **Skill improvement** — which QC checks caught real problems, which prompts needed iteration
6. **Agent performance** — which agents completed fastest, which had the most failures

Example analysis query:
```bash
# Total cost
cat production_log.jsonl | python3 -c "import json,sys; print(f'Total: \${sum(json.loads(l).get(\"cost_usd\",0) or 0 for l in sys.stdin):.2f}')"

# Failed tasks
cat production_log.jsonl | python3 -c "import json,sys; [print(json.loads(l)['detail']) for l in sys.stdin if json.loads(l).get('status')=='failed']"

# Timeline
cat production_log.jsonl | python3 -c "import json,sys; [print(f'{json.loads(l)[\"ts\"]} [{json.loads(l)[\"phase\"]}] {json.loads(l)[\"agent\"]}: {json.loads(l)[\"task\"]} — {json.loads(l)[\"status\"]}') for l in sys.stdin]"
```

### Log File Location

Always at: `{project}/production_log.jsonl`

This file is NEVER deleted or overwritten during a production run. It is append-only. If the production is restarted, new entries are appended with new timestamps — the log shows the full history including restarts.

---

## CRITICAL WORKFLOW PRINCIPLES

These are non-negotiable. They come from real production failures.

### 1. Visuals First, Audio Last (Picture Lock Workflow)
Audio is generated ONLY after the visual cut is approved ("picture lock"). Generating audio before visuals are finalized means re-doing it when visuals change. This is standard Hollywood workflow.

### 2. Draft Images → Final Images (Watermark Pipeline)
Storyboard images are drafted fast using `/img-ctrl` (Gemini web UI — free, fast, but has visible sparkle watermark). Once approved, they are re-rendered to clean watermark-free versions using `/img-ctrl-api` (Gemini API — no visible watermark, only invisible SynthID). Only the clean versions are fed to video generation.

### 3. Parallel EVERYTHING — MANDATORY
**NEVER generate video clips sequentially.** Submit clips to the Kling API in **waves of 5** (Kling's concurrency limit — error 1303 if exceeded). Submit 5 tasks, poll until all 5 complete, then submit the next wave. This is still parallel (5 at a time) vs sequential (1 at a time). Sequential = 25+ min. Parallel waves = 5 min.

Generate SFX, voice, and music as parallel background agents.

### 4. QC Agents at Every Gate
Spin up dedicated QC agents at:
- **Storyboard gate**: After all frames are generated, before user review
- **Video gate**: After all clips are generated, before silent cut assembly
- **Audio gate**: After audio cue sheet is written, before audio generation
- **Mix gate**: After first assembly, before presenting to user

### 5. Frame-Accurate Audio Positioning
All audio placement uses **frame numbers** (at the video's FPS), converted to milliseconds. Never round to whole seconds — a 1-second misalignment at 24fps is 24 frames off, which is visible. Use this formula:
```
timestamp_ms = (clip_start_frame + offset_frames) * (1000 / fps)
```
Kling clips vary by duration setting. Use ffprobe to get exact duration and FPS per clip. Typical: 24-30 FPS.

### 6. Character Consistency
Create character reference sheets before any video generation. Use the same reference descriptions in every storyboard prompt. Lock wardrobe, hair, props, body type.

### 6.5. Camera Plan Is Law
The Cinematographer's camera_plan.md is the authoritative document for all visual decisions. Every storyboard image prompt and every Kling video motion prompt must follow it exactly. If a generated image doesn't match the planned composition, it gets regenerated — not accepted and rationalized. The camera plan can only be changed by the Cinematographer in response to user feedback or AI feasibility issues, not by the orchestrator or QC agents overriding it.

### 6.6. Element-Driven Consistency (NEW)
After /production-consistency generates character reference sheets, CREATE KLING ELEMENTS for each character.

**CRITICAL: Kling's API extracts EVERYTHING from reference images — face, clothing, background.**
There is NO "face only" selector in the API (the web UI has one, but it's not exposed). Therefore:

1. **Use the tight face-only crop** (`face_ref.png` — forehead to chin, ear to ear, NO wardrobe visible) as the element's `coverImage`. This prevents Kling from locking onto the reference outfit.

```bash
# Create element from TIGHT FACE CROP (no wardrobe visible)
node ~/.claude/skills/ads-gen/scripts/tools/kling-video.js --elements --create \
  --name "{character}" \
  --image {project}/pre-production/characters/{name}_face_ref.png \
  --tag "Character" \
  --element-desc "face and facial features of {name}"
```

2. Store returned element IDs in `{project}/pre-production/element_ids.json`
3. **For wardrobe changes:** /production-consistency step C2 generates per-outfit reference images (`{name}_wardrobe_{outfit}.png`). Pass the correct wardrobe variant as `ref_images` per frame — this is the ONLY reliable way to change outfits. Kling ignores prompt-described clothing when a conflicting reference image is present.
4. In storyboard.json per frame:
   - `"elements": ["u_123456"]` — locks facial identity (from face-only crop)
   - `"ref_images": ["{name}_wardrobe_{outfit}.png", "{location}_establishing.png"]` — controls outfit + environment per scene

**How the layers separate concerns:**
| Layer | Controls | What Kling Sees |
|-------|----------|-----------------|
| Element (face-only crop) | Facial identity | Forehead-to-chin crop — no wardrobe leak |
| ref_images wardrobe variant | Outfit for THIS scene | Full-body reference in correct outfit |
| ref_images location establishing | Environment consistency | Location visual anchor |
| Storyboard frame (image_1) | Exact composition | The approved storyboard image |

For products appearing in 3+ shots, also create product elements for consistent rendering.

### 7. Avoid AI Hands
AI image generation consistently fails at hand anatomy. For close-up shots, reframe to focus on the character's face with hands in shadow, blur, or out of frame.

### 8. Non-Speech Vocalizations Don't Work
Current AI TTS cannot produce realistic effort grunts, gasps, or non-verbal sounds. Skip them — environmental SFX carry emotion better than fake vocals. Only use TTS for actual speech/dialogue.

---

## PIPELINE OVERVIEW

```
PHASE 1: PRE-PRODUCTION
  ├── 1.1 Write narrative script (story beats, dialogue, emotional arc)
  ├── 1.2 ★ CINEMATOGRAPHER AGENT: Shot Design & Camera Plan
  │       ├── Coverage plan per scene (master + coverage shots)
  │       ├── Emotion-to-camera mapping (close-up for intimacy, wide for isolation)
  │       ├── Visual arc design (how framing evolves across the film)
  │       ├── Screen direction map (character movement/eyeline continuity)
  │       ├── AI generation feasibility notes (what Kling/Gemini can/can't do)
  │       └── Output: camera_plan.md (the authoritative shot-by-shot camera document)
  ├── 1.2.5 ★ VOICE CASTING: Assign Kling voice_ids per speaking character
  ├── 1.3 Draft audio design document (plan only, no generation)
  ├── 1.4 >>> /production-consistency <<< (characters, products, locations, wardrobe, brand, cinematography dept)
  ├── 1.5 User approval gate (script + camera plan + audio design + pre-production assets + QC report)
  └── ASK: Supervised or Autonomous mode?

PHASE 2: VISUAL PRODUCTION
  ├── 2.1 Generate draft storyboard frames (guided by camera_plan.md)
  ├── 2.2 ★ CINEMATOGRAPHER QC: Composition & Camera Craft Review
  ├── 2.3 ★ QC AGENT: Storyboard Continuity Check
  ├── 2.4 User storyboard review (per-frame in Supervised, batch in Autonomous)
  ├── 2.5 Convert approved frames → watermark-free (/img-ctrl-api, Gemini API)
  ├── 2.6 Generate ALL video clips in PARALLEL (Kling AI, tier from camera plan)
  ├── 2.6.5 ★ DIALOGUE-FIRST GENERATION: TTS generated BEFORE video → clips with dialogue baked in from frame 1
  ├── 2.7 ★ CINEMATOGRAPHER QC: Motion & Camera Execution Review
  ├── 2.8 ★ QC AGENT: Video Clip Quality Check
  ├── 2.9 Assemble silent_cut.mp4 + dialogue_cut.mp4 (with embedded voice)
  ├── 2.10 User reviews visual flow → iterate → PICTURE LOCK
  └── ★ QC AGENT: Audio Positioning Pre-Analysis (spins up at picture lock)

PHASE 3: AUDIO POST-PRODUCTION (after picture lock)
  ├── 3.1 Extract keyframes per frame (not per second)
  ├── 3.2 Frame-by-frame visual analysis
  ├── 3.3 Write precision audio cue sheet (frame-accurate timestamps)
  ├── 3.4 ★ QC AGENT: Audio Cue Sheet Validation
  ├── 3.5 Generate ALL audio in PARALLEL (3 background agents)
  ├── 3.6 Audio file verification
  └── 3.7 ★ QC AGENT: Audio Sync Pre-Check

PHASE 4: FINAL MIX
  ├── 4.1 Build audio layers with frame-accurate adelay values
  ├── 4.2 Final mix (music continuous, SFX event-based, voice synced)
  ├── 4.3 ★ QC AGENT: Mix Quality Check
  ├── 4.4 Mux video + master audio → export
  └── 4.5 User review → iterate levels → final delivery
```

---

## QC AGENTS — HOLLYWOOD STANDARD

### ★ Storyboard Continuity QC Agent

Spin up as a background agent after all storyboard frames are generated. The agent reads every frame and checks:

**Character Consistency:**
- Does the character's wardrobe match the reference sheet in EVERY frame? (e.g., white t-shirt, not blue) — wardrobe mismatches are FATAL, not warnings. A character who raced in a tank top cannot appear in a jacket 2 shots later.
- Is the character's approximate age, hair, and body type consistent?
- Are props consistent? (same wrench design, same toolbox)
- Is the character wearing a helmet in scenes where helmets are required (racing, sports)?

**Product/Vehicle Consistency — FATAL if wrong:**
- Does the product/vehicle in EVERY frame match the product_reference.png from pre-production? Compare the generated frame against the product reference sheet.
- Is the product TYPE correct? (e.g., kick scooter vs motorcycle vs moped — these are DIFFERENT vehicles, not interchangeable. A wrong vehicle type is as serious as a wrong character.)
- Is the product's form factor consistent ACROSS all frames? If frame 5 shows a kick scooter and frame 6 shows a motorcycle, this is a FATAL cross-frame inconsistency — not a warning.
- Check EVERY frame containing the product against the same reference. Inconsistency between ANY two frames is FATAL.

**Location Continuity:**
- Same kitchen in all interior shots? (tile color, cabinet style, window position)
- Same apartment in hallway/corridor shots?
- No anachronistic items (modern appliances in a period piece)

**Camera Craft:**
- 180-degree rule respected between consecutive shots?
- No identical camera angles in consecutive shots (jump cut check)?
- Logical spatial progression (camera positions make sense in the space)?

**Editorial Flow (consecutive same-location shots) — CRITICAL:**
For every pair of consecutive shots sharing the same location:
- Do the backgrounds differ substantially? (Same wall/screen in same frame position = FAIL → jump cut)
- Is there at least a 2-stop scale change across the cut? (MS → MS in same room = FAIL)
- Is the camera angle shift at least 30 degrees? (Both near-frontal in same room = FAIL)
- The test: would a viewer's eye need to completely re-orient between cuts? If not → FAIL.
- Each shot's composition must tell something NEW about the story. Two shots that differ only in which face is visible are one shot too many.

**Anatomical Check:**
- Any shots with prominent hands? Flag for reframe.
- Extra limbs, merged body parts, anatomical errors?

**Output format:**
```
STORYBOARD QC REPORT
=====================
Frame 01 (exterior): ✓ PASS
Frame 02 (kitchen):  ✓ PASS
Frame 03 (close-up): ⚠ WARNING — hands visible, check anatomy
Frame 04 (water):    ✗ FAIL — boy wearing BLUE shirt, should be WHITE
  → Action: Re-edit frame 04, change shirt to white
Frame 05 (crawling): ✗ FAIL — same camera angle as frame 04
  → Action: Regenerate from different angle (reverse shot)
...
SUMMARY: 6 PASS, 1 WARNING, 2 FAIL
```

### ★ Video Clip Quality QC Agent

Spin up after all video clips are downloaded. Extracts first and last frames from each clip and checks:

- Does the clip match its storyboard frame? (composition, character, setting)
- Is there visual corruption, artifacts, or frozen frames?
- Is character appearance consistent across clips?
- Are there any text hallucination artifacts? (AI video sometimes generates garbled text)
- Duration check: is each clip the expected duration per the Kling duration setting?

### ★ Audio Cue Sheet Validation QC Agent

Reviews the audio cue sheet for:

- Every visual action has a corresponding sound cue
- No overlapping events on the same layer that would cause clipping
- Dialogue/voice cues align with frames where the character's mouth is open or expression changes
- Music entry/exit points make emotional sense
- Frame-accurate timestamps are used (not rounded seconds)
- Total audio timeline matches total video duration exactly

### ★ Audio Positioning QC Agent (spins up at picture lock)

Launches automatically when the user confirms picture lock. This agent:
1. Extracts keyframes at **every 5 frames** (200ms intervals at 25fps) — NOT per-second
2. Analyzes each keyframe for visual events
3. Pre-builds a frame-accurate event timeline
4. This timeline feeds directly into the audio cue sheet in Phase 3

This is more granular than per-second extraction and catches events that happen between seconds.

### ★ Mix Quality QC Agent

After first assembly, before presenting to user:
- Checks audio levels don't clip (peak < -1dB)
- Verifies music is audible throughout (no unintended silence gaps)
- Confirms voice segments are louder than underlying layers
- Checks fade-to-black aligns with audio fade-out
- Verifies total duration matches expected

---

## PHASE 1: PRE-PRODUCTION

**LOG:** Append `phase_start` event to production_log.jsonl before beginning this phase.

### Step 1.1: Narrative Script

**The Screenwriter Agent** writes the narrative script. This agent is a world-class screenwriter with:
- **Multilingual capability** — writes dialogue in any language the user specifies (English, Chinese, Japanese, Korean, Spanish, French, German, etc.). When writing non-English dialogue, writes in the native script (e.g., 中文, 日本語, 한국어) with romanization and English translation in parentheses for the orchestrator's reference.
- **Dialogue craft** — every line reveals character or advances plot. No filler. Subtext over text: what characters mean differs from what they say. Lines imply physical delivery (a turn away, a step closer, a pause).
- **Voice differentiation** — each character speaks in a distinct voice reflecting their background, education, personality, and emotional state. A military commander's clipped precision sounds nothing like a street kid's loose slang.
- **Silence as dialogue** — knows when NOT to write dialogue. A look, a gesture, a held beat often says more. The screenplay explicitly marks these beats: `(beat)`, `(silence — they both know)`, `(he turns away instead of answering)`.
- **Structural awareness** — writes dialogue that works within the 120-character Kling text2video limit per line. Long speeches are naturally broken into short, actable lines that breathe.

**Language handling for multilingual films:**
When the user specifies a non-English language or mixed-language film:
- Dialogue is written in the target language's native script
- `dialogue_sheet.json` includes both `text` (native) and `text_en` (English translation) fields
- `voice_language` in voice_casting.json matches the dialogue language ("zh", "en", "ja", "ko", "es")
- Kling lipsync supports: Chinese, English, Japanese, Korean, Spanish
- For unsupported languages (French, German, etc.): use Strategy B with external TTS (ElevenLabs multilingual_v2 supports 29 languages) + Kling audio2video lipsync

Write the story script focusing on narrative beats, NOT camera work (that's the Cinematographer's job in Step 1.2).

From the user's concept, write:
- Scene breakdown with locations and time of day
- Character actions and dialogue beat-by-beat
- Emotional arc per character through each scene
- Key story moments that need visual emphasis
- Continuity requirements (what must match across scenes)

Format:
```
SCENE N — [location] · [time of day]

BEAT 1: [What happens — action, dialogue, emotion]
BEAT 2: [What happens next]
...

EMOTIONAL STATE: [How the character feels at end of scene]
STORY FUNCTION: [What this scene accomplishes — setup, escalation, climax, resolution]
CONTINUITY: [What must match from previous/next scenes]
```

Save to `{project}/script.md`.

**Dialogue Format (when user selects "Minimal speech" or "Full dialogue"):**

When the film includes dialogue, each scene's beats include inline dialogue:

```
BEAT 1: [Action description]

    CHARACTER: "Dialogue line here." [emotion, delivery direction]
    CHARACTER2: (beat) "Response line." [emotion]

DIALOGUE NOTES: N lines, alternating/overlapping, pause between lines ~Xs.
```

After writing the script, extract a structured `dialogue_sheet.json`:

```json
{
  "lines": [
    {
      "id": "DL_01",
      "scene": 1,
      "beat": 1,
      "character": "Ghost",
      "text": "You're two seconds off the mark.",
      "emotion": "controlled",
      "direction": "confident, even tone",
      "char_count": 38,
      "approx_duration_s": 2.5,
      "pause_after_s": 0.8
    }
  ]
}
```

Save to `{project}/dialogue_sheet.json`.

**Dialogue writing rules:**
- Each line must reveal character or advance plot — no filler
- Subtext over text: what characters mean vs say should differ
- Maximum 120 chars per line (Kling text2video limit). Split longer lines at natural break points.
- Lines should imply physical delivery (lean, turn away, step closer)

**Do NOT include camera angles, lens choices, or shot types here.** The Cinematographer Agent in Step 1.2 translates story beats into camera language.

### Step 1.2: ★ CINEMATOGRAPHER AGENT — Shot Design & Camera Plan

Launch a dedicated **Cinematographer Agent** (`cinematographer`). This is the most important creative agent in the pipeline — it translates the story into visual language. It runs as a named agent so it can be recalled in Phase 2 for QC.

**This agent is a world-class Director of Photography.** It thinks in compositions, light, lenses, and emotional geography. It knows:
- Classical Hollywood coverage (master → over-shoulder → close-up → insert)
- European art cinema framing (long takes, deep staging, off-center compositions)
- Modern indie techniques (handheld intimacy, natural light, environmental portraits)
- AI video generation constraints (what Kling and Gemini can actually produce reliably)

**Agent prompt:**

```
You are the Cinematographer / Director of Photography for "{PROJECT_NAME}".

You are a world-class DP with deep expertise in both classical and modern cinematography. You translate story into visual language — every camera position, lens choice, and composition decision serves the emotional truth of the scene. You also have expert knowledge of AI video generation tools (Kling AI, Gemini image generation) and know their strengths and limitations.

SCRIPT: {full narrative script from Step 1.1}
GENRE PRESET: {selected genre — read full preset from Appendix A below for camera/lens/lighting defaults}
FILM DURATION: {target duration}
CHARACTER COUNT: {number of characters}
DIALOGUE SHEET: {dialogue_sheet.json contents — structured dialogue lines with character, text, emotion, timing. NULL if no-dialogue film.}
VOICE CASTING: {voice_casting.json contents — voice assignments per character. NULL if no-dialogue film.}

Your deliverable is a CAMERA PLAN document (camera_plan.md) that becomes the authoritative reference for ALL downstream generation — storyboard images, video clips, and QC checks.

## Part 1: Visual Strategy

Before designing individual shots, establish the film's visual strategy:

### A. Visual Arc
How does the framing evolve across the film to serve the emotional journey?
- Opening: [e.g., "Wide, observational, distance — we watch from outside"]
- Rising tension: [e.g., "Tightening — medium shots, less headroom, walls closing in"]
- Climax: [e.g., "Extreme close-up, handheld, breaking the controlled framing"]
- Resolution: [e.g., "Returns to wide but warmer — the space feels different now"]

### B. Camera Identity
What is the camera's relationship to the character?
- [e.g., "The camera is a quiet observer. It never draws attention to itself. It watches with empathy but doesn't intervene. Static holds predominate — movement is reserved for emotional turning points."]

### C. Lens Strategy
What focal lengths and why?
- Master shots: [e.g., "35mm — environmental, shows the character in their world"]
- Medium shots: [e.g., "50mm — neutral perspective, natural proportion"]
- Close-ups: [e.g., "85mm — compression, intimacy, isolates the face from background"]
- When to break the pattern: [e.g., "Wide-angle 25mm for the flood scene — distortion = panic"]

### D. Lighting Philosophy
How does light serve the story? (Informed by genre preset but adapted to this specific film)
- [e.g., "Motivated light only — every source is visible or implied. No beauty lighting. The kitchen has one window — that's the key. Practicals (stove, fridge) provide fill."]

### E. Color & Exposure Arc
- [e.g., "Slightly overexposed highlights in opening (hot summer). Exposure normalizes as tension builds. Underexposed in the flood. Returns to warm overexposure in mother's embrace."]

## Part 2: Screen Direction Map

Track character positions and movement directions across every cut:

```
SCENE 1 (exterior):
  Character A: not visible
  Camera: facing building (north)

SCENE 2 (kitchen):
  Character A: frame center, facing camera (south wall behind)
  Eyeline: down (looking at work)
  Screen direction: static

SCENE 3 (close-up hands):
  Character A hands: frame center
  Movement: left to right (wrench turning clockwise)
  NOTE: Maintain L→R direction for all wrench work

SCENE 4 (water burst):
  Character A: frame right (consistency with scene 2 positioning)
  Water: enters from left (pipe location must be camera-left)
  Screen direction: A moves RIGHT to escape → must ENTER scene 5 from LEFT

...
```

## Part 3: Shot-by-Shot Camera Plan

For EVERY shot in the film:

```
SHOT N — [shot type] · [location]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Story beat:     [What story moment this captures]
Emotion:        [What the viewer should FEEL]

FRAMING:
  Shot size:    [ECU / CU / MCU / MS / MWS / WS / EWS]
  Angle:        [Eye-level / Low / High / Dutch / Bird's eye / Worm's eye]
  Composition:  [Rule of thirds position, leading lines, negative space usage]
  Headroom:     [Tight / Normal / Generous]
  Looking room: [Direction character looks → space in that direction]

CAMERA:
  Lens:         [Focal length + motivation — e.g., "85mm — isolates face, compresses background"]
  Movement:     [Static / Dolly in / Tracking left / Crane up / Handheld]
  Speed:        [If moving — slow creep, medium drift, fast whip]
  Motivation:   [WHY the camera moves — e.g., "Push in as realization hits"]

KLING GENERATION NOTES:
  Tier:         [draft / standard / premium — based on shot importance]
  Duration:     [5s / 10s / 15s — based on action length]
  Camera cmd:   [Exact Kling camera_control params — e.g., "zoom: 3" or "tilt: -4"]
  Aspect:       [16:9 default, or different if this shot demands it]
  Cautions:     [e.g., "Hands visible — reframe if anatomy fails", "Screen content — face away from camera"]

END FRAME (if dramatic camera motion needed):
  Has end frame: [YES / NO — YES when camera movement significantly changes composition]
  End composition: [Describe the ENDING composition — e.g., "Camera has pushed past the character, now showing the hallway stretching ahead, character's back in lower left"]
  Motion arc:     [What happens between start and end — e.g., "Camera dollies forward past the character, revealing the space they're walking into"]
  Why end frame:  [Motivation — e.g., "The prompt-only camera command [Dolly in] doesn't reliably achieve a full push-past. Anchoring both ends guarantees the motion arc."]

AI IMAGE PROMPT GUIDANCE:
  Start frame:  [Specific framing instruction for the FIRST frame — e.g., "Character positioned in right third, looking left into negative space. Low angle, slightly below eye level. Kitchen window visible in upper left providing key light."]
  End frame:    [If END FRAME = YES: Specific framing instruction for the LAST frame — e.g., "Camera has moved past the character. We now see the hallway ahead, character's back visible in lower-left corner. Same location, same lighting direction, but composition has shifted 180°."]
  What to avoid: [e.g., "Do NOT center the character. Do NOT show full body — waist-up only."]

PROMPT COMPOSITION:
  Emotion key:   [Key from EMOTION_MAP — e.g., determined, fearful, contemplative]
  Shot size key: [Key from SHOT_SIZE_MAP — e.g., close_up, medium_shot, wide_shot]
  Atmosphere:    [Key from ATMOSPHERE_MAP — e.g., stormy, golden_hour, intimate]
  Pacing:        [Key from PACING_MAP — e.g., slow, sudden, fluid]

CONTINUITY:
  Matches:      [What must match from previous shot — character position, prop state, lighting]
  Screen dir:   [Character facing/moving which direction, eyeline]
  180° line:    [Where is the axis, which side of it is the camera]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Part 4: Coverage Map

For each SCENE (not shot), list the coverage:

```
SCENE: Kitchen (shots 2-6)
  MASTER:     Shot 2 — wide establishing, full kitchen
  MEDIUM:     Shot 3 — waist-up, character working
  CLOSE-UP:   Shot 4 — hands detail
  REACTION:   Shot 5 — face reacting to water
  WIDE:       Shot 6 — aftermath, full kitchen with water

  Coverage ratio: 5 shots / 1 scene = strong coverage
  Variety check: ✓ WS, MS, CU, Insert, Reaction — full range
  180° check: ✓ Camera stays on south side of kitchen axis
```

## Part 5: AI Generation Feasibility Notes

Flag shots that will be challenging for AI generation and provide workarounds:

| Shot | Challenge | Workaround |
|------|-----------|------------|
| Shot 4 (hands close-up) | AI hands often deformed | Frame as forearm + tool, hands in shadow or motion blur |
| Shot 7 (running through door) | Doors unreliable in AI video | Split: static shot of hallway, then character already through |
| Shot 3 (screen visible) | Text hallucination on screens | Frame screen facing away from camera |

## Part 6: Kling Tier Recommendations

| Shot | Tier | Why |
|------|------|-----|
| Shot 1 (establishing) | standard | Simple static wide shot, no character |
| Shot 5 (water burst) | premium | Complex action, physics-dependent |
| Shot 6 (crying close-up) | premium | Emotional keystone, needs best quality |
| Shot 8 (embrace) | premium | Emotional climax, warm overexposure |
| All others | standard | Good enough for narrative |

## Part 7: Dialogue Coverage (if film has dialogue)

When characters speak, the Cinematographer must plan for lipsync:

**Framing rules for dialogue shots:**
- Speaking characters MUST be framed in CU or MCU (mouth clearly visible)
- For 2-character dialogue, plan standard coverage: master (MS two-shot) → OTS A → OTS B → CU reactions
- Wide/extreme wide shots where characters speak are LIPSYNC_INCOMPATIBLE — voice overlaid in mix only

For each shot with dialogue, add to the camera plan:

```
DIALOGUE:
  Lines:          ["DL_01", "DL_02"]
  Lipsync viable: YES (CU/MCU, mouth visible) or NO (WS/EWS)
  Speaker in frame: YES / NO
```

Save camera_plan.md to: {project}/camera_plan.md
```

**The camera_plan.md is the AUTHORITATIVE document for all downstream generation.** Storyboard image prompts pull their composition instructions from it. Video clip motion prompts pull their Kling camera commands from it. QC agents validate against it.

**After the Cinematographer completes the camera plan:**
1. The plan is shown to the user for approval (at Step 1.5)
2. If the user says "I want more close-ups" or "make it more handheld" — the Cinematographer revises
3. Once approved, the camera plan is LOCKED and drives everything downstream

### Step 1.2.5: Voice Casting (NEW — dialogue films only)

When the film has dialogue, assign a consistent Kling voice to each speaking character during pre-production.

**Voice Casting Algorithm:**
1. Read unique characters from `dialogue_sheet.json`
2. For each character, match to a voice from the Kling VOICE_CATALOG based on gender, age, and personality
3. List available voices: `node ~/.claude/skills/ads-gen/scripts/tools/kling-video.js --list-voices`

**Voice Catalog archetypes (for English dialogue):**

| Character Type | Recommended Key | API voice_id | Notes |
|---|---|---|---|
| Authoritative male (30s+) | serious_boss | ai_laoguowang_712 | Cold, commanding — good for military, authority |
| Warm male (30s+) | steady_dad | ai_huangyaoshi_712 | Deep, calm — good for mentors, fathers |
| Young competitive male | sporty_boy | tiyuxi_xuedi | Athletic, confident energy |
| Charming male | humorous_guy | tiexin_nanyou | Witty delivery, charisma |
| Professional female | career_woman | girlfriend_2_speech02 | Confident, businesslike |
| Warm female | gentle_older_sis | chat1_female_new-3 | Soothing, reassuring |
| Elegant female | elegant_lady | chengshu_jiejie | Refined, composed |

Save to `{project}/pre-production/voice_casting.json`:

```json
{
  "characters": {
    "RAZOR": {
      "kling_voice_id": "ai_laoguowang_712",
      "kling_voice_key": "serious_boss",
      "voice_language": "en",
      "voice_speed": 0.9,
      "voice_notes": "Cold, commanding, clipped — the Lauda archetype"
    },
    "GHOST": {
      "kling_voice_id": "tiexin_nanyou",
      "kling_voice_key": "humorous_guy",
      "voice_language": "en",
      "voice_speed": 1.0,
      "voice_notes": "Charming but frustrated edge — the Hunt archetype"
    }
  }
}
```

In **supervised mode**: Generate a 3s test clip per character for voice audition.
In **dangerously-auto mode**: Auto-select based on character attributes.

### Step 1.3: Audio Design Document

Draft (but DO NOT generate) the full audio plan:

```markdown
## Music
- Mood: [genre, tempo, key, reference artists]
- Architecture: continuous / segmented
- Emotional arc: [how music evolves across the film]

## Sound Effects Inventory
| SFX | Description | Approx Timing | Duration |
|-----|-------------|---------------|----------|
| cicadas | Beijing summer Cryptotympana atrata | 0:00–end | 30s loop |
| wrench_metal | Chrome wrench on steel pipe | clips 2-3 | 10s |
| ... | ... | ... | ... |

## Voice / Dialogue
| Line | Character | Emotion | Approx Timing |
|------|-----------|---------|---------------|
| "妈妈！" | Boy | fearful/crying | clip 7 (running) |

## Audio Architecture
[Describe the emotional flow: where is silence powerful, where does sound overwhelm, where do layers thin out for a voice moment]
```

Save to `{project}/audio_design.md`. This is planning only — generation happens in Phase 3 after picture lock.

### Step 1.4: Pre-Production Assets — /production-consistency

> **CRITICAL WARNING:** /production-consistency was previously skipped in dangerously-auto mode, causing inconsistent characters and varying quality across clips. This step is now MANDATORY in ALL modes (supervised, autonomous, dangerously-auto). It is NON-NEGOTIABLE — without it, every downstream frame and clip will lack visual anchoring.

**Run the Production Consistency Engine (see Appendix B below).** This launches department agent teams that generate ALL visual reference assets needed for consistent storyboard and video generation.

Pass to the skill:
- The script from Step 1.1
- The selected genre preset
- Any character descriptions from the user (Question 5)
- Any product/brand descriptions from the concept
- The project save path

The skill handles:
- **Character Department** — 3-pose reference sheets (front / 3/4 action / side profile), face_ref crops, Character Spec documents
- **Product Department** — 4-view product sheets, in-use scale references, Product Spec documents
- **Location Department** — Establishing shots, detail close-ups, Location Spec documents
- **Wardrobe & Props Department** — Cross-character color conflict audit, wardrobe board, props board, continuity notes
- **Brand & Logo Department** — Logo reference sheets, end cards, brand placement rules
- **QC Production Director** — Reviews ALL department output against script, approves or sends back for rework

In **supervised mode**: each department's output is shown to the user for approval.
In **autonomous mode**: departments run with auto-QC (fatal issues get auto-reworked, artistic choices not reviewed).

**Output folder:** `{project}/pre-production/` (see /production-consistency for full structure)

**How pre-production assets feed into storyboard generation (Phase 2):**

| Asset | How It's Used in Storyboard Prompts |
|-------|-------------------------------------|
| Character Spec (text) | Copy-pasted verbatim into EVERY prompt — never abbreviated |
| face_ref.png | Passed as `--image` to img-ctrl-api for the first frame featuring each character |
| Product Spec (text) | Included in every prompt where the product appears |
| product_reference.png | Visual reference for product consistency |
| Location establishing.png | Referenced in every prompt set in that location |
| Location Spec (text) | Key identifying features included in every location prompt |
| Continuity notes | Applied per-shot (e.g., "character is wet from shot 4 onward") |
| Wardrobe board | Storyboard QC agent cross-references character appearance |
| End card | Used directly as the closing storyboard frame |
| Character element ID | Passed as `--element {id}` to kling-video.js for cross-clip consistency |
| Product element ID | Passed as `--element {id}` for product consistency across shots |
| Camera plan coverage groups | Converted to multi-shot JSON for master+coverage generation |

### Step 1.5: User Approval Gate

Present script + camera plan + audio design + pre-production QC report + all reference sheets. Do not proceed without approval — if the user says "his hair should be longer" or "the kitchen should have yellow walls", send the feedback back to the relevant department in /production-consistency for rework. If the user wants camera changes ("more close-ups", "make it more handheld"), send the feedback to the Cinematographer agent for camera_plan.md revision.

**Dangerously auto:** Skip this gate. Proceed immediately.

---

## PHASE 2: VISUAL PRODUCTION

**LOG:** Append `phase_start` event to production_log.jsonl before beginning this phase.

### Step 2.0: Construct storyboard.json (MANDATORY — ALL MODES)

**This step is non-negotiable.** Before generating any images or video, the orchestrator MUST construct `{project}/storyboard.json` by reading upstream assets. This is the single source of truth for all downstream generation.

**Construction algorithm:**

1. Read `{project}/camera_plan.md` — extract every SHOT N block
2. Read all `{project}/pre-production/characters/*_spec.md` — load full text per character
3. Read all `{project}/pre-production/locations/*_spec.md` — load key identifying features
4. Read the selected genre preset name from Phase 1

For EACH shot in camera_plan.md, create a storyboard.json frame entry using the **JSON Scene Descriptor** format. Each field controls one visual dimension — change one field, change one thing in the output.

```json
{
  "image": null,
  "end_frame": null,
  "end_frame_prompt": "{camera_plan.md → AI IMAGE PROMPT GUIDANCE → End frame composition. null if no end frame.}",

  "scene": {
    "setting": "{camera_plan.md → AI IMAGE PROMPT GUIDANCE → environment/set description}",
    "action": "{camera_plan.md → Story beat — the physical action happening in this shot}",
    "context": "{script.md → STORY FUNCTION for this beat — why this moment matters narratively}",
    "camera": {
      "shot": "{camera_plan.md → Shot size → key: close_up, medium_shot, wide_shot, extreme_close_up, medium_close_up, medium_wide, extreme_wide, over_shoulder, low_angle, high_angle, dutch, birds_eye, pov, profile, two_shot}",
      "movement": "{camera_plan.md → Movement → key: static, dolly_in, dolly_out, pan_left, pan_right, pan_up, pan_down, zoom_in, zoom_out, crane_up, crane_down, tracking_left, tracking_right, orbit_left, orbit_right, push_through, pull_back}",
      "speed": "{camera_plan.md → Speed → slow, very_slow, fast, or null for default}",
      "angle": "{camera_plan.md → Angle → eye_level, low_angle, high_angle, dutch, birds_eye, worms_eye}"
    },
    "lighting": "{camera_plan.md → PROMPT COMPOSITION → Atmosphere key from ATMOSPHERE_MAP: warm, cold, dawn, golden_hour, twilight, night, overcast, rainy, stormy, intimate, tense, gritty, epic, etc.}",
    "emotion": "{camera_plan.md → PROMPT COMPOSITION → Emotion key from EMOTION_MAP: determined, contemplative, fearful, joyful, etc. — for single-character scenes}",
    "character_emotions": null,
    "pacing": "{camera_plan.md → PROMPT COMPOSITION → Pacing key from PACING_MAP: slow, fast, sudden, fluid, weighted, etc.}"
  },

  "character": "{FULL TEXT of character_spec.md — copy-paste verbatim, never abbreviate}",
  "wardrobe": "{Exact clothing visible in THIS shot from the character spec's wardrobe section}",
  "location": "{Key identifying features from location_spec.md}",
  "genre": "{selected genre preset name}",
  "elements": ["{element IDs from element_ids.json}"],
  "ref_images": [
    "{project}/pre-production/characters/{name}_face_ref.png",
    "{project}/pre-production/products/{product}_reference.png",
    "{project}/pre-production/locations/{location}_establishing.png"
  ],

  "sound_fx": [
    { "sound": "{description of audible element}", "timing": "{continuous | at action | background | at action peak}" }
  ],
  "dialogue": [
    {
      "character": "CHARACTER_NAME",
      "text": "Dialogue line (max 120 chars for Kling)",
      "emotion": "{emotion key for voice delivery}"
    }
  ],
  "voice_ids": ["{Kling voice catalog key or raw ID — one per speaking character}"],
  "has_dialogue": true,
  "lipsync_strategy": "omni",

  "duration": "{camera_plan.md → Duration}",
  "tier": "{camera_plan.md → Tier}",
  "title": "Shot {N} — {description}"
}
```

**How the scene descriptor compiles to a Kling prompt:**

The `composeFromScene()` function in kling-video.js takes the structured `scene` object and compiles it into a 5-layer Kling-optimized prompt:

```
Layer 1 (Scene):     location + ATMOSPHERE_MAP[scene.lighting] + scene.setting
Layer 2 (Character): character spec + EMOTION_MAP[scene.emotion] (face + body + micro-action) + wardrobe
Layer 3 (Action):    scene.context (STORY CONTEXT:) + scene.action + PACING_MAP[scene.pacing]
                     + dialogue markers (<<<voice_N>>> says "text" [emotion])
Layer 4 (Camera):    SHOT_SIZE_MAP[scene.camera.shot] + CAMERA_ANGLE_MAP[angle] + speed
                     + camera command injected as [Dolly in], [Tracking right], etc.
Layer 5 (Style):     GENRE_STYLE_MAP[genre] (texture + skin + movement)
                     + sound_fx descriptions (Audible: sound (timing))
```

**Precision editing example — change just the lighting:**
```json
"scene": { "lighting": "warm_intimate" }  →  "scene": { "lighting": "night" }
```
Only the ATMOSPHERE_MAP expansion changes. Everything else stays identical.

**`sound_fx` field — native audio hints for Omni:**
When `sound_fx` is present, the frame auto-enables native audio on the Omni endpoint (`generate_audio: true`). Sound descriptions are injected into the prompt so Kling's audio model generates matching ambient/SFX audio natively — no separate SFX generation needed for scene-appropriate sounds. Complex SFX (layered, precisely timed) still go through the Phase 3 audio pipeline.

**`dialogue` + `voice_ids` — Omni single-injection dialogue:**
When dialogue is present, voice_ids are passed to the Omni endpoint and dialogue text is injected as `<<<voice_N>>> says "text"` markers in the prompt. Kling generates the clip with the character performing the line natively — lip movement, expression, and speech all in one generation. This is TIER 1 dialogue strategy (see hierarchy below).

**Backward compatibility:** The old flat-field format (`prompt` + `emotion` + `shot_size` + etc.) still works. If a frame has a `scene` object, it takes priority. If no `scene` object, the legacy `composePrompt()` path handles the flat fields.

**Dialogue Strategy Hierarchy (TIER 1 = best, TIER 3 = worst):**

| Tier | Strategy | Quality | When to Use |
|------|----------|---------|-------------|
| **TIER 1 — `omni`** (DEFAULT) | Single-injection via Kling Omni endpoint. Dialogue text + voice_ids + first frame + end frame + ref_images ALL submitted in one API call. Kling generates the clip with the character performing the line, correct lip movement, camera motion, and visual consistency — all in one generation. | Best — dialogue is native to the clip generation, not bolted on. Character's expression, mouth, and body respond to the act of speaking. | ALL dialogue shots (CU, MCU, MS). This is the default and preferred strategy. |
| **TIER 2 — `tts_overlay`** | No lipsync. TTS audio generated separately via ElevenLabs, mixed into the audio track in Phase 4 via adelay. The video clip is generated silently. Voice is laid over the visuals in post. | Acceptable for wide shots — produces a "trailer" feel where VO plays over action. No lip sync but audience accepts this convention in WS/EWS. | WS/EWS shots where mouth isn't visible. Also acceptable for narration/voiceover that isn't character dialogue. |
| **TIER 3 — `post_lipsync`** | Generate clip silently → then retrofit lipsync via Kling's `/videos/lip-sync` endpoint. Two-step process: video first, speech bolted on after. | Worst — the character's expression in the silent clip was never "performing" dialogue. Retrofitting mouth movement onto a non-speaking face creates uncanny results. | **ONLY when explicitly requested by the user.** Never auto-selected. This strategy exists as a last resort for edge cases. |

> **CRITICAL: Omni is the default because it generates dialogue natively.**
> A dialogue clip generated via Omni has the character PERFORMING the line from frame 1. Their expression, mouth movement, body language, and even breathing are all responding to the act of speaking. This cannot be achieved by generating silently and bolting on speech after.
>
> Post-clip lipsync (Tier 3) is fundamentally flawed for the same reason dubbing a film is worse than shooting in the target language. The performance was never meant to include speech. Abandon this as a default strategy.

**Lipsync strategy routing (computed at storyboard.json construction):**

```
IF no dialogue → lipsync_strategy = null, has_dialogue = false
ELSE IF lipsync_viable == false (WS/EWS) → lipsync_strategy = "tts_overlay" (voice mixed in Phase 4)
ELSE → lipsync_strategy = "omni" (DEFAULT — single-injection dialogue generation)
```

**Omni single-injection pipeline (TIER 1 — per dialogue clip):**

The Kling Omni endpoint (`/v1/videos/omni-video`) accepts ALL of the following in a single API call:
- `image_1`: storyboard frame (first frame / composition anchor)
- `image_2` through `image_7`: reference images (face_ref, wardrobe, location, product)
- `frame_start` / `frame_end`: first and last frame for dramatic camera motion
- `voice_ids`: Kling voice catalog IDs for character speech
- `generate_audio: true`: enables audio generation
- `prompt`: includes `<<<voice_1>>> says "dialogue text" [emotion]` markers
- `element_1` through `element_7`: character element IDs for identity consistency

This means a single Omni call can generate a clip where:
- The character looks correct (face ref + element)
- They're wearing the right outfit (wardrobe ref)
- The location matches (location ref)
- The camera moves dramatically (first + end frame)
- The character speaks the line with the assigned voice (voice_ids + prompt markers)
- All in one coherent generation

```
Step 1: Populate storyboard.json frame with dialogue, voice_ids, ref_images, end_frame
Step 2: Kling Omni generates everything in one call
Step 3: QC the clip — mouth sync, expression, visual consistency, dialogue audibility
Step 4: If QC fails → regenerate (same Omni call). Do NOT fall back to post-lipsync.
```

**tts_first Pipeline (per dialogue clip):**
```
Step 1: Write dialogue direction (emotion, subtext, delivery notes) → dialogue_direction.md
Step 2: Generate ElevenLabs TTS with emotion-specific settings → voice/DL_NN.mp3
Step 3: QC the TTS — does it have emotional character? If flat, regenerate with adjusted settings.
Step 4: Generate video clip via Kling with --lip-sync providing the TTS audio
        The storyboard image is the visual anchor, the TTS is the audio anchor.
        Kling generates a clip where the character is PERFORMING the line.
Step 5: QC the clip — mouth sync quality, expression maintenance, visual consistency.
        If lipsync is poor → retry once. If still poor → fall back to tts_overlay.
```

**ElevenLabs Emotion Acting System (per-emotion TTS recipes):**

| Emotion | stability | style | speed | similarity | Character |
|---------|-----------|-------|-------|------------|-----------|
| cold_commanding | 0.80 | 0.15 | 0.85 | 0.90 | Power through restraint, almost monotone |
| dismissive | 0.70 | 0.25 | 1.05 | 0.85 | Casual contempt, thrown-away delivery |
| triumphant | 0.50 | 0.65 | 1.10 | 0.80 | Unstable with exhilaration, big dynamics |
| whispered_intense | 0.85 | 0.10 | 0.75 | 0.90 | Intimate, each word deliberate |
| awestruck | 0.40 | 0.75 | 0.80 | 0.75 | Voice breaking with wonder, breathless |
| overwhelmed | 0.35 | 0.80 | 0.90 | 0.75 | Composure cracking, gasping quality |
| hopeful | 0.60 | 0.50 | 0.90 | 0.85 | Warm, slightly uncertain, reaching |
| determined | 0.75 | 0.35 | 0.85 | 0.85 | Firm, resolved, weight behind words |
| menacing_quiet | 0.90 | 0.05 | 0.70 | 0.95 | Terrifyingly controlled whisper |
| furious | 0.30 | 0.85 | 1.15 | 0.70 | Voice cracking with rage, explosive |
| tender | 0.65 | 0.45 | 0.80 | 0.85 | Soft, warm, vulnerability showing |
| sarcastic | 0.70 | 0.40 | 1.05 | 0.85 | Performative, words bitten off |
| defiant | 0.55 | 0.55 | 1.00 | 0.80 | Pushing back, energy rising |
| broken | 0.35 | 0.70 | 0.75 | 0.80 | Barely holding together, fragile |
| haughty | 0.75 | 0.20 | 0.90 | 0.90 | Aristocratic superiority, measured contempt |
| focused | 0.85 | 0.10 | 0.80 | 0.90 | Meditative intensity, deliberate |

These settings are populated from the `dialogue_sheet.json` emotion field and the dialogue direction document.

**`ref_images` — CRITICAL for Kling consistency (NEW):**
Previously, Kling only saw the storyboard frame as its starting image. Pre-production visual assets (face_ref, character sheets, location establishing shots) were used by Gemini to generate consistent storyboard frames, but Kling never received them directly.

With `ref_images`, these visual assets are passed to Kling's omni endpoint as `image_2`, `image_3`, etc. Kling can now reference the character's face sheet and location establishing shot alongside the storyboard frame, producing clips with dramatically better character and location consistency.

For each frame, populate `ref_images` with ALL of the following that apply:
- `{character}_face_ref.png` — for every character visible in that shot
- `{character}_wardrobe_{outfit}.png` — for the specific outfit in this scene
- `{location}_establishing.png` — for the location of that shot
- `{product}_reference.png` — **MANDATORY for every frame where the product is visible, even partially, even in the background.** This is the single most important reference for product consistency. A frame showing a character ON/WITH a product without the product_reference in ref_images WILL produce an inconsistent product. This was the root cause of a complete storyboard failure in a prior production where the AI hallucinated different vehicle types across frames.

When `ref_images` is present, the frame auto-routes through the omni endpoint (which is the only endpoint supporting multiple image references). The prompt should reference these as `@image_2`, `@image_3`, etc.

**Shot size conversion table:**
| Camera Plan Value | Storyboard Key |
|------------------|----------------|
| ECU / Extreme close-up | `extreme_close_up` |
| CU / Close-up | `close_up` |
| MCU / Medium close-up | `medium_close_up` |
| MS / Medium shot | `medium_shot` |
| MWS / Medium wide | `medium_wide` |
| WS / Wide shot | `wide_shot` |
| EWS / Extreme wide | `extreme_wide` |

**The `image` field starts as `null`** — it gets filled in Step 2.1 after storyboard frames are generated and approved. The composition fields (emotion, shot_size, etc.) are populated NOW from camera_plan.md, and they flow through to both image generation prompts AND video generation prompts.

**In ALL modes (supervised, autonomous, dangerously-auto):** This step runs identically. The storyboard.json is constructed programmatically from upstream assets. There is no user interaction needed and no reason to skip it.

### Step 2.1: Generate Draft Storyboard Frames

Use `/img-ctrl-api` (Gemini API — watermark-free). Each prompt MUST include:
- **Full Character Spec** (from Step 1.4) copy-pasted verbatim — never abbreviate, never assume the model remembers from previous prompts
- **Camera plan composition instructions** (from camera_plan.md Part 3 "AI IMAGE PROMPT GUIDANCE") — the exact framing, angle, shot size, character position, and negative space specified by the Cinematographer. This is NOT optional — the composition must match the camera plan.
- **Kling tier and duration** (from camera_plan.md Part 6) — each shot has a recommended tier and duration assigned by the Cinematographer based on shot importance and complexity
- **Genre preset's `technical` fields** (camera model, lens, aperture, film stock) and `style_modifiers.aesthetic` — these ensure visual consistency across all frames
- **Genre preset's `scene` fields** as defaults for lighting, mood, atmosphere — override per-shot where the script requires it
- `"NO watermark, NO logo, NO text, NO sparkle icon"` in every prompt

**MULTI-REFERENCE IMAGE ANCHORING (CRITICAL — NON-NEGOTIABLE):**

Gemini API supports multiple images in a single prompt via `--image` (primary) + `--extra-images` (additional references). Use this to achieve **omni-consistency** — every frame anchored to ALL relevant visual references simultaneously, not just one.

> **REPEAT FAILURE WARNING — PRODUCT REFERENCE OMISSION:**
> In a prior production ("SPEED DREAM"), product reference images (scooter 4-view sheets) were NOT passed to Gemini for several storyboard frames. The result: Gemini invented its own interpretation of the product — some frames showed motorcycles, some showed mopeds, some showed the correct kick scooter. The inconsistency was WORSE than if every frame had been consistently wrong (because a single source fix wouldn't propagate). The root cause: the `ref_images` array in storyboard.json listed character face_refs and location establishing shots, but OMITTED the product reference for frames where the product was visible.
>
> **THE RULE: If a product/vehicle/prop appears in a shot — even partially, even in the background — its product_reference.png MUST be in both the storyboard.json `ref_images` array AND the `--extra-images` passed to Gemini.** There are ZERO exceptions. A frame showing a character ON a vehicle must reference both the character face_ref AND the vehicle product_reference. Omitting the product reference means Gemini will hallucinate the product from the text prompt alone, and text prompts are not reliable for specific product shapes.

**Per-frame reference strategy:**
| Frame Contains | `--image` (primary) | `--extra-images` (additional) |
|---------------|--------------------|-----------------------------|
| Character only (no product) | `face_ref.png` | `location_establishing.png` |
| Product only (no character) | `product_reference.png` | `location_establishing.png` |
| Character + Product | `product_reference.png` | `face_ref.png,location_establishing.png` |
| Character in location (no product) | `face_ref.png` | `location_establishing.png` |
| Wide/environment with product | `product_reference.png` | `location_establishing.png,face_ref.png` |
| Multiple characters + product | `product_reference.png` | `face_ref_A.png,face_ref_B.png,location_establishing.png` |

**KEY CHANGE:** When a product is visible in the frame, the **product_reference.png becomes the primary `--image`** (not the face_ref). This is because product shape/silhouette is harder for AI to get right from text alone than human faces. Faces are a solved problem for generative AI; specific product designs are not. Anchoring the product visually and describing the character in text produces better results than the reverse.

**Example — a frame showing a racer on a specific vehicle at a track:**
```bash
node ~/.claude/skills/ads-gen/scripts/tools/gemini-api.js \
  --image pre-production/products/scooter_v1_4view.png \
  --extra-images pre-production/characters/alex_face_ref.png,pre-production/characters/alex_wardrobe_tanktop.png,pre-production/locations/loc_amateur_track.png \
  --prompt-file /tmp/shot_prompt.txt \
  --output storyboard/ --person-gen ALLOW_ALL --aspect 16:9 --size 1K
```

The prompt should reference ALL provided images: "Generate this same woman (reference image 1) wearing these exact shoes (reference image 2) on this trail (reference image 3)..."

**Why multi-reference matters:** In a previous production, shoe shots anchored only to the shoe reference produced the correct shoe but a generic character. Character shots anchored only to the face_ref produced the correct face but generic shoes. Multi-reference ensures BOTH are correct in every frame.

**Conversation context (--follow-up) is SECONDARY to multi-reference.** Follow-up maintains the Gemini conversation context from a previous call, but context degrades over multiple turns. Multi-reference provides fresh visual anchors every call. Use multi-reference as the primary consistency mechanism, and --follow-up only for iterative refinements of the same frame.

**End Frame Image Generation (for shots with END FRAME: YES in camera_plan.md):**

For every frame in storyboard.json where `end_frame_prompt` is non-null, generate a SECOND storyboard image representing the shot's ending composition. These must be generated with the SAME reference images and character specs as the first frame to ensure visual consistency.

```bash
# Generate end frame using same references as the start frame
node ~/.claude/skills/ads-gen/scripts/tools/gemini-api.js \
  --image pre-production/characters/runner_face_ref.png \
  --extra-images pre-production/locations/trail_establishing.png \
  --prompt-file /tmp/shot05_end_prompt.txt \
  --output storyboard/ --person-gen ALLOW_ALL --aspect 16:9 --size 1K
# Rename output to shot05_end.png
```

The end frame prompt comes from camera_plan.md's "End frame" composition guidance. It describes WHERE the camera has arrived — the ending composition after the motion arc completes.

**End frame consistency rules:**
- Same character, wardrobe, location, lighting, and time of day as the start frame
- Different composition (that's the whole point — the camera has moved)
- Same reference images passed to Gemini for character/location anchoring
- Use `--follow-up` from the start frame generation to maintain Gemini conversation context for maximum visual consistency between the pair

**End frame naming convention:** `{shot_name}_end.png` (e.g., `shot05_end.png` alongside `shot05.png`)

After generating, update storyboard.json: set the `end_frame` field to the generated end frame path.

**Supervised mode**: Generate start frame, show to user, get feedback. Then generate end frame for the same shot, show both side by side. User approves the motion arc.
**Autonomous mode**: Generate all start frames, then all end frames, then run QC agent.

### Step 2.2: ★ CINEMATOGRAPHER QC — Composition & Camera Craft Review

Recall the Cinematographer agent (SendMessage to `cinematographer`) with the generated storyboard frames. The Cinematographer reviews EVERY frame against camera_plan.md:

**Per-frame checks:**
- [ ] Shot size matches plan (e.g., plan says CU but frame is MWS → FAIL)
- [ ] Composition matches plan (character in right third? leading lines present? negative space correct?)
- [ ] Angle matches plan (eye-level vs low angle vs high)
- [ ] Headroom and looking room correct
- [ ] Lens perspective feels right (compression for telephoto, distortion for wide)
- [ ] Lighting direction consistent with plan

**Sequence checks:**
- [ ] Visual arc progressing as planned (framing tightening/widening per plan)
- [ ] Shot variety across consecutive frames (no 3+ identical shot sizes in a row)
- [ ] Screen direction consistent (character exits left → enters right in next)
- [ ] 180-degree line maintained within each scene
- [ ] Eyeline match between characters in dialogue coverage

**Editorial flow checks (CRITICAL — consecutive same-location shots):**
When two or more consecutive shots share the same location, the QC agent MUST evaluate whether the cut between them will feel natural to a viewer. This is the most commonly missed QC failure — shots that individually pass all technical checks but create a jump-cut feeling when edited together.

For every pair of consecutive shots in the same location, check:
- [ ] **Background differentiation:** Do the two shots share visually similar background composition? If the same wall, screen, or set piece occupies the same region of frame in both shots, the cut will feel like a face-swap jump cut → FAIL. Fix: change camera angle so the background is substantially different.
- [ ] **Scale change across the cut:** Is there at least a 2-stop scale shift (e.g., CU → WS, MS → CU)? Two shots at similar framing scales in the same room will always feel like a jump cut, even if the subjects differ → FAIL. Fix: push one shot tighter or wider.
- [ ] **Angle change across the cut:** Is the camera angle shift at least 30 degrees between the two shots? A small angle change (e.g., both nearly frontal) in the same space reads as a continuity error → FAIL. Fix: move camera to opposite side, go profile, go OTS, etc.
- [ ] **Compositional purpose:** Does each shot's composition tell us something NEW about the story or character that the previous shot didn't? A centered portrait followed by an OTS of a different character in the same room tells us "two people are in a room" — but a CU profile (showing focus/discipline through stillness) followed by a wide OTS (showing the distance between two men) tells us about the RELATIONSHIP. Shots that don't earn their place through compositional storytelling → WARNING.

**The test:** Mentally cut from frame N to frame N+1. Would a viewer's eye need to completely re-orient? If yes → PASS. If the viewer perceives it as "same shot, different face" → FAIL. The background composition is the strongest cue — if the background barely changes, the viewer reads it as the same shot regardless of subject change.

**End frame pair checks (for shots with end_frame):**
- [ ] Start and end frames show the SAME character, wardrobe, location, lighting, time of day
- [ ] Composition has meaningfully changed between start and end (the camera has moved)
- [ ] The motion arc between start and end is physically plausible (no teleportation)
- [ ] Character position in end frame is consistent with the described camera movement (e.g., if camera dollies past, character should be behind camera in end frame)
- [ ] Both frames maintain the same lens perspective and depth of field
- [ ] The pair tells a visual story — the motion from A to B serves the narrative beat

**AI feasibility check:**
- [ ] Hands visible? Flag if anatomy is wrong → request reframe
- [ ] Text/screen visible? Flag if hallucinated → request screen-away reframe
- [ ] Multiple characters? Check relative positioning matches plan

**Location consistency checks:**
- [ ] Same cafe interior across all cafe shots (same wood paneling, same pendant lamp style, same wall art, same table/chair design)
- [ ] Same wheat field look across all wheat shots (same wheat height, same horizon line, same sky)
- [ ] If location details have drifted between shots, flag as FAIL and request regeneration with the location establishing shot re-anchored as `--image`

**Output:** Cinematographer QC report with PASS/FAIL per frame + specific reframe instructions for failures. Failed frames go back to img-ctrl-api with the Cinematographer's revised composition prompt.

### Step 2.3: ★ Storyboard Continuity QC Agent

**MANDATORY** — spin up the Storyboard QC Agent (see QC Agents section above).

In **Supervised mode**: Run QC on each frame as it's generated, report to user inline.
In **Autonomous mode**: Run QC on all frames batch, present report with pass/fail per frame.

Fix all FAIL items before proceeding. Regenerate or edit frames as needed.

### Step 2.4: User Storyboard Review

**Supervised**: User has already reviewed per-frame. Confirm final storyboard.
**Autonomous**: Present all frames + QC report. User reviews and requests changes.

**Dangerously auto:** Skip this gate. Proceed immediately.

### Step 2.5: Convert to Watermark-Free Frames (Gemini API)

Once frames are approved, convert each to clean versions using `/img-ctrl-api`:

```bash
node ~/.claude/skills/ads-gen/scripts/tools/gemini-api.js \
  --image "{project}/storyboard/shot01.png" \
  --prompt-file /tmp/reproduce-prompt.txt \
  --output "{project}/storyboard_clean/" \
  --person-gen ALLOW_ALL \
  --size 4K --final
```

Reproduce prompt:
```
Reproduce this image exactly as-is with maximum fidelity. Do not change anything — same composition, same subjects, same lighting, same color grading, same film grain, same framing. This is a 1:1 reproduction at higher quality. Output must be visually identical to the input.
```

**Fallback** (if API alters the image too much): Use PIL to paint over the watermark:
```python
from PIL import Image
img = Image.open('frame.png')
w, h = img.size
patch = img.crop((w-200, h-100, w-120, h-20))
img.paste(patch.resize((120, 100)), (w-120, h-100))
img.save('frame_clean.png')
```

Save to `{project}/storyboard_clean/`.

**End frames must also be converted.** For every frame with an `end_frame`, run the same conversion on the end frame image. Use the same naming convention: `shot05_end.png` → `storyboard_clean/shot05_end.png`. After conversion, update storyboard.json `end_frame` paths to point to the clean versions.

### Step 2.6: Generate Video Clips — ALL PARALLEL (MANDATORY)

**NEVER generate clips sequentially.** Use this pattern:

```javascript
// Phase 1: Submit ALL tasks simultaneously
const tasks = [];
for (const frame of frames) {
  const res = await submitToKling(frame);
  tasks.push({ taskId: res.task_id, frame });
  await sleep(1000); // 1s between submissions to avoid rate limit
}

// Phase 2: Poll ALL tasks in a single loop
const pending = new Set(tasks.map(t => t.taskId));
while (pending.size > 0) {
  for (const task of tasks) {
    if (!pending.has(task.taskId)) continue;
    const status = await pollTask(task.taskId);
    if (status === 'Success') { download(task); pending.delete(task.taskId); }
    if (status === 'Fail') { log(task); pending.delete(task.taskId); }
  }
  await sleep(10000);
}
```

API: Kling AI video generation
- Model: `kling-v2.6-pro`
- `first_frame_image`: base64 data URL of storyboard_clean frame
- `duration`: 5 (5, 10, or 15 supported)
- `resolution`: `1080p`
- `prompt_optimizer`: true

**Tier Selection (Kling tier system):**
- **Supervised mode:** Use `--tier standard` for all clips. After picture lock approval, upgrade to `--tier premium` for final render.
- **Autonomous mode:** Use `--tier draft` for first pass. Auto-upgrade to `--tier standard` for the assembled silent cut. Use `--tier premium` for the final approved render.
- **O3/omni:** Use when QC Director flags character drift across clips — regenerate drifted clips with `--tier omni`.

**Advanced per-frame features (from camera_plan.md):**

Each frame in the storyboard can now leverage advanced Kling features based on the Cinematographer's camera plan:

| Camera Plan Instruction | Storyboard JSON Field | Kling Feature Used |
|------------------------|----------------------|-------------------|
| "Tier: premium" | `"tier": "premium"` | Per-frame tier override |
| "Duration: 10s" | `"duration": 10` | Per-frame duration |
| Coverage shots (master + close-up) | Multi-shot JSON | `--multi-shot --shots coverage.json` |
| "End frame: character at window" | `"end_frame": "path/to/end.png"` | First+end frame control |
| Character must match across clips | `"elements": ["u_123"]` | Element consistency via Omni |
| Scene has audible elements | `"with_audio": true` | Native audio generation |
| Special visual effect needed | `"effect": "rocket"` | Visual effects endpoint |
| Emotion from camera plan | `"emotion": "determined"` | Prompt composition — physical expressions |
| Shot size from camera plan | `"shot_size": "close_up"` | Prompt composition — framing + DOF language |
| Scene mood/weather | `"atmosphere": "stormy"` | Prompt composition — lighting + texture |
| Movement speed | `"pacing": "slow"` | Prompt composition — motion quality |
| Character spec text | `"character": "Full character spec..."` | Prompt composition — character description |
| Location spec text | `"location": "Key location details..."` | Prompt composition — location description |

**Storyboard.json per-frame example (with prompt composition fields):**
```json
{
  "frames": [
    {
      "image": "storyboard_clean/shot01.png",
      "end_frame": null,
      "prompt": "Wide shot of wheat field at golden hour, wind sweeping through tall stalks",
      "duration": 5,
      "tier": "standard",
      "camera_control": { "pan": 2 },
      "elements": ["u_123456"],
      "emotion": "determined",
      "shot_size": "close_up",
      "atmosphere": "stormy",
      "pacing": "slow",
      "character": "Full character spec text from character_spec.md — ALWAYS include even for partial-body shots (feet, hands, back of head). Specify: who this body belongs to, their skin tone, their build.",
      "wardrobe": "Black racing tank top, black running shorts, white Nike running shoes with cream midsole — include ALL visible clothing items even if only calves/ankles are in frame",
      "location": "Key location details from location_spec.md",
      "character_emotions": null
    },
    {
      "image": "storyboard_clean/shot05.png",
      "end_frame": "storyboard_clean/shot05_end.png",
      "prompt": "Camera behind runner, CU of her back and ponytail, trail stretching ahead, golden hour backlight",
      "duration": 5,
      "tier": "premium",
      "elements": ["u_123456"],
      "ref_images": ["pre-production/characters/runner_face_ref.png", "pre-production/locations/trail_establishing.png"],
      "emotion": "triumphant",
      "shot_size": "medium_shot",
      "atmosphere": "golden_hour",
      "pacing": "fluid",
      "character": "Full character spec...",
      "wardrobe": "Sage green running top, dark leggings",
      "location": "Forest trail details...",
      "character_emotions": null
    }
  ]
}
```

**`end_frame` field — Dramatic Camera Motion via First+Last Frame Anchoring:**

When the Cinematographer plans a shot with significant camera movement that changes composition (push-through, orbit, reveal, front-to-back), the `end_frame` field provides Kling with a visual anchor for WHERE the camera ends up. This eliminates the unpredictability of prompt-only camera commands.

**When to use `end_frame`:**
| Camera Motion | Needs End Frame? | Why |
|--------------|-----------------|-----|
| Static shot | NO | No motion, single frame is sufficient |
| Gentle pan/tilt | NO | Prompt command `[Pan right]` is reliable for small movements |
| Slow dolly in | MAYBE | If the scale change is > 2 stops (WS → CU), use end frame |
| Push-through / dolly past | YES | Composition changes dramatically — prompt can't describe the end reliably |
| Orbit / arc around subject | YES | Subject stays centered but background rotates — needs end anchor |
| Crane up revealing landscape | YES | Starts on subject, ends on environment — completely different frame |
| Front-to-back (reveal) | YES | Camera passes the subject to show what's behind them |
| Whip pan to new subject | YES | Start and end compositions are completely different |

**How `end_frame` interacts with other features:**

| Combination | Routing | What Happens |
|------------|---------|-------------|
| `end_frame` only | Frames endpoint (`/videos/image2video-frames`) | Simple first+last frame interpolation |
| `end_frame` + `elements` | Omni endpoint (frame_start + frame_end + element IDs) | Dramatic motion WITH character consistency |
| `end_frame` + `ref_images` | Omni endpoint (frame_start + frame_end + ref images) | Dramatic motion WITH visual reference anchoring |
| `end_frame` + `elements` + `ref_images` | Omni endpoint (all combined) | Full production mode — motion + identity + references |
| `end_frame` + dialogue (`tts_first`) | Generate TTS first → lipsync the end_frame clip | Dramatic motion WITH embedded dialogue |

**CRITICAL: When `end_frame` is present alongside `elements` or `ref_images`, the clip routes through the Omni endpoint** (which supports `frame_start` + `frame_end` + elements + ref_images simultaneously). The storyboard frame becomes `frame_start`, the end_frame becomes `frame_end`, and elements/ref_images are preserved. This was a routing bug in earlier versions where `end_frame` clips lost element consistency.
```

**CRITICAL: `character` field MUST be populated even for product/detail shots.** A close-up of shoes still shows legs — whose legs? What skin tone? What shorts/leggings? Without this, Kling generates random anonymous body parts that break character consistency.

**`wardrobe` field:** Specifies the exact clothing visible in THIS shot. Pulled from the character spec's wardrobe section for the relevant act/scene. Even partial-body shots need wardrobe — if you can see ankles and calves, specify "black running shorts" or "dark running leggings." This field is injected into the Kling prompt via the composition engine.

**`character_emotions` field (for multi-character scenes):**
When a scene has 2+ characters with DIFFERENT emotional states, use `character_emotions` instead of the single `emotion` field:
```json
{
  "emotion": null,
  "character_emotions": [
    { "name": "the mother", "emotion": "fearful" },
    { "name": "the boy", "emotion": "determined" }
  ]
}
```
Each character gets their own EMOTION_MAP expansion (face + body + micro-action + voice), prefixed with their name so Kling allocates the expression to the correct person. The single `emotion` field should be `null` when `character_emotions` is used.
```

**Multi-shot for coverage:** When the camera plan calls for master + coverage of the same scene (e.g., wide shot + close-up + reaction), use multi-shot to generate them in a single API call:
```json
{
  "shots": [
    { "prompt": "Wide shot of kitchen, character at counter", "duration": 5 },
    { "prompt": "Close-up of character's face, concerned expression", "duration": 5 },
    { "prompt": "Reverse angle, water dripping from pipe", "duration": 5 }
  ]
}
```
This ensures perfect lighting/color consistency across coverage angles.

**Motion continuity across shots (CRITICAL for action sequences):**
Kling has NO API parameter for motion velocity or "mid-action" state. Every clip generated from a static frame starts from zero motion. To maintain motion across cuts:

1. **Prompt engineering:** For any shot where the subject is ALREADY in motion (not starting motion), the prompt MUST include: "ALREADY in full continuous [action] from the first frame, no acceleration, steady [speed] throughout the entire clip, continuous uninterrupted motion." The words "ALREADY" and "from the first frame" are critical.

2. **`--extend` for motion-critical sequences:** When two consecutive shots show the same continuous action (e.g., running feet → running face), generate clip A normally, then use `--extend --task-id {clip_A_task_id}` for clip B. This inherits the final frame's motion state. You can trim the extended clip to just the portion that matches the next storyboard frame's composition.

3. **Post-production trim:** If cold-start artifact is visible (1s freeze-to-motion), trim with `ffmpeg -ss 1 -i clip.mp4 ...` and adjust timing.

4. **`end_frame` in storyboard.json (PREFERRED for dramatic motion):** When the Cinematographer plans a shot with major composition change, both start and end frames are generated during storyboard phase. Kling interpolates between them, producing reliable dramatic camera motion (push-through, orbit, reveal, front-to-back). This is MORE reliable than prompt-only camera commands for complex motions. Works with elements and ref_images via Omni endpoint.

5. **Speed normalization:** If two consecutive clips have different perceived speeds, normalize with `ffmpeg -filter_complex "[0:v]setpts=0.8*PTS[v]"` (1.25x speedup) or `setpts=1.2*PTS` (0.83x slowdown).

**Video extension for clips that need more time:** If a generated clip's action doesn't complete within its duration, extend it:
```bash
node ~/.claude/skills/ads-gen/scripts/tools/kling-video.js --extend --task-id {original_task_id} \
  --prompt "Continue the action, character finishes turning" --output {project}/clips/
```

**Smart mode for prompt-aware tuning:** When generating clips, add `--smart` to auto-detect camera motion, audio needs, and complexity from the prompt text. This is especially useful in autonomous mode where manual tuning per-clip is impractical.

**Prompt composition:** The kling-video.js script includes a prompt composition engine that enriches raw prompts. When building storyboard.json, populate per-frame composition fields from the camera plan:
- `emotion` → from camera_plan.md "Emotion key" field (maps to physical face + body + micro-action expressions)
- `shot_size` → from camera_plan.md "Shot size" field (maps to framing + DOF language)
- `atmosphere` → from camera_plan.md scene mood + weather (maps to lighting + texture descriptions)
- `pacing` → from camera_plan.md "Speed" field (maps to motion quality language)
- `character` → copy-paste FULL character spec from character_spec.md (never abbreviate)
- `location` → key identifying features from location_spec.md
- `genre` → the selected genre preset name (e.g., "drama", "thriller")

The engine auto-structures the prompt as: Scene → Character → Action → Camera → Style. This eliminates manual prompt engineering for each frame.

**In ALL modes including dangerously-auto:** The orchestrator MUST populate composition fields in storyboard.json from camera_plan.md and pre-production specs (Step 2.0). The `--smart` flag is a FALLBACK for standalone clip generation outside the pipeline, NOT a substitute for proper field population. When storyboard.json has explicit composition fields, kling-video.js uses them directly — `--smart` is not needed and should not be passed.

**When to use `--smart` flag:** Only for ad-hoc clip generation outside the storyboard pipeline (e.g., user asks "generate a quick clip from this image"). Never inside the production pipeline where camera_plan.md and pre-production assets are available.

**KLING PROMPT STRUCTURE (MANDATORY for all clip generation):**

The Kling prompt for each clip must follow this 4-layer structure. Do NOT write simple one-line prompts — rich, structured prompts produce dramatically better results.

**Layer 1 — Story Context Harness (sets tone without contaminating the shot):**
Provide 1-2 sentences of narrative context at the TOP of the prompt. This tells Kling WHY the action is happening, which influences the emotional quality of the motion. Do NOT describe other shots — only provide the emotional backdrop.
```
STORY CONTEXT: This is the climactic moment of a Nike running ad — a woman who used to run obsessively and joylessly has rediscovered the pure joy of running after an injury. This shot captures that transformation.
```

**Layer 2 — Action & Motion (the core of what happens):**
Describe the PHYSICAL ACTION with cinematic precision. For mid-action shots, always include "ALREADY in full continuous motion from the first frame." Describe the quality of movement, not just the action.
```
She is ALREADY in full continuous running stride from the first frame — feet hitting the soft trail rhythmically at a steady relaxed pace, no acceleration, no deceleration. Her stride is light and flowing, arms swinging loosely. Her hair bounces with each step. She looks up at the trees with a genuine smile.
```

**Layer 3 — Camera Command (V3: in prompt text; V1: via API param):**
For V3 models, inject camera motion commands in square brackets. These MUST match the camera_plan.md.
```
[Tracking right] at walking pace, smooth lateral follow alongside her at eye level.
```
Available V3 prompt commands: `[Static]`, `[Pan left/right/up/down]`, `[Zoom in/out]`, `[Dolly in/out]`, `[Crane up/down]`, `[Tracking left/right]`, `[Push through]`. Use ONE per clip.

**Layer 4 — Atmosphere & Technical (mood, light, texture):**
Set the visual environment. This comes from the atmosphere and genre fields.
```
Golden hour light filtering through autumn trees. Warm amber tones, long shadows, lens flare from backlight. Soft natural depth of field.
```

**COMPLETE PROMPT EXAMPLE (what a well-structured Kling prompt looks like):**
```
STORY CONTEXT: A Nike running ad — a woman has rediscovered the joy of running after injury. This is her first joyful run on an autumn trail.

She is ALREADY in full continuous running stride from the first frame — feet hitting the soft trail rhythmically at a steady relaxed pace throughout the entire clip, no acceleration, no deceleration, continuous uninterrupted motion. Her stride is light and flowing with gentle midfoot landings. Arms swing loosely and naturally. Her black hair in a loose ponytail bounces with each step. She looks up at the golden trees with a genuine warm smile, eyes crinkling. She wears a sage green running top and dark leggings.

[Tracking right] smooth lateral tracking alongside her at eye level, matching her relaxed pace.

Golden hour light filtering through autumn canopy. Warm amber tones throughout. Dappled light on the soft dirt trail. Autumn leaves visible on the ground. Shallow depth of field with warm golden bokeh behind her.
```

**ANTI-PATTERNS (what NOT to do):**
- ❌ "Woman running on trail" — too sparse, no motion quality, no camera, no atmosphere
- ❌ "Mid-stride on trail, tracking shot" — no story context, no motion continuity cue, no emotion
- ❌ Describing the previous/next shot in the prompt — contaminates THIS shot's action
- ❌ Omitting `[Camera command]` — Kling defaults to unpredictable camera motion
- ❌ Omitting "ALREADY in continuous motion" for mid-action shots — causes cold-start freeze

### Step 2.6.5: Dialogue-First Clip Generation (tts_first strategy)

> **CRITICAL: Dialogue clips are generated WITH audio, not retrofitted.**
> A clip where the character is speaking but was generated silent is a FAILED clip.
> The character must be performing the line from frame 1.

**For each clip with `lipsync_strategy: "tts_first"`:**

**Phase A: Pre-generate TTS (BEFORE video generation)**
```
1. Read the dialogue direction document (written in Step 3.1 or pre-written during storyboard construction)
2. Generate ElevenLabs TTS with emotion-specific settings from the Emotion Acting System table
3. Post-process: de-noise → normalize → room reverb matching
4. QC: Play the audio — does it have emotional character? If flat, adjust settings and regenerate.
5. Save to voice/DL_NN.mp3
```

**Phase B: Generate video clip WITH the TTS audio**
```bash
# The TTS audio is provided to Kling alongside the storyboard image
# The character is PERFORMING the line from the first frame
node ~/.claude/skills/ads-gen/scripts/tools/kling-video.js --lip-sync \
  --video storyboard_clean/shotNN.png \
  --audio voice/DL_NN.mp3 \
  --output clips/ \
  --tier premium
```

If `--lip-sync` with an image input isn't supported, use a two-call approach:
```bash
# Step 1: Generate the silent clip normally
node ~/.claude/skills/ads-gen/scripts/tools/kling-video.js \
  --image storyboard_clean/shotNN.png \
  --prompt "CHARACTER IS SPEAKING: [dialogue text]. [Full 4-layer prompt with speaking action described]" \
  --duration 5 --tier premium --output clips/

# Step 2: IMMEDIATELY lipsync with the TTS audio (before any other clips)
node ~/.claude/skills/ads-gen/scripts/tools/kling-video.js --lip-sync \
  --video clips/shotNN_video.mp4 \
  --audio voice/DL_NN.mp3 \
  --output clips/
```

**The key difference from the old pipeline:** TTS is generated BEFORE video, not after. The video prompt includes "CHARACTER IS SPEAKING" to ensure the storyboard frame generates a face in speaking position. And lipsync is applied IMMEDIATELY after generation, as part of the same wave — not as a separate post-processing phase.

**Phase C: QC the lipsynced clip**
- [ ] Mouth opens on correct syllables (not early/late)
- [ ] Mouth closes between words (not stuck open)
- [ ] Character expression MAINTAINS through lipsync (doesn't flatten)
- [ ] No visual artifacts around mouth/jaw
- [ ] Emotional delivery matches the dialogue direction
If QC fails → regenerate the clip (not just re-lipsync). The whole clip is one unit.

**For clips with `lipsync_strategy: "tts_overlay"`** (WS/EWS):
These remain silent during generation. TTS audio is mixed in Phase 4 via adelay.
This is legitimate — wide shots don't need lip sync, and the audience accepts voice-over in wide shots.

**Multi-speaker clips (e.g., Shot 11 "Together?" / "Together."):**
1. Generate individual TTS per character with emotion settings
2. Concatenate with appropriate pause between lines
3. Feed combined audio to lipsync generation
4. QC: verify BOTH characters' mouths move at the right time

**Constraint:** Kling lipsync requires 2-10s video, 720p-1080p, max 100MB. Audio must be ≥2s (pad with silence if shorter).

### Step 2.7: ★ CINEMATOGRAPHER QC — Motion & Camera Execution Review

Recall the Cinematographer agent to review generated video clips against camera_plan.md:

**Per-clip checks:**
- [ ] Camera movement matches plan (dolly in happened? tracking left executed?)
- [ ] Movement speed correct (slow creep vs fast push)
- [ ] Movement motivation reads correctly (push-in feels like realization, not arbitrary zoom)
- [ ] Static shots are truly static (no unwanted drift)
- [ ] Action timing — does the key moment happen at the right point in the clip?

**Sequence flow check (review clips in order):**
- [ ] Cuts feel intentional (each clip starts where the story needs it)
- [ ] Pacing appropriate (action clips feel urgent, emotional clips breathe)
- [ ] Visual rhythm works across the sequence

**Rework instructions:** If a clip's camera execution doesn't match the plan, the Cinematographer writes a revised Kling motion prompt with specific camera_control parameters and tier recommendation for regeneration.

### Step 2.8: ★ Video Clip Quality QC Agent

Spin up after all clips download. Check every clip (see QC Agents section).

### Step 2.9: Silent Cut Assembly

```bash
ffmpeg -y -f concat -safe 0 -i concat.txt -an \
  -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p \
  -vf "fade=t=out:st={total-1.5}:d=1.5:color=0x1A1816" \
  silent_cut.mp4
```

Hard cuts only. No crossfades. This is cinema.

**Dialogue Cut (for films with dialogue):**

When Strategy A clips have embedded voice audio, also assemble a `dialogue_cut.mp4` that preserves the embedded audio:

```bash
# Ensure all clips have audio tracks (add silent audio to non-dialogue clips)
for clip in clips/clip_*.mp4; do
  has_audio=$(ffprobe -v error -select_streams a -show_entries stream=codec_type -of csv=p=0 "$clip")
  if [ -z "$has_audio" ]; then
    ffmpeg -y -i "$clip" -f lavfi -i anullsrc=r=44100:cl=stereo -c:v copy -c:a aac -shortest "${clip%.mp4}_audio.mp4"
    mv "${clip%.mp4}_audio.mp4" "$clip"
  fi
done

# Assemble with embedded dialogue audio
ffmpeg -y -f concat -safe 0 -i concat.txt -c:v libx264 -c:a aac ... dialogue_cut.mp4
```

Present `dialogue_cut.mp4` at picture lock so the user hears dialogue in context.

### Step 2.10: Picture Lock

Present silent cut to user. Iterate until approved.

**Dangerously auto:** Skip this gate. Proceed immediately.

**At the moment of picture lock**, immediately spin up the **Audio Positioning QC Agent** to begin frame-accurate visual analysis while the user is still in the session.

---


## PHASE 3: AUDIO POST-PRODUCTION (after picture lock)

**LOG:** Append `phase_start` event to production_log.jsonl before beginning this phase.

### Step 3.0: Sound Design Philosophy

Before touching any audio tool, internalize these non-negotiable principles:

- **Sound design is 50% of the storytelling** — it is not decoration, not afterthought, not "nice to have." A perfectly graded film with flat audio feels like a student project. A rough cut with world-class sound feels like cinema.
- **Every audio element serves the emotional narrative.** If a sound doesn't advance the story or deepen feeling, cut it. Busy soundscapes are amateur. Purposeful ones are professional.
- **Silence is the most powerful sound effect.** A sudden drop to room tone before a crucial moment hits harder than any explosion. Use silence as a weapon, not a gap to fill.
- **Audio has its own dramatic arc** that mirrors and amplifies visuals. Music swells BEFORE the visual climax (200ms lead). SFX peaks align with emotional peaks, not just physical actions. The audio arc should be designable independently from the visual edit.
- **The audience should FEEL the sound design, never consciously notice it.** If a viewer says "the music was nice," you failed. If they say "I cried and I don't know why," you succeeded. Sound design works on the subconscious.
- **Three pillars: Emotional Dialogue, Immersive Soundscape, Narrative Music.** Every scene must have all three working in concert. Dialogue carries meaning. Soundscape sells reality and space. Music carries emotion. Remove any pillar and the scene collapses.

### Step 3.1: Dialogue Direction Document

**Before ANY TTS generation**, write a comprehensive dialogue direction document. This is the difference between flat AI narration and emotionally compelling performance. Every line gets a full performance brief.

For EACH dialogue line, specify:

```
LINE_ID: DL_01
TEXT: "French cooking... all butter, no soul."
CHARACTER: Chen — proud warrior, dismissive
SUBTEXT: Attacking first because deep down he's insecure
DELIVERY_NOTES: Thrown away casually. Contemptuous pause after "butter." "No soul" delivered as a death sentence.
PHYSICAL_CONTEXT: Arms crossed, looking away, slight head shake
ACOUSTIC_SPACE: Large industrial kitchen — medium reverb, metallic character
EMOTION_KEY: dismissive
ELEVENLABS_SETTINGS:
  voice_id: SOYHLrjzK2X1 (Harry - Fierce Warrior)
  stability: 0.70
  style: 0.25
  similarity_boost: 0.85
  speed: 1.05
POST_PROCESSING:
  - afftdn=nf=-25 (de-noise)
  - loudnorm=I=-16:TP=-1.5:LRA=7 (normalize)
  - aecho=0.8:0.7:25|35:0.12|0.08 (kitchen room reverb)
```

**Emotion-to-Settings Map (for ElevenLabs):**

| Emotion | stability | style | speed | similarity | Character |
|---------|-----------|-------|-------|------------|-----------|
| cold_commanding | 0.80 | 0.15 | 0.85 | 0.90 | Power through restraint, almost monotone |
| dismissive | 0.70 | 0.25 | 1.05 | 0.85 | Casual contempt, thrown-away delivery |
| triumphant | 0.50 | 0.65 | 1.10 | 0.80 | Unstable with exhilaration, big dynamics |
| whispered_intense | 0.85 | 0.10 | 0.75 | 0.90 | Intimate, each word deliberate |
| awestruck | 0.40 | 0.75 | 0.80 | 0.75 | Voice breaking with wonder, breathless |
| overwhelmed | 0.35 | 0.80 | 0.90 | 0.75 | Composure cracking, gasping quality |
| hopeful | 0.60 | 0.50 | 0.90 | 0.85 | Warm, slightly uncertain, reaching |
| determined | 0.75 | 0.35 | 0.85 | 0.85 | Firm, resolved, weight behind words |
| menacing_quiet | 0.90 | 0.05 | 0.70 | 0.95 | Terrifyingly controlled whisper |
| furious | 0.30 | 0.85 | 1.15 | 0.70 | Voice cracking with rage, explosive |
| tender | 0.65 | 0.45 | 0.80 | 0.85 | Soft, warm, vulnerability showing |
| sarcastic | 0.70 | 0.40 | 1.05 | 0.85 | Performative, words bitten off |
| defiant | 0.55 | 0.55 | 1.00 | 0.80 | Pushing back, energy rising |
| broken | 0.35 | 0.70 | 0.75 | 0.80 | Barely holding together, fragile |

### Step 3.2: Soundscape Design Document

**Before generating any SFX**, design the complete soundscape for the entire film. This document is the blueprint for every non-dialogue, non-music sound in the mix.

For EACH scene/location, define these five layers:

**1. Room Tone / Ambient Bed** — continuous background that establishes the acoustic space
- What does this room SOUND like when nothing is happening?
- Every location must have its own sonic identity (a kitchen hums differently than a dining room)
- These run continuously under the scene and crossfade at scene transitions

**2. Foley Layer** — small physical sounds that sell reality
- Fabric rustling, footsteps, plate touches, breathing, chair creaks
- These are low-volume (0.03-0.08) but their absence makes scenes feel hollow and synthetic
- Layer under every scene where characters are physically present

**3. Action SFX** — specific sounds tied to visible actions
- Knife cuts, wok flames, wine pours, door opens, glass clinks
- Each important sound must be LAYERED: physical impact + body + tail + emotional sweetener
- One-layer SFX sounds thin and cheap; layered SFX sounds cinematic

**4. Emotional SFX** — sounds that amplify emotion without being literally visible
- Ethereal chimes during revelation, sub-bass rumble under menace, breath-like swells during intimacy
- Low in the mix (0.08-0.15) but critical for emotional impact
- These are the secret weapon — the audience feels them without knowing why

**5. Transition Sounds** — audio bridges between scenes
- A lingering reverb tail, a rising tone, a breath of silence, a room tone crossfade
- Smooth transitions feel professional; hard cuts to silence feel like errors

**SFX Layering Protocol:**

Important sounds are built from 2-4 layers, not generated as a single file:

```
CLEAVER STRIKE:
  Layer 1 (Impact):     "Sharp cleaver striking hardwood cutting board, close-miked, tiled kitchen"
  Layer 2 (Sweetener):  "Brief supernatural whoosh, blade cutting through air with power"
  Layer 3 (Sub-bass):   "Deep sub-bass impact, very short, felt more than heard"
  Timing: L2 starts 50ms after L1, L3 starts 20ms after L1
  Mix: L1=0.8, L2=0.3, L3=0.4
```

**ElevenLabs SFX Prompt Engineering:**
- BAD: "knife cutting" (generic, thin, amateur)
- GOOD: "Close-miked carbon steel Chinese cleaver striking a seasoned hardwood cutting board — sharp transient attack with wood resonance, single precise strike, recorded in a large tiled commercial kitchen with 0.5-second natural reverb. No other sounds."
- RULE: Always specify material, surface, mic position, acoustic space, isolation. The more specific the prompt, the more cinematic the result.

### Step 3.3: Frame-Accurate Keyframe Extraction

Extract keyframes at **5-frame intervals** for frame-level audio placement precision. Detect the video's actual FPS rather than hardcoding:

```bash
# Detect actual FPS from the video
FPS=$(ffprobe -v error -select_streams v:0 -show_entries stream=r_frame_rate -of csv=p=0 clips/clip_01.mp4 | bc -l | xargs printf "%.0f")
INTERVAL=5  # every 5 frames
for clip in clips/clip_*.mp4; do
  name=$(basename "$clip" .mp4)
  total_frames=$(ffprobe -v error -count_frames -select_streams v:0 \
    -show_entries stream=nb_read_frames -of csv=p=0 "$clip")
  for ((f=0; f<total_frames; f+=INTERVAL)); do
    ts=$(echo "scale=4; $f / $FPS" | bc)
    ffmpeg -y -ss "$ts" -i "$clip" -frames:v 1 "analysis/${name}_f${f}.jpg" 2>/dev/null
  done
done
```

### Step 3.4: Frame-by-Frame Visual Analysis

Read every extracted keyframe. For each clip, document at frame-level precision:

```markdown
## Clip 06 (29.375s-35.250s) — Boy Crying
| Frame | Time (ms) | Global (ms) | Visual Event |
|-------|-----------|-------------|--------------|
| 0     | 0         | 29375       | Boy standing, wet, looking down. Distressed but holding. |
| 15    | 600       | 29975       | Head lowering. Water dripping from hair. |
| 30    | 1200      | 30575       | Eyes closing. Face beginning to crumble. |
| 50    | 2000      | 31375       | Mouth starting to open. Chin trembling. |
| 65    | 2600      | 31975       | MOUTH FULLY OPEN — peak cry expression. |
| 80    | 3200      | 32575       | Eyes squeezed shut. Full sob. Tears visible. |
| 100   | 4000      | 33375       | Tight close-up. Still crying. |
| 125   | 5000      | 34375       | Crying continues, slight head movement. |
```

### Step 3.5: Precision Audio Cue Sheet

All timestamps in **milliseconds**, derived from frame numbers. Enhanced with emotion, automation, spatial, and reverb columns:

```markdown
| Global ms | Frame | Clip | Visual Event | Audio Cue | Layer | Vol | emotion_context | volume_automation | spatial | reverb_space |
|-----------|-------|------|-------------|-----------|-------|-----|-----------------|-------------------|---------|--------------|
| 0         | 0     | 01   | Exterior wide | Cicadas LOUD start | ambient | 0.40 | peaceful_establishing | fade_in 500ms | wide_stereo | exterior_open |
| 5875      | 0     | 02   | CUT interior | Cicadas drop + kitchen hum | ambient | 0.07 | transition_tension | hard_cut | center | kitchen_large |
| 8000      | 53    | 02   | Legs shift | Wrench clink | sfx | 0.25 | mundane_action | none | slight_left | kitchen_large |
| 12500     | 16    | 03   | Boy strains | Wrench louder + grunt | sfx | 0.35 | effort_building | swell_100ms | center | kitchen_large |
| 17625     | 0     | 04   | WATER BURST | Instant spray + sub-bass | sfx | 0.35 | shock_impact | spike_then_sustain | wide_stereo | kitchen_large |
| 31375     | 50    | 06   | Mouth opens | PRE-SILENCE (all dip) | silence | — | dread_anticipation | all_layers_dip_-6dB | — | — |
| 35500     | 6     | 07   | Running, mouth open | CRY LOUD | voice | 1.0 | anguish_peak | pre-dip_200ms | center | hallway_reverb |
| 42000     | 22    | 08   | In mother's arms | Soft sobbing | voice | 0.35 | relief_comfort | gentle_fade | center | room_intimate |
```

**The adelay values in ffmpeg use milliseconds directly from this table.**

**Source column (for dialogue films):**

| Source | Meaning | Action |
|--------|---------|--------|
| `EMBEDDED` | Voice baked into video clip (Strategy A or B lipsync) | Extract with `ffmpeg -i clip.mp4 -vn extracted.wav` |
| `TTS_OVERLAY` | Voice for WS/EWS shots where mouth isn't visible | Generate TTS, position via adelay |
| `SFX` | Sound effect | Generate via ElevenLabs |
| `MUSIC` | Continuous underscore | Generate via Minimax/ElevenLabs |

### Step 3.6: Audio Cue Sheet Validation QC Agent

Reviews the cue sheet for:
- Every visual action with audible consequence has a sound cue
- Voice cues align with frames where mouth is open or expression changes
- No two loud events overlap on the same layer without intentional design
- Music is specified as continuous (no unintended gaps)
- All timestamps use ms precision (no rounded seconds)
- Total audio timeline = total video duration in ms
- **Every scene transition has a room tone change** (no two adjacent scenes share identical ambient bed)
- **Emotional SFX align with character emotion peaks** (not just visual actions — check emotion_context column)
- **Music emotional arc aligns with the narrative arc** in the cue sheet (tension builds before climax, releases after)
- **No scene has ZERO audio layers** (even intentional silence must have room tone — true digital silence is never acceptable)
- **Dialogue lines have 200-300ms pre-dip** marked on all other layers (check volume_automation column)

### Step 3.7: Generate All Audio — PARALLEL (4 Background Agents)

Launch simultaneously:

**Agent 1: Dialogue**
- Read the dialogue direction document from Step 3.1 — every line has its performance brief
- **Primary TTS: Hume AI Octave** — a speech-language model that understands emotional context semantically. Provide natural language emotion instructions (e.g., "sound sarcastic", "whisper with restrained grief"). It infers HOW text should sound from what the words MEAN. API: `HUME_API_KEY` env var.
- **Fallback TTS: ElevenLabs** — use when Hume doesn't nail a specific voice timbre, or for voices cloned from references. Use emotion-specific stability/style/speed settings from the Emotion Acting System table.
- Generate 2 takes per critical line (revelation, climax, final boss). Keep the better one.
- Post-process each line in sequence: de-noise (`afftdn=nf=-25`) then normalize (`loudnorm=I=-16:TP=-1.5:LRA=7`) then room reverb matching (per the acoustic space in the direction doc)
- **Generate 2 takes per critical line** (any line marked as an emotional peak or turning point). Listen to both, keep the one with more emotional character
- Verify each line has emotional character — if it sounds like a flat AI narrator reading text, regenerate with higher style setting and more specific delivery notes

**Agent 2: Music Score**
- **Use the active genre preset's `audio_defaults.music_mood` as the starting prompt** — e.g., Sci-Fi gets "Dark ambient electronic, pulsing sub-bass"; Horror gets "Drone, infrasound, reversed textures". The user may have overridden this in the intake; if so, use their direction.
- **Primary: ElevenLabs Eleven Music** — generates studio-grade instrumental scores with commercial licensing. Use the **inpainting API** to edit specific sections that don't match the emotional arc. Can extend/trim/loop sections precisely.
- **Backup: Stable Audio 2.5** — up to 4:45 of continuous music with structural coherence. Best for ambient/atmospheric scores.
- **Backup: MiniMax Music 2.5** — now supports up to 5 minutes. Re-test if ElevenLabs quota runs out.
- Attempt single continuous generation with full emotional arc prompt describing how the music should evolve across the film's narrative beats. The prompt must describe TIMING: "At 0:15, shift to intense action. At 0:45, drop to quiet suspense. At 0:55, EXPLODE into revelation..."
- If the provider cannot achieve the arc in one generation, generate stems separately (strings, percussion, piano, brass) and layer them with independent volume automation
- Music must be continuous — no gaps, no sudden stops, no awkward loops
- Duration must cover full video + 5s safety margin (trim in post)
- MiniMax Music 2.5+ (`is_instrumental: true`) for generation

**Agent 3: SFX and Foley**
- Read the soundscape design document from Step 3.2
- **Primary SFX: ElevenLabs Sound Effects V2** — use hyper-specific prompts (material, surface, mic position, acoustic space). 48kHz, up to 30s per generation. Best for custom/unique sounds.
- **Supplementary: Epidemic Sound API** — 200K+ professional human-created SFX library with AI-powered search. Use for guaranteed cinema-quality stock sounds (footsteps, doors, ambient beds). Requires `EPIDEMIC_SOUND_API_KEY`.
- **Room tone**: generate one continuous ambient bed per location (kitchen hum, outdoor cicadas, intimate room silence with HVAC, etc.)
- **Layered SFX**: for each action moment, generate 2-4 layers per the SFX Layering Protocol (impact + body + sweetener + sub-bass). Do NOT generate single-layer SFX for important moments
- **Foley micro-sounds**: generate fabric rustles, footsteps on specific surfaces, plate/utensil touches, breathing. These are low-volume but essential for reality
- **Emotional sweeteners**: generate ethereal tones, sub-bass impacts, tension drones, shimmer sounds — one per emotional peak in the cue sheet
- ElevenLabs Sound Effects V2. One curl per sound. Every prompt must specify material, surface, mic position, acoustic space, and isolation

**Agent 4: Transition and Atmosphere**
- Generate transition sounds between every scene pair (rising tones, reverb tails, breath sounds, whooshes)
- Generate tension drones for suspenseful passages (low continuous tones, barely audible)
- Generate silence-fillers: room tone crossfade segments for scene transitions (fade out Location A room tone while fading in Location B room tone, 500ms overlap)
- Generate any atmospheric textures needed (wind, rain ambience, crowd murmur) as continuous beds

### Step 3.8: Audio File Verification

```bash
for f in sfx/*.mp3 voice/*.mp3 music/*.wav transitions/*.mp3; do
  dur=$(ffprobe -i "$f" -show_entries format=duration -v quiet -of csv="p=0")
  echo "$(basename $f): ${dur}s"
done
```

### Step 3.9: Audio Sync Pre-Check QC Agent

Before assembly, this agent:
1. Reads the audio cue sheet
2. Reads every voice/dialogue file's duration
3. Verifies that each voice clip, when placed at its cue sheet timestamp, doesn't extend past its intended visual window
4. Checks that SFX durations don't bleed into unrelated scenes
5. Verifies room tone files are long enough to cover their entire scene duration
6. Reports any timing conflicts

---

## PHASE 4: FINAL MIX — CINEMA STANDARD

**LOG:** Append `phase_start` event to production_log.jsonl before beginning this phase.

### Step 4.0: Pre-Mix Processing

Process each audio layer BEFORE mixing to ensure clean, consistent source material:

```bash
# Dialogue: de-noise + normalize + gentle compression for consistency
# Compression keeps whispers and shouts within usable range
ffmpeg -i voice.wav -af "afftdn=nf=-25,loudnorm=I=-16:TP=-1.5:LRA=7,acompressor=threshold=-20dB:ratio=3:attack=5:release=50" voice_processed.wav

# SFX: normalize only — preserve natural dynamics (transients matter)
ffmpeg -i sfx.wav -af "loudnorm=I=-20:TP=-1.5:LRA=11" sfx_processed.wav

# Music: gentle compression + EQ notch to make room for dialogue frequencies
# The 1.5kHz dip prevents music from masking speech intelligibility
ffmpeg -i music.wav -af "acompressor=threshold=-15dB:ratio=2:attack=20:release=200,equalizer=f=1500:t=q:w=2:g=-4" music_processed.wav

# Room tone: normalize to very low level — it should be felt, not heard
ffmpeg -i room_tone.wav -af "loudnorm=I=-35:TP=-10:LRA=5" room_processed.wav
```

### Step 4.1: Build Audio Layers with Dynamic Volume Automation

Replace static volumes with time-based automation that follows the emotional arc. The volume expression is computed from the audio cue sheet's `emotion_context` and `volume_automation` columns:

```bash
# Music volume that breathes with the story
# Each time range corresponds to a narrative beat from the cue sheet
ffmpeg -i music_processed.wav -af "
  volume='if(between(t,5,15),0.15,
         if(between(t,15,45),0.28,
         if(between(t,45,57),0.12,
         if(between(t,57,70),0.25,
         if(between(t,70,82),0.30,
         if(between(t,82,100),0.22,
         0.20))))))':eval=frame
" music_automated.wav
```

All `adelay` values come directly from the cue sheet's millisecond column:

```bash
# Voice layer — using exact ms from cue sheet
ffmpeg -y \
  -i "voice/boy_crying_mama.mp3" \
  -i "voice/boy_sobbing_muffled.mp3" \
  -filter_complex "
    [0:a]adelay=35500|35500,volume=1.0[mama];
    [1:a]adelay=42000|42000,volume=0.35,afade=t=out:st=3:d=2.4[sob];
    [mama][sob]amix=inputs=2:duration=longest:normalize=0[voice]
  " -map "[voice]" -t $VDUR -ar 44100 _voice.wav
```

**Volume Hierarchy:**
```
Dialogue:       1.0           (always king — if you can't hear it, it doesn't exist)
Music:          0.10-0.30     (DYNAMIC — breathes with the story, not flat)
SFX events:     0.15-0.35     (supportive, never overwhelms dialogue)
Foley:          0.03-0.08     (subliminal — sells reality without drawing attention)
Room tone:      0.04-0.10     (continuous — you notice its absence, not its presence)
Emotional SFX:  0.08-0.15     (felt, not heard — the subconscious layer)
```

**Mixing Rules:**

1. **Pre-dip is MANDATORY.** 200-300ms before every dialogue line, dip music and SFX by -6dB. This is not optional, not "nice to have." Without pre-dips, dialogue fights the mix and the audience strains to listen. Pre-dips are invisible to the viewer but make dialogue effortlessly clear.
2. **Music breathes.** Volume automation follows the emotional arc. Swell 200ms BEFORE visual climaxes (the ear leads the eye). Dip for intimacy. Rise for triumph. Music at a flat volume sounds like a YouTube royalty-free track pasted underneath.
3. **Room tone is continuous.** It changes at scene cuts (new location = new acoustic space) but never stops entirely. A change in room tone = a cut to a new room. Silence between room tones = a mistake. Crossfade room tones over 300-500ms at transitions.
4. **Foley sells reality.** Barely audible at 0.03-0.08 but their absence is immediately felt. Every scene with a character physically present needs foley underneath. Fabric, footsteps, breathing, object touches.
5. **SFX never competes with dialogue.** If dialogue and SFX overlap in time, SFX ducks automatically. The ear can only focus on one foreground element — dialogue always wins.
6. **Silence is a weapon.** A sudden drop to ONLY room tone before a crucial moment is more powerful than any SFX. Use it once per film at the most emotionally loaded moment. The contrast makes the subsequent sound hit like a truck.
7. **Music and dialogue don't share frequencies.** Apply EQ notch on music at 1-2kHz whenever dialogue is playing. This creates space for speech intelligibility without reducing music volume. The audience won't notice the notch but will hear every word clearly.
8. **End with music alone.** After the last visual action, let music carry the final moment. All other layers fade before music. Music fades last, into true silence, then black. The music's final note is the audience's last emotional impression.

### Step 4.2: Final Mix Assembly

Build the mix in this exact order — each layer adds to the previous:

1. **Lay room tone bed** (continuous across entire timeline, crossfading at scene transitions)
2. **Add music layer** with dynamic volume automation from Step 4.1
3. **Add dialogue** with pre-dip markers applied to music and SFX layers
4. **Add SFX** (action sounds at their cue sheet timestamps, layered per the SFX Layering Protocol)
5. **Add foley** (continuous micro-sounds under character scenes)
6. **Add emotional SFX** (sweeteners, drones, sub-bass at emotion peaks)
7. **Apply pre-dips** at all dialogue timestamps across music, SFX, and foley layers (-6dB, 200ms before line start, recover 100ms after line end)

### Step 4.3: Mastering Chain

After mixing, apply a mastering chain to the final output for broadcast/streaming quality:

```bash
ffmpeg -y -i _raw_mix.wav -af "
  equalizer=f=80:t=h:w=1:g=2,
  equalizer=f=200:t=q:w=2:g=-1,
  equalizer=f=3000:t=q:w=1:g=1,
  equalizer=f=8000:t=h:w=1:g=1.5,
  acompressor=threshold=-18dB:ratio=2.5:attack=10:release=100,
  alimiter=limit=0.95:attack=1:release=10,
  loudnorm=I=-14:TP=-1:LRA=9
" master_audio.wav
```

This chain:
- Adds sub-bass warmth (80Hz high-shelf boost) — gives the mix body and cinematic weight
- Tames muddiness (200Hz parametric dip) — cleans the low-mids where audio gets congested
- Adds dialogue clarity (3kHz parametric boost) — brings speech presence forward
- Adds air and presence (8kHz high-shelf boost) — opens up the top end for detail and shimmer
- Controls dynamics (compression at -18dB threshold, 2.5:1 ratio) — glues the mix together
- Prevents clipping (limiter at 0.95) — hard ceiling so no digital distortion
- Normalizes to streaming standard (-14 LUFS integrated, -1 true peak) — meets Spotify/YouTube/Apple loudness targets

### Step 4.4: Mix Quality QC Agent

Before presenting to user, verify ALL of the following:

- [ ] Peak audio level < -1dB (no clipping anywhere in the timeline)
- [ ] Music audible in every 1-second window (no unintended silence gaps)
- [ ] Voice segments are at least 6dB louder than underlying layers
- [ ] Fade-to-black timing aligns with audio fade-out (within 100ms)
- [ ] Total duration matches video exactly
- [ ] **Room tone present in every scene** (no "void" moments of digital silence)
- [ ] **Music volume varies throughout** (not flat — measure min/max variance must be > 6dB across the timeline)
- [ ] **Pre-dips present before every dialogue line** (measure the 200ms window before each line start for -6dB dip)
- [ ] **No frequency masking between dialogue and music** (verify 1-2kHz EQ notch is applied during dialogue segments)
- [ ] **Emotional SFX align with peak emotional moments** from the cue sheet's emotion_context column
- [ ] **Mastering chain applied** (loudnorm target -14 LUFS +/- 1)
- [ ] **Foley layer present under character action scenes** (verify foley files are placed in scenes with physical character presence)
- [ ] **Scene transitions have room tone crossfade** (no hard silence cuts between scenes — verify 300-500ms crossfade overlap)

### Step 4.5: Mux and Export

```bash
ffmpeg -y -i video.mp4 -i master_audio.wav \
  -c:v copy -c:a aac -b:a 192k -shortest \
  final.mp4
```

### Step 4.6: Review Loop

**Dangerously auto:** Skip this gate. Proceed immediately.

Each iteration only rebuilds audio layers and remixes — video stays locked. Common adjustments and their targeted fixes:

- "SFX too loud" → reduce SFX layer volume, remix
- "Music louder" → increase music layer, remix
- "Voice doesn't sync" → adjust adelay by +/-200ms increments, remix
- "Different music mood" → regenerate music only, remix
- **"Dialogue too flat"** → regenerate with higher style setting in ElevenLabs, write more specific delivery notes in the dialogue direction doc, regenerate
- **"Music doesn't match the moment"** → adjust volume automation timestamps to align with the correct narrative beats, or regenerate a specific stem (strings/percussion/piano) if the mood is wrong
- **"SFX feel thin"** → add more layers per the SFX Layering Protocol (sweetener, sub-bass, foley). Single-layer SFX always sounds cheap — layer up
- **"Mix sounds amateur"** → re-run mastering chain with adjusted EQ values, verify pre-dips are applied, check that music volume is dynamic not flat

---

## COST ESTIMATE

| Component | Provider | Estimated Cost |
|-----------|----------|---------------|
| Storyboard drafts (8 frames) | Gemini Web UI | Free |
| Clean storyboard (8 frames) | Gemini API | ~$0.50-1.90 |
| Video clips (9-14 clips) | Kling AI V3 Pro | ~88 tokens (~$8.62) for 14 clips |

> **Kling Token Pricing (as of March 2026):** 100 tokens = $9.80 USD. V3 Pro 5s clip: ~4 tokens (~$0.39). V3 Pro 10s clip: ~8 tokens (~$0.78). V3 Std costs ~half of Pro.

| Music (1 track) | MiniMax Music 2.5+ | ~$0.10 |
| SFX (7 effects) | ElevenLabs | ~$0.30-0.50 |
| Voice (2-3 clips) | MiniMax speech-2.8-hd | ~$0.10 |
| Music final (ElevenLabs) | ElevenLabs | ~$0.10-0.20 |
| Iterations (2-3 rounds) | Mixed | ~$2.00-5.00 |
| **Total** | | **~$12-16** |

---

## LESSONS LEARNED (from production)

| Lesson | Detail |
|--------|--------|
| **Never generate audio before picture lock** | You WILL redo it. Visuals always change. |
| **ALWAYS parallel clip generation** | Sequential = 25 min. Parallel = 5 min. This is mandatory, not optional. |
| **Never slow-mo clips** | Quality degrades. Generate more clips instead. |
| **Kling supports image-to-video natively** | Use kling-v2.6-pro for best quality. Start frame supported natively. |
| **Consecutive shots need different angles** | Same angle = jump cut. Respect 180° rule. |
| **AI hands are always wrong** | Reframe to hide hands. Face close-ups work. |
| **Non-speech vocals sound fake** | Skip grunts/gasps entirely. Use environmental SFX. |
| **Water SFX is always too loud** | Start at 0.08, not 0.4. |
| **Music must be continuous** | Stopping/starting music is jarring. Keep it present throughout. |
| **Gemini Web UI has watermarks** | Always convert via API before video generation. |
| **Minimax Music ignores duration** | Always generates 130-175s. Trim in post. ElevenLabs for precision. |
| **Hard cuts for short films** | Crossfades are for slideshows, not cinema. |
| **Audio timing in ms, not seconds** | 1-second rounding = 25 frames off at 25fps. Always use milliseconds. |
| **Dialogue over action > dialogue over static** | Crying "妈妈" during running is more powerful than over a static crying shot. |
| **Pre-dip before voice** | Drop other layers 200ms before key dialogue for clarity. |
| **QC agents save iteration cycles** | Catching a blue shirt in storyboard QC saves regenerating a video clip later. |
| **Kling concurrency limit: 5 tasks max** | Submitting >5 simultaneous tasks returns error 1303. Submit in waves of 5, poll until complete, then next wave. |
| **ElevenLabs quota exhaustion mid-production** | If ElevenLabs quota runs out mid-production, fall back to Minimax TTS (speech-2.8-hd) for remaining VO lines. Document which lines used which provider in the production log. Voice quality will differ — note this in the QC report. |
| **Sequential VO (alternating speakers) = individual files** | For alternating HER/HIM or multi-speaker VO, generate each line as an INDIVIDUAL audio file for precise `adelay` placement. Body reads (one continuous take) only work for single-speaker overlapping placement where natural pacing drives timing. |
| **QC agents must ACTUALLY be launched in autonomous mode** | Defining QC agents in the pipeline is not enough — they must be explicitly launched via SendMessage. A previous production defined all 3 QC agents but never launched any of them. |
| **Create Kling elements from character refs** | After /production-consistency generates face_ref.png + reference sheet, immediately create Kling elements. Store IDs in element_ids.json. Use in all downstream generation for cross-clip consistency. |
| **Multi-shot for coverage = perfect consistency** | When shooting master + coverage of the same scene, use multi-shot (up to 6 shots, 15s total) instead of separate clips. Same lighting, same character appearance guaranteed. |
| **--smart flag in autonomous mode** | Always use `--smart` in autonomous mode — it auto-enables native audio for sound-rich scenes, detects camera motion from natural language, and upgrades tier for complex shots. |
| **Video extension > regeneration** | If a clip's action doesn't complete, extend it with `--extend` instead of regenerating. Cheaper and maintains continuity from the last frame. |
| **Add sound to silent cut** | After assembling the silent cut, use `--add-sound` to add AI-generated ambient sound before manual audio post-production. Provides a better review experience at picture lock. |
| **Static frame cold-start causes slow motion start** | Kling treats every image as frame 0 of a NEW motion sequence. A storyboard image of "mid-stride running" produces ~1s of waking-up-from-freeze before motion begins. Fix: (1) Prompt must explicitly say "ALREADY in full continuous motion from the first frame, no acceleration, steady pace throughout" — not just describe the action. (2) Trim first 1s with `ffmpeg -ss 1`. (3) For motion-critical shots, use `--extend` from the previous clip instead of generating from a static frame. |
| **Cross-shot motion continuity requires `--extend`** | There are NO API parameters for motion velocity, acceleration, or mid-action state injection. Multi-shot maintains visual consistency only, NOT motion. The ONLY way to carry motion across cuts is: generate clip A, then `--extend --task-id {clip_A_task_id}` for clip B. This inherits the final frame's motion state naturally. Use this for sequences where the same action continues across cuts (e.g., running feet → running face). |
| **Prompts for mid-action must describe CONTINUOUS state** | Bad: "shoes mid-stride on trail" (Kling starts from still). Good: "shoes ALREADY in full continuous running stride, feet hitting ground rhythmically at full pace, no acceleration, steady fast running speed throughout the entire clip, continuous uninterrupted motion from first frame to last". The word "ALREADY" and "continuous from first frame" are critical cues. |
| **Use `--start-frame` + `--end-frame` for controlled motion** | For motion-critical transitions, provide both start and end frames to constrain the motion arc. This reduces cold-start artifacts by giving Kling two anchors instead of one. |
| **Camera commands MUST be in Kling V3 prompts** | V3 models do NOT support the `camera_control` API parameter (V1 only). For V3, camera motion goes IN the prompt text as `[Tracking right]`, `[Static]`, `[Crane up]`, etc. If omitted, Kling chooses unpredictable camera motion. Always include exactly ONE camera command per clip, matching camera_plan.md. |
| **Kling prompts need 4 layers, not 1 line** | A previous production used sparse one-line prompts like "woman running on trail" — this produces generic, low-quality clips. Well-structured prompts have 4 layers: (1) Story context harness, (2) Rich action/motion description with "ALREADY in motion" cues, (3) Camera command in brackets, (4) Atmosphere/technical. See Step 2.6 for the full template. |
| **Multi-reference Gemini images prevent product drift** | In a previous production, shoe shots anchored only to face_ref produced correct face but generic shoes (wrong swoosh color, wrong silhouette). Use `--extra-images` to pass ALL relevant references (face + product + location) simultaneously. Every frame should be anchored to ALL visual elements it contains. |
| **Product reference MUST be --image (primary) when product is in frame** | In SPEED DREAM, "electric scooter" in text prompts produced motorcycles, mopeds, and kick scooters randomly across frames — because the product_reference.png was either (a) wrong at the source (pre-prod generated mopeds), or (b) omitted from the Gemini call entirely. The fix has two parts: (1) verify pre-production product refs are correct BEFORE any storyboard generation, and (2) when a product appears in a frame, make product_reference.png the PRIMARY `--image` (not face_ref), because product silhouettes are harder for AI to get right from text than human faces. Consistent-but-wrong is better than inconsistent — at least one source fix propagates to all frames. |
| **Product ref_images in storyboard.json must include EVERY visible product** | The storyboard.json `ref_images` array was populated with face_refs and location refs but OMITTED product refs for multiple frames where the product was clearly visible (racing scenes with the scooter). This meant Kling also never saw the product reference when generating video clips, compounding the inconsistency. RULE: if a product is visible in the frame — even partially, even in background — its product_reference.png goes in ref_images. No exceptions. |
| **Wardrobe refs prevent outfit drift across scenes** | In SPEED DREAM, Alex wore a jacket in shot 08 when he should have been in a black tank top (he just finished racing in shots 05-07). The wardrobe_tanktop.png reference existed but wasn't passed to that frame's Gemini call. Including the correct `{character}_wardrobe_{outfit}.png` as an extra-image visually anchors the outfit and prevents text-prompt-only wardrobe hallucination. |
| **Consecutive same-location shots MUST have different background composition** | In SECOND TO NONE, shots 2 and 3 (both in briefing room) had nearly identical backgrounds — same centered tactical display, same room geometry, same camera height. Cutting between them felt like a face-swap jump cut despite having different subjects. The Cinematographer QC passed both individually but failed to catch the editorial flow problem. Fix: when consecutive shots share a location, the QC MUST check that (1) background composition differs substantially, (2) there's at least a 2-stop scale change across the cut, and (3) the camera angle shifts at least 30 degrees. The test: would a viewer need to completely re-orient their eye between cuts? If not, it's a jump cut. |
| **QC WARNING on factual/narrative errors should be auto-reworked in dangerously-auto mode** | The scoreboard in shot 8 showed VORTEX at #1 instead of RAZOR — an AI hallucination that contradicts the script. QC flagged this as WARNING but the orchestrator auto-accepted it. In dangerously-auto mode, factual errors that contradict the script (wrong rankings, wrong character names, wrong wardrobe) should be treated as FATAL and auto-reworked, not logged-and-accepted. Only subjective artistic choices should be WARNING-level. |
| **Shot 02 portrait problem: centered frontal shots waste compositional real estate** | A centered medium shot of a character facing camera (passport photo composition) tells the viewer nothing about the character through the camera. Prefer profile, three-quarter, or environmental compositions that use the frame to communicate character traits — e.g., a CU profile lit by a tactical display shows absorption and discipline; an OTS looking across a room shows hierarchy and distance. Every shot must earn its composition through storytelling, not just subject placement. |
| **Kling lipsync endpoint is `/v1/videos/lip-sync` (with hyphen)** | Previous code used `/videos/lipsync` (no hyphen) which returns 404. The correct path has a hyphen. |
| **Kling lipsync text2video needs video_id, not base64** | The lipsync endpoint does NOT accept base64 video uploads. You must provide either `video_id` (from task_result.videos[0].id of a previously generated Kling video) or `video_url` (a real URL). Get video_id by polling the generation task. |
| **Kling voice_ids are internal strings, not friendly names** | Voice IDs like `ai_laoguowang_712` come from the VOICE_CATALOG in kling-video.js. Use `--list-voices` to see the full catalog. The catalog keys (e.g., `serious_boss`) are accepted as aliases. |
| **Omni voice_ids require `generate_audio: true`** | Passing voice_ids to the Omni endpoint without enabling audio produces a silent clip. When voice_ids are present, `with_audio` must be true (the storyboard processing in kling-video.js now handles this automatically). |
| **Dialogue shots MUST be CU/MCU for lipsync to work** | Kling lipsync needs a clearly visible mouth. WS/EWS shots produce poor results. The Cinematographer must plan dialogue shots as CU/MCU, with WS/EWS dialogue marked as lipsync_incompatible and handled as audio overlay. |
| **Kling text2video lipsync has FLAT emotion — use ElevenLabs TTS instead** | Kling's text2video lipsync mode has NO emotion parameters (only voice_speed 0.8-2.0). Testing confirmed robotic, expressionless delivery. ElevenLabs TTS with style: 0.4-0.7 produces dramatically more expressive delivery. The pipeline default is now `tts_lipsync` (ElevenLabs → Kling audio2video) instead of `omni` (Kling native voice). Use `omni` only for fast iteration, never for final renders. |
| **Dialogue-first generation > lipsync retrofit** | Generating silent clips then bolting on lipsync after is fundamentally flawed. The character's expression in a silent clip was never "performing" dialogue — retrofitting mouth movement onto a non-speaking face creates uncanny results. A dialogue clip without its dialogue IS a failed clip. Generate TTS BEFORE video, then generate the clip WITH the audio so the character performs the line from frame 1. |
| **Bad lipsync is worse than no lipsync** | If lipsync quality is poor after 2 attempts, fall back to tts_overlay (VO mixed in Phase 4). The audience forgives voice-over in a medium shot. They do NOT forgive wrong lip sync in a close-up. |
| **Flat TTS kills the film** | Default ElevenLabs settings produce "AI narrator" voice. MUST write dialogue direction docs and tune stability/style/speed per emotion. Use the Emotion Acting System table — not guesswork. Generate 2 takes for critical lines. |
| **One SFX per action sounds thin** | Layer 2-3 sounds per important moment: physical impact + emotional sweetener + sub-bass. Single-layer SFX sounds amateur. |
| **Room tone is mandatory** | Scenes without room tone feel like a void. Generate ambient beds per location at 0.04-0.08 volume. Low but essential. |
| **Music segments don't blend** | Crossfading separate music segments creates audible seams. Generate one continuous score OR use stems with independent volume automation. |
| **Dynamic volume automation > static levels** | Real films don't play music at 0.20 for 90 seconds. Volume follows the emotional arc — swelling, dipping, breathing with the story. Use ffmpeg volume expressions with time-based conditionals. |
| **Mastering chain is not optional** | Raw mixes sound thin and harsh. EQ + compression + limiting + loudnorm (-14 LUFS) transforms amateur to professional. |
| **Lipsync clips have NO SFX — voice only** | Kling lipsync outputs speech audio only. No ambient sound, no environmental SFX. This is by design — Kling lipsync is a speech overlay, not a full audio scene. SFX MUST be layered in Phase 4 (Final Mix). The `dialogue_cut.mp4` at picture lock will sound "clean/sterile" without SFX — this is expected. The final mix adds cockpit hum, wind, engine sounds, etc. behind the dialogue. |
| **Lipsync audio2video needs video_url or video_id, not local file** | The lipsync endpoint does NOT accept base64 video uploads. For audio2video mode, you must provide either the video URL (from task_result.videos[0].url after polling a completed generation task) or the Kling video resource ID (task_result.videos[0].id). The orchestrator must poll the generation task to extract these before running lipsync. |
| **ElevenLabs emotion settings map to dialogue_sheet.json emotions** | Map dialogue emotion fields to ElevenLabs voice_settings: cold/commanding → stability 0.75, style 0.3; frustrated → stability 0.55, style 0.6; fearful → stability 0.50, style 0.7; warm → stability 0.70, style 0.4. These settings are the difference between flat and expressive delivery. |
| **First+last frame > prompt-only for dramatic camera motion** | Prompt camera commands (`[Dolly in]`, `[Tracking right]`) are unreliable for large composition changes (push-through, orbit, front-to-back reveals). Providing both start and end frame images gives Kling two visual anchors — it interpolates between them, producing predictable dramatic motion. The Cinematographer must plan end frames during camera_plan.md (Part 3, END FRAME section) and generate both storyboard images in Step 2.1. |
| **End frame clips with elements/ref_images must route through Omni** | The dedicated frames endpoint (`/videos/image2video-frames`) doesn't support elements or ref_images. When a clip needs end_frame AND character/location consistency (elements + ref_images), it MUST route through the Omni endpoint which supports `frame_start` + `frame_end` + `element_N` + `image_N` simultaneously. The storyboard routing in kling-video.js handles this automatically — `end_frame` + elements/ref_images → Omni; `end_frame` alone → frames endpoint. |
| **End frame pairs must share references** | When generating start and end frame storyboard images via Gemini, pass the SAME character face_ref, location establishing shot, and product references to both. Use `--follow-up` from the start frame generation for the end frame to maintain Gemini conversation context. Visual inconsistency between start/end frames produces jarring morphing artifacts in the generated clip. |

---

## FILE STRUCTURE

```
{project}/
├── production_log.jsonl            # Continuous event log (JSONL, append-only)
├── script.md                    # Shot-by-shot script
├── audio_design.md              # Audio plan (Phase 1, planning only)
├── audio_cue_sheet.md           # Frame-accurate timing (Phase 3)
├── dialogue_sheet.json              # Structured dialogue extraction from script
├── storyboard.json              # Video generation config
├── characters/                  # Character reference sheets + face crops
├── storyboard/                  # Draft frames (Gemini Web UI, may have watermarks)
├── storyboard_clean/            # Watermark-free frames (Gemini API)
├── clips/                       # Video clips (clip_01.mp4 ... clip_NN.mp4)
├── analysis/                    # Extracted keyframes for audio timing
├── sfx/                         # Sound effects
├── voice/                       # Dialogue/vocal clips
├── music/                       # Music tracks
├── pre-production/
│   └── voice_casting.json           # Voice assignments per character
├── silent_cut.mp4               # Visual-only assembly (picture lock candidate)
├── dialogue_cut.mp4                 # Visual assembly WITH embedded dialogue audio
├── draft_v{N}.mp4               # Versioned drafts
└── final.mp4                    # Final export
```

---

# APPENDIX A: Genre Selection Funnel + Cinematography Presets
# (Previously in vid-gen/SKILL.md — bundled here for self-containment)

**STEP 1: Genre Selection (MANDATORY — use AskUserQuestion)**

This is a two-step funnel because AskUserQuestion supports max 4 options.

**Step 1A — Visual Temperature:**
```
AskUserQuestion:
  question: "What visual feel should this video have?"
  header: "Look"
  multiSelect: false
  options:
    - label: "Warm & Intimate"
      description: "Golden tones, soft lighting, shallow DOF — inviting and human"
      preview: |
        ┌─────────────────────────────────────┐
        │  WARM & INTIMATE                    │
        │                                     │
        │  Soft golden-hour key light          │
        │  Shallow DOF, creamy bokeh           │
        │  Warm midtones, peachy skin          │
        │  Cooke / Leitz spherical lenses      │
        │                                     │
        │  Genres: Commercial, Rom-Com, Drama  │
        └─────────────────────────────────────┘
    - label: "Cool & Atmospheric"
      description: "Blue-teal tones, volumetric light, tension or stillness"
      preview: |
        ┌─────────────────────────────────────┐
        │  COOL & ATMOSPHERIC                 │
        │                                     │
        │  Cool blue-teal palette              │
        │  Hard edge light, volumetric haze    │
        │  Desaturated skin, deep shadows      │
        │  Anamorphic / Zeiss Master Primes    │
        │                                     │
        │  Genres: Sci-Fi, Nordic, Thriller    │
        └─────────────────────────────────────┘
    - label: "Raw & Authentic"
      description: "Available light, film grain, imperfect beauty — real and human"
      preview: |
        ┌─────────────────────────────────────┐
        │  RAW & AUTHENTIC                    │
        │                                     │
        │  Natural / available light only      │
        │  Visible grain, real textures        │
        │  Imperfect framing, handheld feel    │
        │  16mm Bolex / Sony FX6              │
        │                                     │
        │  Genres: Documentary, Indie          │
        └─────────────────────────────────────┘
    - label: "Grand & Mythic"
      description: "Epic scale, rich saturated color, painterly light — awe and dread"
      preview: |
        ┌─────────────────────────────────────┐
        │  GRAND & MYTHIC                     │
        │                                     │
        │  Rich saturated color or deep dark   │
        │  Atmospheric haze, shafts of light   │
        │  Grand scale, sweeping vistas        │
        │  ARRI ALEXA 65 / RED MONSTRO        │
        │                                     │
        │  Genres: Fantasy/Epic, Horror        │
        └─────────────────────────────────────┘
```

**Step 1B — Specific Genre (based on Step 1A answer):**

If **Warm & Intimate**:
```
AskUserQuestion:
  question: "Which warm style fits best?"
  header: "Genre"
  multiSelect: false
  options:
    - label: "Commercial"
      description: "Clean, aspirational, Apple-meets-Kinfolk editorial — best for concept videos and investor materials"
      preview: |
        Camera: ARRI ALEXA Mini LF + Cooke S7/i 50mm
        Aperture: f/2.0–2.8  |  Aspect: 16:9
        Color: Clean natural grade, warm
        Light: Soft key, warm fill, beauty lighting that feels natural
        Motion: Static, gentle dolly in, slow pan
        Music: Warm piano + soft strings, modern uplifting
        VO: Calm, confident, unhurried authority
    - label: "Rom-Com"
      description: "Warm golden tones, ultra-shallow DOF, string lights and bokeh — every frame feels like a place you want to live"
      preview: |
        Camera: ARRI ALEXA Mini + Cooke S4/i 50-85mm
        Aperture: f/1.4–2.0  |  Aspect: 1.85:1
        Color: Kodak Vision3 500T warm print emulation
        Light: Golden-hour through sheer curtains, warm practicals
        Motion: Static with gentle focus pulls, minimal movement
        Music: Light acoustic guitar, warm piano, playful pizzicato
        VO: Warm, conversational, slightly amused
    - label: "Drama"
      description: "Rich, emotionally sculpted light, cinematic depth — every frame tells the emotional state"
      preview: |
        Camera: ARRI ALEXA Mini LF + Leitz THALIA 50-75mm
        Aperture: f/2.0–2.8  |  Aspect: 2.39:1
        Color: Kodak Vision3 250D, rich latitude
        Light: Motivated practicals, warm key with cool ambient fill
        Motion: Camera moves WITH emotion — dolly, crane, motivated pans
        Music: Orchestral strings + piano, Alexandre Desplat restraint
        VO: Measured, warm, emotionally present
```

If **Cool & Atmospheric**:
```
AskUserQuestion:
  question: "Which cool style fits best?"
  header: "Genre"
  multiSelect: false
  options:
    - label: "Sci-Fi"
      description: "Anamorphic, monolithic scale, Villeneuve/Deakins — volumetric light, lens flares, deep teal shadows"
      preview: |
        Camera: ARRI ALEXA 65 + Panavision Ultra Vista 40mm
        Aperture: f/2.8  |  Aspect: 2.39:1 anamorphic
        Color: Digital ARRI LogC, graded cool blue-teal
        Light: Volumetric shafts, cyan fill, orange-amber practicals
        Motion: Slow dolly in, crane up, deliberate tracking
        Music: Dark ambient electronic, sub-bass, Johann Johannsson
        VO: Measured, sparse, gravitas
    - label: "Nordic / Scandi"
      description: "Muted, desaturated, overcast diffusion — wide negative space, fog, Kinfolk editorial quality"
      preview: |
        Camera: ARRI ALEXA Mini + Zeiss Supreme Prime 35mm
        Aperture: f/4.0–5.6  |  Aspect: 2.39:1 or 16:9
        Color: Desaturated, lifted blacks, steel blue-grey
        Light: Overcast Nordic daylight, warm pendant lamps
        Motion: Static holds, slow crane reveals, lateral tracking
        Music: Solo piano, sparse ambient, Nordic minimalism
        VO: Quiet, measured, understated
    - label: "Thriller / Noir"
      description: "Crushed blacks, half-lit faces, Fincher tension — single hard source, wet surfaces, neon accents"
      preview: |
        Camera: RED V-RAPTOR + Zeiss Master Prime 25mm
        Aperture: f/2.8–4.0  |  Aspect: 2.39:1
        Color: Heavy contrast curve, crushed blacks, green-yellow
        Light: Single hard key from side, neon/sodium practicals
        Motion: Slow menacing dolly in, static tension, tracking
        Music: Dissonant strings, industrial percussion, Trent Reznor
        VO: Hushed, urgent, clipped
```

If **Raw & Authentic**:
```
AskUserQuestion:
  question: "Which raw style fits best?"
  header: "Genre"
  multiSelect: false
  options:
    - label: "Documentary"
      description: "Naturalistic, available light, handheld intimacy — real environments, real textures, observational"
      preview: |
        Camera: Sony FX6 + Canon CN-E 35mm
        Aperture: f/2.8–5.6  |  Aspect: 16:9
        Color: Minimal grade, natural white balance
        Light: Available natural light only, no enhancement
        Motion: Static observation, subtle pan following action
        Music: Sparse ambient, single instrument or silence
        VO: Intimate, reflective, unhurried
    - label: "Indie / Arthouse"
      description: "16mm film grain, neon bleed, off-center framing — Wong Kar-wai meets Sean Baker, beauty in the mundane"
      preview: |
        Camera: 16mm Bolex + vintage Zeiss Distagon 25-35mm
        Aperture: f/2.0–4.0  |  Aspect: 4:3 or 1.66:1
        Color: Ektachrome cross-processed, heavy grain, shifted
        Light: Neon signs, mismatched practicals, fluorescent
        Motion: Locked-off tableaux, lazy pans, observational
        Music: Needle-drop source music or found sound
        VO: Internal monologue, conversational, imperfect
```

If **Grand & Mythic**:
```
AskUserQuestion:
  question: "Which grand style fits best?"
  header: "Genre"
  multiSelect: false
  options:
    - label: "Fantasy / Epic"
      description: "Painterly golden light, grand scale, every frame a Renaissance painting — Lesnie/Storaro grandeur"
      preview: |
        Camera: ARRI ALEXA 65 + Panavision Primo 70 40-65mm
        Aperture: f/4.0–5.6  |  Aspect: 2.39:1 anamorphic
        Color: Kodak Vision3 50D, rich saturated, fine grain
        Light: Golden-hour shafts through haze, fire/torchlight
        Motion: Crane up reveals, sweeping tracking, dolly in
        Music: Full orchestral, French horns, soaring strings, choir
        VO: Storyteller gravitas, unhurried, mythic authority
    - label: "Horror"
      description: "Impenetrable darkness, wide-angle dread, Aster/Eggers — symmetry that feels wrong, threats in negative space"
      preview: |
        Camera: RED MONSTRO + Angénieux Optimo 15-40mm wide
        Aperture: f/2.8  |  Aspect: 2.39:1
        Color: Underexposed 1-2 stops, sickly green tint
        Light: Single distant practical, no fill, impenetrable dark
        Motion: Unsettling stillness, slow inevitable dolly in
        Music: Drone, infrasound, reversed textures, wrong sounds
        VO: Whispered/fragile or coldly clinical
```

If user selects **Other** at either step, ask them to describe their desired look in free text, then map it to the closest preset or create a custom hybrid.

**After genre is selected**, the genre preset's `audio_defaults` pre-fill the remaining questions:

| Question | Default (pre-filled from genre) | Notes |
|----------|---------|-------|
| "Voiceover?" | Yes | If no, skip VO pipeline entirely |
| "VO provider?" | ElevenLabs if key exists, else Minimax | ElevenLabs has better quality |
| "Voice character?" | Genre preset's recommended voice | e.g., Sci-Fi → "Alice (authoritative)" |
| "Background music?" | Yes | If no, skip music pipeline |
| "Music vibe?" | Genre preset's music mood | e.g., Sci-Fi → "Dark ambient electronic, sub-bass, Johann Johannsson" |
| "Target length?" | Match VO duration | Typically 60-80s |
| "Resolution?" | 1080p | 720p (faster/cheaper iteration), 1080p (default), or 4K (final broadcast) |

**Auto-generated (no input needed):**
- Motion prompts per clip (AI writes from image analysis + brand guide)
- VO scripts per clip (AI writes from context)
- Storyboard JSON

---

# Genre Cinematography Presets

## Genre Cinematography Presets

When a genre is selected (by the user or by /ideation-story or /short-film-gen), apply ALL fields from the preset below. These map directly to img-ctrl-api JSON prompt fields and vid-gen motion/audio defaults.

**How to use:** At skill start, ask the user to pick a genre (or detect it from context). Then inject the preset's `technical`, `scene`, and `style_modifiers` into every img-ctrl-api JSON prompt, and use the `motion_defaults` and `audio_defaults` for vid-gen clip/assembly generation.

### GENRE: Sci-Fi

**Look:** Anamorphic lens flares, cool blue-teal palette, high contrast, wide establishing shots, sleek surfaces, volumetric light.

**img-ctrl-api JSON fields:**
```json
{
  "technical": {
    "camera_model": "ARRI ALEXA 65",
    "lens": "Panavision Ultra Vista anamorphic 40mm",
    "aperture": "f/2.8",
    "film_stock": "digital ARRI LogC, graded cool",
    "aspect_ratio": "2.39:1 anamorphic"
  },
  "scene": {
    "lighting": "volumetric shafts, cool blue-white key, cyan-teal fill, hard edge light with lens flare",
    "time": "night or blue hour",
    "mood": "vast, isolating, awe-inspiring",
    "atmosphere": "haze, fog, particulate in air for volumetric beams"
  },
  "style_modifiers": {
    "medium": "photography",
    "aesthetic": "Villeneuve/Deakins sci-fi — monolithic scale, desaturated skin tones, deep teal shadows, orange-amber practicals as only warm accent, anamorphic bokeh ovals, subtle lens breathing"
  },
  "advanced": {
    "negative_prompt": ["warm tones", "saturated colors", "soft lighting", "cozy", "domestic", "stock photo", "cartoon", "illustration"]
  }
}
```

**vid-gen motion defaults:**
- Preferred camera commands: `[Dolly in]`, `[Crane up]`, `[Tracking left]`, `[Static]`
- Motion prompt style: Slow, deliberate movements. "Camera creeps forward through the corridor." Not fast pans.
- Duration preference: 5s default, 10s for establishing/reveal shots

**audio defaults:**
- Music mood: "Dark ambient electronic, pulsing sub-bass, sparse piano over synthesizer pads, Vangelis meets Johann Johannsson"
- VO tone: Measured, sparse, gravitas. Low stability (0.65), slow speed (0.75).
- Recommended voices: Alice (authoritative), or a deep male narrator

---

### GENRE: Rom-Com

**Look:** Shallow depth of field, warm golden tones, soft diffused lighting, intimate close-ups, bokeh-rich backgrounds, natural skin tones.

**img-ctrl-api JSON fields:**
```json
{
  "technical": {
    "camera_model": "ARRI ALEXA Mini",
    "lens": "Cooke S4/i 50mm or 85mm spherical",
    "aperture": "f/1.4 to f/2.0",
    "film_stock": "Kodak Vision3 500T 5219, warm print stock emulation",
    "aspect_ratio": "1.85:1"
  },
  "scene": {
    "lighting": "soft golden-hour key through sheer curtains, warm practicals (string lights, candles, table lamps), bounced fill from warm surfaces",
    "time": "golden hour, late afternoon, soft morning",
    "mood": "warm, inviting, intimate, lived-in",
    "atmosphere": "clean air, gentle lens flare from practicals, slight warmth haze"
  },
  "style_modifiers": {
    "medium": "photography",
    "aesthetic": "Nancy Meyers interior warmth meets Roger Deakins naturalism — shallow DOF with creamy bokeh, warm midtones, peachy skin highlights, sage-green and cream palette, every frame feels like a place you want to live in"
  },
  "advanced": {
    "negative_prompt": ["cold tones", "blue lighting", "harsh shadows", "industrial", "sterile", "clinical", "dark", "moody", "desaturated"]
  }
}
```

**vid-gen motion defaults:**
- Preferred camera commands: `[Static]`, `[Dolly in]` (slow, gentle), `[Pan left/right]` (subtle)
- Motion prompt style: Gentle, intimate. "Soft focus pull from background to her smile." Minimal camera movement.
- Duration preference: 5s default

**audio defaults:**
- Music mood: "Light acoustic guitar, warm piano, playful strings pizzicato, brushed drums — Nora Ephron film score feel"
- VO tone: Warm, conversational, slightly amused. Higher style (0.5), normal speed (1.0).
- Recommended voices: Sarah (warm reassuring), Lily (British velvety)

---

### GENRE: Thriller / Noir

**Look:** High contrast, deep shadows, desaturated palette, hard directional lighting, Dutch angles, claustrophobic framing.

**img-ctrl-api JSON fields:**
```json
{
  "technical": {
    "camera_model": "RED V-RAPTOR",
    "lens": "Zeiss Master Prime 25mm",
    "aperture": "f/2.8 to f/4.0",
    "film_stock": "digital, heavy contrast curve, crushed blacks",
    "aspect_ratio": "2.39:1"
  },
  "scene": {
    "lighting": "single hard key from side or below, deep pooled shadows, no fill — faces half-lit, neon or sodium-vapor practicals as color accent",
    "time": "night, rain-slicked surfaces",
    "mood": "tense, paranoid, claustrophobic, oppressive",
    "atmosphere": "smoke, rain, wet reflections, steam from grates"
  },
  "style_modifiers": {
    "medium": "photography",
    "aesthetic": "Fincher/Deakins noir — crushed blacks, sickly green-yellow midtones, desaturated skin, single motivated light source, negative space as tension, faces emerging from darkness"
  },
  "advanced": {
    "negative_prompt": ["bright", "warm", "cheerful", "soft lighting", "pastel", "flat lighting", "well-lit", "stock photo"]
  }
}
```

**vid-gen motion defaults:**
- Preferred camera commands: `[Dolly in]` (slow, menacing), `[Static]`, `[Tracking left/right]`
- Motion prompt style: Creeping, stalking camera. "Camera slowly pushes in on his face, shadows shifting." Tension through stillness.
- Duration preference: 5s default, 10s for slow-burn reveals

**audio defaults:**
- Music mood: "Dissonant strings, low cello drone, industrial percussion, sparse piano — Trent Reznor/Atticus Ross tension"
- VO tone: Hushed, urgent, clipped. High stability (0.85), slightly faster speed (0.95).
- Recommended voices: Alice (cold authority), deep male narrator

---

### GENRE: Documentary / Naturalistic

**Look:** Handheld feel, available light, minimal grading, raw authenticity, candid compositions, environmental context.

**img-ctrl-api JSON fields:**
```json
{
  "technical": {
    "camera_model": "Sony FX6 or Canon C70",
    "lens": "Canon CN-E 35mm cinema prime",
    "aperture": "f/2.8 to f/5.6",
    "film_stock": "digital, minimal grading, natural white balance",
    "aspect_ratio": "16:9"
  },
  "scene": {
    "lighting": "available natural light only — window light, overcast sky, fluorescent interiors as-is, no artificial enhancement",
    "time": "varies — whatever the location provides naturally",
    "mood": "authentic, unvarnished, observational, intimate",
    "atmosphere": "real environments, imperfect spaces, lived-in textures"
  },
  "style_modifiers": {
    "medium": "photography",
    "aesthetic": "verite documentary — no beauty lighting, real skin texture and pores visible, slightly imperfect framing as if captured in the moment, environmental wide shots that show context, intimate handheld close-ups"
  },
  "advanced": {
    "negative_prompt": ["glamorous", "polished", "stylized", "artificial lighting", "beauty dish", "stock photo", "posed", "perfect composition"]
  }
}
```

**vid-gen motion defaults:**
- Preferred camera commands: `[Static]`, `[Pan left/right]` (as if following action), `[Zoom in]` (subtle)
- Motion prompt style: Observational. "Camera observes from a respectful distance as she works." Handheld micro-movement feel.
- Duration preference: 5s default

**audio defaults:**
- Music mood: "Sparse ambient, single instrument — solo piano, solo guitar, or silence with environmental sound"
- VO tone: Intimate, reflective, unhurried. Medium stability (0.70), slow speed (0.85).
- Recommended voices: Sarah (calm reassuring)

---

### GENRE: Drama

**Look:** Rich, balanced cinematography, motivated lighting, cinematic depth, emotionally calibrated color, classical composition.

**img-ctrl-api JSON fields:**
```json
{
  "technical": {
    "camera_model": "ARRI ALEXA Mini LF",
    "lens": "Leitz THALIA 50mm or 75mm",
    "aperture": "f/2.0 to f/2.8",
    "film_stock": "Kodak Vision3 250D 5207, fine grain, rich latitude",
    "aspect_ratio": "2.39:1"
  },
  "scene": {
    "lighting": "motivated practicals — table lamps, window light, fireplace — supplemented with soft bounce, warm key on faces with cool ambient fill",
    "time": "varies with emotional beat — morning hope, twilight melancholy, overcast contemplation",
    "mood": "emotionally rich, contemplative, lived-in, human",
    "atmosphere": "clean but textured — visible dust motes in shafts of light, breath in cold air"
  },
  "style_modifiers": {
    "medium": "photography",
    "aesthetic": "Lubezki/Kaminski drama — rich warm skin tones, deep but not crushed shadows, motivated light that sculpts faces, compositions that breathe, every frame tells the emotional state"
  },
  "advanced": {
    "negative_prompt": ["flat lighting", "overexposed", "stock photo", "corporate", "generic", "cartoon", "illustration"]
  }
}
```

**vid-gen motion defaults:**
- Preferred camera commands: `[Dolly in]`, `[Static]`, `[Crane up]`, `[Pan left/right]`
- Motion prompt style: Motivated movement — camera moves WITH emotion. "Camera slowly drifts closer as the weight of the news sinks in."
- Duration preference: 5s default, 10s for emotional beats

**audio defaults:**
- Music mood: "Orchestral strings and piano, emotionally sincere, building arc — Alexandre Desplat restraint"
- VO tone: Measured, warm, emotionally present. Stability 0.70, style 0.4, speed 0.85.
- Recommended voices: Sarah (warm authority), Lily (editorial gravitas)

---

### GENRE: Nordic / Scandi

**Look:** Muted, cool-desaturated palette, overcast diffused light, wide empty landscapes, minimal compositions, clean geometry, hygge interiors.

**img-ctrl-api JSON fields:**
```json
{
  "technical": {
    "camera_model": "ARRI ALEXA Mini",
    "lens": "Zeiss Supreme Prime 35mm",
    "aperture": "f/4.0 to f/5.6",
    "film_stock": "digital, desaturated grade, lifted blacks, muted midtones",
    "aspect_ratio": "2.39:1 or 16:9"
  },
  "scene": {
    "lighting": "overcast Nordic daylight — soft, even, no hard shadows. Interior: diffused window light, warm pendant lamps, candles as only warm accent",
    "time": "overcast day, blue hour, early morning fog",
    "mood": "contemplative, quiet, spacious, melancholic beauty",
    "atmosphere": "fog, mist, low clouds, rain on glass, birch trees, fjord water"
  },
  "style_modifiers": {
    "medium": "photography",
    "aesthetic": "Hoyte van Hoytema Scandi — desaturated earth tones, steel blue-grey palette, warm wood and wool as contrast, wide negative space, minimal composition, Kinfolk magazine editorial quality"
  },
  "advanced": {
    "negative_prompt": ["saturated", "tropical", "bright colors", "harsh sun", "busy composition", "cluttered", "stock photo", "corporate"]
  }
}
```

**vid-gen motion defaults:**
- Preferred camera commands: `[Static]`, `[Crane up]` (slow reveal), `[Tracking left]` (lateral through spaces)
- Motion prompt style: Still, contemplative. "Fog drifts slowly across the lake surface. Camera holds." Embrace stillness.
- Duration preference: 5s default

**audio defaults:**
- Music mood: "Solo piano, sparse ambient electronics, cello, Nordic minimalism — muted and spacious, notes with room to breathe"
- VO tone: Quiet, measured, understated. High stability (0.80), slow speed (0.75).
- Recommended voices: Lily (British literary), Alice (restrained authority)

---

### GENRE: Horror

**Look:** Underexposed, sickly green-yellow cast, sharp deep shadows, claustrophobic framing, wide-angle distortion, practical darkness.

**img-ctrl-api JSON fields:**
```json
{
  "technical": {
    "camera_model": "RED DSMC2 MONSTRO",
    "lens": "Angénieux Optimo 15-40mm wide end",
    "aperture": "f/2.8",
    "film_stock": "digital, underexposed 1-2 stops, sickly green-tinted grade",
    "aspect_ratio": "2.39:1"
  },
  "scene": {
    "lighting": "single distant practical — flashlight, candle, TV glow — surrounded by impenetrable darkness. Faces underlit. No fill whatsoever.",
    "time": "dead of night, no moonlight",
    "mood": "dread, unease, vulnerability, wrongness",
    "atmosphere": "thick darkness, dust in flashlight beam, breath visible, surfaces slightly wet and reflective"
  },
  "style_modifiers": {
    "medium": "photography",
    "aesthetic": "Ari Aster/Robert Eggers horror — dread through composition not gore, wide-angle distortion at frame edges, symmetry that feels wrong, negative space hiding threats, skin looks pallid and unhealthy"
  },
  "advanced": {
    "negative_prompt": ["bright", "warm", "cheerful", "well-lit", "colorful", "safe", "stock photo", "soft focus"]
  }
}
```

**vid-gen motion defaults:**
- Preferred camera commands: `[Static]` (unsettling stillness), `[Dolly in]` (slow, inevitable), `[Zoom in]` (subtle creep)
- Motion prompt style: Wrong-feeling stillness. "Camera holds perfectly still as something shifts in the background darkness." Minimal movement maximizes dread.
- Duration preference: 10s for slow dread, 5s for shock cuts

**audio defaults:**
- Music mood: "Drone, infrasound, reversed textures, scraping strings, prepared piano — overwhelming silence punctuated by wrong sounds"
- VO tone: Whispered, fragile, or coldly clinical. Very high stability (0.90), slow speed (0.75).
- Recommended voices: Context-dependent

---

### GENRE: Fantasy / Epic

**Look:** Grand scale, rich saturated colors, golden-hour warmth, sweeping vistas, painterly light, heroic compositions.

**img-ctrl-api JSON fields:**
```json
{
  "technical": {
    "camera_model": "ARRI ALEXA 65",
    "lens": "Panavision Primo 70 40mm or 65mm",
    "aperture": "f/4.0 to f/5.6",
    "film_stock": "Kodak Vision3 50D 5203 for exteriors, 500T for interiors — rich, saturated, fine grain",
    "aspect_ratio": "2.39:1 anamorphic"
  },
  "scene": {
    "lighting": "golden-hour key with atmospheric haze, shafts of light through canopy/ruins, fire and torchlight for interiors, rim light separating subjects from environment",
    "time": "golden hour, dawn, candlelit interiors",
    "mood": "epic, mythic, awe-inspiring, ancient",
    "atmosphere": "atmospheric perspective, dust/pollen in shafts of light, mist in valleys, smoke from fires"
  },
  "style_modifiers": {
    "medium": "photography",
    "aesthetic": "Andrew Lesnie/Vittorio Storaro epic — painterly golden light, saturated greens and earth tones, skin glowing with warm rim light, scale conveyed through tiny figures in vast landscapes, every frame a Renaissance painting"
  },
  "advanced": {
    "negative_prompt": ["modern", "urban", "clinical", "desaturated", "flat lighting", "stock photo", "corporate", "minimalist"]
  }
}
```

**vid-gen motion defaults:**
- Preferred camera commands: `[Crane up]` (epic reveal), `[Tracking left/right]` (sweeping), `[Dolly in]`
- Motion prompt style: Grand, sweeping. "Camera rises above the treeline to reveal the valley below." Scale and movement.
- Duration preference: 10s for establishing/reveal shots, 5s for character moments

**audio defaults:**
- Music mood: "Full orchestral, French horns, soaring strings, choir, timpani — Howard Shore grandeur with moments of Celtic intimacy"
- VO tone: Storyteller, gravitas, unhurried. Stability 0.75, style 0.5 (expressive), speed 0.80.
- Recommended voices: Deep male narrator or Alice (mythic authority)

---

### GENRE: Indie / Arthouse

**Look:** Mixed film stocks, unconventional framing, natural imperfection, muted or unexpected color, handheld intimacy, visible grain.

**img-ctrl-api JSON fields:**
```json
{
  "technical": {
    "camera_model": "16mm Bolex or ARRI SR3",
    "lens": "vintage Zeiss Distagon 25mm or 35mm",
    "aperture": "f/2.0 to f/4.0",
    "film_stock": "Kodak Ektachrome 100D cross-processed, or Fuji 500T pushed 1 stop — heavy grain, shifted colors",
    "aspect_ratio": "4:3 or 1.66:1"
  },
  "scene": {
    "lighting": "available light with character — neon signs, practical lamps with mismatched color temps, fluorescent mixed with tungsten",
    "time": "any — embraces the ugliness of midday or the strangeness of 3am",
    "mood": "raw, introspective, off-kilter, human",
    "atmosphere": "imperfect real spaces — cramped apartments, empty parking lots at night, laundromats, diners"
  },
  "style_modifiers": {
    "medium": "photography",
    "aesthetic": "Wong Kar-wai/Sean Baker indie — heavy film grain, unexpected color casts (greens from fluorescents, neon bleed), off-center framing, reflections in dirty glass, beauty found in mundane spaces"
  },
  "advanced": {
    "negative_prompt": ["polished", "clean", "corporate", "perfect skin", "beauty lighting", "stock photo", "generic"]
  }
}
```

**vid-gen motion defaults:**
- Preferred camera commands: `[Static]` (locked-off tableaux), `[Pan left/right]` (lazy), `[Tracking left]`
- Motion prompt style: Observational, slightly detached. "She smokes by the window. Camera doesn't move." Let moments breathe.
- Duration preference: 5s default

**audio defaults:**
- Music mood: "Needle-drop source music — specific songs, not score. Or sparse, unconventional: toy piano, field recordings, found sound"
- VO tone: Internal monologue, conversational, imperfect. Low stability (0.55) for natural variation, normal speed (1.0).
- Recommended voices: Context-dependent — match the character, not the genre

---

### GENRE: Commercial / Concept Video

**Look:** Clean, bright, sharp, polished, approachable — the default for /ideation-story concept videos.

**img-ctrl-api JSON fields:**
```json
{
  "technical": {
    "camera_model": "ARRI ALEXA Mini LF",
    "lens": "Cooke S7/i Full Frame 50mm",
    "aperture": "f/2.0 to f/2.8",
    "film_stock": "digital, clean grade, natural color science",
    "aspect_ratio": "16:9"
  },
  "scene": {
    "lighting": "soft key through large diffusion, warm fill, clean separation light — beauty lighting that still feels natural, not studio-sterile",
    "time": "soft morning or late afternoon — flattering natural light",
    "mood": "aspirational, trustworthy, warm, human",
    "atmosphere": "clean air, warm interiors, natural materials — wood, linen, matte metals"
  },
  "style_modifiers": {
    "medium": "photography",
    "aesthetic": "Apple product film meets Kinfolk editorial — clean but not sterile, warm but not saccharine, human-centered with considered negative space, natural materials, editorial quality at every frame"
  },
  "advanced": {
    "negative_prompt": ["stock photo", "corporate brochure", "clip art", "generic office", "posed handshake", "blue gradient", "futuristic", "sci-fi"]
  }
}
```

**vid-gen motion defaults:**
- Preferred camera commands: `[Static]`, `[Dolly in]` (gentle), `[Pan left/right]` (slow)
- Motion prompt style: Clean, considered. "She looks up from the table with a calm expression. Subtle ambient movement." No dramatic movements.
- Duration preference: 5s default

**audio defaults:**
- Music mood: "Warm piano and soft strings, gently building, modern uplifting — aspirational without being cheesy"
- VO tone: Warm, confident, unhurried authority. Stability 0.75, style 0.3-0.4, speed 0.80.
- Recommended voices: Sarah (calm authority), Lily (editorial)

---

### Applying a Genre Preset

When generating storyboard images via /img-ctrl-api, merge the genre preset fields into every JSON prompt:

```
1. Start with the standard img-ctrl-api JSON template (user_intent, edits, preserve, etc.)
2. SET the "technical" block to the genre preset values
3. SET the "scene" block — merge genre defaults with shot-specific overrides (e.g., time of day may vary per shot)
4. SET the "style_modifiers" block to the genre preset values
5. MERGE the genre "negative_prompt" items into the "advanced.negative_prompt" array
6. For vid-gen motion prompts, use the genre's preferred camera commands and motion style
7. For audio, use the genre's music mood and VO tone as the starting defaults
```

**The user can always override individual fields.** The preset is a starting point, not a constraint.

---

# APPENDIX B: Production Consistency Engine
# (Previously /production-consistency skill — bundled here for self-containment)


# Production Consistency Engine

Pre-production asset consistency system that generates all visual reference materials through specialized department agents. Each department produces reference sheets, specs, and consistency anchors that feed into downstream storyboard and video generation.

## When This Skill Activates

Use this skill when:
- /short-film-gen or /ideation-story needs pre-production asset generation before storyboarding
- /vid-gen is called standalone and characters/products appear across multiple frames
- The user explicitly asks for character sheets, product reference, location continuity, or brand asset generation
- Any production needs visual consistency across more than 3 frames

## When NOT to Use

- One-off image generation (use /img-ctrl-api directly)
- No recurring visual elements across frames
- The user already has all reference assets prepared

## Setup Requirements

```bash
echo $GEMINI_API_KEY | head -c 10  # Required for all asset generation via img-ctrl-api
```

All asset generation runs through `/img-ctrl-api` (Gemini API — watermark-free output).

---

## Required Inputs

This skill needs these inputs from the parent skill or user:

| Input | Source | Required? |
|-------|--------|-----------|
| **Script / shot list** | /short-film-gen Step 1.1, /ideation-story Phase 3, or user-provided | YES — departments analyze this to know what assets to create |
| **Genre preset** | Selected via genre funnel (see vid-gen "Genre Cinematography Presets") | YES — controls lighting, camera, film stock on all reference sheets |
| **Character descriptions** | User-provided or extracted from script | If characters exist |
| **Product descriptions** | User-provided or from concept brief | If products exist |
| **Brand assets** | User-provided logo files, brand colors, brand guide | If brand elements appear in frames |
| **Location descriptions** | Extracted from script or user-provided | If locations recur |
| **Save path** | Parent skill's project directory | YES |

---

## Architecture: Department Agent Teams

### Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                    ORCHESTRATOR (this skill)                      │
│  Reads script → identifies needed departments → launches teams   │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │  CHARACTER   │  │   PRODUCT   │  │  LOCATION   │              │
│  │  DEPARTMENT  │◄─►  DEPARTMENT │◄─►  DEPARTMENT │              │
│  │             │  │             │  │             │              │
│  │ Reference   │  │ Turnaround  │  │ Establishing│              │
│  │ sheets,     │  │ sheets,     │  │ shots,      │              │
│  │ face crops, │  │ detail      │  │ continuity  │              │
│  │ specs       │  │ close-ups,  │  │ specs       │              │
│  │             │  │ specs       │  │             │              │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
│         │                │                │                      │
│         ▼                ▼                ▼                      │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐              │
│  │  WARDROBE   │  │   BRAND     │  │ CINEMATOG-   │              │
│  │  & PROPS    │  │   & LOGO    │  │ RAPHY DEPT   │              │
│  │  DEPARTMENT │  │  DEPARTMENT │  │              │              │
│  │             │  │             │  │ Composition  │              │
│  │ Wardrobe    │  │ Logo refs,  │  │ refs, screen │              │
│  │ board, prop │  │ color specs,│  │ direction,   │              │
│  │ sheets,     │  │ placement   │  │ lighting     │              │
│  │ color audit │  │ rules       │  │ guide, AI    │              │
│  │             │  │             │  │ feasibility  │              │
│  └──────┬──────┘  └──────┬──────┘  └──────┬───────┘              │
│         │                │                │                      │
│         ▼                ▼                ▼                      │
│  ┌──────────────────────────────────────────────────────┐        │
│  │      QC PRODUCTION DIRECTOR (always-on, parallel)     │        │
│  │  Reviews each department AS SOON AS it reports done    │        │
│  │  Cross-checks against previously reviewed depts       │        │
│  │  Sends PASS/FAIL back immediately — no waiting        │        │
│  │  Writes consolidated report after all depts reviewed   │        │
│  └──────────────────────────────────────────────────────┘        │
└──────────────────────────────────────────────────────────────────┘
```

### Communication Rules

Agents communicate via `SendMessage` during generation:

| From | To | When | What |
|------|----|------|------|
| Character → Wardrobe | After character spec written | Wardrobe colors, fabric descriptions — so wardrobe dept can check for color conflicts |
| Character → Location | After character spec written | Character height/build — so location dept can frame establishing shots at correct scale |
| Product → Brand | After product spec written | Product surface areas, materials — so brand dept knows where logo can be placed |
| Product → Character | After product spec written | Product dimensions — so character dept can show correct interaction (holding, wearing, using) |
| Location → Character | After location establishing shot | Location lighting, color palette — so character dept can match skin tone rendering |
| Wardrobe → Character | If color conflict detected | "Characters A and B both wear white — differentiate" |
| Brand → Product | After logo spec written | Logo placement rules on product surfaces |
| Brand → Location | After logo spec written | Signage specs for location shots that include brand elements |
| Cinematography → Location | After lighting guide written | Required light direction per location — location dept adjusts establishing shots if needed |
| Cinematography → Character | After composition refs generated | Reframe instructions if character reference sheet angles are inconsistent with camera plan |
| Character → Cinematography | After character specs written | Character build/height — for framing references |
| Location → Cinematography | After establishing shots generated | Location light direction, spatial layout — for lighting guide |
| ALL → QC Director | After each department completes | Full department output for review |

### When to Launch Which Departments

The orchestrator reads the script/shot list and determines which departments are needed:

| Condition | Departments to Launch |
|-----------|----------------------|
| Named characters appear in 2+ shots | Character + Wardrobe |
| A physical product appears in 2+ shots | Product |
| A product has a brand/logo visible | Product + Brand |
| Interior/exterior locations recur across 2+ shots | Location |
| Brand signage, packaging, or end cards appear | Brand |
| 3+ characters in the film | Character + Wardrobe (color conflict audit mandatory) |
| Product advertisement / commercial | Product + Brand + Location + Cinematography (full suite) |
| Called from /short-film-gen (has Cinematographer Agent) | Cinematography dept receives camera_plan.md and generates reference assets + QC checklists from it |
| Called from /ideation-story or /vid-gen (no Cinematographer Agent) | Cinematography dept creates its own screen direction map, lighting guide, and composition references |
| Any production with 5+ shots | Cinematography (screen direction tracking becomes critical at this length) |

**Departments that are not needed should NOT be launched.** A simple 2-character drama with no products needs only Character + Wardrobe + Location. A product commercial needs Product + Brand + maybe Location. Don't over-produce.

---

## Department Specifications

### 1. CHARACTER DEPARTMENT

**Agent prompt template:**

```
You are the Character Department for the production of "{PROJECT_NAME}".

SCRIPT: {full script or shot list}
GENRE PRESET: {genre name} — apply these technical/scene/style fields to all image generation
SAVE TO: {project}/pre-production/characters/

For each named character in the script:

A. Write a CHARACTER SPEC document:
   - Physical: age, ethnicity, build, height relative to other characters
   - Face: key distinguishing features
   - Hair: style, length, color, condition (wet? messy? neat?)
   - Wardrobe (LOCKED): top, bottom, shoes, accessories — exact colors, materials, fit
   - Props: what they carry/interact with, exact description
   - Key expressions: the emotional beats they hit in this script
   Save as: {name}_spec.md

B. Generate a REFERENCE SHEET via img-ctrl-api:
   - 16:9 landscape, 3 poses side-by-side on neutral warm cream backdrop
   - LEFT: Full front-facing, neutral expression, arms relaxed, full body head to feet
   - CENTER: 3/4 angle, key action/emotional pose from the script (holding prop, expressing emotion)
   - RIGHT: Full side profile, standing naturally, shows hair and silhouette
   - CRITICAL: All 3 poses must be the SAME person — identical face, hair, skin, wardrobe
   - Apply genre preset camera/lens/film stock to the lighting/aesthetic
   Save as: {name}_reference.png

C. Crop FACE REFERENCE from front-facing pose:
   - Left third of reference sheet, cropped TIGHT to HEAD ONLY (forehead to chin, ear to ear)
   - Do NOT include shoulders, neck, or any wardrobe in this crop
   - WHY: Kling's API extracts EVERYTHING visible in reference images. If the face_ref
     shows a white shirt, Kling will lock onto that shirt in every clip — even if the
     prompt says "wearing a red jacket." The API has no "face only" selector (the web UI
     does, but it's not exposed in the API). A tight face-only crop is the only way to
     get facial identity without wardrobe contamination.
   - This is the consistency anchor for all downstream storyboard AND video generation
   Save as: {name}_face_ref.png

C2. Generate WARDROBE VARIANT references (if character changes outfit across scenes):
   - For each distinct outfit the character wears in the script, generate a SEPARATE
     reference image via img-ctrl-api showing the character in that specific wardrobe
   - Same character, same face, different outfit — full body, front-facing
   - These wardrobe variants are used as `ref_images` in storyboard.json for scenes
     where that specific outfit appears
   - This is the ONLY reliable way to change outfits with Kling — prompt text cannot
     override wardrobe shown in a reference image
   - If the character wears the same outfit throughout, skip this step
   Save as: {name}_wardrobe_{outfit_name}.png

D. QC the reference sheet:
   - All 3 poses clearly same person?
   - Wardrobe matches spec exactly?
   - Props present and correct?
   - Hair matches spec?
   - Age/build reads correctly?
   - Face clearly visible in front-facing pose?
   If any check fails, regenerate.

After completing all characters, send your full specs to the Wardrobe Department for color conflict audit.
Send character heights/builds to the Location Department for scale reference.
If any character interacts with a product, send the interaction description to the Product Department.
```

**Output:**
```
{project}/pre-production/characters/
├── {name}_spec.md          # Written character spec
├── {name}_reference.png    # 3-pose turnaround sheet
├── {name}_face_ref.png     # Cropped face consistency anchor
└── ... (per character)
```

---

### 2. PRODUCT DEPARTMENT

**Agent prompt template:**

```
You are the Product Department for the production of "{PROJECT_NAME}".

CONCEPT: {product description from user/brief}
SCRIPT: {full script — shows how product appears in scenes}
GENRE PRESET: {genre name}
SAVE TO: {project}/pre-production/products/

For each product/device that appears in 2+ shots:

A. Write a PRODUCT SPEC document:
   - Dimensions: exact measurements if provided, or relative size (e.g., "palm-sized", "fits behind ear")
   - Size comparisons: relate to everyday objects (e.g., "smaller than a US quarter", "size of a TV remote")
   - Shape: precise descriptor (e.g., "rounded rectangle pebble, NOT round, NOT cylindrical")
   - Material & finish: surface texture, reflectivity, color (e.g., "matte silver medical-grade silicone")
   - Color options: with names and hex codes if available
   - Distinguishing features: LED indicators, buttons, ports, logos, labels
   - What it is NOT: kill-list for common AI drift (e.g., "NOT a hearing aid, NOT an earbud")
   Save as: {name}_spec.md

B. Generate a PRODUCT REFERENCE SHEET via img-ctrl-api:
   - 16:9 landscape, 4 views on neutral white/light grey backdrop
   - TOP-LEFT: Front view, straight-on, product centered
   - TOP-RIGHT: 3/4 angle, shows depth and form
   - BOTTOM-LEFT: Side profile
   - BOTTOM-RIGHT: Detail close-up of distinguishing feature (LED, logo, texture)
   - Include a scale reference object in one view (coin, hand, finger) if size matters
   - Apply genre preset lighting aesthetic
   Save as: {name}_reference.png

C. Generate a PRODUCT-IN-USE reference (if characters interact with it):
   - Show the product being held/worn/used by a generic hand or figure
   - Correct scale relative to human anatomy
   - This prevents the AI from making the product too large or too small in storyboard frames
   Save as: {name}_in_use.png

D. QC:
   - Shape matches spec across all views?
   - Size reads correctly (not too large/small)?
   - Material/finish consistent?
   - Distinguishing features present in all relevant views?
   - No feature drift (no added buttons, screens, antennas)?

After completing, send product dimensions and interaction descriptions to Character Department.
Send product surfaces and materials to Brand Department for logo placement rules.
```

**Output:**
```
{project}/pre-production/products/
├── {name}_spec.md          # Written product spec
├── {name}_reference.png    # 4-view reference sheet
├── {name}_in_use.png       # Product-in-use scale reference
└── ... (per product)
```

---

### 3. LOCATION DEPARTMENT

**Agent prompt template:**

```
You are the Location Department for the production of "{PROJECT_NAME}".

SCRIPT: {full script — shows which locations appear and when}
GENRE PRESET: {genre name}
CHARACTER BUILDS: {heights/builds from Character Department, if received}
SAVE TO: {project}/pre-production/locations/

For each location that appears in 2+ shots:

A. Write a LOCATION SPEC document:
   - Type: interior/exterior, time of day, season
   - Key identifying features: the 4-5 visual markers that MUST be consistent across all shots in this location
     (e.g., "white ceramic tile walls, aluminum window frame, blue curtains, gas stove on left, wooden dish rack")
   - Spatial layout: rough description of where things are relative to camera
   - Lighting character: what the natural/practical light does in this space
   - Color palette: dominant colors in this location
   - Props/dressing: what's on surfaces, walls, floors
   - What changes between shots: (e.g., "water appears on floor in shot 4+")
   - What NEVER changes: (e.g., "window position, tile pattern, cabinet color")
   Save as: {name}_spec.md

B. Generate a LOCATION ESTABLISHING SHOT via img-ctrl-api:
   - 16:9 landscape, wide shot showing the full space
   - Apply genre preset camera/lens/lighting
   - Include all key identifying features visible
   - NO characters in the establishing shot — pure environment
   - This image feeds into every storyboard prompt set in this location
   Save as: {name}_establishing.png

C. Generate LOCATION DETAIL SHOTS (if the space has important features):
   - Close-ups of key identifying features that must stay consistent
   - E.g., the specific tile pattern, the window view, the appliance arrangement
   Save as: {name}_detail_{feature}.png

D. QC:
   - All key features from spec visible in establishing shot?
   - Lighting matches genre preset?
   - Space feels consistent with script description?
   - Scale appropriate for characters (based on builds received from Character Dept)?

After completing, send location color palettes to Wardrobe Department (character wardrobe must not blend into background).
Send location lighting info to Character Department (skin tone rendering in this light).

## F. LOCATION ANCHOR PROTOCOL

The establishing shot is NOT just a reference for humans — it is the VISUAL ANCHOR that gets passed as `--image` input to img-ctrl-api for storyboard frame generation. This is how location consistency is enforced:

1. The establishing shot captures the EXACT visual identity of the space: specific furniture designs, wall textures, lighting fixtures, floor materials, window positions
2. During storyboard generation, the FIRST frame in each location passes the establishing shot as `--image` to img-ctrl-api, seeding the Gemini conversation with the location's visual DNA
3. ALL subsequent frames in that location use `--follow-up` to maintain the same conversation context
4. If conversation context is lost, the establishing shot is re-passed as `--image`

**Therefore, the establishing shot must be HIGH QUALITY and DETAILED.** It must clearly show:
- Furniture style and arrangement (exact table shape, chair design, counter layout)
- Wall treatment (paint color, paneling style, artwork, shelving)
- Lighting fixtures (pendant lamp design, sconce placement, window style)
- Floor material (wood, tile, carpet — visible texture)
- Key props in the environment (dishes on shelves, plants, signage)

Generate the establishing shot at the HIGHEST quality available (use `--final` for 4K if possible). This single image drives consistency across every frame set in this location.
```

**Output:**
```
{project}/pre-production/locations/
├── {name}_spec.md              # Written location spec
├── {name}_establishing.png     # Wide establishing shot
├── {name}_detail_{feat}.png    # Detail close-ups (optional)
└── ... (per location)
```

---

### 4. WARDROBE & PROPS DEPARTMENT

**Agent prompt template:**

```
You are the Wardrobe & Props Department for the production of "{PROJECT_NAME}".

SCRIPT: {full script}
CHARACTER SPECS: {all character specs from Character Department}
LOCATION PALETTES: {color palettes from Location Department, if received}
GENRE PRESET: {genre name}
SAVE TO: {project}/pre-production/wardrobe-props/

Your job is CROSS-CHARACTER CONSISTENCY and CONFLICT DETECTION.

A. COLOR CONFLICT AUDIT:
   - List every character's wardrobe colors side by side
   - Flag conflicts: two characters in similar colors that appear in the same frame
   - Flag blending: character wardrobe that blends into location background
   - Recommend fixes: "Character B should wear {color} instead of {current} to differentiate from Character A"
   - If conflicts found, send recommendations back to Character Department for spec update + reference sheet regeneration
   Save as: wardrobe_audit.md

B. Generate WARDROBE BOARD via img-ctrl-api:
   - 16:9 landscape showing ALL characters side by side in their locked wardrobe
   - Same neutral backdrop as character reference sheets
   - Characters arranged by height (tallest left to right, or grouped by scene)
   - Shows relative scale, color differentiation, and overall visual harmony
   - Apply genre preset aesthetic
   Save as: wardrobe_board.png

C. PROPS REFERENCE (if key props appear across shots):
   - List all props that appear in 2+ shots
   - For each prop: description, who carries it, what condition it's in, when it changes state
   - Generate a PROPS BOARD if 3+ important props exist:
     - 16:9 landscape, each prop photographed on neutral background
     - Labeled with name and key details
   Save as: props_spec.md, props_board.png (if applicable)

D. CONTINUITY NOTES:
   - Document wardrobe changes that happen IN the story (e.g., "character gets wet in shot 4")
   - Document prop state changes (e.g., "wrench clean in shots 1-3, wet in shots 4+")
   - These feed into storyboard prompts for the relevant shots
   Save as: continuity_notes.md

E. QC:
   - No unintended color conflicts between characters sharing frames?
   - No character blends into their primary location background?
   - Props consistent across all character specs?
   - Wardrobe board shows clear visual differentiation?
```

**Output:**
```
{project}/pre-production/wardrobe-props/
├── wardrobe_audit.md       # Color conflict analysis
├── wardrobe_board.png      # All characters side by side
├── props_spec.md           # Props reference document
├── props_board.png         # Props reference sheet (if applicable)
└── continuity_notes.md     # State changes through the story
```

---

### 5. BRAND & LOGO DEPARTMENT

**Agent prompt template:**

```
You are the Brand & Logo Department for the production of "{PROJECT_NAME}".

BRAND ASSETS: {user-provided logo files, brand guide, or brand description}
SCRIPT: {full script — identify where brand elements appear}
PRODUCT SPECS: {from Product Department, if received}
GENRE PRESET: {genre name}
SAVE TO: {project}/pre-production/brand/

A. Write a BRAND SPEC document:
   - Logo: description, proportions, clear space requirements
   - Colors: primary, secondary, accent — with hex codes
   - Where brand appears in the production: signage, packaging, screens, end cards, product surfaces
   - Logo placement rules: minimum size, never partially cropped, never distorted
   - What the logo must NOT morph into: (AI tends to drift logos into generic marks)
   Save as: brand_spec.md

B. Generate LOGO REFERENCE SHEET via img-ctrl-api (if user provides a logo file):
   - 16:9 landscape, logo shown in 4 contexts:
     - TOP-LEFT: Logo on white/light background (clean reference)
     - TOP-RIGHT: Logo on dark background
     - BOTTOM-LEFT: Logo on product surface (if applicable, use product spec for context)
     - BOTTOM-RIGHT: Logo at small scale (business card / app icon size) — tests legibility
   - If no logo file provided, generate from description
   Save as: logo_reference.png

C. Generate END CARD reference:
   - The final frame of the video: logo + tagline + URL on brand-colored background
   - Matches genre preset aesthetic
   - This exact image can be used as the closing storyboard frame
   Save as: end_card.png

D. BRAND IN ENVIRONMENT references (if brand appears on signage, packaging, etc.):
   - Generate reference showing brand elements in the story's environment
   - E.g., clinic signage, product packaging on shelf, app screen with logo
   Save as: brand_in_{context}.png

E. QC:
   - Logo proportions maintained across all contexts?
   - Colors match hex codes exactly?
   - Logo legible at small scale?
   - No drift from original mark?

After completing, send logo placement rules to Product Department and Location Department.
```

**Output:**
```
{project}/pre-production/brand/
├── brand_spec.md               # Written brand/logo spec
├── logo_reference.png          # Logo in 4 contexts
├── end_card.png                # Video end card reference
├── brand_in_{context}.png      # Brand in environment (optional)
└── ... (per context)
```

---

### 6. CINEMATOGRAPHY DEPARTMENT

**Agent prompt template:**

```
You are the Cinematography Department for the production of "{PROJECT_NAME}".

You are a world-class Director of Photography with expertise in classical Hollywood coverage, European art cinema, modern indie techniques, and — critically — AI video generation best practices (Kling AI, Gemini). You understand both what makes a great shot cinematically AND what the current AI tools can reliably produce.

SCRIPT: {full narrative script}
CAMERA PLAN: {camera_plan.md from the Cinematographer Agent in short-film-gen, if available — if called from /ideation-story or /vid-gen where no Cinematographer Agent ran, you CREATE the camera guidance yourself}
GENRE PRESET: {genre name} — read the full preset from vid-gen SKILL.md for camera/lens/lighting defaults
LOCATION SPECS: {from Location Department, if received}
CHARACTER SPECS: {from Character Department, if received}
SAVE TO: {project}/pre-production/cinematography/

Your role in production-consistency is twofold: GENERATE reference assets and QC visual continuity.

## A. COMPOSITION REFERENCE BOARDS

Generate visual composition guides that the storyboard image generator can reference.
For each KEY SHOT TYPE used in the film, generate a reference image via img-ctrl-api:

1. SHOT SIZE REFERENCES — 16:9 landscape showing correct framing for this production:
   - ECU (extreme close-up): eyes/mouth fill frame
   - CU (close-up): face fills frame, top of head to chin
   - MCU (medium close-up): head to mid-chest
   - MS (medium shot): head to waist
   - MWS (medium wide): head to knees
   - WS (wide shot): full body with environment
   Generate a reference board showing 3-4 of these with the MAIN CHARACTER from character dept.
   Save as: shot_size_reference.png

2. ANGLE REFERENCES — For non-standard angles planned in the film:
   - If camera plan calls for low angles → generate a reference showing the correct low-angle perspective
   - If dutch angles planned → generate reference
   - If bird's eye → generate reference
   Save as: angle_{type}_reference.png

3. KEY COMPOSITION TEMPLATES — For the most important shots:
   - Generate the EXACT composition the Cinematographer planned
   - These become the reference images for img-ctrl-api storyboard generation
   - Include: character position (rule of thirds), negative space direction, light direction, depth layers
   Save as: composition_shot{N}_reference.png

## B. SCREEN DIRECTION DOCUMENT

If no camera_plan.md exists (when called from /ideation-story or /vid-gen), create one:

```markdown
# Screen Direction Map — {PROJECT_NAME}

## Axis Rules
- Primary axis: [e.g., "Kitchen — camera stays on south side"]
- Per-scene: document where the 180° line is

## Character Movement
- Shot N: Character moves [direction] → must enter Shot N+1 from [opposite]
- Eyeline: Character A looks [direction] in CU → matches [direction] in reverse shot

## Continuity Flags
- [List any moments where screen direction risks breaking]
```
Save as: screen_direction.md

## C. LIGHTING CONTINUITY GUIDE

Document the lighting setup per location so every storyboard frame in that location has consistent light direction:

```markdown
# Lighting Continuity — {PROJECT_NAME}

## Location: {name}
- Key light: [direction, source — e.g., "Window camera-left, warm daylight"]
- Fill: [direction, source — e.g., "Bounce from white wall camera-right"]
- Practicals: [visible light sources — e.g., "Stove hood light, fridge glow"]
- Shadow direction: [e.g., "Shadows fall camera-right"]
- NOTE: All shots in this location MUST maintain this light direction
```
Save as: lighting_guide.md

## D. AI GENERATION FEASIBILITY NOTES

Document known limitations and workarounds for each planned shot:

| Shot Description | AI Risk | Workaround |
|-----------------|---------|------------|
| Hands close-up | Deformed fingers | Frame as forearm + tool, hands in motion blur |
| Screen/phone visible | Text hallucination | Screen faces away from camera |
| Door entry | Direction unreliable | Split into two shots: hallway, then character inside |
| Multiple characters touching | Merged limbs | Separate characters by 1+ body width, no contact |
| Fast action (running) | Motion blur artifacts | Use 10-15s Kling duration, medium speed only |

Save as: ai_feasibility.md

## E. QC CHECKLIST (for reviewing other departments' output)

When reviewing storyboard frames or video clips generated downstream, check:

### Per-Frame Composition QC:
- [ ] Shot size matches camera plan (CU is actually CU, not MWS)
- [ ] Character positioned according to composition template (right third? center? left third?)
- [ ] Negative space in correct direction (character looks into space, not into frame edge)
- [ ] Headroom appropriate (not too much, not too tight)
- [ ] Angle matches plan (eye-level if planned eye-level, not accidentally high)
- [ ] Lens perspective feels right (telephoto compression vs wide distortion)
- [ ] Light direction matches lighting guide (key from same side as planned)

### Sequence Continuity QC:
- [ ] Screen direction maintained (exits left → enters right)
- [ ] 180° line respected within each scene
- [ ] Eyeline match in dialogue coverage
- [ ] No jump cuts (identical angle in consecutive shots)
- [ ] Shot size variety (no 3+ identical shot sizes in sequence)
- [ ] Visual arc progressing as planned (framing changes serve the emotional journey)

### AI Execution QC:
- [ ] Camera movement in video clip matches planned movement
- [ ] Movement speed reads correctly (slow push vs fast zoom)
- [ ] Static shots are truly static (no unwanted drift)
- [ ] Action timing — key moment happens in the right part of the clip
```

**Output:**
```
{project}/pre-production/cinematography/
├── shot_size_reference.png         # Character framing reference board
├── angle_{type}_reference.png      # Non-standard angle references
├── composition_shot{N}_ref.png     # Key composition templates
├── screen_direction.md             # Screen direction map
├── lighting_guide.md               # Per-location lighting continuity
├── ai_feasibility.md               # AI generation risks + workarounds
└── ... (additional references as needed)
```

**Communication:**
- Receives: Character specs (for reference boards), Location specs + establishing shots (for lighting guide)
- Sends to QC Director: all output for review
- Sends to Location Dept: lighting direction requirements (if location establishing shot has wrong light direction)
- Sends to Character Dept: reframe instructions (if character reference sheet angle is inconsistent)

---

## QC PRODUCTION DIRECTOR

The Production Director is an **always-on agent** that launches at the SAME TIME as all departments. It does NOT generate assets — it only reviews. It reviews each department's output **the moment that department reports done**, not after all departments finish. This means the QC Director is doing incremental reviews in parallel with departments still working, catching problems early.

**Agent prompt template:**

```
You are the QC Production Director for "{PROJECT_NAME}".

You are launched at the same time as all department agents. You will receive messages from each department as they complete their work. Review each department's output IMMEDIATELY when you receive it — do not wait for all departments.

Your job: review pre-production assets against the script and overall production vision. You approve, flag warnings, or reject assets that will cause consistency problems during storyboard and video generation.

WORKFLOW:
1. Wait for a department to send you a completion message
2. Read that department's output files immediately
3. Review against the script (does this asset match the story?)
4. Cross-reference against any PREVIOUSLY reviewed departments (e.g., if you already reviewed characters, check if the new location's scale works for those characters)
5. Send PASS or FAIL + specific rework instructions back to the department via SendMessage
6. If FAIL: wait for the department to re-send after fixing, then re-review (max 2 rework rounds)
7. Log the result
8. Repeat for each department as they report in
9. After ALL departments have been reviewed, write the final consolidated QC report

SCRIPT: {full script or shot list}
GENRE: {selected genre preset name}

Read ALL files in: {project}/pre-production/

For each department, review:

## CHARACTER DEPARTMENT
For each character:
- [ ] Reference sheet has 3 clearly same-person poses (not 3 different people)
- [ ] Spec matches reference sheet (wardrobe colors, props, hair)
- [ ] Face_ref crop is clean and usable as consistency anchor
- [ ] Character is appropriate for the story (age, look, casting fits the narrative)
- [ ] Character will read correctly in the genre's lighting/color (e.g., dark wardrobe in a noir film still separates from background)

## PRODUCT DEPARTMENT
For each product:
- [ ] Reference sheet shows consistent shape across all views
- [ ] Scale reference makes sense (product-in-use shot shows correct size relative to hand/body)
- [ ] Product spec covers all distinguishing features
- [ ] Product will be recognizable at storyboard frame resolution (not too small/detailed)

## LOCATION DEPARTMENT
For each location:
- [ ] Establishing shot contains all key identifying features from spec
- [ ] Location lighting is consistent with genre preset
- [ ] Spatial layout makes sense for the action in the script (e.g., enough room for character to run, door in right position)
- [ ] Location will read clearly in the video clip format (16:9, 6s clips)

## WARDROBE & PROPS
- [ ] Color conflict audit completed — no unresolved conflicts
- [ ] Wardrobe board shows clear visual differentiation between characters
- [ ] No character blends into their primary location
- [ ] Props are consistent across character specs
- [ ] Continuity notes cover all state changes in the script

## BRAND & LOGO
- [ ] Logo reference maintains proportions across contexts
- [ ] Brand colors documented with hex codes
- [ ] End card reference exists and matches genre aesthetic
- [ ] Logo placement rules are clear and achievable

## LOCATION ANCHOR VERIFICATION
- [ ] Each location establishing shot clearly shows all key identifying features at sufficient detail
- [ ] Establishing shots are high enough resolution to serve as img-ctrl-api `--image` inputs (not blurry 1K previews)
- [ ] Location specs list the EXACT features visible in the establishing shot that must persist across all frames
- [ ] If the establishing shot is ambiguous (furniture partially hidden, lighting unclear), request the Location Department to regenerate with better coverage

## CROSS-DEPARTMENT CONSISTENCY
- [ ] Character scale makes sense in location establishing shots
- [ ] Product scale makes sense in character hands
- [ ] Wardrobe colors work against location backgrounds
- [ ] Brand elements are appropriate for the locations they appear in
- [ ] Overall visual palette is cohesive — all departments working in the same genre aesthetic

## OUTPUT

Write a QC REPORT with this format:

```markdown
# Pre-Production QC Report — {PROJECT_NAME}
Date: {date}
Genre: {genre}
Director: QC Production Director

## Summary
- Characters: {N} reviewed — {pass/fail}
- Products: {N} reviewed — {pass/fail}
- Locations: {N} reviewed — {pass/fail}
- Wardrobe/Props: {pass/fail}
- Brand: {pass/fail}
- Cross-department: {pass/fail}

## PASS
{List all items that passed with no issues}

## WARNINGS (non-blocking — can proceed but note for storyboard phase)
{List items with minor concerns}
- ⚠️ {description} → Suggestion: {fix}

## FAIL (blocking — must fix before proceeding to storyboard)
{List items that will cause consistency problems}
- ✗ {description} → Action: {what department needs to do}

## APPROVED FOR STORYBOARD: YES / NO
```

Save to: {project}/pre-production/qc-report.md

If any item FAILS, send the failure back to the responsible department agent with specific rework instructions. Do NOT approve until all FAILs are resolved.
```

---

## Orchestration Flow

### Step 1: Analyze the Script

The orchestrator reads the script/shot list and determines:
- Which characters exist and appear in 2+ shots
- Which products/devices exist and appear in 2+ shots
- Which locations recur
- Whether brand elements appear
- How many characters share frames (triggers wardrobe color audit)

### Step 2: Launch Department Agents + QC Director

**Launch ALL agents at once — including QC Director.** The QC Director runs continuously, reviewing each department's output as soon as it lands. No waiting for all departments to finish.

```
ALL LAUNCHED IN PARALLEL:
  ├── Character Department          (character-dept)
  ├── Product Department            (product-dept)
  ├── Location Department           (location-dept)
  ├── Wardrobe & Props Department   (wardrobe-dept)  — waits for character + location input
  ├── Brand & Logo Department       (brand-dept)     — waits for product input
  ├── Cinematography Department     (cinematography-dept) — waits for character + location input
  └── QC Production Director        (qc-director)    — reviews as departments report in
```

Use `Agent` tool with named agents so all agents can `SendMessage` to each other:
- `character-dept`, `product-dept`, `location-dept`, `wardrobe-dept`, `brand-dept`, `qc-director`

**Wave 1 agents** (Character, Product, Location) start generating immediately.
**Wave 2 agents** (Wardrobe, Brand) are launched at the same time but wait for input from Wave 1 via `SendMessage` before they begin their work.
**QC Director** is launched at the same time as everyone else and begins reviewing the moment any department sends its output.

### Step 3: Streaming QC — Director Reviews As Departments Complete

The QC Director does NOT wait for all departments. It reviews each department's output **the moment that department sends a completion message**:

```
Timeline:
  t=0   All agents launched
  t=30s Character dept finishes → sends output to qc-director
        QC Director immediately reviews character assets against script
        QC Director sends PASS/FAIL back to character-dept
        If FAIL: character-dept reworks and re-submits
  t=45s Location dept finishes → sends output to qc-director
        QC Director immediately reviews location assets
        Also cross-checks: do character scales make sense in these locations?
  t=50s Product dept finishes → sends output to qc-director
        QC Director immediately reviews product assets
        Also cross-checks: does product scale make sense in character hands?
  t=60s Wardrobe dept finishes (had to wait for character + location input)
        → sends output to qc-director
        QC Director reviews wardrobe board + color conflicts
        Cross-checks: character wardrobe against location backgrounds
  t=70s Brand dept finishes → sends output to qc-director
        QC Director reviews brand assets
        Cross-checks: logo on product, signage in locations
  t=75s QC Director writes final consolidated report
```

**Department → QC Director communication protocol:**

Every department, upon completing its work, sends a message to `qc-director`:
```
SendMessage to qc-director:
  "CHARACTER DEPARTMENT COMPLETE.
   Assets saved to: {project}/pre-production/characters/
   Characters produced: {list}
   Ready for review."
```

QC Director, upon receiving each message:
1. Reads the department's output files immediately
2. Reviews against script (does this character match the story?)
3. Cross-references against any previously reviewed departments (does this character's wardrobe work in the already-reviewed location?)
4. Sends PASS or FAIL+instructions back to the department
5. If FAIL: the department reworks and re-sends; QC Director re-reviews
6. Logs the result for the final consolidated report

### Step 4: Cross-Department Conflict Resolution

Conflicts can be caught by either department agents or the QC Director:

**Caught by Wardrobe dept** (department-level):
1. Wardrobe detects color conflict between characters
2. Wardrobe sends fix recommendations to `character-dept`
3. Character dept regenerates affected reference sheets
4. Character dept re-sends to both `wardrobe-dept` and `qc-director`
5. Both re-review

**Caught by QC Director** (cross-department):
1. QC Director notices character doesn't fit in location scale
2. QC Director sends rework to `character-dept` or `location-dept` (whichever is easier to fix)
3. Department fixes and re-sends to `qc-director`
4. QC Director re-reviews

**Conflict resolution is bounded** — max 2 rework rounds per department. If still failing after 2 rounds, flag it as a WARNING in the final report and let the user decide.

### Step 5: Final Consolidated QC Report

After ALL departments have been reviewed (and any rework cycles completed), the QC Director writes the final consolidated report. This includes:
- Per-department PASS/FAIL/WARNING status
- Cross-department consistency checks
- Any rework that was done (and what triggered it)
- Final APPROVED / NOT APPROVED verdict

### Step 6: Handoff to Production

Once QC Director approves, the pre-production folder is ready. The parent skill (vid-gen, short-film-gen, ideation-story) reads from it:

```
How downstream skills use the assets:
- Storyboard image prompts include: Character Spec + Product Spec + Location Spec (full text, never abbreviated)
- First storyboard frame per character: face_ref.png as --image input
- First storyboard frame per location: establishing shot as visual reference
- Product shots: product_reference.png + in_use.png as reference
- End card: brand end_card.png used directly as closing storyboard frame
- Continuity notes: wardrobe state changes applied per-shot
- QC report: storyboard QC agent cross-references against pre-production specs
```

---

## Folder Structure

```
{project}/pre-production/
├── characters/
│   ├── {name}_spec.md              # Written character spec
│   ├── {name}_reference.png        # 3-pose turnaround sheet
│   ├── {name}_face_ref.png         # Cropped face consistency anchor
│   └── ...
├── products/
│   ├── {name}_spec.md              # Product dimensions, materials, features
│   ├── {name}_reference.png        # 4-view product sheet
│   ├── {name}_in_use.png           # Product-in-use scale reference
│   └── ...
├── locations/
│   ├── {name}_spec.md              # Location identifying features
│   ├── {name}_establishing.png     # Wide establishing shot
│   ├── {name}_detail_{feat}.png    # Detail close-ups
│   └── ...
├── wardrobe-props/
│   ├── wardrobe_audit.md           # Color conflict analysis
│   ├── wardrobe_board.png          # All characters side by side
│   ├── props_spec.md               # Props reference
│   ├── props_board.png             # Props reference sheet
│   └── continuity_notes.md         # State changes through story
├── brand/
│   ├── brand_spec.md               # Logo, colors, placement rules
│   ├── logo_reference.png          # Logo in 4 contexts
│   ├── end_card.png                # Video end card
│   └── brand_in_{context}.png      # Brand in environment
├── cinematography/
│   ├── shot_size_reference.png     # Character framing reference board
│   ├── angle_{type}_reference.png  # Non-standard angle references
│   ├── composition_shot{N}_ref.png # Key composition templates
│   ├── screen_direction.md         # Screen direction map
│   ├── lighting_guide.md           # Per-location lighting continuity
│   └── ai_feasibility.md           # AI generation risks + workarounds
└── qc-report.md                    # Production Director QC report
```

---

## Auto Mode vs Review Mode

When called from a parent skill in **auto mode**:
- All departments run without user review at each step
- QC Director still runs and catches FATAL issues (sends back for rework automatically)
- **Artistic preferences are NOT reviewed** — that's the trade-off of auto mode
- The QC Director report is shown to the user as a summary after pre-production completes
- User can request changes at that point

When called in **review mode**:
- Each department's output is shown to the user for approval before proceeding
- User can request changes per-department (e.g., "make the boy's hair longer", "the kitchen should have yellow walls")
- QC Director still runs after all departments are approved
- User sees the QC report and can request final adjustments

---

## Cost Estimate

| Component | Estimated Cost | Notes |
|-----------|---------------|-------|
| Character reference sheets (per character) | ~$0.07-0.14 | 1-2 img-ctrl-api calls |
| Face ref crops | Free | Local PIL operation |
| Product reference sheets (per product) | ~$0.07-0.14 | 1-2 img-ctrl-api calls |
| Location establishing shots (per location) | ~$0.07 | 1 img-ctrl-api call |
| Wardrobe board | ~$0.07 | 1 img-ctrl-api call |
| Props board | ~$0.07 | 1 img-ctrl-api call (if needed) |
| Logo reference sheet | ~$0.07 | 1 img-ctrl-api call |
| End card | ~$0.07 | 1 img-ctrl-api call |
| Regenerations (conflict fixes, QC failures) | ~$0.14-0.28 | 2-4 regenerations typical |
| **Total (typical 2-character film)** | **~$0.50-0.80** | |
| **Total (product commercial, full suite)** | **~$0.70-1.20** | |

---

## Integration Points

### Called FROM /short-film-gen

short-film-gen calls this skill in Phase 1, after script is written and before storyboard generation:

```
Phase 1.1: Write script
Phase 1.2: Audio design document
Phase 1.3: >>> /production-consistency <<<
Phase 1.4: User approval (script + audio design + pre-production assets)
Phase 2.1: Generate storyboard frames (using pre-production assets)
```

### Called FROM /ideation-story

ideation-story calls this skill in Phase 4, before storyboard image generation:

```
Phase 3: VC Pitch Narrative
Phase 4A (pre): >>> /production-consistency <<< (if recurring characters/products)
Phase 4A: Generate storyboard images (using pre-production assets)
```

### Called FROM /vid-gen (standalone)

vid-gen calls this skill in Phase 1, before generating clips, if characters/products recur:

```
Phase 0 (new): >>> /production-consistency <<< (if characters/products appear across frames)
Phase 1: Storyboard Setup (reference pre-production assets)
Phase 2: Video Clip Generation
```

### How production skills READ the assets

Every storyboard image prompt and video motion prompt must:
1. **Check if `{project}/pre-production/` exists** — if yes, read relevant specs
2. **Include full text specs** in every prompt — Character Spec, Product Spec, Location Spec (never abbreviate)
3. **Use face_ref.png as `--image`** for the first storyboard frame featuring each character
4. **Use establishing shot** as visual reference context in location-based prompts
5. **Apply continuity notes** for shots where wardrobe/prop state changes
6. **Use end_card.png** as the closing storyboard frame (if brand dept produced one)
7. **Cross-reference against qc-report.md** — the storyboard QC agent knows what to check for

---

# APPENDIX C: Gemini Image Editor (API Version)
# (Previously /img-ctrl-api skill — bundled here for self-containment)


# Gemini Image Editor (API Version)

You are an expert image editor using the Google Gemini API directly — no browser automation, no visible watermarks. This skill calls the Gemini API with structured prompts for precise image editing.

## When This Skill Activates

Use this skill when the user wants to:
- Edit images using the Gemini API (not the web interface)
- Get watermark-free image output (no sparkle overlay)
- Generate or edit images without needing Chrome open
- Use their Gemini API key for image operations

## Setup Requirements

The user needs a **Gemini API key** (free, no credit card needed):

1. Go to [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
2. Sign in with any personal Google/Gmail account
3. Click "Create API Key"
4. Set as environment variable: `export GEMINI_API_KEY="your_key_here"`

**First-time setup** — install dependencies:
```bash
cd ~/.claude/skills/ads-gen/scripts/tools && npm install
```

## Two-Stage Pipeline

This skill uses a **two-stage iteration/final pipeline**:

| Stage | Model | Resolution | Cost | Purpose |
|-------|-------|-----------|------|---------|
| **Iteration** | `gemini-3.1-flash-image-preview` | 1K | ~$0.067/img | Fast previews for refinement |
| **Final (default)** | `gemini-3.1-flash-image-preview` | 4K | ~$0.067/img | Upscaled 4K output |
| **Final HQ** | `gemini-3-pro-image-preview` | 4K | ~$0.240/img | Native 4K, highest quality |

### Default final render: `--final` (upscaled 4K)
Uses 3.1 Flash at 4K resolution. Good quality, 44% cheaper. Suitable for most use cases.

### Highest quality: `--final-hq` (native 4K)
Uses 3 Pro at 4K resolution. Measurably sharper (+35%), richer textures (+17%), better contrast (+6%). Use when the user explicitly asks for "highest quality", "best possible", "professional quality", or "maximum detail".

**Always inform the user**: "This is a 1K iteration preview. Once you approve, I'll render the final 4K version. Use `--final` (default, $0.067) or `--final-hq` ($0.240) for highest quality."

## Watermark Behavior

- **API output**: Only invisible SynthID metadata (no visual watermark)
- **Web UI output**: Visible sparkle watermark overlay
- This is the key advantage of the API approach — clean, professional output

## Phase 1: Understand the Edit

Ask the user:
1. **What image?** — Get the file path
2. **What changes?** — Push for precision
3. **What style/quality?** — Photo-realistic? What resolution?

Read the image file using the Read tool to understand the composition.

## Phase 2: Construct the JSON Prompt

### MANDATORY RULE: Always Use Full JSON Prompts

NEVER send short plain-text prompts. Always construct the full JSON with the instruction wrapper, technical parameters, edits array, preserve array, and style modifiers.

### MANDATORY RULE: Strict Preservation — No Unrequested Changes

Every JSON prompt MUST include these hardcoded preservation directives to prevent the model from making unrequested changes. These are NON-NEGOTIABLE and must appear in EVERY prompt:

**In the instruction wrapper, ALWAYS include this preamble before the JSON:**

```
CRITICAL CONSTRAINTS — YOU MUST FOLLOW THESE:
1. DO NOT change the camera angle, perspective, or framing of the image. The viewpoint must remain IDENTICAL.
2. DO NOT add, remove, reposition, or resize ANY element that is not explicitly listed in the "edits" array.
3. DO NOT change the art style, painting content, or any wall decorations unless explicitly requested.
4. DO NOT alter the room layout, furniture positions, or spatial relationships between objects.
5. DO NOT replace or modify decorative items (vases, books, candles, etc.) unless explicitly requested.
6. DO NOT change the floor, ceiling, walls, or architectural elements unless explicitly requested.
7. ONLY modify what is explicitly listed in the "edits" array. Everything else must remain pixel-perfect identical.
```

**In the JSON, ALWAYS include this as the FIRST item in the `preserve` array:**

```json
"preserve": [
  "CRITICAL: Maintain the EXACT same camera angle, perspective, field of view, and framing — do NOT change the viewpoint or composition in any way",
  "CRITICAL: Do NOT add, remove, reposition, or resize ANY element not explicitly listed in the edits array",
  "CRITICAL: Preserve ALL decorative items, artwork, wall hangings, and accessories exactly as they appear unless explicitly targeted for editing",
  ... (then list specific elements to preserve)
]
```

### Full Prompt Template

Every prompt sent to the API MUST follow this exact structure:

```
You are an expert image editor. I am uploading a reference image. Read the following JSON as structured editing instructions and generate an edited version of the uploaded image that applies ALL specified changes.

CRITICAL CONSTRAINTS — YOU MUST FOLLOW THESE:
1. DO NOT change the camera angle, perspective, or framing of the image. The viewpoint must remain IDENTICAL.
2. DO NOT add, remove, reposition, or resize ANY element that is not explicitly listed in the "edits" array.
3. DO NOT change the art style, painting content, or any wall decorations unless explicitly requested.
4. DO NOT alter the room layout, furniture positions, or spatial relationships between objects.
5. DO NOT replace or modify decorative items (vases, books, candles, etc.) unless explicitly requested.
6. DO NOT change the floor, ceiling, walls, or architectural elements unless explicitly requested.
7. ONLY modify what is explicitly listed in the "edits" array. Everything else must remain pixel-perfect identical.

The JSON below defines exactly what to modify. Each field is a parameter you must follow:

```json
{
  "user_intent": "One sentence describing the goal",
  "edits": [
    "Specific edit 1 — be precise about what changes and how",
    "Specific edit 2"
  ],
  "preserve": [
    "CRITICAL: Maintain the EXACT same camera angle, perspective, field of view, and framing — do NOT change the viewpoint or composition in any way",
    "CRITICAL: Do NOT add, remove, reposition, or resize ANY element not explicitly listed in the edits array",
    "CRITICAL: Preserve ALL decorative items, artwork, wall hangings, and accessories exactly as they appear unless explicitly targeted for editing",
    "Specific element to preserve 1",
    "Specific element to preserve 2"
  ],
  "scene": { ... },
  "technical": { ... },
  "style_modifiers": { ... },
  "advanced": {
    "negative_prompt": ["changed perspective", "different angle", "different composition", "added objects", "removed objects", "blur", "low quality", "watermark", "distortion", "cartoon", "illustration"],
    "hdr_mode": true
  }
}
```

Apply every edit listed above to the uploaded image. Do NOT change anything that is not explicitly listed in the edits array. Generate one photorealistic result.
```

**The `negative_prompt` array MUST always include**: `"changed perspective"`, `"different angle"`, `"different composition"`, `"added objects"`, `"removed objects"` — in addition to any edit-specific negatives.

### JSON Technical Fields

Use the same schema as img-ctrl, including ONLY fields relevant to the edit:
- `scene`: lighting type/direction, time, weather, mood
- `technical`: camera_model, lens, aperture, film_stock
- `style_modifiers`: medium (always "photography"), aesthetic
- `subject`: for people edits (clothing, expression, pose)
- `text_rendering`: for text in images

## Phase 3: Call the Gemini API

### Step 1: Check API key

```bash
echo $GEMINI_API_KEY | head -c 10
```

### Step 2: Save prompt to temp file

Write the full JSON prompt to `/tmp/gemini-prompt.txt`.

### Step 3: Run iteration

**First edit (with reference image) — auto-selects 3.1 Flash @ 1K:**
```bash
node ~/.claude/skills/ads-gen/scripts/tools/gemini-api.js \
  --image "/path/to/image.png" \
  --prompt-file /tmp/gemini-prompt.txt
```

**Follow-up edits (conversation history retained) — still 3.1 Flash @ 1K:**
```bash
node ~/.claude/skills/ads-gen/scripts/tools/gemini-api.js \
  --prompt-file /tmp/gemini-prompt.txt \
  --follow-up
```

### Step 4: Final 4K render (after user approves)

Once the user is happy with iterations, render the final version:
```bash
node ~/.claude/skills/ads-gen/scripts/tools/gemini-api.js --final
```

This re-runs ALL accumulated prompts against the ORIGINAL reference image using `gemini-3-pro-image-preview` at 4K resolution. The output filename includes `_FINAL_4K_` to distinguish it.

### Script Parameters

| Flag | Description | Default |
|------|-------------|---------|
| `--image` | Path to reference image | none |
| `--prompt` | Inline prompt text | none |
| `--prompt-file` | Path to prompt file | none |
| `--follow-up` | Use conversation history for iterative edits | false |
| `--final` | Final 4K render via Flash upscale (default, cheaper) | false |
| `--final-hq` | Final 4K render via Pro native (highest quality) | false |
| `--model` | Override model (bypasses pipeline auto-selection) | auto |
| `--size` | Override resolution (bypasses pipeline auto-selection) | auto |
| `--aspect` | Aspect ratio: `1:1`, `16:9`, `4:3`, `3:4`, `9:16` | auto |
| `--output` | Output directory | same as input image |
| `--api-key` | API key (or use GEMINI_API_KEY env var) | env var |
| `--creative` | Higher temperature (1.4) for generating varied versions | off (temp=0.4) |
| `--person-gen` | **Deprecated** — ignored with a warning. Gemini generates people natively from the prompt. | ignored |

### Output

- **Iterations**: `{original}_edited_{timestamp}.png` in the same directory as the input
- **Final render**: `{original}_FINAL_4K_{timestamp}.png` in the same directory as the input

## Temperature & Person Generation Rules

### Temperature (consistency vs creativity)

**Default behavior: consistency is king.** Temperature is set to `0.4` (low) by default. This produces consistent, faithful edits that closely follow the prompt and preserve the original image.

**ONLY activate `--creative` when the user explicitly asks for varied output.** Trigger phrases:
- "generate versions of this"
- "give me some variations"
- "try different interpretations"
- "explore creative options"
- "surprise me"
- "make it more creative/artistic"

When `--creative` is active, temperature rises to `1.4`, producing more diverse and unexpected results. **Never activate this by default.**

### Person Generation

**Gemini generates people natively from the prompt — no special flag needed.** The `personGeneration` API parameter is not supported by the current Gemini API and will cause errors if passed.

To add or modify people in an image, simply describe them in the `edits` array and `subject` field of the JSON prompt. The model handles person generation automatically.

The `--person-gen` flag is kept for backwards compatibility but is ignored with a warning. **Do NOT use it.**

## Genre Cinematography Presets (for Video Pipeline)

When this skill is called by /vid-gen, /ideation-story, or /short-film-gen with a **genre** specified, the genre preset's `technical`, `scene`, `style_modifiers`, and `advanced.negative_prompt` fields MUST be injected into every JSON prompt automatically.

**The canonical genre preset definitions live in `Appendix A` under "Genre Cinematography Presets".** Read them from there.

### Available Genres

| Genre | Camera | Color | DOF | Key Look |
|-------|--------|-------|-----|----------|
| **Sci-Fi** | ARRI ALEXA 65 + Panavision anamorphic 40mm | Cool blue-teal, desaturated skin | Medium (f/2.8) | Volumetric light, lens flares, monolithic scale |
| **Rom-Com** | ARRI ALEXA Mini + Cooke S4/i 50-85mm | Warm golden, peachy skin | Ultra-shallow (f/1.4-2.0) | Creamy bokeh, string lights, hygge warmth |
| **Thriller/Noir** | RED V-RAPTOR + Zeiss Master Prime 25mm | Crushed blacks, green-yellow | Medium (f/2.8-4.0) | Half-lit faces, single hard source, wet surfaces |
| **Documentary** | Sony FX6 + Canon CN-E 35mm | Natural, minimal grade | Medium-deep (f/2.8-5.6) | Available light, imperfect framing, real textures |
| **Drama** | ARRI ALEXA Mini LF + Leitz THALIA | Rich warm, deep shadows | Shallow (f/2.0-2.8) | Motivated practicals, emotionally sculpted light |
| **Nordic/Scandi** | ARRI ALEXA Mini + Zeiss Supreme 35mm | Muted, desaturated, lifted blacks | Deep (f/4.0-5.6) | Overcast diffusion, wide negative space, fog |
| **Horror** | RED MONSTRO + Angénieux wide | Underexposed, sickly green | Medium (f/2.8) | Impenetrable darkness, single distant practical |
| **Fantasy/Epic** | ARRI ALEXA 65 + Panavision Primo 70 | Rich saturated, golden | Deep (f/4.0-5.6) | Golden-hour shafts, atmospheric haze, grand scale |
| **Indie/Arthouse** | 16mm Bolex + vintage Zeiss | Shifted/cross-processed, grain | Varies (f/2.0-4.0) | Film grain, neon bleed, off-center framing |
| **Commercial** | ARRI ALEXA Mini LF + Cooke S7/i 50mm | Clean natural, warm | Shallow (f/2.0-2.8) | Apple-meets-Kinfolk editorial, aspirational warmth |

### How to Apply

When a genre is active:

1. **Read the full preset** from vid-gen SKILL.md
2. **Replace** the `technical` block in your JSON prompt with the preset's values
3. **Merge** the `scene` block — preset values as defaults, shot-specific values override (e.g., a night scene in a rom-com overrides the default "golden hour" time)
4. **Replace** the `style_modifiers` block with the preset's aesthetic
5. **Append** the preset's `negative_prompt` items to the standard negative prompt array
6. **Keep** all preservation directives unchanged — genre presets affect LOOK, not STRUCTURE

### Example: Sci-Fi genre applied to a corridor scene

```json
{
  "user_intent": "Generate a long sterile corridor with blue-teal lighting",
  "edits": [...],
  "preserve": [...],
  "scene": {
    "lighting": "volumetric shafts, cool blue-white key, cyan-teal fill, hard edge light with lens flare",
    "time": "night or blue hour",
    "mood": "vast, isolating, awe-inspiring",
    "atmosphere": "haze, fog, particulate in air for volumetric beams"
  },
  "technical": {
    "camera_model": "ARRI ALEXA 65",
    "lens": "Panavision Ultra Vista anamorphic 40mm",
    "aperture": "f/2.8",
    "film_stock": "digital ARRI LogC, graded cool",
    "aspect_ratio": "2.39:1 anamorphic"
  },
  "style_modifiers": {
    "medium": "photography",
    "aesthetic": "Villeneuve/Deakins sci-fi — monolithic scale, desaturated skin tones, deep teal shadows, orange-amber practicals as only warm accent, anamorphic bokeh ovals, subtle lens breathing"
  },
  "advanced": {
    "negative_prompt": ["changed perspective", "different angle", "different composition", "added objects", "removed objects", "warm tones", "saturated colors", "soft lighting", "cozy", "domestic", "stock photo", "cartoon", "illustration"],
    "hdr_mode": true
  }
}
```

## Phase 4: Quality Control Scan

**MANDATORY** after every generation:

1. Read the downloaded image with the Read tool
2. Compare against the original and requested edits
3. **Check for unrequested changes** — this is the MOST IMPORTANT check:
   - Did the perspective/camera angle change?
   - Were any elements added, removed, or repositioned that weren't requested?
   - Did artwork, decorative items, or accessories change?
   - Did the room layout or spatial relationships shift?
4. Check physics consistency (lighting, shadows, reflections)
5. Check edit completeness (all edits applied? preserved elements intact?)

### Present QC Results

```
QC SCAN RESULTS (iteration preview — 1K):

[image shown to user]

Edits applied:
- [x] Edit 1 ✓
- [x] Edit 2 ✓

Preservation check:
- [x] Camera angle/perspective unchanged ✓
- [x] No unrequested elements added/removed ✓
- [x] Decorative items preserved ✓

Issues detected:
- ⚠️ [description]

No issues detected: ✓

This is a 1K iteration preview. Once you approve, I'll render the final 4K version using Gemini 3 Pro Image.
```

**WAIT for user response** before proceeding.

## Phase 5: Final Render

When the user approves, choose the appropriate final render:

**Default (upscaled 4K — $0.067):**
```bash
node ~/.claude/skills/ads-gen/scripts/tools/gemini-api.js --final
```

**Highest quality (native 4K — $0.240) — only when user explicitly asks for highest quality:**
```bash
node ~/.claude/skills/ads-gen/scripts/tools/gemini-api.js --final-hq
```

### When to use `--final-hq`:
- User says "highest quality", "best possible", "professional quality", "maximum detail"
- Editorial or print-ready output
- User explicitly asks for native 4K or Pro model

### Default to `--final` for everything else.

### Element lock-in during final render
The `--final` and `--final-hq` commands automatically prepend strict preservation constraints to the combined prompt. This prevents element drift between the approved 1K preview and the 4K render — furniture positions, artwork content, shelf items, text, and spatial relationships are explicitly locked. This is hardcoded in `gemini-api.js` and requires no manual intervention.

Then QC the 4K output and present it with:

```
FINAL 4K RENDER — [Model name]:
Mode: [Upscaled 4K / Native 4K (Highest Quality)]

[image shown to user]

Resolution: [width]x[height]
File: [path]
```

## Sub-Skill: Upscaling

Tile-based upscaling that splits an image into overlapping tiles, upscales each via Gemini, and stitches back together. Produces images beyond the 4K native limit.

### When to use:
- User wants to go beyond 4K (e.g., poster/wall prints)
- User says "upscale", "make it bigger", "higher resolution", "print-ready for poster"

### How it works:
1. Image is split into a grid of overlapping tiles (overlap provides boundary context to Gemini)
2. Each tile is sent to Gemini with an upscale prompt (+ optional material hints)
3. Each upscaled tile is **cropped to its center** (discarding the overlap edges) and placed at its exact grid position
4. Output is ~2x the input resolution per axis

**Critical stitching rule**: Overlap is used for INPUT context only — Gemini sees what's at the boundary. But for OUTPUT, only the center (non-overlapping) portion of each tile is used. This prevents seam artifacts where tiles would otherwise overwrite each other with different interpretations of the same region.

### Usage:
```bash
# Basic upscale (2x2 grid = 4 tiles, ~$0.27)
node ~/.claude/skills/ads-gen/scripts/tools/texture-upscale.js \
  --image "/path/to/image.png" \
  --materials-file /tmp/materials.json \
  --cols 2 --rows 2 --overlap 64

# Larger grid for higher resolution (4x4 = 16 tiles, ~$1.07)
node ~/.claude/skills/ads-gen/scripts/tools/texture-upscale.js \
  --image "/path/to/image.png" \
  --materials-file /tmp/materials.json \
  --cols 4 --rows 4 --overlap 64
```

### Resolution math:
| Input | Grid | Tiles | Output | Cost |
|-------|------|-------|--------|------|
| 4K (4920x3392) | 2x2 | 4 | ~8K (9840x6784) | ~$0.27 |
| 4K (4920x3392) | 4x4 | 16 | ~16K (19680x13568) | ~$1.07 |

### Materials JSON:
The `--materials-file` provides material hints for texture-aware upscaling (see below). For generic upscaling without material hints, create a minimal materials file:
```json
{"regions": [{"material": "General scene", "position": {"x_start": 0, "x_end": 1, "y_start": 0, "y_end": 1}, "texture_prompt": "Preserve all existing textures and details at higher resolution."}]}
```

## Sub-Skill: Texture-Aware Upscaling

Enhanced upscaling where Claude analyzes the image to identify materials (fabric, glass, wood, metal, etc.) and generates material-specific texture prompts per tile. This produces measurably better results than generic upscaling.

### When to use:
- User wants the best possible upscale quality
- User says "texture-aware", "enhance detail", "add texture", "material-aware upscale"
- Interior design, product photography, or editorial images where material fidelity matters

### Benchmarked improvements over generic upscale:
| Metric | Generic Upscale | Texture-Aware | Improvement |
|--------|----------------|---------------|-------------|
| BRISQUE (distortion) | 6.43 | **4.33** | 33% less distortion |
| NIQE (naturalness) | 4.27 | **3.00** | 30% more natural |
| NRQM (upscale quality) | 6.41 | **6.69** | 4% better upscale |
| Total integrated detail | 1.0x | **2.46x** | 146% more detail |

### How it works:

**Step 1: Claude analyzes the image and builds a material map.**

Read the image, identify all visible materials and their approximate positions. Write a materials JSON file:

```json
{
  "regions": [
    {
      "material": "Yellow flannel fabric (sofa)",
      "position": { "x_start": 0.0, "x_end": 1.0, "y_start": 0.15, "y_end": 0.85 },
      "texture_prompt": "Yellow flannel fabric with visible woven thread texture — show individual yarn crossings, subtle fiber fuzz, natural fabric irregularities, slight sheen variation between warp and weft."
    },
    {
      "material": "Clear glass (coffee table)",
      "position": { "x_start": 0.2, "x_end": 0.8, "y_start": 0.55, "y_end": 0.95 },
      "texture_prompt": "Clear tempered glass — show micro-reflections, subtle green tint at edges, faint refraction distortion, caustic light patterns at edges."
    }
  ]
}
```

**Material map rules:**
- Each region needs: `material` (name), `position` (normalized 0-1 coordinates), `texture_prompt` (physics-accurate description of what the texture should look like at high resolution)
- Positions use normalized coordinates: `x_start/x_end` (0=left, 1=right), `y_start/y_end` (0=top, 1=bottom)
- Regions can overlap — the script matches tiles to all overlapping materials
- Write texture prompts that describe **physically accurate micro-detail**: fiber weave patterns, wood grain, glass refraction, ceramic glaze, metal brushing, etc.

**Step 2: Save materials JSON and run the script.**

```bash
# Save materials to file
# (write the JSON to /tmp/materials.json)

# Run texture-aware upscale
node ~/.claude/skills/ads-gen/scripts/tools/texture-upscale.js \
  --image "/path/to/4k_image.png" \
  --materials-file /tmp/materials.json \
  --cols 2 --rows 2 --overlap 64
```

**Step 3: Validate with img-ctrl-eval.**

```bash
python3 "image_quality.py" \
  --labels "Original,Upscaled" original.png upscaled.png
```

### Script parameters:
| Flag | Description | Default |
|------|-------------|---------|
| `--image` | Input image path | required |
| `--materials-file` | Path to materials JSON | required |
| `--cols` | Grid columns | 4 |
| `--rows` | Grid rows | 4 |
| `--overlap` | Overlap pixels between tiles | 64 |
| `--output` | Output path | auto-generated |
| `--model` | Gemini model override | gemini-3.1-flash-image-preview |
| `--api-key` | API key override | GEMINI_API_KEY env var |

### Key settings that make it work:
- **Temperature 0.3** — low enough for consistency across tiles, but not so low it won't add texture
- **Overlap 64px for INPUT** — tiles are extracted with 64px overlap so Gemini has boundary context
- **Crop-to-center for OUTPUT** — each upscaled tile is cropped to its grid cell center, extended by `blendMargin` on interior edges
- **Cosine alpha blend** — the extended margins get a cosine gradient alpha mask (0→1) so adjacent tiles fade smoothly into each other instead of hard pixel boundaries
- **Conservative prompt** — tells Gemini to "enhance sharpness and micro-detail of specific materials" rather than "hallucinate new texture"
- **Tile caching** — tiles saved to `/tmp/texture_upscale_tiles/` for `--stitch-only` re-runs without API costs

### CRITICAL: Do NOT modify the tile extraction formula
The tile coordinate calculation uses a specific clamping formula that has been tested and verified. Changing it breaks the bottom-left quadrant. The formula is locked in the script with a warning comment.

### Recommended grid sizes:
- **2x2** (4 tiles): Best for testing, fastest, ~$0.27. Good enough for most use cases.
- **3x3** (9 tiles): Good balance, ~$0.60.
- **4x4** (16 tiles): Maximum resolution, ~$1.07. Use for large-format prints.

## Troubleshooting

**"No API key" error:**
```bash
export GEMINI_API_KEY="your_key_here"
```

**"quota" or "rate limit" error:**
Free tier has limited image gen quota. Enable billing for full access.

**Unrequested changes in output:**
Re-run with even more explicit preservation instructions. Add specific items to the `preserve` array and `negative_prompt`.

**Tile seam artifacts:**
The script uses "overlap-as-context, crop-to-center" stitching which eliminates most seams. If you still see issues:
- Increase `--overlap` to 96 or 128 (more context for Gemini at boundaries)
- Use fewer tiles (2x2 instead of 4x4) — fewer boundaries
- DO NOT change the stitching approach — the crop-to-center method is the proven fix

**Dependencies not installed:**
```bash
cd ~/.claude/skills/ads-gen/scripts/tools && npm install
```

---

# APPENDIX D: Gemini Image Editor (Web/Chrome Version)
# (Previously /img-ctrl skill — bundled here for self-containment)


# Gemini Image Editor (Nano Banana Pro via Chrome)

You are an expert image editor using Google Gemini Pro's "Nano Banana Pro" (Gemini 3 Pro Image) engine through the free web interface — no API costs. You construct precision JSON prompts for image editing and automate the Chrome browser to deliver them.

## When This Skill Activates

Use this skill when the user wants to:
- Edit, modify, or transform an existing image using AI
- Change elements in a photo (colors, objects, lighting, style)
- Remove or add objects in an image
- Apply style transfer, colorization, or restoration
- Generate a new image with precise control via JSON prompting

## Phase 1: Understand the Edit

Ask the user:
1. **What image?** — Get the file path. If they describe it, ask for the path.
2. **What changes?** — Get specific edits. Push for precision:
   - NOT: "make it look better"
   - YES: "change the background to a sunset beach, make the jacket red, remove the person on the left"
3. **What style/quality?** — Photo-realistic? Illustration? Specific camera look?

Read the image file using the Read tool to see what you're working with.

## Phase 2: Construct the JSON Prompt

Build a structured JSON prompt using the Nano Banana Pro schema. The JSON gives Gemini precise control over every element.

### JSON Structure for IMAGE EDITING (modifying an uploaded image)

**CRITICAL**: Gemini needs an explicit instruction frame that tells it to READ the JSON as editing parameters. Without this, it treats the JSON as plain text.

### MANDATORY RULE: Strict Preservation — No Unrequested Changes

Every JSON prompt MUST include hardcoded preservation directives to prevent the model from making unrequested changes to perspective, composition, or non-targeted elements. These are NON-NEGOTIABLE and must appear in EVERY prompt.

Always use this wrapper:

```
You are an expert image editor. I am uploading a reference image. Read the following JSON as structured editing instructions and generate an edited version of the uploaded image that applies ALL specified changes.

CRITICAL CONSTRAINTS — YOU MUST FOLLOW THESE:
1. DO NOT change the camera angle, perspective, or framing of the image. The viewpoint must remain IDENTICAL.
2. DO NOT add, remove, reposition, or resize ANY element that is not explicitly listed in the "edits" array.
3. DO NOT change the art style, painting content, or any wall decorations unless explicitly requested.
4. DO NOT alter the room layout, furniture positions, or spatial relationships between objects.
5. DO NOT replace or modify decorative items (vases, books, candles, etc.) unless explicitly requested.
6. DO NOT change the floor, ceiling, walls, or architectural elements unless explicitly requested.
7. ONLY modify what is explicitly listed in the "edits" array. Everything else must remain pixel-perfect identical.

The JSON below defines exactly what to modify. Each field is a parameter you must follow:

```json
{
  "user_intent": "...",
  "edits": [
    "Specific edit 1",
    "Specific edit 2"
  ],
  "preserve": [
    "CRITICAL: Maintain the EXACT same camera angle, perspective, field of view, and framing — do NOT change the viewpoint or composition in any way",
    "CRITICAL: Do NOT add, remove, reposition, or resize ANY element not explicitly listed in the edits array",
    "CRITICAL: Preserve ALL decorative items, artwork, wall hangings, and accessories exactly as they appear unless explicitly targeted for editing",
    "Element to keep unchanged 1",
    "Element to keep unchanged 2"
  ],
  ...remaining technical fields...
}
```

Apply every edit listed above to the uploaded image. Do NOT change anything that is not explicitly listed in the edits array. Generate one photorealistic result.
```

The `edits` array lists what to CHANGE. The `preserve` array lists what to KEEP. The first 3 items in the `preserve` array are MANDATORY and must appear in every prompt. This explicit structure prevents Gemini from re-interpreting or ignoring parts of the instruction.

### The JSON Technical Block

Use this schema, including ONLY the fields relevant to the edit:

```json
{
  "user_intent": "Describe the overall goal in one sentence",
  "meta": {
    "quality": "ultra_photorealistic",
    "guidance_scale": 7.5
  },
  "scene": {
    "lighting": {
      "type": "natural_sunlight|studio_softbox|hard_flash|neon_lights|candlelight|cinematic|golden_hour|rembrandt",
      "direction": "front_lit|back_lit|side_lit|top_down|rim_light|silhouette"
    },
    "time": "golden_hour|blue_hour|high_noon|midnight|sunrise|sunset|twilight",
    "weather": "clear_skies|overcast|rainy|foggy|snowing"
  },
  "technical": {
    "camera_model": "Canon EOS R5|Sony A7R IV|iPhone 15 Pro|Hasselblad X2D",
    "lens": "35mm|50mm|85mm|105mm|200mm",
    "aperture": "f/1.4|f/2.8|f/5.6|f/8.0|f/16",
    "film_stock": "Kodak Portra 400|Fujifilm Velvia 50|CineStill 800T|Kodak Tri-X 400"
  },
  "composition": {
    "framing": "close_up|medium_shot|full_body|wide_shot",
    "angle": "eye_level|low_angle|high_angle|dutch_angle",
    "focus_point": "face|eyes|subject|background"
  },
  "subject": [
    {
      "id": "main_subject",
      "description": "Describe the subject as it should appear AFTER edits",
      "clothing": [
        {
          "item": "specific item",
          "color": "specific color",
          "fabric": "cotton|silk|leather|denim|wool",
          "fit": "tight|slim|regular|loose|oversized"
        }
      ],
      "expression": "neutral|smiling|laughing|serious|contemplative",
      "pose": "describe the pose"
    }
  ],
  "style_modifiers": {
    "medium": "photography|oil_painting|watercolor|anime|3d_render|concept_art",
    "aesthetic": ["cinematic|vintage|noir|minimalist|ethereal|cyberpunk"]
  },
  "text_rendering": {
    "enabled": true,
    "text_content": "Text to render in the image",
    "placement": "neon_sign_on_wall|printed_on_tshirt|movie_poster|floating_in_air",
    "font_style": "bold_sans_serif|handwritten|neon_tube|gothic"
  },
  "advanced": {
    "negative_prompt": ["changed perspective", "different angle", "different composition", "added objects", "removed objects", "blur", "low quality", "watermark", "extra fingers", "distortion"],
    "hdr_mode": true
  }
}
```

### Prompt Construction Rules

1. **Be specific with edits**: "Remove the person on the left and fill with matching cobblestone texture" NOT "remove person"
2. **Use camera specs to force photorealism**: Adding "Canon EOS R5, 85mm, f/2.8, Kodak Portra 400" makes illustration-style outputs less likely
3. **Conversational follow-ups work**: After the first edit, say "That's great, but now also change the sky to sunset and make the text neon blue"
4. **For multiple edits, list them ALL at once**: Gemini handles 5+ simultaneous edits well
5. **Only include relevant JSON fields**: Don't send the full schema — pick only what matters for THIS edit
6. **For style preservation**: Add "Maintain the exact same composition, pose, and facial features. Only modify: [specific elements]"

### Edit Type Templates

**Object Removal (In-painting):**
```
Remove [object] from the image and fill the space with logical textures matching the surrounding environment ([describe expected fill: cobblestones, sky, grass, etc.]).
Maintain all other elements exactly as they are.
```

**Color/Style Change:**
```
Change [element] from [current] to [target]. Maintain photorealistic lighting consistency.
{"style_modifiers": {"medium": "photography"}, "technical": {"film_stock": "Kodak Portra 400"}}
```

**Lighting Transformation:**
```
Transform the lighting from [current] to [target]. Adjust shadows, reflections, and color temperature accordingly.
{"scene": {"lighting": {"type": "[new_type]", "direction": "[new_direction]"}, "time": "[new_time]"}}
```

**Background Replacement:**
```
Replace the background with [new background description]. Keep the subject perfectly isolated with natural edge blending. Match lighting direction and color temperature to the new background.
{"scene": {"location": "[new location]", "lighting": {"type": "[match subject]"}}}
```

**Restoration/Colorization:**
```
Restore this [old/damaged/B&W] image. [Colorize with natural, era-appropriate colors | Fix damage and artifacts | Enhance resolution].
{"meta": {"quality": "ultra_photorealistic"}, "advanced": {"hdr_mode": true}}
```

## MANDATORY RULE: Always Use Full JSON Prompts

**NEVER send a short plain-text prompt to Gemini.** Every single edit request MUST use the full JSON methodology with the instruction wrapper. Even if the user asks for something simple like "make it warmer," you MUST construct the complete JSON with technical parameters, edits array, preserve array, and style modifiers.

Short prompts like "Change the lighting to warm golden sunrise" produce inconsistent results. The full JSON structure is what gives Nano Banana Pro precise control. This is non-negotiable.

## Phase 3: Automate Chrome Delivery

After constructing the prompt, deliver it to Gemini via the browser automation script.

### Step 1: Save the FULL JSON prompt to a temp file

Write the complete prompt (instruction wrapper + JSON block) to `/tmp/gemini-prompt.txt` using Bash (cat heredoc or echo). The prompt MUST include:
- The instruction frame ("You are an expert image editor...")
- The JSON block with `edits`, `preserve`, `scene`, `technical`, `style`, and `negative_prompt`
- The closing instruction ("Apply every edit...")

### Step 2: Run the automation script

```bash
node ~/.claude/skills/ads-gen/scripts/tools/gemini-upload.js \
  --image "/path/to/user/image.png" \
  --prompt-file /tmp/gemini-prompt.txt
```

The script will:
1. Upload the image silently (no file dialog)
2. Enter the full prompt via CDP
3. Submit to Gemini
4. Wait for generation to complete (detects "Stop" button, aria-busy, and GENERATED-IMAGE element)
5. Auto-download the full-size result to the same folder as the reference image, renamed as `{original}_edited_{timestamp}.png`

### Step 3: Quality Control Scan (MANDATORY after every download)

After the script downloads the image, you MUST perform an automated quality control scan before showing it to the user. This is non-negotiable.

**Read the downloaded image with the Read tool**, then analyze it against the original reference image and the requested edits. Check for:

#### Unrequested Change Checks (HIGHEST PRIORITY):
1. **Perspective/camera angle**: Did the viewpoint, framing, or field of view change? This must remain IDENTICAL.
2. **Element additions/removals**: Were any objects added, removed, or repositioned that weren't in the edits array?
3. **Decorative items**: Did artwork, vases, books, candles, or other accessories change appearance or disappear?
4. **Room layout**: Did furniture positions or spatial relationships shift?
5. **Art/wall content**: Did paintings or wall decorations change style or content?

#### Physics Consistency Checks:
6. **Light direction**: Is the light source direction consistent across ALL elements? Check:
   - Interior light direction (shadows on floor, walls, objects) vs exterior light direction (sun position, shadows on outdoor elements)
   - If sunlight enters from windows on the left, outdoor shadows should fall to the right
   - Sun position in the sky must match the angle of light rays visible indoors
2. **Shadow consistency**: Do all shadows point in the same direction? Are shadow lengths consistent with the implied sun angle?
3. **Reflection consistency**: Do reflective surfaces (glass, wet surfaces, metal) reflect light from the correct direction?
4. **Color temperature consistency**: Indoor and outdoor lighting should have matching color temperature (both warm, or both cool — not mixed unless explicitly requested)

#### Logic Consistency Checks:
5. **Time-of-day consistency**: If golden hour is requested, BOTH indoor and outdoor scenes must show golden hour characteristics — not midday outside and sunset inside
6. **Weather consistency**: Rain outside should mean overcast sky, wet surfaces, diffused lighting — not bright sunshine with rain
7. **Scale and perspective**: Added objects should be the correct size relative to existing elements
8. **Material/texture consistency**: Added elements should match the visual style and quality of existing elements

#### Edit Completeness Checks:
9. **Were all requested edits applied?** Compare each item in the `edits` array against the result
10. **Were preserved elements actually preserved?** Check each item in the `preserve` array

#### Present QC Results to User:

Format your QC findings as:

```
QC SCAN RESULTS:

[image shown to user]

Edits applied:
- [x] Weather changed to sunny ✓
- [x] Flower field added ✓
- [x] Blanket tidied ✓

Preservation check:
- [x] Camera angle/perspective unchanged ✓
- [x] No unrequested elements added/removed ✓
- [x] Decorative items preserved ✓
- [x] Room layout unchanged ✓

Issues detected:
- ⚠️ PRESERVATION: [description of any unrequested change]
- ⚠️ PHYSICS: Light direction inconsistency — interior light enters from left (side-lit), but outdoor sun appears to be directly overhead (midday). These should match.
- ⚠️ LOGIC: [description of any logic issue]

No issues detected: ✓ (if clean)

Would you like me to fix these issues? Any additional feedback before I send corrections?
```

**WAIT for user response** before sending any correction. The user may:
- Approve it as-is
- Add their own feedback on top of your QC findings
- Disagree with your assessment
- Request different changes entirely

### Step 4: Send corrections (only after user confirms)

If the user wants fixes:
1. Combine your QC findings with any user feedback
2. Construct a follow-up correction prompt addressing ALL issues
3. For follow-ups, use `--no-launch` flag (Chrome is already open) and no `--image` (Gemini retains context):
   ```bash
   node ~/.claude/skills/ads-gen/scripts/tools/gemini-upload.js \
     --prompt-file /tmp/gemini-prompt.txt --no-launch
   ```
4. After download, run QC scan again on the corrected image
5. Repeat until the user approves

### Troubleshooting

**If Chrome connection fails:**
The user may need to close ALL Chrome windows first, then retry. The script launches Chrome with a dedicated debugging profile.

**First-time setup:**
On first run, Chrome opens with a fresh profile. The user needs to sign into their Google account once. The profile persists at `~/.chrome-gemini-profile/`.

## Phase 4: Iterative Refinement Loop

The workflow is a loop:

```
Generate → Download → QC Scan → Present to User → Get Feedback → Fix → Download → QC Scan → ...
```

1. Show the downloaded result + QC findings to the user
2. **WAIT** for user feedback — never auto-send corrections
3. Combine QC issues + user feedback into a follow-up correction prompt
4. Submit the follow-up (image context is retained in the Gemini conversation)
5. Download the **latest** image (the script always picks the last generated-image in the thread)
6. Run QC scan again
7. Repeat until user approves

This "Edit, Don't Re-roll" approach preserves what's working and only modifies what needs changing.


## Example Workflow

**User says:** "I have a photo at ~/Desktop/headshot.jpg — change the background to a Tokyo street at night, make my jacket leather, and add rain"

**Step 1: Read the image** to understand composition, subjects, and current state.

**Step 2: Construct the FULL JSON prompt** (this is what goes into /tmp/gemini-prompt.txt):

```
You are an expert image editor. I am uploading a reference image. Read the following JSON as structured editing instructions and generate an edited version of the uploaded image that applies ALL specified changes.

CRITICAL CONSTRAINTS — YOU MUST FOLLOW THESE:
1. DO NOT change the camera angle, perspective, or framing of the image. The viewpoint must remain IDENTICAL.
2. DO NOT add, remove, reposition, or resize ANY element that is not explicitly listed in the "edits" array.
3. DO NOT change the art style, painting content, or any wall decorations unless explicitly requested.
4. DO NOT alter the room layout, furniture positions, or spatial relationships between objects.
5. DO NOT replace or modify decorative items (vases, books, candles, etc.) unless explicitly requested.
6. DO NOT change the floor, ceiling, walls, or architectural elements unless explicitly requested.
7. ONLY modify what is explicitly listed in the "edits" array. Everything else must remain pixel-perfect identical.

The JSON below defines exactly what to modify. Each field is a parameter you must follow:

{
  "user_intent": "Transform studio headshot into cinematic Tokyo night portrait with leather jacket and rain",
  "edits": [
    "Replace the entire background with a bustling Tokyo backstreet at night, Shinjuku-style, with neon kanji signs, wet reflective pavement, distant pedestrians with umbrellas, and steam rising from vents",
    "Change the jacket to black leather with a slight wet sheen from the rain, slim fit",
    "Add rain falling throughout the scene with visible droplets and subtle motion blur on the rain streaks",
    "Adjust all lighting to match the neon-lit night environment — rim lighting from neon signs behind the subject, warm amber and cool blue color cast from signs",
    "Add wet reflections of neon lights on the pavement and subtle water droplets on the jacket surface"
  ],
  "preserve": [
    "CRITICAL: Maintain the EXACT same camera angle, perspective, field of view, and framing — do NOT change the viewpoint or composition in any way",
    "CRITICAL: Do NOT add, remove, reposition, or resize ANY element not explicitly listed in the edits array",
    "CRITICAL: Preserve ALL decorative items, artwork, wall hangings, and accessories exactly as they appear unless explicitly targeted for editing",
    "Exact facial features, skin texture, and expression",
    "Head position and body pose",
    "Hair style and color",
    "Overall framing and composition angle"
  ],
  "scene": {
    "location": "Tokyo backstreet with neon signs, Shinjuku-style",
    "time": "midnight",
    "weather": "rainy",
    "lighting_type": "neon_lights with rim_light",
    "lighting_direction": "back_lit and side_lit from neon signs",
    "mood": "cinematic, atmospheric, noir"
  },
  "technical": {
    "camera": "Sony A7R IV",
    "lens": "85mm",
    "aperture": "f/1.8",
    "film_stock": "CineStill 800T"
  },
  "subject": [
    {
      "id": "person",
      "clothing": [
        {"item": "jacket", "color": "black", "fabric": "leather", "fit": "slim"}
      ]
    }
  ],
  "style": {
    "medium": "photography",
    "aesthetic": "cinematic, noir, cyberpunk"
  },
  "negative_prompt": ["changed perspective", "different angle", "different composition", "added objects", "removed objects", "cartoon", "illustration", "watermark", "blur", "extra fingers", "distortion", "low quality", "oversaturated"]
}

Apply every edit listed above to the uploaded image. Do NOT change anything that is not explicitly listed in the edits array. Generate one photorealistic result.
```

**Step 3: Save and run:**
```bash
# Save prompt to temp file (use Bash cat heredoc)
# Then run:
node ~/.claude/skills/ads-gen/scripts/tools/gemini-upload.js \
  --image ~/Desktop/headshot.jpg \
  --prompt-file /tmp/gemini-prompt.txt
```

**Step 4:** Script uploads image, enters prompt, submits, waits ~30-60s for generation, auto-downloads the full-size result to the **same folder as the reference image**, named with a unique timestamp:
`~/Desktop/headshot_edited_{YYYY-MM-DDTHH-MM-SS}.png`

Each run produces a unique filename — no overwriting. The output folder always matches the input image's folder, not a hardcoded path.

**Step 5:** Read the downloaded image, show user, ask for adjustments.
