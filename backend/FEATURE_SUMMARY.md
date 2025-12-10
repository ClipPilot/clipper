# Video Clipping API - Feature Summary

## Complete Feature List

The `/clip-video` endpoint now supports comprehensive video clipping with AI-powered clip selection and customization.

## All Supported Parameters

| Parameter | Type | Default | Options/Range | Description |
|-----------|------|---------|---------------|-------------|
| `video` | File | **Required** | mp4, mov, avi, mkv, webm (max 500MB) | The video file to process |
| `length` | Integer | `40` | 10-120 seconds | Total duration of the final clip |
| `hookLength` | Integer | `6` | 2-15 seconds | Duration of the attention-grabbing hook |
| `promptType` | String | `"business"` | `"business"` or `"viral"` | AI prompt style for clip selection |
| `customPrompt` | String | None | Any text | Custom instructions to guide AI clip selection |
| `customText` | String | None | Any text | Text overlay to display on the video |
| `textPosition` | String | `"top"` | `"top"` or `"bottom"` | Position of the text overlay |

## Quick Examples

### 1. Minimal Request (All Defaults)
```bash
curl -X POST http://localhost:3000/clip-video \
  -F "video=@video.mp4"
```
Result: 40s clip, 6s hook, business prompt, no text overlay

### 2. Viral Clip with Text
```bash
curl -X POST http://localhost:3000/clip-video \
  -F "video=@stream.mp4" \
  -F "promptType=viral" \
  -F "customText=🔥 EPIC MOMENT 🔥"
```
Result: 40s viral clip with top text overlay

### 3. Custom Length Business Clip
```bash
curl -X POST http://localhost:3000/clip-video \
  -F "video=@demo.mp4" \
  -F "length=30" \
  -F "hookLength=5" \
  -F "promptType=business" \
  -F "customText=NEW PRODUCT 🚀" \
  -F "textPosition=bottom"
```
Result: 30s business clip with bottom text

### 4. Fully Customized
```bash
curl -X POST http://localhost:3000/clip-video \
  -F "video=@video.mp4" \
  -F "length=45" \
  -F "hookLength=8" \
  -F "promptType=viral" \
  -F "customPrompt=Focus on the funniest moments, avoid setup" \
  -F "customText=😂 TOO FUNNY 😂" \
  -F "textPosition=top"
```
Result: Fully customized 45s viral clip

## Response Format

```json
{
  "clipPath": "/output/combined.mp4",
  "clipSuggestions": {
    "hook": {
      "start": 45.2,
      "end": 51.2,
      "text": "Most engaging moment"
    },
    "main": [
      {
        "start": 12.5,
        "end": 25.8,
        "text": "Supporting content"
      }
    ]
  },
  "parameters": {
    "length": 40,
    "hookLength": 6,
    "promptType": "business"
  }
}
```

## Feature Breakdown

### 1. File Upload
- Upload any video file directly
- Supports multiple formats
- Automatic file cleanup
- Max 500MB file size

### 2. Customizable Clip Length
- Choose total clip duration (10-120s)
- Adjust hook length independently (2-15s)
- Main content fills remaining time

### 3. Dual AI Prompts

**Business Prompt**
- Product demos
- Educational content
- Professional presentations
- Structured: Hook → Context → Demo → Closing

**Viral Prompt**
- Stream highlights
- Funny moments
- Reactions and energy
- Focus: Engagement and shareability

### 4. Custom AI Instructions
- Add specific guidance for clip selection
- Examples:
  - "Focus on funny moments"
  - "Highlight product features"
  - "Avoid technical jargon"
  - "Find the most epic fail"

### 5. Text Overlays
- Add custom text to your video
- Position at top or bottom
- Perfect for CTAs or branding
- Use emojis for engagement

## Use Cases

