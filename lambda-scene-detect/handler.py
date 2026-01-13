import json
import os
import re
import tempfile
import subprocess
import boto3
import cv2
import numpy as np
from typing import List, Dict, Any, Tuple
from urllib.parse import urlparse

s3_client = boto3.client('s3')

# Scene detection configuration
SCENE_CONFIG = {
    'threshold': 30.0,           # Mean frame difference threshold for scene change
    'min_scene_length': 0.5,     # Minimum scene duration in seconds
    'sample_fps': 8,             # Frames per second to analyze
    'frame_width': 320,          # Downscale width for faster processing
    'frame_height': 180,         # Downscale height for faster processing
}

# Silence detection configuration (for finding speech pauses)
SILENCE_CONFIG = {
    'noise_threshold': -35,      # dB threshold below which audio is considered silent
    'min_silence_duration': 0.15, # Minimum silence duration to detect (150ms = typical word gap)
}


def download_from_s3(bucket: str, key: str, local_path: str) -> None:
    """Download a file from S3 to local path."""
    print(f"[SCENE-DETECT] Downloading s3://{bucket}/{key}")
    s3_client.download_file(bucket, key, local_path)


def download_from_s3_url(s3_url: str, local_path: str) -> None:
    """Download from S3 URL (s3:// or https://) to local path."""
    parsed = urlparse(s3_url)
    if parsed.scheme == 's3':
        bucket = parsed.netloc
        key = parsed.path.lstrip('/')
    else:
        # Handle https://bucket.s3.region.amazonaws.com/key format
        parts = parsed.netloc.split('.')
        bucket = parts[0]
        key = parsed.path.lstrip('/')

    download_from_s3(bucket, key, local_path)


def get_video_info(video_path: str) -> Tuple[float, float]:
    """Get video duration and FPS using ffmpeg."""
    cmd = ['ffmpeg', '-i', video_path, '-f', 'null', '-']
    result = subprocess.run(cmd, capture_output=True, text=True)
    stderr = result.stderr

    duration = 0.0
    fps = 30.0

    duration_match = re.search(r'Duration: (\d+):(\d+):(\d+)\.(\d+)', stderr)
    if duration_match:
        h, m, s, ms = duration_match.groups()
        duration = int(h) * 3600 + int(m) * 60 + int(s) + int(ms) / 100

    fps_match = re.search(r'(\d+(?:\.\d+)?)\s*fps', stderr)
    if fps_match:
        fps = float(fps_match.group(1))

    return duration, fps


def detect_silence_points(
    video_path: str,
    noise_threshold: float = -35,
    min_silence_duration: float = 0.15
) -> List[Dict[str, float]]:
    """
    Detect silence/pause points in video audio using FFmpeg silencedetect.

    These points represent natural speech pauses where it's safe to cut
    without interrupting words.

    Args:
        video_path: Path to the video file
        noise_threshold: dB level below which audio is considered silent (-35dB works well for speech)
        min_silence_duration: Minimum duration of silence to detect (0.15s catches word gaps)

    Returns:
        List of silence periods with start, end, and midpoint (best cut point)
    """
    print(f"[SILENCE-DETECT] Detecting silence points (threshold: {noise_threshold}dB, min duration: {min_silence_duration}s)")

    cmd = [
        'ffmpeg', '-i', video_path,
        '-af', f'silencedetect=noise={noise_threshold}dB:d={min_silence_duration}',
        '-f', 'null', '-'
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)
    stderr = result.stderr

    silence_points = []
    current_start = None

    for line in stderr.split('\n'):
        # Parse silence_start events
        start_match = re.search(r'silence_start:\s*([\d.]+)', line)
        if start_match:
            current_start = float(start_match.group(1))

        # Parse silence_end events
        end_match = re.search(r'silence_end:\s*([\d.]+)', line)
        if end_match and current_start is not None:
            end_time = float(end_match.group(1))
            duration = end_time - current_start

            # The midpoint of silence is the ideal cut point
            midpoint = current_start + (duration / 2)

            silence_points.append({
                'start': round(current_start, 3),
                'end': round(end_time, 3),
                'duration': round(duration, 3),
                'midpoint': round(midpoint, 3)  # Best point to cut
            })
            current_start = None

    print(f"[SILENCE-DETECT] Found {len(silence_points)} silence points")
    return silence_points


