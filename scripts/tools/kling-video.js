#!/usr/bin/env node

/**
 * Kling AI Video Generation — Full API Coverage
 *
 * Supports ALL Kling API features:
 *   Image-to-video, Text-to-video, Omni unified endpoint (V3),
 *   Multi-shot (up to 6 shots), Video extension, Element management (CRUD),
 *   First+end frame control, Visual effects (73+), Motion control,
 *   Lip sync, Add sound, Video-to-video transform, Storyboard batch,
 *   Clip stitching, and Prompt-aware auto-tuning (--smart).
 *
 * Usage:
 *   # Image-to-video (standard)
 *   node kling-video.js --image frame.png --prompt "A car drifts on snow" --output ./clips/
 *
 *   # Text-to-video (no input image)
 *   node kling-video.js --text2video --prompt "A snowy mountain landscape" --output ./clips/
 *
 *   # Omni endpoint (advanced — elements, video ref, multi-shot)
 *   node kling-video.js --omni --prompt "The @element_1 walks through the door" --element u_123 --output ./clips/
 *
 *   # Multi-shot (up to 6 shots in one call)
 *   node kling-video.js --multi-shot --shots shots.json --output ./clips/
 *
 *   # First + end frame control
 *   node kling-video.js --start-frame start.png --end-frame end.png --prompt "Transition" --output ./clips/
 *
 *   # Video extension (continue an existing clip)
 *   node kling-video.js --extend --task-id 123456 --prompt "Continue walking" --output ./clips/
 *
 *   # Effects (list or apply)
 *   node kling-video.js --effects --list
 *   node kling-video.js --effects --apply rocket --image photo.png --output ./clips/
 *
 *   # Motion control (motion presets or reference video)
 *   node kling-video.js --motions --list
 *   node kling-video.js --motion --image photo.png --motion-url https://... --output ./clips/
 *
 *   # Add AI-generated sound to existing video
 *   node kling-video.js --add-sound --video clip.mp4 --output ./clips/
 *
 *   # Video-to-video transform (text-instructed editing)
 *   node kling-video.js --omni --prompt "Transform to winter scene" --ref-video source.mp4 --video-mode transform --output ./clips/
 *
 *   # Element management
 *   node kling-video.js --elements --create --name "hero" --image front.png --extra-images side.png,back.png
 *   node kling-video.js --elements --list
 *   node kling-video.js --elements --get u_123456
 *   node kling-video.js --elements --delete u_123456
 *
 *   # Lip sync
 *   node kling-video.js --lip-sync --video clip.mp4 --audio voice.mp3 --output ./clips/
 *
 *   # Storyboard batch + stitch
 *   node kling-video.js --storyboard config.json --output ./clips/
 *   node kling-video.js --stitch ./clips/ --output final.mp4
 *
 *   # Smart mode (auto-detects audio, camera, duration, tier from prompt)
 *   node kling-video.js --image frame.png --prompt "Car drifts on snow in thunderstorm" --smart --output ./clips/
 *
 * Environment:
 *   KLING_ACCESS_KEY + KLING_SECRET_KEY — JWT auth (platform.klingai.com)
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

// ── Configuration ──────────────────────────────────────────────────────────

const API_BASE = 'https://api.klingai.com/v1';
const DEFAULT_DURATION = 5;
const DEFAULT_ASPECT = '16:9';
const POLL_INTERVAL_MS = 10000;
const MAX_POLL_ATTEMPTS = 180;

// ── Endpoints ──────────────────────────────────────────────────────────────

const ENDPOINTS = {
  // Video generation
  IMAGE2VIDEO:         '/videos/image2video',
  TEXT2VIDEO:           '/videos/text2video',
  OMNI:                '/videos/omni-video',
  FRAMES:              '/videos/image2video-frames',
  ELEMENTS_VIDEO:      '/videos/image2video-elements',
  EFFECTS_VIDEO:       '/videos/image2video-effects',
  EXTEND:              '/videos/extend',
  LIPSYNC:             '/videos/lip-sync',
  ADD_SOUND:           '/videos/add-sound',
  MOTION_CREATE:       '/videos/motion-create',
  // Queries
  EFFECTS_LIST:        '/videos/effects',
  MOTIONS_LIST:        '/videos/motions',
  // Elements
  ELEMENTS:            '/elements',
};

// ── Voice Catalog (Kling TTS for lipsync text2video mode) ─────────────────
// Source: KwaiVGI/ComfyUI-KLingAI-API — py/nodes.py LipSyncTextInputNode
// Display names are Chinese but voices support voice_language: "en" for English
const VOICE_CATALOG = {
  // Male voices
  sunny_boy:       { id: 'genshin_vindi2',          gender: 'male',   age: 'young',   desc: 'Sunny boy — bright, youthful energy' },
  smart_brother:   { id: 'zhinen_xuesheng',          gender: 'male',   age: 'young',   desc: 'Smart younger brother — earnest, eager' },
  sporty_boy:      { id: 'tiyuxi_xuedi',             gender: 'male',   age: 'young',   desc: 'Sporty boy — athletic, confident' },
  sunny_male:      { id: 'ai_kaiya',                 gender: 'male',   age: 'adult',   desc: 'Sunny male — warm, approachable baritone' },
  humorous_guy:    { id: 'tiexin_nanyou',             gender: 'male',   age: 'adult',   desc: 'Humorous guy — charming, witty delivery' },
  artistic_guy:    { id: 'ai_chenjiahao_712',         gender: 'male',   age: 'adult',   desc: 'Artistic guy — thoughtful, measured, literary' },
  steady_dad:      { id: 'ai_huangyaoshi_712',        gender: 'male',   age: 'mature',  desc: 'Steady father — deep, authoritative, calm' },
  serious_boss:    { id: 'ai_laoguowang_712',         gender: 'male',   age: 'mature',  desc: 'Serious boss — cold, commanding, clipped' },
  talkative_grandpa: { id: 'uk_oldman3',              gender: 'male',   age: 'elderly', desc: 'Talkative grandpa — warm, rambling, British' },
  // Female voices
  young_girl:      { id: 'ai_shatang',                gender: 'female', age: 'young',   desc: 'Young girl — bright, energetic' },
  gentle_sister:   { id: 'genshin_klee2',             gender: 'female', age: 'young',   desc: 'Gentle younger sister — soft, sweet' },
  energetic_girl:  { id: 'genshin_kirara',            gender: 'female', age: 'young',   desc: 'Energetic girl — lively, animated' },
  sweet_neighbor:  { id: 'girlfriend_1_speech02',     gender: 'female', age: 'adult',   desc: 'Sweet neighbor — warm, friendly, approachable' },
  gentle_older_sis:{ id: 'chat1_female_new-3',        gender: 'female', age: 'adult',   desc: 'Gentle older sister — soothing, reassuring' },
  career_woman:    { id: 'girlfriend_2_speech02',     gender: 'female', age: 'adult',   desc: 'Career woman — confident, professional' },
  playful_child:   { id: 'cartoon-girl-01',           gender: 'female', age: 'child',   desc: 'Playful girl child — cute, animated' },
  gentle_mom:      { id: 'you_pingjing',              gender: 'female', age: 'mature',  desc: 'Gentle mother — warm, nurturing' },
  elegant_lady:    { id: 'chengshu_jiejie',           gender: 'female', age: 'mature',  desc: 'Elegant lady — refined, composed, dignified' },
  kind_grandma:    { id: 'heainainai_speech02',       gender: 'female', age: 'elderly', desc: 'Kind grandma — soft, caring' },
  boy_child:       { id: 'cartoon-boy-07',            gender: 'male',   age: 'child',   desc: 'Playful boy child — energetic, animated' },
};

// ── Model Tiers ────────────────────────────────────────────────────────────

const MODEL_TIERS = {
  draft: {
    model_name: 'kling-v1-6',
    mode: 'std',
    resolution: '720p',
    description: 'V1.6 Standard — fastest, cheapest (~$0.04/s). Testing only.',
  },
  standard: {
    model_name: 'kling-v3',
    mode: 'std',
    resolution: '1080p',
    description: 'V3 Standard — good quality, native audio, 30fps (~$0.08/s). Default.',
  },
  premium: {
    model_name: 'kling-v3',
    mode: 'pro',
    resolution: '1080p',
    description: 'V3 Pro — best quality, up to 4K/60fps, native audio (~$0.17-0.25/s). Final renders.',
  },
  omni: {
    model_name: 'kling-v3',
    mode: 'pro',
    resolution: '1080p',
    is_omni: true,
    description: 'V3 Omni Pro — reference-driven consistency, video editing (~$0.15-0.28/s). Character continuity.',
  },
};

// All available models for --model manual override
const AVAILABLE_MODELS = {
  'kling-v3-std':       { model_name: 'kling-v3', mode: 'std', res: '720p-1080p',  note: 'V3 Standard (latest)' },
  'kling-v3-pro':       { model_name: 'kling-v3', mode: 'pro', res: '1080p-4K',    note: 'V3 Pro (latest, best)' },
  'kling-o3-std':       { model_name: 'kling-v3', mode: 'std', res: '720p',        note: 'O3 Standard (ref-driven)', is_omni: true },
  'kling-o3-pro':       { model_name: 'kling-v3', mode: 'pro', res: '1080p-4K',    note: 'O3 Pro (ref-driven, best)', is_omni: true },
  'kling-v2-6-std':     { model_name: 'kling-v2-6', mode: 'std', res: '720p',      note: 'V2.6 Standard' },
  'kling-v2-6-pro':     { model_name: 'kling-v2-6', mode: 'pro', res: '1080p',     note: 'V2.6 Pro' },
  'kling-v1-6-std':     { model_name: 'kling-v1-6', mode: 'std', res: '720p',      note: 'V1.6 Standard (fastest)' },
  'kling-v1-6-pro':     { model_name: 'kling-v1-6', mode: 'pro', res: '1080p',     note: 'V1.6 Pro' },
  'kling-v2-1-std':     { model_name: 'kling-v2-1', mode: 'std', res: '720p',      note: 'V2.1 Standard (legacy)' },
  'kling-v2-1-pro':     { model_name: 'kling-v2-1', mode: 'pro', res: '1080p',     note: 'V2.1 Pro (legacy)' },
};

const DEFAULT_TIER = 'standard';

// ── Feature Compatibility Matrix ───────────────────────────────────────────
// Which features each model version supports

const FEATURE_MATRIX = {
  'kling-v3': {
    native_audio: true,
    multi_shot: true,
    elements: true,
    first_end_frame: true,
    video_reference: true,
    video_transform: true,
    effects: true,
    motion_control: true,
    extend: true,
    add_sound: true,
    negative_prompt: false, // Not supported on V3
    cfg_scale: true,
    camera_api: false,      // Uses prompt text only
    max_prompt_length: 2500,
    duration_range: [3, 15],
    aspects: ['16:9', '9:16', '1:1', '4:3', '3:4', '3:2', '2:3', '21:9'],
  },
  'kling-v2-6': {
    native_audio: true,     // Pro mode only
    multi_shot: false,
    elements: false,
    first_end_frame: true,
    video_reference: false,
    video_transform: false,
    effects: true,
    motion_control: true,
    extend: false,
    add_sound: true,
    negative_prompt: false,
    cfg_scale: false,
    camera_api: false,
    max_prompt_length: 2500,
    duration_range: [5, 10],
    aspects: ['16:9', '9:16', '1:1'],
  },
  'kling-v1-6': {
    native_audio: false,
    multi_shot: false,
    elements: false,
    first_end_frame: true,
    video_reference: false,
    video_transform: false,
    effects: false,
    motion_control: false,
    extend: false,
    add_sound: false,
    negative_prompt: true,
    cfg_scale: true,
    camera_api: true,       // V1 supports API camera_control
    max_prompt_length: 500,
    duration_range: [5, 10],
    aspects: ['16:9', '9:16', '1:1'],
  },
};

// ── Camera Motion ──────────────────────────────────────────────────────────

const CAMERA_PROMPT_INJECTIONS = {
  '[Pan left]':       'Slow smooth camera pan from right to left.',
  '[Pan right]':      'Slow smooth camera pan from left to right.',
  '[Pan up]':         'Slow smooth camera tilt upward.',
  '[Pan down]':       'Slow smooth camera tilt downward.',
  '[Zoom in]':        'Slow smooth zoom in toward the subject.',
  '[Zoom out]':       'Slow smooth zoom out away from the subject.',
  '[Dolly in]':       'Camera slowly moves forward toward the subject, dolly in.',
  '[Dolly out]':      'Camera slowly moves backward away from the subject, dolly out.',
  '[Crane up]':       'Camera rises upward in a slow crane movement.',
  '[Crane down]':     'Camera descends in a slow crane movement.',
  '[Tracking left]':  'Camera tracks laterally from right to left in a smooth tracking shot.',
  '[Tracking right]': 'Camera tracks laterally from left to right in a smooth tracking shot.',
  '[Static]':         'LOCKED TRIPOD. Absolutely static camera. No camera movement whatsoever. Only subjects and environment move.',
  '[Orbit left]':     'Camera orbits around the subject from right to left in a smooth arc.',
  '[Orbit right]':    'Camera orbits around the subject from left to right in a smooth arc.',
  '[Push through]':   'Camera pushes through the scene, moving forward through obstacles or openings.',
  '[Pull back reveal]': 'Camera pulls back to reveal the wider scene in a dramatic reveal.',
};

const V1_CAMERA_CONTROL = {
  '[Pan left]':       { type: 'simple', config: { horizontal: 0, vertical: 0, pan: -5, tilt: 0, roll: 0, zoom: 0 } },
  '[Pan right]':      { type: 'simple', config: { horizontal: 0, vertical: 0, pan: 5, tilt: 0, roll: 0, zoom: 0 } },
  '[Pan up]':         { type: 'simple', config: { horizontal: 0, vertical: 0, pan: 0, tilt: 5, roll: 0, zoom: 0 } },
  '[Pan down]':       { type: 'simple', config: { horizontal: 0, vertical: 0, pan: 0, tilt: -5, roll: 0, zoom: 0 } },
  '[Zoom in]':        { type: 'simple', config: { horizontal: 0, vertical: 0, pan: 0, tilt: 0, roll: 0, zoom: 5 } },
  '[Zoom out]':       { type: 'simple', config: { horizontal: 0, vertical: 0, pan: 0, tilt: 0, roll: 0, zoom: -5 } },
  '[Dolly in]':       { type: 'forward_up' },
  '[Dolly out]':      { type: 'down_back' },
  '[Crane up]':       { type: 'simple', config: { horizontal: 0, vertical: 4, pan: 0, tilt: 0, roll: 0, zoom: 0 } },
  '[Crane down]':     { type: 'simple', config: { horizontal: 0, vertical: -4, pan: 0, tilt: 0, roll: 0, zoom: 0 } },
  '[Tracking left]':  { type: 'simple', config: { horizontal: -5, vertical: 0, pan: 0, tilt: 0, roll: 0, zoom: 0 } },
  '[Tracking right]': { type: 'simple', config: { horizontal: 5, vertical: 0, pan: 0, tilt: 0, roll: 0, zoom: 0 } },
  '[Static]':         null,
};

// ── Prompt Composition Engine ───────────────────────────────────────────────
// Transforms raw prompts into Kling-optimized 5-layer structured prompts:
//   Scene → Characters → Action → Camera → Style
//
// Kling V3 responds to cinematic direction, not object lists.
// Emotions must be paired with physical micro-actions.
// Lighting needs direction and quality, not just "dramatic."
// Motion needs physics, not just verbs.

// Emotion → physical expression mapping (face + body + micro-action)
const EMOTION_MAP = {
  // Positive — face + body + micro-action + voice tone (for native audio)
  happy:        { face: 'warm genuine smile, eyes crinkling at the corners, soft laugh lines visible', body: 'relaxed open posture, shoulders back, chin slightly lifted', micro: 'a subtle head tilt with a gentle exhale', voice: 'warm bright voice' },
  joyful:       { face: 'wide radiant smile, bright sparkling eyes, raised cheeks', body: 'animated upright posture, hands gesturing openly', micro: 'a spontaneous laugh escaping, head thrown back slightly', voice: 'excited elated voice' },
  content:      { face: 'soft closed-lip smile, relaxed brow, calm steady gaze', body: 'settled comfortable posture, hands resting naturally', micro: 'slow steady breathing, eyes drifting peacefully', voice: 'calm serene voice' },
  hopeful:      { face: 'eyes widening with quiet anticipation, lips parting slightly', body: 'leaning forward subtly, chest opening', micro: 'a slow inhale as gaze lifts upward', voice: 'gentle optimistic voice' },
  relieved:     { face: 'tension melting from forehead, eyes closing briefly, exhaling smile', body: 'shoulders dropping from tension, spine releasing', micro: 'a long slow exhale, hand touching chest', voice: 'breathy relieved voice' },
  amused:       { face: 'one corner of mouth lifting, eyebrows raised, knowing look', body: 'slight lean back, head tilting to one side', micro: 'a barely suppressed smirk, quick glance away', voice: 'sleepy amused voice' },
  proud:        { face: 'chin lifted, confident steady gaze, composed subtle smile', body: 'tall upright posture, shoulders squared, hands at sides', micro: 'a slow deliberate nod, chest expanding', voice: 'controlled confident voice' },
  loving:       { face: 'softened eyes, tender gentle smile, gaze lingering', body: 'leaning toward the other person, shoulders relaxed', micro: 'fingertips reaching out, a slow blink of warmth', voice: 'soft tender voice' },
  grateful:     { face: 'glistening eyes, trembling smile, brow softening', body: 'hands clasping together at chest, slight forward bow', micro: 'pressing lips together to contain emotion, nodding slowly', voice: 'voice trembling slightly with gratitude' },

  // Negative
  sad:          { face: 'downcast eyes, lips pressed thin, chin trembling slightly', body: 'shoulders hunched inward, head bowed, arms close to body', micro: 'a slow heavy blink, swallowing hard', voice: 'quiet hollow voice' },
  crying:       { face: 'eyes squeezed shut, tears streaming, mouth open in silent sob', body: 'chest heaving, shoulders shaking, curling inward', micro: 'wiping eyes with back of hand, gasping between sobs', voice: 'voice cracking, broken by sobs' },
  angry:        { face: 'jaw clenched tight, nostrils flaring, eyes narrowing, brow furrowed deep', body: 'tense rigid posture, fists balling, leaning forward aggressively', micro: 'a sharp exhale through the nose, teeth grinding', voice: 'sharp aggressive voice' },
  frustrated:   { face: 'tight-lipped grimace, furrowed brow, eyes darting', body: 'hands running through hair, pacing or shifting weight', micro: 'pressing palms against forehead, jaw working side to side', voice: 'trembling frustrated voice' },
  fearful:      { face: 'wide eyes with visible whites, mouth slightly open, frozen expression', body: 'body pulling back, shoulders raised and tight, hands trembling', micro: 'a sharp intake of breath, quick darting glance over shoulder', voice: 'clear fearful voice, barely above whisper' },
  anxious:      { face: 'brow furrowed, biting lower lip, eyes scanning nervously', body: 'fidgeting hands, shifting weight, touching neck or face', micro: 'fingers tapping, swallowing repeatedly, adjusting clothing', voice: 'tight nervous voice' },
  shocked:      { face: 'eyes wide, jaw dropping open, eyebrows shooting up', body: 'body recoiling slightly, hands rising to mouth', micro: 'an audible gasp, stumbling back half a step', voice: 'breathless stunned voice' },
  disgusted:    { face: 'nose wrinkling, upper lip curling, brow creasing', body: 'head turning away, hand raising as if to block', micro: 'a sharp turn of the head, stepping back', voice: 'sharp dismissive voice' },
  guilty:       { face: 'eyes dropping to the floor, lips tightening, swallowing', body: 'shoulders slumping, hands clasped or hidden behind back', micro: 'unable to maintain eye contact, fidgeting with fingers', voice: 'small quiet ashamed voice' },
  lonely:       { face: 'distant empty gaze, subtle downturn of mouth, hollowed expression', body: 'arms wrapped around self, sitting small, withdrawn', micro: 'absently tracing a finger along a surface, slow exhale', voice: 'hollow distant voice' },

  // Complex / Transitional
  conflicted:   { face: 'jaw tightening then releasing, eyes searching, brow flickering', body: 'weight shifting between feet, hands opening and closing', micro: 'starting to speak then stopping, looking away then back', voice: 'halting uncertain voice' },
  determined:   { face: 'jaw set firm, eyes locking forward with intensity, brow lowering', body: 'squaring shoulders, planting feet, standing taller', micro: 'a single decisive nod, hands clenching with purpose', voice: 'controlled serious voice' },
  resigned:     { face: 'eyes lowering with acceptance, a tired half-smile, exhaling through nose', body: 'shoulders dropping, hands falling to sides, weight settling', micro: 'a long slow breath out, eyes closing briefly', voice: 'tired accepting voice' },
  suspicious:   { face: 'eyes narrowing, one eyebrow raised, lips pursed', body: 'head tilting, arms crossing, weight shifting back', micro: 'a sidelong glance, chin drawing back slightly', voice: 'quiet cold tone' },
  nostalgic:    { face: 'eyes softening with distant focus, bittersweet half-smile', body: 'settling back, hands relaxing, posture loosening', micro: 'fingers touching a meaningful object, slow exhale through parted lips', voice: 'warm nostalgic voice' },
  vulnerable:   { face: 'eyes glistening, lower lip trembling, expression open and unguarded', body: 'arms uncrossed, palms visible, chest exposed', micro: 'a shaky breath, meeting eyes with raw openness', voice: 'voice trembling slightly' },
  contemplative:{ face: 'eyes focused in middle distance, brow slightly furrowed in thought', body: 'chin resting on hand, stillness, weight on one side', micro: 'slow deliberate blink, finger tracing jawline absently', voice: 'measured thoughtful voice' },
  tense:        { face: 'tight jaw, controlled neutral expression masking strain, eyes alert', body: 'rigid upright posture, muscles visibly taut, controlled breathing', micro: 'a barely perceptible flinch, fingers pressing into palm', voice: 'clipped tense voice' },
  defiant:      { face: 'chin raised, eyes blazing, slight sneer, unwavering gaze', body: 'chest out, feet planted wide, arms crossed or fists at sides', micro: 'a slow challenging head turn, refusing to break eye contact', voice: 'sharp defensive voice' },
  overwhelmed:  { face: 'rapid blinking, unfocused eyes, mouth working without sound', body: 'hands pressing temples, backing against wall, sinking down', micro: 'shaking head slowly, pressing palms flat against surface for grounding', voice: 'breathless panicked voice' },
};

// Atmosphere → lighting + texture + environmental detail
const ATMOSPHERE_MAP = {
  // Temperature
  warm:         'golden amber warmth, soft key light from window, warm practicals glowing, honey-toned highlights on skin',
  cold:         'cool blue-steel lighting, breath faintly visible, desaturated tones, pale skin under fluorescent wash',
  hot:          'harsh overhead sun, heat shimmer on surfaces, sweat beading on skin, deep saturated shadows',

  // Time of day
  dawn:         'pre-dawn blue light shifting to pink-gold, long horizontal shadows, dew on surfaces, soft diffused glow',
  golden_hour:  'rich golden hour backlight streaming through dust motes, long warm shadows, amber lens flare, skin glowing',
  twilight:     'deep blue-purple twilight sky, last amber on horizon, sodium-vapor streetlights flickering on, cool ambient fill',
  night:        'deep darkness, isolated pools of artificial light, neon reflections on wet surfaces, stark contrast',
  overcast:     'flat diffused overcast light, no hard shadows, muted palette, even illumination, grey sky through windows',
  midnight:     'near-total darkness, moonlight casting silver-blue edges, deep blacks, single practical light source',

  // Weather
  rainy:        'rain streaking down glass, wet reflective surfaces, headlights diffusing through moisture, grey muted palette',
  stormy:       'dramatic storm light, dark churning clouds, intermittent lightning flashes, violent wind, sheets of rain',
  snowy:        'soft white diffused light reflecting off snow, crystalline air, cold blue shadows, warm breath visible',
  foggy:        'thick atmospheric fog, light sources creating halos, reduced visibility, surfaces emerging from mist',
  windy:        'hair and fabric caught in strong wind, dust or particles in air, dynamic natural movement',
  sunny:        'bright direct sunlight, sharp defined shadows, high contrast, warm skin highlights, blue sky fill',

  // Mood
  intimate:     'soft close warm lighting, shallow depth of field, warm skin tones, candle-flicker quality, hushed',
  tense:        'high contrast single-source side light, deep shadows on half the face, cold undertones, claustrophobic framing',
  dreamlike:    'soft ethereal glow, halation around light sources, pastel desaturated tones, slow-motion quality of light',
  gritty:       'raw unfiltered light, film grain visible, unflattering angles, real skin texture with pores, imperfect exposure',
  epic:         'grand dramatic lighting, god-rays breaking through clouds, massive scale, deep rich contrast, sweeping vista',
  melancholic:  'grey muted palette, flat diffused light, single warm practical as emotional anchor, empty negative space',
  mysterious:   'deep shadow with selective reveals, rim light defining silhouettes, smoke or haze diffusing light beams',
  claustrophobic: 'tight framing, walls visible on all sides, low ceiling, practical lights creating pools, no escape',
  serene:       'gentle even light, soft natural tones, still air, subtle warmth, wide quiet composition with breathing room',
  ominous:      'underexposed with sickly green-yellow undertones, unnatural shadow angles, subtle wrongness in the light',
};

// Shot size → framing + DOF + composition language
const SHOT_SIZE_MAP = {
  extreme_close_up: 'extreme close-up filling the frame with a single detail, razor-thin depth of field, texture and pores visible, everything else dissolved in bokeh',
  close_up:         'tight close-up framing on face from forehead to chin, shallow depth of field with creamy background bokeh, eyes sharp and luminous, skin texture visible',
  medium_close_up:  'medium close-up from chest to head, subject fills most of the frame, background softly defocused, shoulders and face dominant',
  medium_shot:      'medium shot from waist up, balanced framing showing body language and environment, moderate depth of field',
  medium_wide:      'medium wide shot showing full body with environmental context, deep focus, character grounded in space',
  wide_shot:        'wide establishing shot, full environmental context, deep focus throughout, character positioned using rule of thirds, architecture and landscape visible',
  extreme_wide:     'extreme wide shot, vast landscape or environment dwarfing the human figure, epic scale, deep focus to infinity',
  over_shoulder:    'over-the-shoulder framing, foreground figure soft and dark, background character sharp, conversational depth',
  low_angle:        'low angle looking up at subject, conveying power or dominance, ceiling or sky visible, foreshortened perspective',
  high_angle:       'high angle looking down on subject, conveying vulnerability or smallness, ground visible, subject diminished',
  birds_eye:        'bird\'s eye view directly overhead, abstract composition, pattern and geometry emphasized, subject seen from above',
  dutch_angle:      'tilted dutch angle, conveying unease or disorientation, horizon line diagonal, psychological tension in the frame',
  pov:              'point-of-view shot through the character\'s eyes, hands visible in foreground, subjective perspective',
  profile:          'clean profile shot from the side, strong silhouette potential, jaw and nose line prominent, negative space ahead',
  two_shot:         'two-shot framing both characters, balanced composition, relationship dynamic visible in body positioning',
};

// Temporal pacing → motion quality language for Kling
const PACING_MAP = {
  // Speed modifiers
  slow:       'in slow graceful motion, each movement deliberate and weighted',
  very_slow:  'in extremely slow almost dreamlike motion, time stretching, every micro-movement visible',
  fast:       'in quick sharp motion, snapping into position, urgent kinetic energy',
  sudden:     'with an abrupt explosive burst of motion, startling instant change',
  gradual:    'with imperceptibly gradual progression, change happening so slowly it is only noticed in retrospect',
  steady:     'with measured consistent rhythm, metronomic steady pacing, controlled and unwavering',
  accelerating: 'motion starting slow and smoothly accelerating, building momentum and urgency',
  decelerating: 'motion gradually slowing to a weighted halt, energy draining, settling into stillness',

  // Quality modifiers
  fluid:      'with smooth continuous flowing motion, no jarring stops, silk-like movement quality',
  mechanical: 'with precise robotic deliberate motion, each movement separate and defined',
  organic:    'with natural imperfect human motion, slight wobble and self-correction, lived-in movement',
  weighted:   'with heavy gravity-aware motion, each movement showing the effort and mass involved',
  ethereal:   'with weightless floating motion, defying gravity, dreamlike suspension',
  explosive:  'with violent sudden bursting energy, coiled tension releasing all at once',
  restrained: 'with tightly controlled minimal motion, holding back, tension in the stillness',
};

// Genre preset → cinematic styling injection (maps to SKILL.md genre presets)
const GENRE_STYLE_MAP = {
  'sci-fi':       { texture: 'film grain, anamorphic lens flare, cool teal shadows', skin: 'desaturated skin tones', movement: 'slow deliberate camera movements, monolithic scale', negative: 'warm tones, soft lighting, cartoon' },
  'rom-com':      { texture: 'soft diffused glow, warm bokeh circles, golden tones', skin: 'warm peachy natural skin, soft beauty', movement: 'gentle intimate camera, minimal movement', negative: 'cold tones, harsh shadows, desaturated' },
  'thriller':     { texture: 'high contrast, crushed blacks, hard shadows', skin: 'underlit faces half in shadow, cold skin tones', movement: 'creeping stalking camera, slow menacing push', negative: 'bright, cheerful, soft lighting, warm' },
  'documentary':  { texture: 'available light, minimal grading, handheld micro-movement', skin: 'real skin texture with pores, unretouched', movement: 'observational camera, following not leading', negative: 'glamorous, polished, posed, beauty lighting' },
  'drama':        { texture: 'rich latitude, motivated practicals, dust motes in light', skin: 'warm sculpted skin, subtle shadows defining bone structure', movement: 'emotionally motivated camera, moves with feeling', negative: 'flat lighting, corporate, generic' },
  'nordic':       { texture: 'desaturated cool palette, overcast diffusion, clean geometry', skin: 'pale porcelain skin under flat grey light', movement: 'static observational holds, unhurried', negative: 'saturated, warm, busy, cluttered' },
  'horror':       { texture: 'underexposed, sickly green undertones, film grain', skin: 'sallow pallid skin, dark circles, unhealthy', movement: 'unsettling slow drift, wrongness in motion', negative: 'bright, cheerful, warm, saturated' },
  'fantasy':      { texture: 'golden painterly light, rich deep contrast, volumetric rays', skin: 'luminous warm skin, golden highlights', movement: 'grand sweeping camera, epic scale reveals', negative: 'modern, flat, desaturated, mundane' },
  'indie':        { texture: 'film grain, neon bleed, imperfect exposure', skin: 'raw natural skin, sweat and imperfection visible', movement: 'handheld intimacy, breathing camera', negative: 'polished, corporate, clean, perfect' },
  'commercial':   { texture: 'clean bright lighting, polished surfaces, controlled', skin: 'healthy glowing skin, beauty lighting', movement: 'smooth precise camera, controlled reveals', negative: 'gritty, dark, imperfect, raw' },
};

// ── JSON Scene Descriptor ─────────────────────────────────────────────────
// Structured scene definition that compiles to a Kling-optimized prompt.
// Each field controls one visual dimension — change one field, change one thing.
//
// Schema:
// {
//   "scene": {
//     "setting": "Dimly lit garage at night",           // WHERE — environment description
//     "action": "A man fits a fairing onto a scooter",  // WHAT — the physical action happening
//     "context": "He's building his dream racing machine after work", // WHY — story context (optional)
//     "camera": {
//       "shot": "medium_wide",                          // Shot size key from SHOT_SIZE_MAP
//       "movement": "dolly_in",                         // Camera movement (maps to [Dolly in] etc.)
//       "speed": "slow",                                // Movement speed qualifier
//       "angle": "eye_level"                            // low_angle, high_angle, dutch, birds_eye, etc.
//     },
//     "lighting": "warm_intimate",                      // Atmosphere key from ATMOSPHERE_MAP
//     "emotion": "meditative_focus",                    // Emotion key from EMOTION_MAP (single character)
//     "character_emotions": [                           // Multi-character emotions (overrides emotion)
//       { "name": "the mother", "emotion": "fearful" },
//       { "name": "the boy", "emotion": "determined" }
//     ],
//     "pacing": "slow"                                  // Pacing key from PACING_MAP
//   },
//   "character": "Full character spec text...",          // WHO — character description
//   "wardrobe": "Black tank top, dark work pants",      // WEARING — visible clothing
//   "location": "Alex's garage — bare bulb, workbench", // WHERE (detail) — location spec
//   "genre": "drama",                                   // Genre preset key
//   "sound_fx": [                                       // Audible elements in the scene (Omni native audio)
//     { "sound": "electric motor whine", "timing": "continuous" },
//     { "sound": "metal tool clank", "timing": "at action" }
//   ],
//   "dialogue": [                                       // Character speech (Omni voice_ids)
//     { "character": "ALEX", "text": "Almost there.", "emotion": "focused" }
//   ]
// }
//
// The `scene` object REPLACES the free-form `prompt` field.
// If both `scene` and `prompt` exist, `scene` takes priority.
// The old `prompt` + flat fields (emotion, shot_size, etc.) still work for backward compat.

const CAMERA_MOVEMENT_MAP = {
  'static':         '[Static]',
  'dolly_in':       '[Dolly in]',
  'dolly_out':      '[Dolly out]',
  'pan_left':       '[Pan left]',
  'pan_right':      '[Pan right]',
  'pan_up':         '[Pan up]',
  'pan_down':       '[Pan down]',
  'zoom_in':        '[Zoom in]',
  'zoom_out':       '[Zoom out]',
  'crane_up':       '[Crane up]',
  'crane_down':     '[Crane down]',
  'tracking_left':  '[Tracking left]',
  'tracking_right': '[Tracking right]',
  'orbit_left':     '[Orbit left]',
  'orbit_right':    '[Orbit right]',
  'push_through':   '[Push through]',
  'pull_back':      '[Pull back reveal]',
};

const CAMERA_ANGLE_MAP = {
  'eye_level':  '',  // default, no qualifier needed
  'low_angle':  'low angle looking up, conveying power',
  'high_angle': 'high angle looking down, conveying vulnerability',
  'dutch':      'tilted dutch angle, conveying unease',
  'birds_eye':  'bird\'s eye view directly overhead',
  'worms_eye':  'extreme low angle from ground looking up',
};

/**
 * Compile a structured scene JSON into a Kling-optimized prompt.
 * This is the primary compilation path — scene JSON → 5-layer prompt.
 *
 * @param {object} scene - The scene descriptor object
 * @param {object} frame - The full frame object (for character, wardrobe, location, genre, dialogue)
 * @returns {{ prompt: string, cameraCmd: string, enrichments: string[] }}
 */
function composeFromScene(scene, frame = {}) {
  const layers = { scene: '', character: '', action: '', camera: '', style: '' };
  const enrichments = [];

  // ── Layer 1: Scene / Environment ─────────────────────────────────
  if (frame.location) {
    layers.scene += frame.location + '. ';
  }
  if (scene.lighting && ATMOSPHERE_MAP[scene.lighting]) {
    layers.scene += ATMOSPHERE_MAP[scene.lighting] + '. ';
    enrichments.push(`lighting: ${scene.lighting}`);
  }
  if (scene.setting) {
    layers.scene += scene.setting + '. ';
  }

  // ── Layer 2: Character + Emotion ─────────────────────────────────
  if (frame.character) {
    layers.character += frame.character + '. ';
  }

  // Multi-character emotions
  if (scene.character_emotions && Array.isArray(scene.character_emotions)) {
    for (const ce of scene.character_emotions) {
      if (ce.emotion && EMOTION_MAP[ce.emotion]) {
        const em = EMOTION_MAP[ce.emotion];
        layers.character += `${ce.name}: Expression: ${em.face}. ${em.body}. ${em.micro}. `;
        if (em.voice) layers.style += `${ce.name}: ${em.voice}. `;
        enrichments.push(`emotion(${ce.name}): ${ce.emotion}`);
      }
    }
  } else if (scene.emotion && EMOTION_MAP[scene.emotion]) {
    const em = EMOTION_MAP[scene.emotion];
    layers.character += `Expression: ${em.face}. ${em.body}. ${em.micro}. `;
    if (em.voice) layers.style += `${em.voice}. `;
    enrichments.push(`emotion: ${scene.emotion}`);
  }

  if (frame.wardrobe) {
    layers.character += `Wardrobe: ${frame.wardrobe}. `;
  }

  // ── Layer 3: Action ──────────────────────────────────────────────
  if (scene.context) {
    layers.action += `STORY CONTEXT: ${scene.context}. `;
  }
  layers.action += scene.action || '';
  if (scene.pacing && PACING_MAP[scene.pacing]) {
    layers.action += ' ' + PACING_MAP[scene.pacing] + '.';
    enrichments.push(`pacing: ${scene.pacing}`);
  }
  // Anchor hands to objects
  if (scene.action && /hand|finger|grip|hold|touch|grab|reach/i.test(scene.action)) {
    if (!/grip.*\w+|hold.*\w+|touch.*\w+|grab.*\w+/i.test(scene.action)) {
      layers.action += ' Hands make firm physical contact with a tangible surface or object.';
    }
  }

  // ── Layer 4: Camera / Composition ────────────────────────────────
  const cam = scene.camera || {};
  if (cam.shot && SHOT_SIZE_MAP[cam.shot]) {
    layers.camera += SHOT_SIZE_MAP[cam.shot] + '. ';
    enrichments.push(`shot: ${cam.shot}`);
  }
  if (cam.angle && CAMERA_ANGLE_MAP[cam.angle]) {
    layers.camera += CAMERA_ANGLE_MAP[cam.angle] + '. ';
  }

  // Camera command — extracted for V3 prompt injection and V1 API param
  let cameraCmd = '[Static]';
  if (cam.movement && CAMERA_MOVEMENT_MAP[cam.movement]) {
    cameraCmd = CAMERA_MOVEMENT_MAP[cam.movement];
  }
  if (cam.speed) {
    const speedQualifier = cam.speed === 'fast' ? 'fast, urgent' :
                           cam.speed === 'slow' ? 'slow, deliberate' :
                           cam.speed === 'very_slow' ? 'very slow, almost imperceptible' :
                           cam.speed;
    layers.camera += `Camera moves ${speedQualifier}. `;
  }

  // ── Layer 5: Style / Genre ───────────────────────────────────────
  const genre = frame.genre;
  if (genre && GENRE_STYLE_MAP[genre]) {
    const g = GENRE_STYLE_MAP[genre];
    layers.style += `${g.texture}, ${g.skin}, ${g.movement}. `;
    enrichments.push(`genre: ${genre}`);
  }

  // ── Sound FX hints (for Omni native audio) ───────────────────────
  if (frame.sound_fx && frame.sound_fx.length > 0) {
    const sfxDesc = frame.sound_fx.map(s =>
      `Audible: ${s.sound}${s.timing ? ` (${s.timing})` : ''}`
    ).join('. ');
    layers.style += sfxDesc + '. ';
    enrichments.push(`sound_fx: ${frame.sound_fx.length} cues`);
  }

  // ── Dialogue markers (for Omni voice_ids) ────────────────────────
  if (frame.dialogue && frame.dialogue.length > 0 && frame.voice_ids && frame.voice_ids.length > 0) {
    const speakerToSlot = {};
    let slotIdx = 1;
    const dialogueLines = frame.dialogue.map(line => {
      if (!speakerToSlot[line.character]) {
        speakerToSlot[line.character] = slotIdx++;
      }
      const slot = speakerToSlot[line.character];
      const emotionVoice = EMOTION_MAP[line.emotion]?.voice || '';
      return `<<<voice_${slot}>>> says "${line.text}" ${emotionVoice ? `[${emotionVoice}]` : ''}`;
    }).join('\n');
    layers.action += '\n\n' + dialogueLines;
    enrichments.push(`dialogue: ${frame.dialogue.length} lines`);
  }

  // ── Assemble: Scene → Character → Action → Camera → Style ───────
  let composed = '';
  if (layers.scene) composed += layers.scene;
  if (layers.character) composed += layers.character;
  composed += layers.action;
  if (layers.camera) composed += ' ' + layers.camera;
  if (layers.style) composed += layers.style;

  composed = composed.replace(/\.\s*\./g, '.').replace(/\s{2,}/g, ' ').trim();

  if (enrichments.length > 0) {
    console.log(`[SCENE] Compiled: ${enrichments.join(', ')}`);
  }

  return { prompt: composed, cameraCmd, enrichments };
}

/**
 * Compose a Kling-optimized prompt from structured input (LEGACY).
 * Backward-compatible with the old flat-field approach.
 * New code should use composeFromScene() with the scene JSON descriptor.
 *
 * @param {string} rawPrompt - The user's raw scene description
 * @param {object} opts - Composition options
 * @param {string} opts.emotion - Emotion key (e.g., 'sad', 'determined')
 * @param {string} opts.shotSize - Shot size key (e.g., 'close_up', 'wide_shot')
 * @param {string} opts.atmosphere - Atmosphere key (e.g., 'rainy', 'golden_hour')
 * @param {string} opts.pacing - Pacing key (e.g., 'slow', 'sudden')
 * @param {string} opts.genre - Genre key (e.g., 'thriller', 'drama')
 * @param {string} opts.character - Character description to inject
 * @param {string} opts.location - Location description to inject
 * @param {boolean} opts.smart - Auto-detect enrichments from raw prompt
 * @returns {string} Kling-optimized prompt
 */
function composePrompt(rawPrompt, opts = {}) {
  if (!rawPrompt) return '';
  const lower = rawPrompt.toLowerCase();
  const layers = { scene: '', character: '', action: '', camera: '', style: '' };
  let enrichments = [];

  // ── Auto-detection (smart mode) ──────────────────────────────────
  let emotion = opts.emotion || null;
  let shotSize = opts.shotSize || null;
  let atmosphere = opts.atmosphere || null;
  let pacing = opts.pacing || null;

  if (opts.smart) {
    // Detect emotion from prompt text
    if (!emotion) {
      for (const [key] of Object.entries(EMOTION_MAP)) {
        const patterns = {
          happy: /happy|smil|laugh|joy|delight/,
          joyful: /joyful|ecstat|elat|jubilant/,
          content: /content|peaceful|serene|satisfied/,
          hopeful: /hopeful|optimistic|anticipat/,
          relieved: /reliev|exhale.*tension|weight.*lift/,
          amused: /amused|smirk|chuckl|wry/,
          proud: /proud|triumph|accomplish/,
          loving: /loving|tender|adoring|affection/,
          grateful: /grateful|thankful|appreciat/,
          sad: /sad|sorrow|melanchol|grief|mourn/,
          crying: /cry|weep|tear|sob/,
          angry: /angry|rage|furious|livid/,
          frustrated: /frustrat|exasperat|irritat/,
          fearful: /fear|terrif|scared|fright|horror/,
          anxious: /anxious|nervous|worry|dread|uneasy/,
          shocked: /shock|stun|disbelief|aghast/,
          disgusted: /disgust|repuls|revolt|sicken/,
          guilty: /guilt|shame|remorse|regret/,
          lonely: /lonely|isolat|alone|abandon/,
          conflicted: /conflict|torn|dilemma|uncertain/,
          determined: /determin|resolut|resolv|unwaver/,
          resigned: /resign|accept|surrender|give.*up/,
          suspicious: /suspicious|distrust|wary|doubt/,
          nostalgic: /nostalg|remember|memoir|past/,
          vulnerable: /vulnerab|exposed|raw|unguard/,
          contemplative: /contempl|ponder|think|reflect|meditat/,
          tense: /tense|rigid|stiff|on.*edge/,
          defiant: /defiant|rebel|resist|refuse/,
          overwhelmed: /overwhelm|overload|too.*much|breaking/,
        };
        if (patterns[key] && patterns[key].test(lower)) {
          emotion = key;
          break;
        }
      }
    }

    // Detect shot size from prompt text
    if (!shotSize) {
      if (/extreme close.?up|ecu|macro/i.test(lower)) shotSize = 'extreme_close_up';
      else if (/close.?up|cu|tight.*on.*face/i.test(lower)) shotSize = 'close_up';
      else if (/medium close/i.test(lower)) shotSize = 'medium_close_up';
      else if (/medium wide|full body/i.test(lower)) shotSize = 'medium_wide';
      else if (/medium shot|waist.*up|mid.?shot/i.test(lower)) shotSize = 'medium_shot';
      else if (/extreme wide|aerial|vast|landscape/i.test(lower)) shotSize = 'extreme_wide';
      else if (/wide shot|establish|full.*environment/i.test(lower)) shotSize = 'wide_shot';
      else if (/over.?the.?shoulder|ots/i.test(lower)) shotSize = 'over_shoulder';
      else if (/low angle|look.*up.*at|from below/i.test(lower)) shotSize = 'low_angle';
      else if (/high angle|look.*down|from above|bird/i.test(lower)) shotSize = 'high_angle';
      else if (/dutch|tilted|canted/i.test(lower)) shotSize = 'dutch_angle';
      else if (/pov|point of view|first.?person|through.*eyes/i.test(lower)) shotSize = 'pov';
      else if (/profile|side.*view|silhouett/i.test(lower)) shotSize = 'profile';
      else if (/two.?shot|both.*character/i.test(lower)) shotSize = 'two_shot';
    }

    // Detect atmosphere from prompt text
    if (!atmosphere) {
      if (/golden hour|sunset|magic hour/i.test(lower)) atmosphere = 'golden_hour';
      else if (/dawn|sunrise|first light/i.test(lower)) atmosphere = 'dawn';
      else if (/twilight|dusk|blue hour/i.test(lower)) atmosphere = 'twilight';
      else if (/midnight|dead of night|pitch dark/i.test(lower)) atmosphere = 'midnight';
      else if (/overcast|cloudy|grey sky/i.test(lower)) atmosphere = 'overcast';
      else if (/night|dark|after dark|streetlight/i.test(lower)) atmosphere = 'night';
      else if (/rain|drizzle|downpour|wet/i.test(lower)) atmosphere = 'rainy';
      else if (/storm|thunder|lightning/i.test(lower)) atmosphere = 'stormy';
      else if (/snow|winter|blizzard|frost/i.test(lower)) atmosphere = 'snowy';
      else if (/fog|mist|haze|murk/i.test(lower)) atmosphere = 'foggy';
      else if (/wind|gust|breez/i.test(lower)) atmosphere = 'windy';
      else if (/intimate|close.*warm|candle/i.test(lower)) atmosphere = 'intimate';
      else if (/tense|suspense|claustro/i.test(lower)) atmosphere = 'tense';
      else if (/dream|ethereal|surreal/i.test(lower)) atmosphere = 'dreamlike';
      else if (/gritty|raw|unfilt/i.test(lower)) atmosphere = 'gritty';
      else if (/epic|grand|sweeping|vast/i.test(lower)) atmosphere = 'epic';
      else if (/melanchol|grey|muted|somber/i.test(lower)) atmosphere = 'melancholic';
      else if (/mysterious|shadow|enigma/i.test(lower)) atmosphere = 'mysterious';
      else if (/serene|calm|peace|tranquil/i.test(lower)) atmosphere = 'serene';
      else if (/ominous|foreboding|dread/i.test(lower)) atmosphere = 'ominous';
    }

    // Detect pacing from prompt text
    if (!pacing) {
      if (/very slow|extremely slow|glacial/i.test(lower)) pacing = 'very_slow';
      else if (/slow|gentle|deliberate|careful/i.test(lower)) pacing = 'slow';
      else if (/sudden|abrupt|explosive|instant/i.test(lower)) pacing = 'sudden';
      else if (/fast|quick|rapid|urgent|rush/i.test(lower)) pacing = 'fast';
      else if (/gradual|imperceptib|inch/i.test(lower)) pacing = 'gradual';
      else if (/accelerat|speed.*up|faster.*faster/i.test(lower)) pacing = 'accelerating';
      else if (/decelerat|slow.*down|come.*stop/i.test(lower)) pacing = 'decelerating';
      else if (/fluid|smooth|flowing|silk/i.test(lower)) pacing = 'fluid';
      else if (/heavy|weight|gravity|mass/i.test(lower)) pacing = 'weighted';
      else if (/restrained|held.*back|controlled/i.test(lower)) pacing = 'restrained';
    }
  }

  // ── Layer 1: Scene / Environment ─────────────────────────────────
  if (opts.location) {
    layers.scene = opts.location + '. ';
  }
  if (atmosphere && ATMOSPHERE_MAP[atmosphere]) {
    layers.scene += ATMOSPHERE_MAP[atmosphere] + '. ';
    enrichments.push(`atmosphere: ${atmosphere}`);
  }

  // ── Layer 2: Character ───────────────────────────────────────────
  if (opts.character) {
    layers.character = opts.character + '. ';
  }
  // Per-character emotions for multi-character scenes
  // opts.characterEmotions = [{ name: "parent", emotion: "angry" }, { name: "child", emotion: "fearful" }]
  if (opts.characterEmotions && Array.isArray(opts.characterEmotions)) {
    for (const ce of opts.characterEmotions) {
      if (ce.emotion && EMOTION_MAP[ce.emotion]) {
        const em = EMOTION_MAP[ce.emotion];
        layers.character += `${ce.name}: Expression: ${em.face}. ${em.body}. ${em.micro}. `;
        if (em.voice) layers.style += `${ce.name}: ${em.voice}. `;
        enrichments.push(`emotion(${ce.name}): ${ce.emotion}`);
      }
    }
  } else if (emotion && EMOTION_MAP[emotion]) {
    // Single-character / scene-wide emotion (original behavior)
    const em = EMOTION_MAP[emotion];
    layers.character += `Expression: ${em.face}. ${em.body}. ${em.micro}. `;
    // Voice tone for native audio (Kling V3 responds to vocal descriptors in prompt)
    if (em.voice) {
      layers.style += `${em.voice}. `;
    }
    enrichments.push(`emotion: ${emotion}`);
  }
  // Wardrobe injection — ensures visible clothing is specified even in partial-body shots
  if (opts.wardrobe) {
    layers.character += `Wardrobe: ${opts.wardrobe}. `;
    enrichments.push('wardrobe: specified');
  }

  // ── Layer 3: Action (the raw prompt is primarily action) ─────────
  layers.action = rawPrompt;
  if (pacing && PACING_MAP[pacing]) {
    layers.action += ' ' + PACING_MAP[pacing] + '.';
    enrichments.push(`pacing: ${pacing}`);
  }
  // Anchor hands to objects (Kling best practice)
  if (/hand|finger|grip|hold|touch|grab|reach|pick up/i.test(lower)) {
    if (!/grip.*\w+|hold.*\w+|touch.*\w+|grab.*\w+/i.test(lower)) {
      layers.action += ' Hands make firm physical contact with a tangible surface or object.';
    }
  }

  // ── Layer 4: Camera / Composition ────────────────────────────────
  if (shotSize && SHOT_SIZE_MAP[shotSize]) {
    layers.camera = SHOT_SIZE_MAP[shotSize] + '. ';
    enrichments.push(`shot: ${shotSize}`);
  }

  // ── Layer 5: Style / Genre ───────────────────────────────────────
  const genre = opts.genre;
  if (genre && GENRE_STYLE_MAP[genre]) {
    const g = GENRE_STYLE_MAP[genre];
    layers.style = `${g.texture}, ${g.skin}, ${g.movement}. `;
    enrichments.push(`genre: ${genre}`);
  }

  // ── Assemble: Scene → Character → Action → Camera → Style ───────
  let composed = '';
  if (layers.scene) composed += layers.scene;
  if (layers.character) composed += layers.character;
  composed += layers.action;
  if (layers.camera) composed += ' ' + layers.camera;
  if (layers.style) composed += layers.style;

  // Clean up multiple spaces and periods
  composed = composed.replace(/\.\s*\./g, '.').replace(/\s{2,}/g, ' ').trim();

  if (enrichments.length > 0) {
    console.log(`[COMPOSE] Enriched prompt with: ${enrichments.join(', ')}`);
  }

  return composed;
}

// ── Prompt Intelligence (--smart mode) ─────────────────────────────────────

function analyzePrompt(prompt) {
  if (!prompt) return { suggestAudio: false, suggestCamera: [], suggestDuration: null, suggestTier: null, audioReasons: [], cameraReasons: [] };
  const lower = prompt.toLowerCase();
  const analysis = {
    suggestAudio: false,
    suggestCamera: [],
    suggestDuration: null,
    suggestTier: null,
    audioReasons: [],
    cameraReasons: [],
  };

  // Audio detection — scene elements that produce sound
  const audioPatterns = [
    { re: /thunder|lightning|storm/,              reason: 'thunder/storm' },
    { re: /rain|raining|downpour|drizzle/,        reason: 'rain' },
    { re: /snow|snowing|blizzard|winter wind/,    reason: 'wind/snow ambience' },
    { re: /car|vehicle|driv|drift|engine|motor/,  reason: 'vehicle sounds' },
    { re: /explos|crash|impact|collide|shatter/,  reason: 'impact/explosion' },
    { re: /music|singing|concert|instrument/,     reason: 'musical elements' },
    { re: /crowd|people|busy|market|festival/,    reason: 'crowd ambience' },
    { re: /water|ocean|wave|river|waterfall|splash/, reason: 'water sounds' },
    { re: /bird|animal|dog|cat|horse|roar/,       reason: 'animal sounds' },
    { re: /city|urban|traffic|street|siren/,      reason: 'urban ambience' },
    { re: /forest|wind|tree|leaves|rustl/,        reason: 'nature ambience' },
    { re: /fire|burn|flame|crackling/,            reason: 'fire sounds' },
    { re: /speak|talk|conversation|dialogue/,     reason: 'speech' },
    { re: /footstep|walk|run|sprint/,             reason: 'footsteps' },
    { re: /door|knock|creak|slam/,                reason: 'door sounds' },
    { re: /gun|shot|bullet|weapon/,               reason: 'weapon sounds' },
    { re: /helicopter|plane|jet|fly/,             reason: 'aircraft sounds' },
    { re: /clock|tick|bell|chime/,                reason: 'mechanical sounds' },
  ];

  for (const { re, reason } of audioPatterns) {
    if (re.test(lower)) {
      analysis.suggestAudio = true;
      analysis.audioReasons.push(reason);
    }
  }

  // Camera motion detection — natural language to camera commands
  const cameraPatterns = [
    { re: /push (through|into|forward)|move forward|advance toward|enter/,      cmd: '[Push through]',    reason: 'forward push' },
    { re: /pull (back|away|out)|retreat|reveal|move back/,                       cmd: '[Pull back reveal]', reason: 'pull back reveal' },
    { re: /zoom (in|into|closer)|magnif|close(r| up)/,                          cmd: '[Zoom in]',         reason: 'zoom in' },
    { re: /zoom (out|away|wider)|widen/,                                         cmd: '[Zoom out]',        reason: 'zoom out' },
    { re: /dolly (in|forward|closer)/,                                           cmd: '[Dolly in]',        reason: 'dolly in' },
    { re: /dolly (out|back|away)/,                                               cmd: '[Dolly out]',       reason: 'dolly out' },
    { re: /pan (left|to the left)/,                                              cmd: '[Pan left]',        reason: 'pan left' },
    { re: /pan (right|to the right)/,                                            cmd: '[Pan right]',       reason: 'pan right' },
    { re: /tilt (up|upward)|look(ing)? up|gaze up/,                             cmd: '[Pan up]',          reason: 'tilt up' },
    { re: /tilt (down|downward)|look(ing)? down/,                               cmd: '[Pan down]',        reason: 'tilt down' },
    { re: /track(ing)? (left|to the left)|lateral(ly)? left/,                   cmd: '[Tracking left]',   reason: 'tracking left' },
    { re: /track(ing)? (right|to the right)|lateral(ly)? right/,                cmd: '[Tracking right]',  reason: 'tracking right' },
    { re: /crane up|rise|ascend|lift/,                                           cmd: '[Crane up]',        reason: 'crane up' },
    { re: /crane down|descend|lower|sink/,                                       cmd: '[Crane down]',      reason: 'crane down' },
    { re: /orbit (left|around.*left|counter)/,                                   cmd: '[Orbit left]',      reason: 'orbit left' },
    { re: /orbit (right|around.*right|clock)/,                                   cmd: '[Orbit right]',     reason: 'orbit right' },
    { re: /static|still|locked|frozen|no (camera )?move/,                       cmd: '[Static]',          reason: 'static shot' },
  ];

  for (const { re, cmd, reason } of cameraPatterns) {
    if (re.test(lower) && !analysis.suggestCamera.includes(cmd)) {
      analysis.suggestCamera.push(cmd);
      analysis.cameraReasons.push(reason);
    }
  }

  // Duration estimation — complex scenes need more time
  const sceneTransitions = (lower.match(/\b(then|next|after that|and then|into|through|inside|transform|transition|morph)\b/g) || []).length;
  const actionCount = (lower.match(/\b(drift|run|chase|fight|explode|crash|fly|race|jump|climb|fall|walk|drive|spin|turn|dance)\b/g) || []).length;

  if (sceneTransitions >= 3 || actionCount >= 4) analysis.suggestDuration = 15;
  else if (sceneTransitions >= 2 || actionCount >= 2) analysis.suggestDuration = 10;
  else analysis.suggestDuration = 5;

  // Tier suggestion — complexity drives quality needs
  let complexity = 0;
  const complexityMarkers = [
    /face|facial|expression|emotion|close.?up/,
    /multiple.*(people|character)|crowd|group/,
    /transform|morph|transition.*into|magic/,
    /rain|snow|fire|water|particle|explos|smoke|fog/,
    /reflect|glass|mirror|metallic|chrome/,
    /fast|speed|drift|race|action/,
    /lightning|thunder|dramatic/,
  ];
  for (const marker of complexityMarkers) {
    if (marker.test(lower)) complexity++;
  }
  if (complexity >= 4) analysis.suggestTier = 'premium';
  else if (complexity >= 2) analysis.suggestTier = 'standard';

  return analysis;
}

function applySmartDefaults(opts, analysis) {
  const applied = [];

  // Auto-enable native audio if scene is sound-rich and model supports it
  if (analysis.suggestAudio && !opts.audioEnabled) {
    const modelName = opts._modelName || 'kling-v3';
    const features = FEATURE_MATRIX[modelName] || FEATURE_MATRIX['kling-v3'];
    if (features.native_audio) {
      opts.audioEnabled = true;
      applied.push(`audio ON (detected: ${analysis.audioReasons.join(', ')})`);
    }
  }

  // Auto-inject camera motion if detected and no explicit camera command in prompt
  if (analysis.suggestCamera.length > 0 && opts.prompt) {
    const hasExplicitCamera = Object.keys(CAMERA_PROMPT_INJECTIONS).some(cmd => opts.prompt.includes(cmd));
    if (!hasExplicitCamera) {
      // Use first detected camera command (primary motion)
      const primaryCamera = analysis.suggestCamera[0];
      opts.prompt = opts.prompt + ' ' + CAMERA_PROMPT_INJECTIONS[primaryCamera];
      applied.push(`camera: ${primaryCamera} (detected: ${analysis.cameraReasons[0]})`);
    }
  }

  // Auto-set duration if not explicitly provided
  if (analysis.suggestDuration && opts.duration === DEFAULT_DURATION && !opts._durationExplicit) {
    opts.duration = analysis.suggestDuration;
    applied.push(`duration: ${analysis.suggestDuration}s (based on scene complexity)`);
  }

  // Auto-upgrade tier if scene is complex
  if (analysis.suggestTier && !opts.tier && !opts.model) {
    const tierName = analysis.suggestTier;
    const tier = MODEL_TIERS[tierName];
    opts._modelName = tier.model_name;
    opts._mode = tier.mode;
    opts._isOmni = tier.is_omni || false;
    if (!opts._resolutionExplicit) opts.resolution = tier.resolution;
    applied.push(`tier: ${tierName} (complexity score justifies upgrade)`);
  }

  if (applied.length > 0) {
    console.log(`[SMART] Auto-tuned settings:`);
    for (const a of applied) console.log(`        → ${a}`);
  }

  return opts;
}

// ── Argument Parsing ───────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    // Mode flags
    image: null,
    prompt: null,
    promptFile: null,
    storyboard: null,
    stitch: null,
    output: null,
    text2video: false,
    omniMode: false,
    multiShot: false,
    shotsFile: null,
    extendMode: false,
    extendTaskId: null,
    effectsMode: false,
    effectsList: false,
    effectsApply: null,
    motionsMode: false,
    motionsList: false,
    motionMode: false,
    motionUrl: null,
    motionDirection: null,
    addSoundMode: false,
    elementsMode: false,
    elementsCreate: false,
    elementsList: false,
    elementsGet: null,
    elementsDelete: null,
    elementName: null,
    elementExtraImages: null,
    elementGenerateViews: false,
    elementTag: null,
    elementDescription: null,
    lipSync: false,
    tryOn: false,
    garment: null,
    listModels: false,
    smart: false,

    // Prompt composition
    emotion: null,
    shotSize: null,
    atmosphere: null,
    pacing: null,
    genre: null,
    character: null,
    location: null,

    // Generation settings
    tier: null,
    model: null,
    duration: DEFAULT_DURATION,
    resolution: null,
    aspect: DEFAULT_ASPECT,
    audioEnabled: false,
    negativePrompt: null,
    cfgScale: 0.5,
    crossfade: 0,

    // Reference inputs
    refVideo: null,
    videoMode: null,        // 'reference' or 'transform'
    keepAudio: false,
    startFrame: null,
    endFrame: null,
    elements: [],           // Array of element IDs for generation
    refImages: [],          // Array of reference image paths (face_ref, character sheet, location establishing)
    voices: [],             // Array of voice IDs
    video: null,
    audio: null,
    lipSyncText: false,     // Lip sync text2video mode (vs audio2video)
    voiceId: null,          // Voice ID for lipsync text2video
    voiceLanguage: 'en',    // Voice language for lipsync text2video
    voiceSpeed: null,       // Voice speed for lipsync text2video (0.8-2.0)
    text: null,             // Text for lipsync text2video
    videoId: null,          // Kling video_id for lipsync (from previous generation)
    listVoices: false,      // List available voices

    // Auth
    accessKey: process.env.KLING_ACCESS_KEY || null,
    secretKey: process.env.KLING_SECRET_KEY || null,

    // Internal
    _durationExplicit: false,
    _resolutionExplicit: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      // Input/output
      case '--image':           opts.image = args[++i]; break;
      case '--prompt':          opts.prompt = args[++i]; break;
      case '--prompt-file':     opts.promptFile = args[++i]; break;
      case '--output':          opts.output = args[++i]; break;

      // Mode selectors
      case '--text2video':      opts.text2video = true; break;
      case '--omni':            opts.omniMode = true; break;
      case '--multi-shot':      opts.multiShot = true; break;
      case '--shots':           opts.shotsFile = args[++i]; break;
      case '--extend':          opts.extendMode = true; break;
      case '--task-id':         opts.extendTaskId = args[++i]; break;
      case '--effects':         opts.effectsMode = true; break;
      case '--apply':           opts.effectsApply = args[++i]; break;
      case '--motions':         opts.motionsMode = true; break;
      case '--motion':          opts.motionMode = true; break;
      case '--motion-url':      opts.motionUrl = args[++i]; break;
      case '--motion-direction': opts.motionDirection = args[++i]; break;
      case '--add-sound':       opts.addSoundMode = true; break;
      case '--elements':        opts.elementsMode = true; break;
      case '--create':          opts.elementsCreate = true; break;
      case '--get':             opts.elementsGet = args[++i]; break;
      case '--delete':          opts.elementsDelete = args[++i]; break;
      case '--name':            opts.elementName = args[++i]; break;
      case '--extra-images':    opts.elementExtraImages = args[++i]; break;
      case '--generate-views':  opts.elementGenerateViews = true; break;
      case '--tag':             opts.elementTag = args[++i]; break;
      case '--element-desc':    opts.elementDescription = args[++i]; break;
      case '--lip-sync':        opts.lipSync = true; break;
      case '--lip-sync-text':   opts.lipSyncText = true; break;
      case '--voice-id':        opts.voiceId = args[++i]; break;
      case '--voice-lang':      opts.voiceLanguage = args[++i]; break;
      case '--voice-speed':     opts.voiceSpeed = parseFloat(args[++i]); break;
      case '--text':            opts.text = args[++i]; break;
      case '--video-id':        opts.videoId = args[++i]; break;
      case '--list-voices':     opts.listVoices = true; break;
      case '--try-on':          opts.tryOn = true; break;
      case '--garment':         opts.garment = args[++i]; break;
      case '--storyboard':      opts.storyboard = args[++i]; break;
      case '--stitch':          opts.stitch = args[++i]; break;
      case '--list':            opts.effectsList = true; opts.motionsList = true; opts.elementsList = true; break;
      case '--list-models':     opts.listModels = true; break;
      case '--smart':           opts.smart = true; break;

      // Prompt composition
      case '--emotion':         opts.emotion = args[++i]; break;
      case '--shot-size':       opts.shotSize = args[++i]; break;
      case '--atmosphere':      opts.atmosphere = args[++i]; break;
      case '--pacing':          opts.pacing = args[++i]; break;
      case '--genre-preset':    opts.genre = args[++i]; break;
      case '--character':       opts.character = args[++i]; break;
      case '--location':        opts.location = args[++i]; break;

      // Generation settings
      case '--tier':            opts.tier = args[++i]; break;
      case '--model':           opts.model = args[++i]; break;
      case '--duration':        opts.duration = parseInt(args[++i]); opts._durationExplicit = true; break;
      case '--resolution':      opts.resolution = args[++i]; opts._resolutionExplicit = true; break;
      case '--aspect':          opts.aspect = args[++i]; break;
      case '--with-audio':      opts.audioEnabled = true; break;
      case '--negative-prompt': opts.negativePrompt = args[++i]; break;
      case '--cfg':             opts.cfgScale = parseFloat(args[++i]); break;
      case '--crossfade':       opts.crossfade = parseFloat(args[++i]); break;

      // Reference inputs
      case '--ref-video':       opts.refVideo = args[++i]; break;
      case '--video-mode':      opts.videoMode = args[++i]; break;
      case '--keep-audio':      opts.keepAudio = true; break;
      case '--start-frame':     opts.startFrame = args[++i]; break;
      case '--end-frame':       opts.endFrame = args[++i]; break;
      case '--element':         opts.elements.push(args[++i]); break;
      case '--ref-image':       opts.refImages.push(args[++i]); break;
      case '--voice':           opts.voices.push(args[++i]); break;
      case '--video':           opts.video = args[++i]; break;
      case '--audio':           opts.audio = args[++i]; break;

      // Auth
      case '--access-key':      opts.accessKey = args[++i]; break;
      case '--secret-key':      opts.secretKey = args[++i]; break;

      case '--help':
        printUsage();
        process.exit(0);
    }
  }

  // --list-models: print all models and exit
  if (opts.listModels) {
    console.log('\nKling AI — Available Models & Features\n');
    console.log('TIERS (use --tier):');
    for (const [name, tier] of Object.entries(MODEL_TIERS)) {
      console.log(`  ${name.padEnd(12)} ${tier.description}`);
    }
    console.log('\nMODELS (use --model for manual override):');
    for (const [id, info] of Object.entries(AVAILABLE_MODELS)) {
      console.log(`  ${id.padEnd(20)} ${info.note} (${info.res})`);
    }
    console.log('\nFEATURE MATRIX:');
    console.log('  Feature'.padEnd(25) + Object.keys(FEATURE_MATRIX).map(k => k.padEnd(14)).join(''));
    const features = ['native_audio', 'multi_shot', 'elements', 'first_end_frame', 'video_reference',
      'video_transform', 'effects', 'motion_control', 'extend', 'add_sound', 'negative_prompt', 'camera_api'];
    for (const feat of features) {
      const row = feat.padEnd(25) + Object.values(FEATURE_MATRIX).map(m => (m[feat] ? '✓' : '✗').padEnd(14)).join('');
      console.log(`  ${row}`);
    }
    process.exit(0);
  }

  // Read prompt from file if specified
  if (opts.promptFile && !opts.prompt) {
    opts.prompt = fs.readFileSync(opts.promptFile, 'utf-8').trim();
  }

  // Resolve tier → model + resolution (only for generation modes)
  if (!opts.elementsMode && !opts.effectsMode && !opts.motionsMode) {
    if (!opts.model) {
      const tierName = opts.tier || DEFAULT_TIER;
      const tier = MODEL_TIERS[tierName];
      if (!tier) {
        console.error(`[ERROR] Unknown tier: ${tierName}. Use: draft, standard, premium, omni`);
        process.exit(1);
      }
      opts._modelName = tier.model_name;
      opts._mode = tier.mode;
      opts._isOmni = tier.is_omni || false;
      if (!opts.resolution) opts.resolution = tier.resolution;
    } else {
      const info = AVAILABLE_MODELS[opts.model];
      if (info) {
        opts._modelName = info.model_name;
        opts._mode = info.mode;
        opts._isOmni = info.is_omni || false;
        if (!opts.resolution) opts.resolution = info.res.split('-')[0];
      } else {
        opts._modelName = opts.model;
        opts._mode = 'pro';
        opts._isOmni = false;
        if (!opts.resolution) opts.resolution = '1080p';
      }
    }
  }

  return opts;
}

function printUsage() {
  console.log(`
Kling AI Video Generation — Full API Coverage

MODES:
  Image-to-video:   node kling-video.js --image <path> --prompt "..." --output <dir>
  Text-to-video:    node kling-video.js --text2video --prompt "..." --output <dir>
  Omni (advanced):  node kling-video.js --omni --prompt "..." [--element <id>] [--ref-video <path>] --output <dir>
  Multi-shot:       node kling-video.js --multi-shot --shots <config.json> --output <dir>
  First+end frame:  node kling-video.js --start-frame <path> [--end-frame <path>] --prompt "..." --output <dir>
  Video extend:     node kling-video.js --extend --task-id <id> [--prompt "..."] --output <dir>
  Effects:          node kling-video.js --effects --list
                    node kling-video.js --effects --apply <name> --image <path> --output <dir>
  Motion control:   node kling-video.js --motions --list
                    node kling-video.js --motion --image <path> --motion-url <url> --output <dir>
  Add sound:        node kling-video.js --add-sound --video <path> --output <dir>
  Lip sync:         node kling-video.js --lip-sync --video <path> --audio <path> --output <dir>
  Storyboard:       node kling-video.js --storyboard <config.json> --output <dir>
  Stitch clips:     node kling-video.js --stitch <clips-dir> --output <final.mp4>
  V2V transform:    node kling-video.js --omni --prompt "Transform to..." --ref-video <path> --video-mode transform --output <dir>

ELEMENT MANAGEMENT:
  Create:           node kling-video.js --elements --create --name "hero" --image <path> [--extra-images a.png,b.png]
  List:             node kling-video.js --elements --list
  Get:              node kling-video.js --elements --get <element_id>
  Delete:           node kling-video.js --elements --delete <element_id>

MODEL SELECTION:
  --tier <name>              draft | standard | premium | omni (default: standard)
  --model <id>               Manual model override. Run --list-models to see all.
  --list-models              Print all models, tiers, and feature matrix

GENERATION OPTIONS:
  --prompt <text>            Motion/content prompt (supports [Camera commands])
  --prompt-file <path>       Read prompt from file
  --duration <sec>           3-15 seconds (default: ${DEFAULT_DURATION})
  --resolution <res>         720p, 1080p, 4k (auto from tier)
  --aspect <ratio>           16:9, 9:16, 1:1, 4:3, 3:4, 3:2, 2:3, 21:9 (default: ${DEFAULT_ASPECT})
  --with-audio               Enable native audio generation (V3 only, ~1.5x cost)
  --negative-prompt <text>   What to avoid (V1 only)
  --cfg <float>              CFG scale 0-1 (default: 0.5)
  --smart                    Auto-detect audio, camera, duration, tier from prompt

REFERENCE INPUTS:
  --start-frame <path>       First frame image (for frame-to-frame mode)
  --end-frame <path>         End frame image (requires --start-frame)
  --element <id>             Use element for consistency (repeatable, up to 7)
  --ref-video <path>         Reference video for style/motion/transform
  --video-mode <mode>        How to use ref video: reference | transform (default: reference)
  --keep-audio               Preserve reference video audio
  --voice <id>               Voice ID reference (repeatable, up to 2)

ELEMENT OPTIONS:
  --name <text>              Element name (max 15 chars)
  --extra-images <paths>     Comma-separated extra angle images (up to 3)
  --generate-views           Auto-generate multi-angle views
  --tag <text>               Element category tag
  --element-desc <text>      Element description (max 100 chars)

CAMERA COMMANDS (embed in prompt text):
  [Pan left/right/up/down]  [Zoom in/out]  [Dolly in/out]
  [Crane up/down]  [Tracking left/right]  [Orbit left/right]
  [Push through]  [Pull back reveal]  [Static]

MULTI-SHOT JSON FORMAT (--shots):
  {
    "shots": [
      { "prompt": "Scene 1 description", "duration": 5 },
      { "prompt": "Scene 2 description", "duration": 5 },
      { "prompt": "Scene 3 description", "duration": 5 }
    ],
    "aspect_ratio": "16:9"
  }
  Max 6 shots, total duration <= 15s, each shot >= 3s. V3 only.

STORYBOARD JSON FORMAT (--storyboard):
  {
    "frames": [
      {
        "image": "/path/to/image.png",
        "prompt": "Motion description. [Dolly in]",
        "duration": 5,
        "title": "Scene name",
        "end_frame": "/path/to/end.png",
        "elements": ["u_123"],
        "with_audio": true,
        "effect": "rocket",
        "tier": "premium"
      }
    ]
  }
  `);
}

// ── Auth — JWT Token Generation ────────────────────────────────────────────

function base64url(data) {
  return Buffer.from(data).toString('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function generateJWT(accessKey, secretKey) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: accessKey,
    exp: now + 1800,
    nbf: now - 5,
    iat: now,
  };
  const segments = [base64url(JSON.stringify(header)), base64url(JSON.stringify(payload))];
  const signature = crypto.createHmac('sha256', secretKey)
    .update(segments.join('.'))
    .digest('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${segments.join('.')}.${signature}`;
}

// ── HTTP Helpers ───────────────────────────────────────────────────────────

function makeRequest(method, urlPath, body, opts) {
  const token = generateJWT(opts.accessKey, opts.secretKey);
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath.startsWith('http') ? urlPath : `${API_BASE}${urlPath}`);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch (e) { resolve({ status: res.statusCode, data: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function downloadFile(url, outputPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outputPath);
    const doRequest = (reqUrl) => {
      const mod = reqUrl.startsWith('https') ? https : require('http');
      mod.get(reqUrl, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          doRequest(res.headers.location);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`Download failed with status ${res.statusCode}`));
          return;
        }
        res.pipe(file);
        file.on('finish', () => { file.close(); resolve(); });
      }).on('error', (err) => { fs.unlink(outputPath, () => {}); reject(err); });
    };
    doRequest(url);
  });
}

// ── Image & Asset Helpers ──────────────────────────────────────────────────

function imageToBase64(imagePath) {
  const data = fs.readFileSync(imagePath);
  return data.toString('base64');
}

function imageToDataUrl(imagePath) {
  const ext = path.extname(imagePath).toLowerCase().replace('.', '');
  const mimeMap = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' };
  const mime = mimeMap[ext] || 'image/png';
  const data = fs.readFileSync(imagePath);
  return `data:${mime};base64,${data.toString('base64')}`;
}

function videoToBase64(videoPath) {
  const data = fs.readFileSync(videoPath);
  return data.toString('base64');
}

function resolveInput(inputPath) {
  if (!inputPath) return null;
  if (inputPath.startsWith('http://') || inputPath.startsWith('https://') || inputPath.startsWith('data:')) {
    return inputPath;
  }
  return imageToBase64(inputPath);
}

// ── Camera Control Parser ──────────────────────────────────────────────────

function parseCameraCommand(prompt, modelName) {
  const isV1 = modelName && modelName.startsWith('kling-v1');

  for (const [command, promptInjection] of Object.entries(CAMERA_PROMPT_INJECTIONS)) {
    if (prompt && prompt.includes(command)) {
      let cleanPrompt = prompt.replace(command, '').trim();
      cleanPrompt = cleanPrompt + ' ' + promptInjection;
      const apiControl = isV1 ? (V1_CAMERA_CONTROL[command] || null) : null;
      return { cleanPrompt, cameraControl: apiControl, cameraDescription: promptInjection };
    }
  }
  return { cleanPrompt: prompt, cameraControl: null, cameraDescription: 'natural motion' };
}

// ── Task Submission Helpers ────────────────────────────────────────────────

function handleSubmitResponse(res, label) {
  if (res.status === 429) {
    throw new Error('Rate limited (429). Kling allows 5 concurrent requests. Wait and retry.');
  }
  if (res.data.code && res.data.code !== 0) {
    throw new Error(`${label} API error: ${res.data.message || JSON.stringify(res.data)} (code: ${res.data.code})`);
  }
  const taskId = res.data.data?.task_id || res.data.task_id;
  if (!taskId) {
    throw new Error(`No task_id returned from ${label}: ${JSON.stringify(res.data)}`);
  }
  return taskId;
}

// ── Core API: Image-to-Video ───────────────────────────────────────────────

async function submitImageToVideo(imagePath, prompt, opts) {
  const modelName = opts._modelName || 'kling-v3';
  const mode = opts._mode || 'std';
  const isV1 = modelName.startsWith('kling-v1');

  const { cleanPrompt, cameraControl, cameraDescription } = parseCameraCommand(prompt, modelName);
  const imageBase64 = imageToBase64(imagePath);

  const body = {
    model_name: modelName,
    mode: mode,
    image: imageBase64,
    prompt: (cleanPrompt || '').substring(0, isV1 ? 500 : 2500),
    duration: String(opts.duration),
    aspect_ratio: opts.aspect,
  };

  if (isV1 && opts.cfgScale !== undefined) body.cfg_scale = opts.cfgScale;
  if (cameraControl && isV1 && mode === 'std') body.camera_control = cameraControl;
  if (opts.negativePrompt && isV1) body.negative_prompt = opts.negativePrompt.substring(0, 200);
  if (opts.audioEnabled && modelName === 'kling-v3') body.enable_audio = true;

  // End frame (image_tail) support on standard image2video endpoint
  // The omni and frames endpoints may not be available on all accounts,
  // but image_tail is accepted on the standard image2video endpoint for V3
  if (opts.endFrame && fs.existsSync(opts.endFrame)) {
    body.image_tail = resolveInput(opts.endFrame);
    console.log(`      End frame: ${opts.endFrame}`);
  }

  if (opts.refVideo && fs.existsSync(opts.refVideo)) {
    body.ref_video = videoToBase64(opts.refVideo);
    body.character_orientation = 'image';
  }

  const tierLabel = opts.tier || (opts.model ? `model:${opts.model}` : 'standard');
  console.log(`[...] Submitting image-to-video task...`);
  console.log(`      Model: ${modelName} (${mode}) [${tierLabel}]`);
  console.log(`      Duration: ${opts.duration}s | Aspect: ${opts.aspect}`);
  console.log(`      Audio: ${opts.audioEnabled ? 'native' : 'off'}`);
  console.log(`      Camera: ${cameraDescription}`);
  if (opts.endFrame) console.log(`      End frame: yes (image_tail on image2video)`);
  console.log(`      Prompt: ${(cleanPrompt || '').substring(0, 100)}...`);

  const res = await makeRequest('POST', ENDPOINTS.IMAGE2VIDEO, body, opts);
  const taskId = handleSubmitResponse(res, 'image2video');
  console.log(`[OK] Task submitted: ${taskId}`);
  return { taskId, pollEndpoint: ENDPOINTS.IMAGE2VIDEO };
}

// ── Core API: Text-to-Video ────────────────────────────────────────────────

async function submitTextToVideo(prompt, opts) {
  const modelName = opts._modelName || 'kling-v3';
  const mode = opts._mode || 'std';
  const isV1 = modelName.startsWith('kling-v1');

  const { cleanPrompt, cameraDescription } = parseCameraCommand(prompt, modelName);

  const body = {
    model_name: modelName,
    mode: mode,
    prompt: (cleanPrompt || '').substring(0, isV1 ? 500 : 2500),
    duration: String(opts.duration),
    aspect_ratio: opts.aspect,
  };

  if (isV1 && opts.cfgScale !== undefined) body.cfg_scale = opts.cfgScale;
  if (opts.negativePrompt && isV1) body.negative_prompt = opts.negativePrompt.substring(0, 200);
  if (opts.audioEnabled && modelName === 'kling-v3') body.enable_audio = true;

  console.log(`[...] Submitting text-to-video task...`);
  console.log(`      Model: ${modelName} (${mode})`);
  console.log(`      Duration: ${opts.duration}s | Aspect: ${opts.aspect}`);
  console.log(`      Audio: ${opts.audioEnabled ? 'native' : 'off'}`);
  console.log(`      Camera: ${cameraDescription}`);
  console.log(`      Prompt: ${(cleanPrompt || '').substring(0, 100)}...`);

  const res = await makeRequest('POST', ENDPOINTS.TEXT2VIDEO, body, opts);
  const taskId = handleSubmitResponse(res, 'text2video');
  console.log(`[OK] Task submitted: ${taskId}`);
  return { taskId, pollEndpoint: ENDPOINTS.TEXT2VIDEO };
}

// ── Core API: Omni Endpoint (V3 unified) ───────────────────────────────────

async function submitOmniVideo(prompt, opts) {
  const mode = opts._mode || 'std';

  const body = {
    mode: mode,
    prompt: (prompt || '').substring(0, 2500),
    duration: String(opts.duration),
    aspect_ratio: opts.aspect,
  };

  // CFG scale
  if (opts.cfgScale !== undefined) body.cfg_scale = opts.cfgScale;

  // Negative prompt (omni may support it)
  if (opts.negativePrompt) body.negative_prompt = opts.negativePrompt.substring(0, 2500);

  // Native audio
  if (opts.audioEnabled) body.generate_audio = true;

  // Image references (up to 7) — image_1 is the storyboard frame, image_2+ are reference assets
  // This is how pre-production visual assets (face_ref, character sheets, location establishing)
  // reach Kling directly — not just through the storyboard frame.
  let nextImageSlot = 1;
  if (opts.image) {
    body[`image_${nextImageSlot}`] = resolveInput(opts.image);
    nextImageSlot++;
  }
  // Reference images from pre-production (face_ref, character_reference, location_establishing, product_reference)
  // These are passed as image_2, image_3, etc. and referenced in the prompt as @image_2, @image_3
  if (opts.refImages && opts.refImages.length > 0) {
    for (const refImg of opts.refImages.slice(0, 7 - nextImageSlot + 1)) {
      if (fs.existsSync(refImg)) {
        body[`image_${nextImageSlot}`] = resolveInput(refImg);
        nextImageSlot++;
      }
    }
    if (opts.refImages.length > 0) {
      console.log(`      Ref images: ${opts.refImages.length} (image_2 through image_${nextImageSlot - 1})`);
    }
  }

  // Element references (up to 7)
  if (opts.elements.length > 0) {
    opts.elements.slice(0, 7).forEach((elId, idx) => {
      body[`element_${idx + 1}`] = elId;
    });
  }

  // First/end frame (overrides image references)
  if (opts.startFrame) {
    body.frame_start = resolveInput(opts.startFrame);
    if (opts.endFrame) body.frame_end = resolveInput(opts.endFrame);
    // Remove image references when using frames
    delete body.image_1;
  }

  // Video reference / transform
  if (opts.refVideo) {
    if (opts.refVideo.startsWith('http')) {
      body.video_1 = opts.refVideo;
    } else {
      body.video_1 = videoToBase64(opts.refVideo);
    }
    body.video_mode = opts.videoMode || 'reference';
    if (opts.keepAudio) body.keep_audio = true;
  }

  // Voice references
  if (opts.voices.length > 0) {
    body.voice_ids = opts.voices.slice(0, 2);
  }

  console.log(`[...] Submitting Omni video task...`);
  console.log(`      Mode: ${mode}`);
  console.log(`      Duration: ${opts.duration}s | Aspect: ${opts.aspect}`);
  console.log(`      Audio: ${opts.audioEnabled ? 'native' : 'off'}`);
  if (opts.elements.length > 0) console.log(`      Elements: ${opts.elements.join(', ')}`);
  if (opts.refVideo) console.log(`      Video ref: ${opts.videoMode || 'reference'}`);
  if (opts.startFrame) console.log(`      Frames: start${opts.endFrame ? ' + end' : ''}`);
  console.log(`      Prompt: ${(prompt || '').substring(0, 100)}...`);

  const res = await makeRequest('POST', ENDPOINTS.OMNI, body, opts);
  const taskId = handleSubmitResponse(res, 'omni');
  console.log(`[OK] Omni task submitted: ${taskId}`);
  return { taskId, pollEndpoint: ENDPOINTS.OMNI };
}

// ── Core API: Multi-Shot (via Omni, V3 only) ──────────────────────────────

async function submitMultiShot(shotsConfig, opts) {
  const mode = opts._mode || 'std';

  const body = {
    mode: mode,
    aspect_ratio: opts.aspect,
  };

  // Build shot_N_prompt / shot_N_duration fields
  const shots = shotsConfig.shots || shotsConfig;
  if (!Array.isArray(shots) || shots.length < 2 || shots.length > 6) {
    throw new Error('Multi-shot requires 2-6 shots');
  }

  let totalDuration = 0;
  for (let i = 0; i < shots.length; i++) {
    const shot = shots[i];
    const duration = shot.duration || 5;
    if (duration < 3) throw new Error(`Shot ${i + 1} duration must be >= 3s`);
    totalDuration += duration;
    body[`shot_${i + 1}_prompt`] = (shot.prompt || '').substring(0, 2500);
    body[`shot_${i + 1}_duration`] = duration;
  }

  if (totalDuration > 15) {
    throw new Error(`Total multi-shot duration (${totalDuration}s) exceeds 15s limit`);
  }

  // Native audio
  if (opts.audioEnabled) body.generate_audio = true;

  // Element references for consistency across shots
  if (opts.elements.length > 0) {
    opts.elements.slice(0, 7).forEach((elId, idx) => {
      body[`element_${idx + 1}`] = elId;
    });
  }

  // Image reference for visual context
  if (opts.image) {
    body.image_1 = resolveInput(opts.image);
  }

  if (opts.cfgScale !== undefined) body.cfg_scale = opts.cfgScale;

  console.log(`[...] Submitting multi-shot task (${shots.length} shots, ${totalDuration}s total)...`);
  console.log(`      Mode: ${mode} | Aspect: ${opts.aspect}`);
  console.log(`      Audio: ${opts.audioEnabled ? 'native' : 'off'}`);
  for (let i = 0; i < shots.length; i++) {
    console.log(`      Shot ${i + 1} (${shots[i].duration || 5}s): ${(shots[i].prompt || '').substring(0, 60)}...`);
  }

  const res = await makeRequest('POST', ENDPOINTS.OMNI, body, opts);
  const taskId = handleSubmitResponse(res, 'multi-shot');
  console.log(`[OK] Multi-shot task submitted: ${taskId}`);
  return { taskId, pollEndpoint: ENDPOINTS.OMNI };
}

// ── Core API: First + End Frame ────────────────────────────────────────────

async function submitFrameToFrame(startFrame, endFrame, prompt, opts) {
  const modelName = opts._modelName || 'kling-v3';
  const mode = opts._mode || 'std';

  const body = {
    model_name: modelName,
    mode: mode,
    prompt: (prompt || '').substring(0, 2500),
    duration: String(opts.duration),
  };

  if (startFrame) body.image = resolveInput(startFrame);
  if (endFrame) body.image_tail = resolveInput(endFrame);

  if (!body.image && !body.image_tail) {
    throw new Error('At least one of --start-frame or --end-frame is required');
  }

  if (opts.audioEnabled && modelName === 'kling-v3') body.enable_audio = true;

  console.log(`[...] Submitting frame-to-frame task...`);
  console.log(`      Model: ${modelName} (${mode})`);
  console.log(`      Start frame: ${startFrame ? 'yes' : 'no'} | End frame: ${endFrame ? 'yes' : 'no'}`);
  console.log(`      Duration: ${opts.duration}s`);
  console.log(`      Prompt: ${(prompt || '').substring(0, 100)}...`);

  const res = await makeRequest('POST', ENDPOINTS.FRAMES, body, opts);
  const taskId = handleSubmitResponse(res, 'frame-to-frame');
  console.log(`[OK] Frame-to-frame task submitted: ${taskId}`);
  return { taskId, pollEndpoint: ENDPOINTS.FRAMES };
}

// ── Core API: Video Extension ──────────────────────────────────────────────

async function submitVideoExtend(originTaskId, prompt, opts) {
  const body = {
    task_id: originTaskId,
  };

  if (prompt) body.prompt = prompt.substring(0, 2500);
  if (opts.negativePrompt) body.negative_prompt = opts.negativePrompt.substring(0, 2500);
  if (opts.cfgScale !== undefined) body.cfg_scale = opts.cfgScale;
  if (opts.audioEnabled) body.enable_audio = true;

  console.log(`[...] Submitting video extension task...`);
  console.log(`      Original task: ${originTaskId}`);
  if (prompt) console.log(`      Prompt: ${prompt.substring(0, 100)}...`);

  const res = await makeRequest('POST', ENDPOINTS.EXTEND, body, opts);
  const taskId = handleSubmitResponse(res, 'extend');
  console.log(`[OK] Extension task submitted: ${taskId}`);
  return { taskId, pollEndpoint: ENDPOINTS.EXTEND };
}

// ── Core API: Visual Effects ───────────────────────────────────────────────

async function listEffects(opts) {
  console.log('[...] Fetching available effects...');
  const res = await makeRequest('GET', ENDPOINTS.EFFECTS_LIST, null, opts);

  if (res.data.code && res.data.code !== 0) {
    throw new Error(`Effects list error: ${res.data.message || JSON.stringify(res.data)}`);
  }

  const effects = res.data.data || res.data || [];
  console.log(`\nKling AI — Available Effects (${effects.length})\n`);
  for (const effect of effects) {
    const hot = effect.hot ? ' 🔥' : '';
    const modes = (effect.supportedModelMode || []).join('/');
    const prompt = effect.promptSupported ? ' [accepts prompt]' : '';
    console.log(`  ${(effect.name || '').padEnd(25)} ${(effect.caption || '').padEnd(30)} ${modes}${prompt}${hot}`);
  }
  return effects;
}

async function submitWithEffects(effectName, imagePath, prompt, opts) {
  const mode = opts._mode || 'std';

  const body = {
    effect: effectName,
    image: resolveInput(imagePath),
    mode: mode,
  };

  if (prompt) body.prompt = prompt.substring(0, 2500);

  console.log(`[...] Submitting effects task...`);
  console.log(`      Effect: ${effectName}`);
  console.log(`      Mode: ${mode}`);
  if (prompt) console.log(`      Prompt: ${prompt.substring(0, 100)}...`);

  const res = await makeRequest('POST', ENDPOINTS.EFFECTS_VIDEO, body, opts);
  const taskId = handleSubmitResponse(res, 'effects');
  console.log(`[OK] Effects task submitted: ${taskId}`);
  return { taskId, pollEndpoint: ENDPOINTS.EFFECTS_VIDEO };
}

// ── Core API: Motion Control ───────────────────────────────────────────────

async function listMotions(opts) {
  console.log('[...] Fetching available motion presets...');
  const res = await makeRequest('GET', `${ENDPOINTS.MOTIONS_LIST}?mine=false`, null, opts);

  if (res.data.code && res.data.code !== 0) {
    throw new Error(`Motions list error: ${res.data.message || JSON.stringify(res.data)}`);
  }

  const motions = res.data.data || res.data || [];
  console.log(`\nKling AI — Available Motion Presets (${motions.length})\n`);
  for (const motion of motions) {
    const dur = motion.duration ? `${(motion.duration / 1000).toFixed(1)}s` : '?';
    const audio = motion.hasAudio ? ' [has audio]' : '';
    console.log(`  ${(motion.assetId || '').padEnd(25)} ${dur}${audio} ${motion.url ? '(url available)' : ''}`);
  }
  return motions;
}

async function submitMotionCreate(imagePath, motionUrl, prompt, opts) {
  const modelName = opts._modelName || 'kling-v3';
  const mode = opts._mode || 'std';

  const body = {
    imageUrl: resolveInput(imagePath),
    motionUrl: motionUrl,
    model_name: modelName,
    mode: mode,
  };

  if (prompt) body.prompt = prompt.substring(0, 2500);
  if (opts.keepAudio) body.keepAudio = true;
  if (opts.motionDirection) body.motionDirection = opts.motionDirection;

  // Element for consistency (V3 only)
  if (opts.elements.length > 0 && modelName === 'kling-v3') {
    body.element_1 = opts.elements[0];
  }

  console.log(`[...] Submitting motion control task...`);
  console.log(`      Model: ${modelName} (${mode})`);
  console.log(`      Motion URL: ${motionUrl.substring(0, 60)}...`);
  if (prompt) console.log(`      Prompt: ${prompt.substring(0, 100)}...`);

  const res = await makeRequest('POST', ENDPOINTS.MOTION_CREATE, body, opts);
  const taskId = handleSubmitResponse(res, 'motion-create');
  console.log(`[OK] Motion task submitted: ${taskId}`);
  return { taskId, pollEndpoint: ENDPOINTS.MOTION_CREATE };
}

// ── Core API: Add Sound ────────────────────────────────────────────────────

async function submitAddSound(videoPath, opts) {
  const body = {
    video: resolveInput(videoPath),
    cropVideoOriginalSound: opts.keepAudio || false,
  };

  console.log(`[...] Submitting add-sound task...`);
  console.log(`      Video: ${videoPath}`);
  console.log(`      Keep original: ${opts.keepAudio || false}`);

  const res = await makeRequest('POST', ENDPOINTS.ADD_SOUND, body, opts);
  const taskId = handleSubmitResponse(res, 'add-sound');
  console.log(`[OK] Add-sound task submitted: ${taskId}`);
  return { taskId, pollEndpoint: ENDPOINTS.ADD_SOUND };
}

// ── Core API: Lip Sync ─────────────────────────────────────────────────────

async function submitLipSync(videoPath, audioPath, opts) {
  const audioData = fs.readFileSync(audioPath).toString('base64');
  const body = {
    input: {
      mode: 'audio2video',
      audio_type: 'file',
      audio_file: audioData,
    }
  };

  // Video source — URL, Kling video_id, or local path
  // NOTE: Kling lipsync does NOT accept base64. Must be a URL or video_id.
  if (videoPath.startsWith('http')) {
    body.input.video_url = videoPath;
  } else if (/^\d+$/.test(videoPath)) {
    // Numeric string = Kling video resource ID
    body.input.video_id = videoPath;
  } else {
    // Local file — need to get the Kling video_url from the generation task.
    // Fall back to using the Kling task system: caller should pass video_url or video_id.
    console.error('[WARN] Lipsync requires a video URL or Kling video_id, not a local file.');
    console.error('       Get the video URL from the generation task: poll task → task_result.videos[0].url');
    console.error('       Or pass --video-id with the Kling video resource ID.');
    // Attempt anyway with data URL as last resort
    body.input.video_url = 'data:video/mp4;base64,' + videoToBase64(videoPath);
  }

  console.log(`[...] Submitting lip sync (audio2video) task...`);
  console.log(`      Video: ${videoPath}`);
  console.log(`      Audio: ${audioPath} (${(audioData.length / 1024).toFixed(0)}KB base64)`);

  const res = await makeRequest('POST', ENDPOINTS.LIPSYNC, body, opts);
  const taskId = handleSubmitResponse(res, 'lipsync');
  console.log(`[OK] Lip sync audio2video task submitted: ${taskId}`);
  return { taskId, pollEndpoint: ENDPOINTS.LIPSYNC };
}

// Text-to-video lip sync — Kling generates voice AND syncs mouth in one call.
// Requires video_id (from a previously generated Kling video) or video_url.
// voice_id comes from VOICE_CATALOG (e.g., 'ai_laoguowang_712' for serious boss).
// voice_language: 'en' or 'zh'. voice_speed: 0.8–2.0 (default 1.0).
// Max 120 chars of text.
async function submitLipSyncText(videoIdOrUrl, text, voiceId, opts) {
  const body = { input: { mode: 'text2video', text: text.substring(0, 120) } };

  // Resolve voice_id — accept catalog key or raw API ID
  if (VOICE_CATALOG[voiceId]) {
    body.input.voice_id = VOICE_CATALOG[voiceId].id;
  } else {
    body.input.voice_id = voiceId;
  }

  body.input.voice_language = opts.voiceLanguage || 'en';
  if (opts.voiceSpeed) body.input.voice_speed = opts.voiceSpeed;

  // Accept either a video_id or video_url
  if (videoIdOrUrl.startsWith('http')) {
    body.input.video_url = videoIdOrUrl;
  } else {
    body.input.video_id = videoIdOrUrl;
  }

  console.log(`[...] Submitting lip sync (text2video) task...`);
  console.log(`      Voice: ${body.input.voice_id} (${opts.voiceLanguage || 'en'})`);
  console.log(`      Text: "${text.substring(0, 80)}${text.length > 80 ? '...' : ''}"`);
  console.log(`      Video: ${videoIdOrUrl.substring(0, 60)}...`);

  const res = await makeRequest('POST', ENDPOINTS.LIPSYNC, body, opts);
  const taskId = handleSubmitResponse(res, 'lipsync');
  console.log(`[OK] Lip sync text2video task submitted: ${taskId}`);
  return { taskId, pollEndpoint: ENDPOINTS.LIPSYNC };
}

// ── Core API: Virtual Try-On (Kolors) ──────────────────────────────────────
// Two use cases:
//   PRE-PRODUCTION: Generate wardrobe variant references from character sheet + garment image
//   POST-PRODUCTION: Change outfit on generated video frames / stills
// This is NEVER auto-called — only when the user explicitly requests a wardrobe change.

async function submitTryOn(personImage, garmentImage, opts) {
  const body = {
    model_name: 'kolors-virtual-try-on-v1',
    human_image: resolveInput(personImage),
    cloth_image: resolveInput(garmentImage),
  };

  console.log(`[...] Submitting virtual try-on task...`);
  console.log(`      Person: ${personImage}`);
  console.log(`      Garment: ${garmentImage}`);

  const res = await makeRequest('POST', '/images/kolors-virtual-try-on', body, opts);
  const taskId = handleSubmitResponse(res, 'try-on');
  console.log(`[OK] Try-on task submitted: ${taskId}`);
  return { taskId, pollEndpoint: '/images/kolors-virtual-try-on' };
}

// ── Element Management ─────────────────────────────────────────────────────

async function createElement(opts) {
  if (!opts.elementName) throw new Error('--name required for element creation');
  if (!opts.image) throw new Error('--image required for element creation');

  const body = {
    name: opts.elementName.substring(0, 15),
    coverImage: resolveInput(opts.image),
  };

  // Extra angle images (up to 3)
  if (opts.elementExtraImages) {
    const extras = opts.elementExtraImages.split(',').map(p => p.trim());
    if (extras[0]) body.extraImage1 = resolveInput(extras[0]);
    if (extras[1]) body.extraImage2 = resolveInput(extras[1]);
    if (extras[2]) body.extraImage3 = resolveInput(extras[2]);
  }

  if (opts.elementGenerateViews && !opts.elementExtraImages) {
    body.generateViews = true;
  }

  if (opts.elementTag) body.tag = opts.elementTag;
  if (opts.elementDescription) body.description = opts.elementDescription.substring(0, 100);

  console.log(`[...] Creating element "${opts.elementName}"...`);
  if (opts.elementExtraImages) console.log(`      Extra images: ${opts.elementExtraImages}`);
  if (opts.elementGenerateViews) console.log(`      Auto-generating views: yes`);

  const res = await makeRequest('POST', ENDPOINTS.ELEMENTS, body, opts);

  if (res.data.code && res.data.code !== 0) {
    throw new Error(`Element creation error: ${res.data.message || JSON.stringify(res.data)}`);
  }

  const elementId = res.data.data?.id || res.data.data?.element_id || res.data.id;
  console.log(`[OK] Element created: ${elementId}`);
  console.log(`     Use in prompts with @element_1 and --element ${elementId}`);
  return elementId;
}

async function listElementsApi(opts) {
  console.log('[...] Fetching elements...');
  const res = await makeRequest('GET', ENDPOINTS.ELEMENTS, null, opts);

  if (res.data.code && res.data.code !== 0) {
    throw new Error(`Elements list error: ${res.data.message || JSON.stringify(res.data)}`);
  }

  const elements = res.data.data || res.data || [];
  console.log(`\nKling AI — Your Elements (${elements.length})\n`);
  for (const el of elements) {
    const id = el.id || el.element_id || '?';
    const name = el.name || '?';
    const tag = el.tag ? ` [${el.tag}]` : '';
    const desc = el.description ? ` — ${el.description}` : '';
    console.log(`  ${id.padEnd(25)} ${name}${tag}${desc}`);
  }
  return elements;
}

async function getElement(elementId, opts) {
  console.log(`[...] Fetching element ${elementId}...`);
  const res = await makeRequest('GET', `${ENDPOINTS.ELEMENTS}/${elementId}`, null, opts);

  if (res.data.code && res.data.code !== 0) {
    throw new Error(`Element get error: ${res.data.message || JSON.stringify(res.data)}`);
  }

  const el = res.data.data || res.data;
  console.log(`\nElement: ${el.name || elementId}`);
  console.log(JSON.stringify(el, null, 2));
  return el;
}

async function deleteElement(elementId, opts) {
  console.log(`[...] Deleting element ${elementId}...`);
  const res = await makeRequest('DELETE', `${ENDPOINTS.ELEMENTS}/${elementId}`, null, opts);

  if (res.data.code && res.data.code !== 0) {
    throw new Error(`Element delete error: ${res.data.message || JSON.stringify(res.data)}`);
  }

  console.log(`[OK] Element ${elementId} deleted`);
}

// ── Poll & Download ────────────────────────────────────────────────────────

async function pollTaskStatus(taskId, pollEndpoint, opts) {
  const pollPath = `${pollEndpoint}/${taskId}`;
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    const res = await makeRequest('GET', pollPath, null, opts);
    const taskData = res.data.data || res.data;
    const status = taskData.task_status || taskData.status;

    if (status === 'succeed' || status === 'completed' || status === 'Success') {
      console.log(`\n[OK] Generation complete!`);
      return taskData;
    } else if (status === 'failed' || status === 'Fail') {
      throw new Error(`Generation failed: ${taskData.task_status_msg || JSON.stringify(taskData)}`);
    }

    const elapsed = ((attempt + 1) * POLL_INTERVAL_MS / 1000).toFixed(0);
    process.stdout.write(`\r[...] Status: ${status} (${elapsed}s elapsed)`);
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error('Timeout: generation exceeded maximum wait time');
}

function extractVideoUrl(result) {
  const videos = result.task_result?.videos || result.videos || [];
  return videos[0]?.url || result.video_url || result.download_url;
}

// ── Generation Pipeline ────────────────────────────────────────────────────

async function generateClip(opts, submitFn, outputDir, clipName) {
  const outputPath = path.join(outputDir, `${clipName}.mp4`);

  if (fs.existsSync(outputPath)) {
    console.log(`[SKIP] ${clipName}.mp4 already exists`);
    return outputPath;
  }

  const { taskId, pollEndpoint } = await submitFn();

  console.log('');
  const result = await pollTaskStatus(taskId, pollEndpoint, opts);
  console.log('');

  const downloadUrl = extractVideoUrl(result);
  if (!downloadUrl) {
    throw new Error(`No video URL in result: ${JSON.stringify(result)}`);
  }

  console.log(`[...] Downloading to ${outputPath}...`);
  await downloadFile(downloadUrl, outputPath);

  const stats = fs.statSync(outputPath);
  console.log(`[OK] Saved: ${outputPath} (${(stats.size / 1024).toFixed(0)}KB)`);
  return outputPath;
}

// ── Storyboard Frame Preparation ─────────────────────────────────────────

function prepareFrame(frame, i, opts) {
  const clipName = `clip_${String(i + 1).padStart(2, '0')}`;

  // Per-frame option overrides
  const frameOpts = { ...opts };
  if (frame.duration) { frameOpts.duration = frame.duration; frameOpts._durationExplicit = true; }
  if (frame.tier) {
    const tier = MODEL_TIERS[frame.tier];
    if (tier) {
      frameOpts._modelName = tier.model_name;
      frameOpts._mode = tier.mode;
      frameOpts._isOmni = tier.is_omni || false;
      frameOpts.tier = frame.tier;
    }
  }
  if (frame.with_audio !== undefined) frameOpts.audioEnabled = frame.with_audio;
  if (frame.elements) frameOpts.elements = frame.elements;
  if (frame.ref_images) frameOpts.refImages = frame.ref_images;

  // Voice IDs for dialogue (Omni endpoint Strategy A)
  if (frame.voice_ids && frame.voice_ids.length > 0) {
    frameOpts.voices = frame.voice_ids.map(v => VOICE_CATALOG[v] ? VOICE_CATALOG[v].id : v);
    frameOpts.audioEnabled = true;
  }
  if (frame.dialogue && frame.dialogue.length > 0) {
    frameOpts.dialogue = frame.dialogue;
  }

  // ── Prompt Compilation ──────────────────────────────────────────
  // Priority: scene JSON descriptor > flat fields + prompt > raw prompt
  let framePrompt;

  if (frame.scene && typeof frame.scene === 'object') {
    // NEW: Structured scene descriptor — compile to prompt
    const compiled = composeFromScene(frame.scene, {
      character: frame.character,
      wardrobe: frame.wardrobe,
      location: frame.location,
      genre: frame.genre || opts.genre,
      sound_fx: frame.sound_fx,
      dialogue: frame.dialogue,
      voice_ids: frame.voice_ids,
    });
    framePrompt = compiled.prompt;
    // Inject camera command from scene descriptor into the prompt for V3
    if (compiled.cameraCmd && compiled.cameraCmd !== '[Static]') {
      framePrompt += ` ${compiled.cameraCmd}`;
    }
  } else if (frame.emotion || frame.shot_size || frame.atmosphere || frame.pacing || frame.genre || frame.character || frame.location) {
    // LEGACY: Flat fields + raw prompt → compose
    framePrompt = composePrompt(frame.prompt, {
      emotion: frame.emotion,
      shotSize: frame.shot_size,
      atmosphere: frame.atmosphere,
      pacing: frame.pacing,
      genre: frame.genre || opts.genre,
      character: frame.character,
      location: frame.location,
      wardrobe: frame.wardrobe,
      characterEmotions: frame.character_emotions,
      smart: false,
    });
    // Inject dialogue for legacy frames
    if (frameOpts.dialogue && frameOpts.voices && frameOpts.voices.length > 0) {
      const speakerToSlot = {};
      let slotIdx = 1;
      const dialogueLines = frameOpts.dialogue.map(line => {
        if (!speakerToSlot[line.character]) {
          speakerToSlot[line.character] = slotIdx++;
        }
        const slot = speakerToSlot[line.character];
        const emotionVoice = EMOTION_MAP[line.emotion]?.voice || '';
        return `<<<voice_${slot}>>> says "${line.text}" ${emotionVoice ? `[${emotionVoice}]` : ''}`;
      }).join('\n');
      framePrompt = framePrompt + '\n\n' + dialogueLines;
    }
  } else if (opts.smart) {
    framePrompt = composePrompt(frame.prompt, { smart: true, genre: opts.genre });
  } else {
    framePrompt = frame.prompt;
  }

  // Enable native audio when sound_fx or dialogue present
  if (frame.sound_fx && frame.sound_fx.length > 0) {
    frameOpts.audioEnabled = true;
  }

  // Build submit function — routing hierarchy:
  //   1. Effects → effects endpoint
  //   2. Any frame with elements, ref_images, end_frame, or dialogue → Omni
  //      (Omni is the unified endpoint: image refs + elements + first/end frame + voice_ids)
  //   3. Bare frame (no refs, no end frame, no dialogue) → standard image2video
  let submitFn;
  const hasElements = frame.elements && frame.elements.length > 0;
  const hasRefImages = frame.ref_images && frame.ref_images.length > 0;
  const hasEndFrame = !!frame.end_frame;
  const hasDialogue = frame.has_dialogue && frameOpts.voices && frameOpts.voices.length > 0;
  const useOmni = hasElements || hasRefImages || hasEndFrame || hasDialogue;

  if (frame.effect) {
    submitFn = () => submitWithEffects(frame.effect, frame.image, framePrompt, frameOpts);
  } else if (useOmni) {
    // Omni endpoint — single injection for everything:
    // image refs, elements, first+end frame, voice_ids, dialogue
    frameOpts.elements = frame.elements || [];
    frameOpts.refImages = frame.ref_images || [];
    frameOpts.image = frame.image;
    if (hasEndFrame) {
      frameOpts.startFrame = frame.image;
      frameOpts.endFrame = frame.end_frame;
    }
    submitFn = () => submitOmniVideo(framePrompt, frameOpts);
  } else {
    // Standard image-to-video (bare frame, no refs)
    submitFn = () => submitImageToVideo(frame.image, framePrompt, frameOpts);
  }

  return { clipName, frameOpts, submitFn, title: frame.title || clipName };
}

// ── Parallel Wave Generation ─────────────────────────────────────────────

const WAVE_SIZE = 5; // Kling allows 5 concurrent tasks

async function generateFromStoryboard(storyboardPath, outputDir, opts) {
  const config = JSON.parse(fs.readFileSync(storyboardPath, 'utf-8'));
  const frames = config.frames;

  console.log(`\n========================================`);
  console.log(`  Kling AI Video Generation Pipeline`);
  console.log(`  ${frames.length} frames (waves of ${WAVE_SIZE})`);
  console.log(`========================================\n`);

  fs.mkdirSync(outputDir, { recursive: true });
  const clipPaths = new Array(frames.length).fill(null);

  // Prepare all frames
  const prepared = frames.map((frame, i) => ({ ...prepareFrame(frame, i, opts), index: i }));

  // Filter out already-generated clips
  const pending = prepared.filter(p => {
    const outputPath = path.join(outputDir, `${p.clipName}.mp4`);
    if (fs.existsSync(outputPath)) {
      console.log(`[SKIP] ${p.clipName}.mp4 already exists`);
      clipPaths[p.index] = { path: outputPath, title: p.title };
      return false;
    }
    return true;
  });

  console.log(`\n${pending.length} clips to generate, ${frames.length - pending.length} already exist\n`);

  // Process in waves of WAVE_SIZE
  for (let waveStart = 0; waveStart < pending.length; waveStart += WAVE_SIZE) {
    const wave = pending.slice(waveStart, waveStart + WAVE_SIZE);
    const waveNum = Math.floor(waveStart / WAVE_SIZE) + 1;
    const totalWaves = Math.ceil(pending.length / WAVE_SIZE);

    console.log(`\n═══ WAVE ${waveNum}/${totalWaves} — Submitting ${wave.length} clips ═══\n`);

    // Phase 1: Submit all tasks in this wave
    const tasks = [];
    for (const item of wave) {
      console.log(`  [SUBMIT] Frame ${item.index + 1}: ${item.title}`);
      try {
        const { taskId, pollEndpoint } = await item.submitFn();
        tasks.push({ ...item, taskId, pollEndpoint, status: 'submitted' });
        console.log(`  [OK] Task ${taskId}`);
        // 1s delay between submissions to avoid rate limit
        await new Promise(r => setTimeout(r, 1000));
      } catch (err) {
        console.error(`  [ERROR] Frame ${item.index + 1} submit failed: ${err.message}`);
        tasks.push({ ...item, taskId: null, status: 'failed', error: err.message });
      }
    }

    // Phase 2: Poll all tasks in parallel until all complete
    const activeTasks = tasks.filter(t => t.taskId);
    const completed = new Set();
    let pollRound = 0;

    console.log(`\n  [POLL] Waiting for ${activeTasks.length} clips...`);

    while (completed.size < activeTasks.length) {
      pollRound++;
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));

      for (const task of activeTasks) {
        if (completed.has(task.taskId)) continue;

        try {
          const pollPath = `${task.pollEndpoint}/${task.taskId}`;
          const res = await makeRequest('GET', pollPath, null, task.frameOpts);
          const taskData = res.data.data || res.data;
          const status = taskData.task_status || taskData.status;

          if (status === 'succeed' || status === 'completed' || status === 'Success') {
            completed.add(task.taskId);
            const downloadUrl = extractVideoUrl(taskData);
            const outputPath = path.join(outputDir, `${task.clipName}.mp4`);

            if (downloadUrl) {
              await downloadFile(downloadUrl, outputPath);
              const stats = fs.statSync(outputPath);
              console.log(`  [DONE] ${task.clipName} — ${task.title} (${(stats.size / 1024).toFixed(0)}KB)`);
              clipPaths[task.index] = { path: outputPath, title: task.title };
            } else {
              console.error(`  [ERROR] ${task.clipName} — no download URL`);
            }
          } else if (status === 'failed' || status === 'Fail') {
            completed.add(task.taskId);
            console.error(`  [FAILED] ${task.clipName} — ${taskData.task_status_msg || 'unknown error'}`);
          }
        } catch (pollErr) {
          // Polling errors are transient — continue
        }
      }

      const elapsed = (pollRound * POLL_INTERVAL_MS / 1000).toFixed(0);
      const doneCount = completed.size;
      process.stdout.write(`\r  [POLL] ${doneCount}/${activeTasks.length} complete (${elapsed}s elapsed)  `);
    }

    console.log(`\n  [WAVE ${waveNum} DONE] ${completed.size}/${wave.length} clips generated\n`);
  }

  const successCount = clipPaths.filter(Boolean).length;
  console.log(`\n[DONE] ${successCount}/${frames.length} clips generated in ${outputDir}`);

  const manifest = {
    clips: clipPaths.filter(Boolean),
    crossfade: opts.crossfade,
    generated: new Date().toISOString(),
    provider: 'kling',
  };
  const manifestPath = path.join(outputDir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`[OK] Manifest saved: ${manifestPath}`);

  return clipPaths.filter(Boolean);
}

// ── Stitch Clips ───────────────────────────────────────────────────────────

async function stitchClips(clipsDir, outputPath, opts) {
  const { execSync } = require('child_process');

  try { execSync('which ffmpeg', { stdio: 'pipe' }); }
  catch { throw new Error('ffmpeg not found. Install with: brew install ffmpeg'); }

  let clips = [];
  const manifestPath = path.join(clipsDir, 'manifest.json');

  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    clips = manifest.clips;
  } else {
    clips = fs.readdirSync(clipsDir)
      .filter(f => f.match(/^clip_\d+\.mp4$/))
      .sort()
      .map(f => ({ path: path.join(clipsDir, f) }));
  }

  if (clips.length === 0) throw new Error(`No clips found in ${clipsDir}`);

  console.log(`\n[...] Stitching ${clips.length} clips (hard cuts — cinema style)...`);

  const concatFile = path.join(clipsDir, '_concat.txt');
  const concatContent = clips.map(c => `file '${c.path}'`).join('\n');
  fs.writeFileSync(concatFile, concatContent);

  if (opts.crossfade > 0 && clips.length > 1) {
    let inputs = clips.map((c) => `-i "${c.path}"`).join(' ');
    let filterParts = [];
    let lastLabel = '[0:v]';

    for (let i = 1; i < clips.length; i++) {
      const outLabel = i === clips.length - 1 ? '[vout]' : `[v${i}]`;
      filterParts.push(
        `${lastLabel}[${i}:v]xfade=transition=fade:duration=${opts.crossfade}:offset=${i * opts.duration - opts.crossfade * i}${outLabel}`
      );
      lastLabel = outLabel;
    }

    const filter = filterParts.join(';');
    const cmd = `ffmpeg -y ${inputs} -filter_complex "${filter}" -map "[vout]" -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p "${outputPath}"`;

    try {
      execSync(cmd, { stdio: 'inherit' });
    } catch {
      console.log('[WARN] Crossfade failed, falling back to concat...');
      const simpleCmd = `ffmpeg -y -f concat -safe 0 -i "${concatFile}" -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p "${outputPath}"`;
      execSync(simpleCmd, { stdio: 'inherit' });
    }
  } else {
    const cmd = `ffmpeg -y -f concat -safe 0 -i "${concatFile}" -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p "${outputPath}"`;
    execSync(cmd, { stdio: 'inherit' });
  }

  fs.unlinkSync(concatFile);

  const stats = fs.statSync(outputPath);
  console.log(`\n[DONE] Final video: ${outputPath} (${(stats.size / 1024 / 1024).toFixed(1)}MB)`);
  return outputPath;
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs();

  // Auth check (not needed for stitch or list-models)
  if ((!opts.accessKey || !opts.secretKey) && !opts.stitch && !opts.listModels) {
    console.error('[ERROR] Missing Kling credentials. Set KLING_ACCESS_KEY and KLING_SECRET_KEY env vars.');
    process.exit(1);
  }

  // Prompt composition: enrich with emotion, atmosphere, shot size, pacing, genre
  const hasCompositionInput = opts.smart || opts.emotion || opts.shotSize || opts.atmosphere || opts.pacing || opts.genre || opts.character || opts.location;
  if (hasCompositionInput && opts.prompt) {
    opts.prompt = composePrompt(opts.prompt, {
      emotion: opts.emotion,
      shotSize: opts.shotSize,
      atmosphere: opts.atmosphere,
      pacing: opts.pacing,
      genre: opts.genre,
      character: opts.character,
      location: opts.location,
      smart: opts.smart,
    });
  }

  // Smart mode: analyze prompt and auto-tune settings (audio, camera, duration, tier)
  if (opts.smart && opts.prompt) {
    const analysis = analyzePrompt(opts.prompt);
    applySmartDefaults(opts, analysis);
  }

  // Log tier/model if generating
  if (!opts.elementsMode && !opts.effectsMode && !opts.motionsMode && !opts.stitch) {
    const tierLabel = opts.tier || (opts.model ? `model:${opts.model}` : DEFAULT_TIER);
    const tier = MODEL_TIERS[tierLabel] || MODEL_TIERS[DEFAULT_TIER];
    if (tier && !opts.effectsMode) {
      console.log(`[TIER] ${tierLabel} — ${tier.description}`);
    }
  }

  try {
    // ── Element Management ──────────────────────────────────────────────
    if (opts.elementsMode) {
      if (opts.elementsCreate) {
        await createElement(opts);
      } else if (opts.elementsList) {
        await listElementsApi(opts);
      } else if (opts.elementsGet) {
        await getElement(opts.elementsGet, opts);
      } else if (opts.elementsDelete) {
        await deleteElement(opts.elementsDelete, opts);
      } else {
        console.error('[ERROR] --elements requires --create, --list, --get <id>, or --delete <id>');
        process.exit(1);
      }
      return;
    }

    // ── Effects ─────────────────────────────────────────────────────────
    if (opts.effectsMode) {
      if (opts.effectsList) {
        await listEffects(opts);
      } else if (opts.effectsApply) {
        if (!opts.image) { console.error('[ERROR] --apply requires --image'); process.exit(1); }
        const outputDir = opts.output || path.dirname(opts.image);
        fs.mkdirSync(outputDir, { recursive: true });
        const baseName = path.basename(opts.image, path.extname(opts.image));
        await generateClip(opts, () => submitWithEffects(opts.effectsApply, opts.image, opts.prompt, opts), outputDir, `${baseName}_${opts.effectsApply}`);
      } else {
        console.error('[ERROR] --effects requires --list or --apply <name>');
        process.exit(1);
      }
      return;
    }

    // ── Motion Presets List ─────────────────────────────────────────────
    if (opts.motionsMode && opts.motionsList) {
      await listMotions(opts);
      return;
    }

    // ── Motion Control ──────────────────────────────────────────────────
    if (opts.motionMode) {
      if (!opts.image) { console.error('[ERROR] --motion requires --image'); process.exit(1); }
      if (!opts.motionUrl) { console.error('[ERROR] --motion requires --motion-url'); process.exit(1); }
      const outputDir = opts.output || path.dirname(opts.image);
      fs.mkdirSync(outputDir, { recursive: true });
      const baseName = path.basename(opts.image, path.extname(opts.image));
      await generateClip(opts, () => submitMotionCreate(opts.image, opts.motionUrl, opts.prompt, opts), outputDir, `${baseName}_motion`);
      return;
    }

    // ── Add Sound ───────────────────────────────────────────────────────
    if (opts.addSoundMode) {
      if (!opts.video) { console.error('[ERROR] --add-sound requires --video'); process.exit(1); }
      const outputDir = opts.output || path.dirname(opts.video);
      fs.mkdirSync(outputDir, { recursive: true });
      const baseName = path.basename(opts.video, path.extname(opts.video));
      await generateClip(opts, () => submitAddSound(opts.video, opts), outputDir, `${baseName}_sound`);
      return;
    }

    // ── List Voices ──────────────────────────────────────────────────────
    if (opts.listVoices) {
      console.log('\nKling Voice Catalog (for --lip-sync-text and Omni voice_ids)\n');
      console.log('KEY                  ID                          GENDER  AGE      DESCRIPTION');
      console.log('─'.repeat(100));
      for (const [key, v] of Object.entries(VOICE_CATALOG)) {
        console.log(`${key.padEnd(20)} ${v.id.padEnd(27)} ${v.gender.padEnd(7)} ${v.age.padEnd(8)} ${v.desc}`);
      }
      console.log(`\nUsage:  --lip-sync-text --video-id <id> --text "..." --voice-id <KEY or ID> --voice-lang en`);
      console.log(`  Or:   --voice <KEY or ID>  (for Omni endpoint with <<<voice_1>>> in prompt)\n`);
      return;
    }

    // ── Lip Sync (audio2video — existing) ───────────────────────────────
    if (opts.lipSync) {
      if (!opts.video || !opts.audio) { console.error('[ERROR] --lip-sync requires --video and --audio'); process.exit(1); }
      const outputDir = opts.output || path.dirname(opts.video);
      fs.mkdirSync(outputDir, { recursive: true });
      const baseName = path.basename(opts.video, path.extname(opts.video));
      await generateClip(opts, () => submitLipSync(opts.video, opts.audio, opts), outputDir, `${baseName}_lipsync`);
      return;
    }

    // ── Lip Sync Text (text2video — Kling generates voice + syncs mouth) ─
    if (opts.lipSyncText) {
      const videoRef = opts.videoId || opts.video;
      if (!videoRef) { console.error('[ERROR] --lip-sync-text requires --video-id <kling_video_id> or --video <url>'); process.exit(1); }
      if (!opts.text && !opts.prompt) { console.error('[ERROR] --lip-sync-text requires --text "dialogue line"'); process.exit(1); }
      if (!opts.voiceId) { console.error('[ERROR] --lip-sync-text requires --voice-id <id>'); process.exit(1); }
      const text = opts.text || opts.prompt;
      const outputDir = opts.output || '.';
      fs.mkdirSync(outputDir, { recursive: true });
      const baseName = `lipsync_${Date.now()}`;
      await generateClip(opts, () => submitLipSyncText(videoRef, text, opts.voiceId, opts), outputDir, baseName);
      return;
    }

    // ── Virtual Try-On (Kolors) ─────────────────────────────────────────
    // NEVER auto-called. Only when user explicitly asks to change wardrobe.
    // Pre-production: generate wardrobe variant ref from character sheet + garment
    // Post-production: change outfit on a generated frame/still
    if (opts.tryOn) {
      if (!opts.image) { console.error('[ERROR] --try-on requires --image (person image)'); process.exit(1); }
      if (!opts.garment) { console.error('[ERROR] --try-on requires --garment (clothing image)'); process.exit(1); }
      const outputDir = opts.output || path.dirname(opts.image);
      fs.mkdirSync(outputDir, { recursive: true });
      const baseName = path.basename(opts.image, path.extname(opts.image));
      const garmentName = path.basename(opts.garment, path.extname(opts.garment));
      await generateClip(opts, () => submitTryOn(opts.image, opts.garment, opts), outputDir, `${baseName}_tryon_${garmentName}`);
      return;
    }

    // ── Stitch ──────────────────────────────────────────────────────────
    if (opts.stitch) {
      if (!opts.output) { console.error('[ERROR] --output <final.mp4> required for stitch mode'); process.exit(1); }
      await stitchClips(opts.stitch, opts.output, opts);
      return;
    }

    // ── Multi-Shot ──────────────────────────────────────────────────────
    if (opts.multiShot) {
      if (!opts.shotsFile) { console.error('[ERROR] --multi-shot requires --shots <config.json>'); process.exit(1); }
      const shotsConfig = JSON.parse(fs.readFileSync(opts.shotsFile, 'utf-8'));
      const outputDir = opts.output || path.dirname(opts.shotsFile);
      fs.mkdirSync(outputDir, { recursive: true });
      const baseName = path.basename(opts.shotsFile, path.extname(opts.shotsFile));
      await generateClip(opts, () => submitMultiShot(shotsConfig, opts), outputDir, `${baseName}_multishot`);
      return;
    }

    // ── Video Extension ─────────────────────────────────────────────────
    if (opts.extendMode) {
      if (!opts.extendTaskId) { console.error('[ERROR] --extend requires --task-id <id>'); process.exit(1); }
      const outputDir = opts.output || '.';
      fs.mkdirSync(outputDir, { recursive: true });
      await generateClip(opts, () => submitVideoExtend(opts.extendTaskId, opts.prompt, opts), outputDir, `extend_${opts.extendTaskId}`);
      return;
    }

    // ── Storyboard ──────────────────────────────────────────────────────
    if (opts.storyboard) {
      const outputDir = opts.output || path.join(path.dirname(opts.storyboard), 'clips');
      await generateFromStoryboard(opts.storyboard, outputDir, opts);
      return;
    }

    // ── Frame-to-Frame (first + end frame) ──────────────────────────────
    if (opts.startFrame) {
      const outputDir = opts.output || path.dirname(opts.startFrame);
      fs.mkdirSync(outputDir, { recursive: true });
      const baseName = path.basename(opts.startFrame, path.extname(opts.startFrame));
      await generateClip(opts, () => submitFrameToFrame(opts.startFrame, opts.endFrame, opts.prompt, opts), outputDir, `${baseName}_f2f`);
      return;
    }

    // ── Omni Mode ───────────────────────────────────────────────────────
    if (opts.omniMode) {
      const outputDir = opts.output || '.';
      fs.mkdirSync(outputDir, { recursive: true });
      const clipName = opts.image ? path.basename(opts.image, path.extname(opts.image)) + '_omni' : `omni_${Date.now()}`;
      await generateClip(opts, () => submitOmniVideo(opts.prompt, opts), outputDir, clipName);
      return;
    }

    // ── Text-to-Video ───────────────────────────────────────────────────
    if (opts.text2video) {
      if (!opts.prompt) { console.error('[ERROR] --text2video requires --prompt'); process.exit(1); }
      const outputDir = opts.output || '.';
      fs.mkdirSync(outputDir, { recursive: true });
      await generateClip(opts, () => submitTextToVideo(opts.prompt, opts), outputDir, `t2v_${Date.now()}`);
      return;
    }

    // ── Standard Image-to-Video ─────────────────────────────────────────
    if (opts.image) {
      let prompt = opts.prompt;
      const outputDir = opts.output || path.dirname(opts.image);
      fs.mkdirSync(outputDir, { recursive: true });
      const baseName = path.basename(opts.image, path.extname(opts.image));
      await generateClip(opts, () => submitImageToVideo(opts.image, prompt, opts), outputDir, `${baseName}_video`);
      return;
    }

    // No mode selected
    printUsage();
    process.exit(1);

  } catch (err) {
    console.error(`\n[ERROR] ${err.message}`);
    process.exit(1);
  }
}

main();