### Product Launch Video
```javascript
{
  video: file,
  promptType: "business",
  length: 40,
  hookLength: 6,
  customText: "🚀 NEW PRODUCT ALERT 🚀",
  textPosition: "top"
}
```

### Gaming Stream Highlight
```javascript
{
  video: file,
  promptType: "viral",
  length: 35,
  hookLength: 8,
  customPrompt: "Find the most epic or funny moment",
  customText: "🎮 INSANE PLAY 🎮"
}
```

### Educational Tutorial
```javascript
{
  video: file,
  promptType: "business",
  length: 45,
  customPrompt: "Focus on the key learning points",
  customText: "🎯 PRO TIP"
}
```

### Podcast Highlight
```javascript
{
  video: file,
  promptType: "viral",
  length: 40,
  hookLength: 5,
  customPrompt: "Find the most controversial or thought-provoking statement",
  customText: "💡 MIND BLOWN"
}
```

## Technical Details

### Processing Flow
1. **Upload**: Receive and validate video file
2. **Transcribe**: Extract audio and transcribe with Deepgram
3. **Analyze**: AI analyzes transcript based on prompt type
4. **Select**: AI identifies best hook and main content clips
5. **Cut**: Extract individual clips from original video
6. **Merge**: Combine clips into final video
7. **Overlay**: Add text overlay if specified
8. **Cleanup**: Remove temporary files
9. **Return**: Provide clip path and metadata

### File Management
- Uploads saved to `uploads/` directory
- Temporary clips in `output/` directory
- Source file deleted after processing
- Temp files cleaned up after merge
- Final output kept in `output/`

### Performance
- Processing time: 1-3 minutes for 5-10 min video
- Depends on file size and video length
- Transcription is the longest step
- Concurrent requests supported

## API Documentation

- **Swagger UI**: `http://localhost:3000/api-docs`
- **Text Overlay Guide**: `TEXT_OVERLAY_GUIDE.md`
- **Quick Start**: `QUICK_START.md` (if available)

## Testing

### Test with curl
```bash
curl -X POST http://localhost:3000/clip-video \
  -F "video=@test.mp4" \
  -F "promptType=viral" \
  -F "customText=TEST"
```

### Test with Postman
1. POST to `http://localhost:3000/clip-video`
2. Body → form-data
3. Add `video` (file) and parameters (text)
4. Send request

### Test with Swagger
1. Open `http://localhost:3000/api-docs`
2. Find `/clip-video` endpoint
3. Click "Try it out"
4. Upload file and set parameters
5. Execute

## Common Patterns

### Maximum Customization
Use all parameters for complete control:
```bash
-F "video=@video.mp4"
-F "length=45"
-F "hookLength=8"
-F "promptType=viral"
-F "customPrompt=Your specific instructions"
-F "customText=Your overlay text"
-F "textPosition=top"
```

### Quick Viral Clip
Minimal config for viral content:
```bash
-F "video=@stream.mp4"
-F "promptType=viral"
-F "customText=🔥 EPIC 🔥"
```

### Professional Business Clip
Business content with branding:
```bash
-F "video=@demo.mp4"
-F "promptType=business"
-F "customText=BRAND NAME | NEW FEATURE"
-F "textPosition=bottom"
```

## Error Handling

The API validates all parameters and returns clear error messages:

- Missing video: `"No video file uploaded"`
- Invalid length: `"Length must be between 10 and 120 seconds"`
- Invalid hook: `"Hook length must be between 2 and 15 seconds"`
- Invalid prompt type: `"Prompt type must be either 'business' or 'viral'"`
- Invalid text position: `"Text position must be either 'top' or 'bottom'"`
- Transcription issues: `"Transcription failed"`
- AI issues: `"Failed to generate clip suggestions"`

## Future Enhancements

Potential upcoming features:
- Multiple text overlays
- Custom fonts and colors
- Animated text effects
- Stickers and graphics
- Background music
- Batch processing
- Webhook callbacks
- Cloud storage integration