def detect_scene_changes(
    video_path: str,
    threshold: float = 30.0,
    min_scene_length: float = 0.5,
    sample_fps: float = 8.0,
    context: Any = None
) -> List[Dict[str, float]]:
    """
    Detect scene changes in a video by analyzing frame differences.

    Args:
        video_path: Path to the video file
        threshold: Mean pixel difference threshold for scene change detection
        min_scene_length: Minimum scene length in seconds
        sample_fps: Frames per second to sample
        context: Lambda context for keep-alive logging

    Returns:
        List of scenes with start/end timestamps
    """
    video = cv2.VideoCapture(video_path)

    if not video.isOpened():
        raise RuntimeError(f"Could not open video file: {video_path}")

    # Get video properties
    native_fps = video.get(cv2.CAP_PROP_FPS)
    total_frames = int(video.get(cv2.CAP_PROP_FRAME_COUNT))
    duration = total_frames / native_fps if native_fps > 0 else 0

    # Calculate frame skip to achieve target sample FPS
    frame_skip = max(1, int(native_fps / sample_fps))
    min_frames_between = int(sample_fps * min_scene_length)

    print(f"[SCENE-DETECT] Video: {duration:.2f}s @ {native_fps:.1f} FPS")
    print(f"[SCENE-DETECT] Sampling every {frame_skip} frames ({sample_fps} effective FPS)")
    print(f"[SCENE-DETECT] Threshold: {threshold}, Min scene length: {min_scene_length}s")

    scene_boundaries = [0.0]  # Start with time 0
    prev_frame = None
    frame_count = 0
    samples_processed = 0
    last_scene_frame = 0
    progress_interval = max(1, total_frames // 10)

    while True:
        ret, frame = video.read()
        if not ret:
            break

        # Only process every Nth frame
        if frame_count % frame_skip == 0:
            # Convert to grayscale and resize for faster processing
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            gray = cv2.resize(gray, (SCENE_CONFIG['frame_width'], SCENE_CONFIG['frame_height']))

            if prev_frame is not None:
                # Calculate frame difference
                frame_diff = cv2.absdiff(prev_frame, gray)
                mean_diff = np.mean(frame_diff)

                # Check if difference exceeds threshold and minimum scene length
                frames_since_last = samples_processed - last_scene_frame
                if mean_diff > threshold and frames_since_last >= min_frames_between:
                    timestamp = frame_count / native_fps
                    scene_boundaries.append(timestamp)
                    last_scene_frame = samples_processed
                    print(f"[SCENE-DETECT] Scene change at {timestamp:.2f}s (diff: {mean_diff:.1f})")

            prev_frame = gray.copy()
            samples_processed += 1

        frame_count += 1

        # Progress logging with keep-alive
        if frame_count % progress_interval == 0:
            pct = (frame_count / total_frames) * 100
            remaining_time = "N/A"
            if context:
                remaining_ms = context.get_remaining_time_in_millis()
                remaining_time = f"{remaining_ms // 1000}s"
            print(f"[KEEP-ALIVE] Progress: {frame_count}/{total_frames} ({pct:.0f}%) | "
                  f"Scenes found: {len(scene_boundaries)} | Lambda time: {remaining_time}")

    # Add final timestamp as end of last scene
    scene_boundaries.append(duration)

    video.release()

    # Convert boundaries to scenes
    scenes = []
    for i in range(len(scene_boundaries) - 1):
        start = scene_boundaries[i]
        end = scene_boundaries[i + 1]
        scene_duration = end - start

        # Only include scenes that meet minimum length
        if scene_duration >= min_scene_length:
            scenes.append({
                'start': round(start, 3),
                'end': round(end, 3),
                'duration': round(scene_duration, 3)
            })

    print(f"[SCENE-DETECT] Found {len(scenes)} scenes from {len(scene_boundaries) - 1} boundaries")
    return scenes


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda handler for scene detection.

    Input event format:
    {
        "bucket": "bucket-name",
        "key": "path/to/video.mp4",
        "threshold": 30.0,        # Optional
        "minSceneLength": 0.5     # Optional
    }

    OR with video_url:
    {
        "video_url": "s3://bucket/key",
        "threshold": 30.0,
        "minSceneLength": 0.5
    }
    """
    print(f"[SCENE-DETECT] Received event: {json.dumps(event)}")

    try:
        # Parse body if it's a string (API Gateway format)
        body = event.get('body')
        if isinstance(body, str):
            body = json.loads(body)
        elif body is None:
            body = event

        # Get video location
        bucket = body.get('bucket')
        key = body.get('key')
        video_url = body.get('video_url') or body.get('videoUrl')

        if not bucket and not video_url:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'bucket/key or video_url is required'})
            }

        # Get optional parameters
        threshold = float(body.get('threshold', SCENE_CONFIG['threshold']))
        min_scene_length = float(body.get('minSceneLength', body.get('min_scene_length', SCENE_CONFIG['min_scene_length'])))

        # Create temp file for video
        with tempfile.NamedTemporaryFile(suffix='.mp4', delete=False) as tmp:
            video_path = tmp.name

        try:
            def log_remaining_time(step: str):
                if context:
                    remaining_ms = context.get_remaining_time_in_millis()
                    print(f"[KEEP-ALIVE] {step} | Lambda time remaining: {remaining_ms // 1000}s")
                else:
                    print(f"[KEEP-ALIVE] {step}")

            log_remaining_time("Starting - downloading video")

            # Download video
            if bucket and key:
                download_from_s3(bucket, key, video_path)
            else:
                download_from_s3_url(video_url, video_path)

            log_remaining_time("Download complete - getting video info")

            # Get video info
            duration, native_fps = get_video_info(video_path)
            print(f"[SCENE-DETECT] Video duration: {duration:.2f}s, FPS: {native_fps:.1f}")

            log_remaining_time("Starting scene detection")

            # Detect visual scenes
            scenes = detect_scene_changes(
                video_path,
                threshold=threshold,
                min_scene_length=min_scene_length,
                sample_fps=SCENE_CONFIG['sample_fps'],
                context=context
            )

            log_remaining_time(f"Scene detection complete - found {len(scenes)} scenes. Starting silence detection")

            # Detect audio silence points (for smart sub-chunking of long scenes)
            silence_noise_threshold = float(body.get('silenceNoiseThreshold', SILENCE_CONFIG['noise_threshold']))
            silence_min_duration = float(body.get('silenceMinDuration', SILENCE_CONFIG['min_silence_duration']))

            silence_points = detect_silence_points(
                video_path,
                noise_threshold=silence_noise_threshold,
                min_silence_duration=silence_min_duration
            )

            log_remaining_time(f"Complete - found {len(scenes)} scenes, {len(silence_points)} silence points")

            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({
                    'success': True,
                    'scenes': scenes,
                    'silencePoints': silence_points,  # NEW: Audio pause points for smart chunking
                    'totalDuration': round(duration, 3),
                    'sceneCount': len(scenes),
                    'silencePointCount': len(silence_points),
                    'threshold': threshold,
                    'minSceneLength': min_scene_length,
                    'silenceNoiseThreshold': silence_noise_threshold,
                    'silenceMinDuration': silence_min_duration,
                    'nativeFps': native_fps,
                    'sampleFps': SCENE_CONFIG['sample_fps']
                })
            }

        finally:
            # Clean up temp file
            if os.path.exists(video_path):
                os.unlink(video_path)

    except Exception as e:
        print(f"[SCENE-DETECT] Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }
