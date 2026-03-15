# Agent State — UGC Video Creation

Everything the agent needs to track from first message to final video.
Each `ready` flag tells the agent whether that piece is finalized.

---

## Top-Level State

```
VideoState {
  scriptId: string | null              // UUID — set after script generation, needed by every downstream endpoint
  teamId: number                       // set from session, never changes

  scenes: SceneObj[]                   // the storyboard
  character: CharacterObj | null       // null = product-only video (no avatar)
  voice: VoiceObj | null               // null = silent video (no TTS)

  videoType: "ugc" | "reaction" | "montage" | "nocharacter_montage"
  isSilent: boolean                    // true → skip TTS, ambientSound, captions
  targetAudience: string               // e.g. "Health-conscious women 25-40"
  productImageKeys: string[]           // S3 keys of uploaded product reference images
  userDirection: string                // original user prompt that started everything

  ready: boolean                       // all scenes ready + character ready (if needed) + voice ready (if needed)
}
```

### What sets each field

| Field | Set by |
|-------|--------|
| `scriptId` | `POST /ugc/generate-script-agent` response |
| `scenes` | script-agent result, then editable via storyboard-chat + inline edits |
| `character` | user picks from CharacterStep UI |
| `voice` | user picks from AudioStep UI |
| `videoType`, `isSilent`, `targetAudience` | `POST /ugc/init-structure` response |
| `productImageKeys` | user uploads during chat |
| `userDirection` | first user chat message |

---

## SceneObj

```
SceneObj {
  id: string                           // unique scene identifier (used as sceneId everywhere)
  sceneNumber: number                  // ordering (1-indexed)
  sceneTag: SceneType                  // "hook" | "problem" | "agitate" | "solution" | "demo" | "social-proof" | "testimonial" | "transformation" | "cta"
  type: "a-roll" | "b-roll"           // determines pipeline: a-roll → VEED avatar, b-roll → Kling product video
  emotion: Emotion                     // "excited" | "curious" | "confident" | etc. — used in TTS delivery + prompt grounding
  sceneDirection: string               // what happens in this scene (the "action" field)
  dialogue: string                     // voiceover text with emotion tags: "[excited] Hey guys..."
                                       //   empty string if silent
  duration: number                     // total scene duration in seconds
  cameraAngle: CameraAngle            // "pov-selfie" | "medium-shot" | "close-up" | "wide-shot" | "overhead" | "low-angle" | "custom"
  ambientSound: string | null          // REQUIRED for a-roll: "Recorded through iPhone mic — kitchen ambient"
                                       //   MUST be null for b-roll

  shots: ShotObj[]                     // a-roll scenes have 1 shot, b-roll scenes have 1-5 shots
  numShots: number                     // shots.length (convenience)

  ready: boolean                       // all shots have thumbnails selected
}
```

### What each downstream endpoint needs from a scene

| Endpoint | Fields consumed |
|----------|----------------|
| **Image gen** (`generate-all-scene-images`) | `id`, `sceneNumber`, `type` (as sceneType), `dialogue`, `sceneDirection` (as action), `emotion`, `shotType`, `cameraAngle`, `shots[].cinematicPrompt`, `shots[].action`, `shots[].durationSeconds` |
| **Video gen** (SQS job) | `id`, `sceneNumber`, `type` (as shotType), `dialogue`, `duration`, `emotion`, `sceneDirection` (as action), `ambientSound`, each shot's `imageKey` + `cinematicPrompt` + `action` + `durationSeconds` |
| **Storyboard chat** | all fields (sent as context summary to the agent) |

---

## ShotObj

A shot is a single continuous video clip within a scene.
- A-roll scenes have exactly 1 shot (the avatar talking).
- B-roll scenes have 1-5 shots (product montage).

Audio (dialogue, ambientSound) lives on the **scene**, not the shot — TTS generates
one audio track per scene, and for b-roll montages that single track plays over all shots.

```
ShotObj {
  action: string                       // what physically happens: "Close-up of hands opening product box"
                                       //   THIS IS THE PRIMARY FIELD — cinematicPrompt is regenerated from it at video gen time
  cinematicPrompt: string              // camera movement + visual progression for Kling/VEED
                                       //   NOTE: overwritten by backend right before video gen via
                                       //   regenerateCinematicPrompt(action) — so `action` is the source of truth
  duration: number                     // seconds this shot lasts within the scene

  thumbnail: {                         // the selected first-frame image
    imageKey: string | null            // S3 key — needed by video gen
    imageUrl: string | null            // presigned URL — for display only
    generatedImages: Array<{           // all candidate images from generation (typically 1 per shot)
      key: string
      url: string
      index: number
    }> | null
    status: "idle" | "generating" | "completed" | "failed"
    jobId: string | null               // generation job UUID for polling
  }

  shotType: "CHARACTER" | "PRODUCT" | "CHARACTER_AND_PRODUCT"  // determines prompt modifiers
  productImageNeeded: boolean          // whether product reference image should be composited

  ready: boolean                       // thumbnail.imageKey is set
}
```

