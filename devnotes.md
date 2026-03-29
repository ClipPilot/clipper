# Dev Notes: Multi-Character UGC Video Generation

Max 4 characters per script (practically 1-2 most of the time).

## Schema Decision: `ugc_scripts` table

We added two new nullable JSONB columns alongside the existing single-character columns:

| Column | Type | Purpose |
|--------|------|---------|
| `character_id` | `integer` (FK) | **Legacy** single-character reference. Always populated. |
| `characters_config` | `jsonb` | **New** multi-character config. Only populated when 2+ characters. |
| `voice_id` (on `ugc_video_generation_jobs`) | `varchar` | **Legacy** single voice. Always populated with primary voice. |
| `voice_config` (on `ugc_video_generation_jobs`) | `jsonb` | **New** per-character voice mapping. Only populated when 2+ characters. |

## How `character_id` and `characters_config` relate

**Single-character video (ugc, reaction, montage):**
- `character_id` = the selected character
- `characters_config` = `null` (not needed)

**Multi-character video (podcast, 2-3 actors):**
- `character_id` = first character's ID (index 0) — keeps backward compat for any code that reads this field
- `characters_config` = full array:
  ```json
  [
    { "characterId": 42, "voiceId": "voice_abc", "role": "host" },
    { "characterId": 78, "voiceId": "voice_xyz", "role": "guest" }
  ]
  ```

So yes, `character_id` always matches `characters_config[0].characterId`. This means legacy code that only reads `character_id` will still get a valid character (the primary/first one) without breaking.

## How scenes reference characters

The agent output assigns a `characterIndex` (0, 1, or 2) per scene and per shot. This is an index into the `characters_config` array.

Example script with 2 characters:

```json
{
  "characters_config": [
    { "characterId": 42, "voiceId": "voice_abc" },
    { "characterId": 78, "voiceId": "voice_xyz" }
  ],
  "scripts_data": [
    {
      "scenes": [
        {
          "sceneNumber": 1,
          "sceneType": "a-roll",
          "characterIndex": 0,
          "dialogue": "[excited] Welcome to the show!",
          "slug": "Host Intro"
        },
        {
          "sceneNumber": 2,
          "sceneType": "a-roll",
          "characterIndex": 1,
          "dialogue": "[sincere] Thanks for having me!",
          "slug": "Guest Reply"
        },
        {
          "sceneNumber": 3,
          "sceneType": "b-roll",
          "characterIndex": 0,
          "dialogue": "[curious] Let me show you what we built...",
          "shots": [
            { "shotType": "CHARACTER_AND_PRODUCT", "characterIndex": 0 },
            { "shotType": "PRODUCT", "characterIndex": null },
            { "shotType": "CHARACTER", "characterIndex": 1 }
          ]
        }
      ]
    }
  ]
}
```

## Resolution at each pipeline stage

1. **Scene image generation**: `characterIndex` resolved to `characterId` via `characters_config[i].characterId`. Passed to `sceneImageGenerationJobs.character_id` (already per-scene).
2. **Video generation (a-roll)**: `characterIndex` resolved to `voiceId` via `characters_config[i].voiceId`. Each a-roll scene gets its character's voice for TTS + lip-sync.
3. **Video generation (b-roll shots)**: Shot-level `characterIndex` determines which character's reference image is used. Defaults to scene-level `characterIndex` if omitted.

## Reading logic

```
if (characters_config !== null) {
  // multi-character path — use characters_config array + per-scene characterIndex
} else {
  // single-character path — use character_id + voice_id as before
}
```