### How shot data flows to video generation

For **a-roll** (single shot per scene):
```
shot.thumbnail.imageKey  → scene.imageKey        (the avatar starting frame)
shot.action              → scene.action           (regenerated into cinematicPrompt by backend)
shot.duration            → scene.duration

scene.dialogue           → ElevenLabs TTS         (one audio for the scene)
scene.emotion            → TTS delivery + prompt grounding
scene.ambientSound       → ElevenLabs SFX         (background audio, a-roll only)
```

For **b-roll** (montage — multiple shots per scene):
```
scene.dialogue           → single TTS audio for entire scene (NOT per-shot)
scene.emotion            → TTS delivery

each shot becomes a bRollShots[] entry:
  shot.thumbnail.imageKey  → bRollShots[i].imageKey
  shot.action              → bRollShots[i].action  (regenerated into cinematicPrompt by backend)
  shot.duration            → bRollShots[i].durationSeconds
```

---

## CharacterObj

```
CharacterObj {
  id: number                           // characters.id — FK used by image gen + video gen
  name: string                         // display name
  gender: string | null                // "male" | "female"
  ageRange: string | null              // "25-35"
  appearanceConfig: object | null      // JSONB — hair color, ethnicity, eye color, body type, etc.
  primaryImageUrl: string | null       // avatar preview image for display

  ready: boolean                       // always true once selected (characters are pre-created)
}
```

### Where characterId is needed
- `POST /scene-builder/generate-all-scene-images` → `characterId` (required)
- Image gen prompts include appearance details for a-roll consistency
- NOT directly passed to video gen (images already encode the character)

---

## VoiceObj

```
VoiceObj {
  id: string                           // ElevenLabs voice ID — the actual identifier for TTS
  name: string                         // display name ("Sarah", "Marcus", etc.)
  previewUrl: string | null            // sample audio for the UI

  ready: boolean                       // always true once selected
}
```

### Where voiceId is needed
- `POST /ugc-video/generate` → `voiceId` (required unless silent)
- Worker calls `ElevenLabs.generateSpeech(voiceId, dialogue, speed)` per scene
- Default TTS speed: 1.0x (configurable via `ttsSpeed`)

---

## Derived / Auto-Generated (not in state)

These are produced automatically and don't need to be in the agent state:

| Data | When | How |
|------|------|-----|
| **cinematicPrompt** (final) | Right before video gen | Backend calls `regenerateCinematicPrompt(action)` via GPT for every scene + every b-roll shot. Overwrites what's stored in DB. So `action` is the real source of truth. |
| **Grounded cinematic prompt** | During video gen | OpenAI analyzes thumbnail + cinematicPrompt → grounded version that matches the actual image |
| **Captions** | After video gen | Deepgram transcribes final audio → `CaptionEntry[]` |
| **Prompt modifiers** | During video gen | Appended based on shotType (PRODUCT_NEGATIVE_PROMPT, SCREEN_STABILITY_MODIFIERS, etc.) |
| **Ambient audio track** | During video gen | ElevenLabs sound effects from `ambientSound` description text |
| **ttsSpeed** | Hardcoded | Currently defaults to 1.0 — not user-configurable yet, but the SQS job schema supports it |

---

## State Transitions (what the agent tracks)

```
1. CHAT PHASE
   state.scenes = []
   state.character = null
   state.voice = null
   → user describes video → init-structure returns structure blueprint
   → user accepts → videoType, isSilent, targetAudience set on state

2. CHARACTER SELECTION (if needed)
   state.character = null → user picks → state.character set (ready = true)

3. VOICE SELECTION (if !state.isSilent)
   state.voice = null → user picks → state.voice set (ready = true)

4. SCRIPT GENERATION
   structure + character + voice → script-agent
   → populates state.scenes[] with full shot data (dialogue, prompts, etc.)
   → state.scriptId set
   → auto-triggers image generation for all shots

5. EDITING PHASE (concurrent with image gen)
   - Chat messages → storyboard-agent → updates state.scenes
   - Inline edits → direct state.scenes mutation + debounced backend save
   - Image gen completes → shot.thumbnail populated

6. READY CHECK
   state.ready = every scene.ready (every shot has thumbnail)
                + character.ready (if needed)
                + voice.ready (if needed)

7. VIDEO GENERATION
   state → POST /ugc-video/generate
   → poll for completion
   → final video URL
```

---

## Mapping to Current Codebase Types

| State field | Current type | File |
|-------------|-------------|------|
| `SceneObj` | `UGCScene` | `frontend/components/ugc-studio/script/types.ts` |
| `ShotObj` (b-roll) | `BRollShot` | same file |
| `ShotObj` (images) | `SceneImageState` | `frontend/store/ugc.ts` |
| `CharacterObj` | `Character` | `frontend/components/ugc-studio/actors/types.ts` |
| `VoiceObj` | `Voice` | `frontend/config/voicesConfig.ts` |
| `VideoState` (partial) | spread across `useChatAgent` + Jotai atoms | `frontend/store/ugc.ts` + `useChatAgent.ts` |
