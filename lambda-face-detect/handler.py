import json
import os
import re
import shutil
import tempfile
import subprocess
import boto3
import cv2
import urllib.request
from typing import List, Dict, Any, Tuple
from urllib.parse import urlparse
from concurrent.futures import ThreadPoolExecutor, as_completed

s3_client = boto3.client('s3')

FACE_CONFIG = {
    'min_confidence': 0.5,
    'min_face_size_percent': 0.03,
    'max_face_size_percent': 0.9,
    'min_consecutive_frames': 2,
    'min_segment_duration': 1.0,
    'sample_fps': 8,
    'merge_gap': 0.3,
    'padding': 0.0,  # No padding - edge refinement provides precise boundaries
    'max_workers': 6,
    'frame_offset': 2,  # Number of frames to offset start (earlier) and end (later)
}

FRAME_ACCURATE_CONFIG = {
    'min_confidence': 0.5,
    'min_face_size_percent': 0.03,
    'max_face_size_percent': 0.9,
    'min_consecutive_frames': 2,
    'min_segment_duration': 0.1,
    'sample_fps': 15,
    'merge_gap': 0.15,
    'padding': 0.0,
    'max_workers': 8,
    'frame_offset': 2,  # Number of frames to offset start (earlier) and end (later)
}

PROTOTXT_URL = "https://raw.githubusercontent.com/opencv/opencv/master/samples/dnn/face_detector/deploy.prototxt"
CAFFEMODEL_URL = "https://raw.githubusercontent.com/opencv/opencv_3rdparty/dnn_samples_face_detector_20170830/res10_300x300_ssd_iter_140000.caffemodel"

BAKED_MODEL_DIR = "/var/task/models"
CACHE_MODEL_DIR = "/tmp/face_models"


def get_model_paths() -> Tuple[str, str]:
    baked_prototxt = os.path.join(BAKED_MODEL_DIR, "deploy.prototxt")
    baked_caffemodel = os.path.join(BAKED_MODEL_DIR, "res10_300x300_ssd_iter_140000.caffemodel")

    if os.path.exists(baked_prototxt) and os.path.exists(baked_caffemodel):
        print("[FACE-DETECT] Using baked-in models")
        return baked_prototxt, baked_caffemodel

    os.makedirs(CACHE_MODEL_DIR, exist_ok=True)
    cache_prototxt = os.path.join(CACHE_MODEL_DIR, "deploy.prototxt")
    cache_caffemodel = os.path.join(CACHE_MODEL_DIR, "res10_300x300_ssd_iter_140000.caffemodel")

    if not os.path.exists(cache_prototxt):
        print("[FACE-DETECT] Downloading prototxt...")
        urllib.request.urlretrieve(PROTOTXT_URL, cache_prototxt)

    if not os.path.exists(cache_caffemodel):
        print("[FACE-DETECT] Downloading caffemodel...")
        urllib.request.urlretrieve(CAFFEMODEL_URL, cache_caffemodel)

    return cache_prototxt, cache_caffemodel


def get_face_detector():
    prototxt_path, caffemodel_path = get_model_paths()
    net = cv2.dnn.readNetFromCaffe(prototxt_path, caffemodel_path)
    return net


def download_from_s3(s3_url: str, local_path: str) -> None:
    parsed = urlparse(s3_url)
    if parsed.scheme == 's3':
        bucket = parsed.netloc
        key = parsed.path.lstrip('/')
    else:
        parts = parsed.netloc.split('.')
        bucket = parts[0]
        key = parsed.path.lstrip('/')

    s3_client.download_file(bucket, key, local_path)


def extract_frames(video_path: str, output_dir: str, fps: float = 5.0) -> List[str]:
    os.makedirs(output_dir, exist_ok=True)
    output_pattern = os.path.join(output_dir, 'frame_%04d.jpg')

    fps_val = min(float(fps), 30.0)
    if fps_val != int(fps_val):
        fps_filter = f'fps={fps_val:.2f}'
    else:
        fps_filter = f'fps={int(fps_val)}'

    cmd = [
        'ffmpeg', '-i', video_path,
        '-vf', fps_filter,
        '-q:v', '2',
        output_pattern,
        '-y', '-loglevel', 'warning'
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"[FACE-DETECT] FFmpeg stderr: {result.stderr}")
        raise RuntimeError(f"Frame extraction failed: {result.stderr}")

    frames = sorted([
        os.path.join(output_dir, f)
        for f in os.listdir(output_dir)
        if f.endswith('.jpg')
    ])
    return frames


def detect_faces_in_frame(net, frame_path: str) -> bool:
    image = cv2.imread(frame_path)
    if image is None:
        return False

    (h, w) = image.shape[:2]
    frame_area = w * h

    # Multi-scale detection for better small face detection (full body shots)
    scales_to_try = [
        ('full_300', 300, None),  # Full frame at 300x300 (standard)
    ]

    # For larger frames, try 500x500 blob for better small face detection
    if min(h, w) >= 500:
        scales_to_try.append(('full_500', 500, None))

    # Center crop - useful for TikTok style videos where subject is centered
    if h > 400 and w > 400:
        crop_h = int(h * 0.6)
        crop_w = int(w * 0.6)
        y_start = (h - crop_h) // 2
        x_start = (w - crop_w) // 2
        scales_to_try.append(('center_crop', 300, (x_start, y_start, x_start + crop_w, y_start + crop_h)))

    # For portrait video, add upper portion crop where face usually is
    if h > w * 1.5:
        upper_h = int(h * 0.5)
        scales_to_try.append(('upper_crop', 300, (0, 0, w, upper_h)))

    for scale_name, blob_size, crop_region in scales_to_try:
        if crop_region:
            x1, y1, x2, y2 = crop_region
            roi = image[y1:y2, x1:x2]
            roi_h, roi_w = roi.shape[:2]
            roi_area = roi_w * roi_h
        else:
            roi = image
            roi_h, roi_w = h, w
            roi_area = frame_area

        blob = cv2.dnn.blobFromImage(
            cv2.resize(roi, (blob_size, blob_size)),
            1.0,
            (blob_size, blob_size),
            (104.0, 177.0, 123.0)
        )

        net.setInput(blob)
        detections = net.forward()

        for i in range(detections.shape[2]):
            confidence = detections[0, 0, i, 2]

            if confidence < FACE_CONFIG['min_confidence']:
                continue

            box = detections[0, 0, i, 3:7] * [roi_w, roi_h, roi_w, roi_h]
            (startX, startY, endX, endY) = box.astype("int")

            face_width = endX - startX
            face_height = endY - startY
            face_area = face_width * face_height
            face_size_percent = face_area / roi_area

            # For cropped regions, allow smaller faces since we're zoomed in
            min_size = FACE_CONFIG['min_face_size_percent']
            if crop_region:
                min_size = min_size * 0.5

            if min_size <= face_size_percent <= FACE_CONFIG['max_face_size_percent']:
                return True

    return False



def filter_isolated_detections(
    times: List[float],
    sample_interval: float,
    min_consecutive: int = None
) -> List[float]:
    if min_consecutive is None:
        min_consecutive = FACE_CONFIG['min_consecutive_frames']
    if len(times) < min_consecutive:
        return []

    sorted_times = sorted(times)
    valid_times = []
    max_gap = sample_interval * 1.5

    for i, current in enumerate(sorted_times):
        consecutive_count = 1

        for j in range(i - 1, -1, -1):
            if current - sorted_times[j] <= max_gap * (i - j):
                consecutive_count += 1
            else:
                break

        for j in range(i + 1, len(sorted_times)):
            if sorted_times[j] - current <= max_gap * (j - i):
                consecutive_count += 1
            else:
                break

        if consecutive_count >= min_consecutive:
            valid_times.append(current)

    return valid_times


def merge_times_into_segments(times: List[float], gap: float = 0.5) -> List[Dict[str, float]]:
    if not times:
        return []

    sorted_times = sorted(times)
    segments = []
    start = sorted_times[0]
    prev = sorted_times[0]

    for t in sorted_times[1:]:
        if t - prev <= gap:
            prev = t
        else:
            segments.append({'start': start, 'end': prev})
            start = t
            prev = t

    segments.append({'start': start, 'end': prev})
    return segments


def extract_edge_frames(
    video_path: str,
    start_time: float,
    duration: float,
    fps: float = 30.0
) -> Tuple[List[str], str]:
    """Extract frames for a specific time window at high FPS for edge refinement."""
    temp_dir = tempfile.mkdtemp()
    frames_dir = os.path.join(temp_dir, 'edge_frames')
    os.makedirs(frames_dir, exist_ok=True)

    output_pattern = os.path.join(frames_dir, 'frame_%04d.jpg')

    # Clamp start_time to >= 0
    start_time = max(0, start_time)

    # Use -ss AFTER -i for frame-accurate seeking (slower but precise)
    cmd = [
        'ffmpeg', '-i', video_path,
        '-ss', str(start_time),
        '-t', str(duration),
        '-vf', f'fps={int(fps)}',
        '-q:v', '2',
        output_pattern,
        '-y', '-loglevel', 'warning'
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"[EDGE-REFINE] FFmpeg stderr: {result.stderr}")
        return [], temp_dir

    frames = sorted([
        os.path.join(frames_dir, f)
        for f in os.listdir(frames_dir)
        if f.endswith('.jpg')
    ])
    return frames, temp_dir


def refine_segment_edges(
    segments: List[Dict[str, float]],
    video_path: str,
    video_duration: float,
    context: Any = None,
    native_fps: float = 30.0
) -> List[Dict[str, float]]:
    """
    Refine segment edges by analyzing frames at the video's native FPS
    in a 0.5-second window around each edge.

    Uses native FPS to ensure we check EVERY frame - no missed boundaries.
    """
    if not segments:
        return segments

    REFINE_FPS = min(native_fps, 60.0)
    EDGE_WINDOW = 0.5

    print(f"[EDGE-REFINE] Using {REFINE_FPS} FPS for edge refinement (native: {native_fps})")

    prototxt_path, caffemodel_path = get_model_paths()
    net = cv2.dnn.readNetFromCaffe(prototxt_path, caffemodel_path)

    refined_segments = []

    for seg_idx, segment in enumerate(segments):
        original_start = segment['start']
        original_end = segment['end']

        print(f"[EDGE-REFINE] Segment {seg_idx + 1}/{len(segments)}: {original_start:.3f}s - {original_end:.3f}s")

        # Refine START edge
        start_window_begin = max(0, original_start - EDGE_WINDOW)
        start_window_duration = min(EDGE_WINDOW * 2, video_duration - start_window_begin)

        start_frames, start_temp_dir = extract_edge_frames(
            video_path, start_window_begin, start_window_duration, REFINE_FPS
        )

        new_start = original_start
        if start_frames:
            # Scan forward to find FIRST frame with a face
            for i, frame_path in enumerate(start_frames):
                frame_time = start_window_begin + (i / REFINE_FPS)
                if detect_faces_in_frame(net, frame_path):
                    new_start = frame_time
                    break

            # Clean up temp directory
            shutil.rmtree(start_temp_dir, ignore_errors=True)

        # Refine END edge
        end_window_begin = max(0, original_end - EDGE_WINDOW)
        end_window_duration = min(EDGE_WINDOW * 2, video_duration - end_window_begin)

        end_frames, end_temp_dir = extract_edge_frames(
            video_path, end_window_begin, end_window_duration, REFINE_FPS
        )

        new_end = original_end
        if end_frames:
            # Scan BACKWARD to find LAST frame with a face
            for i in range(len(end_frames) - 1, -1, -1):
                frame_path = end_frames[i]
                frame_time = end_window_begin + (i / REFINE_FPS)
                if detect_faces_in_frame(net, frame_path):
                    new_end = frame_time
                    break

            # Clean up temp directory
            shutil.rmtree(end_temp_dir, ignore_errors=True)

        # Log refinement results
        start_delta = new_start - original_start
        end_delta = new_end - original_end
        print(f"[EDGE-REFINE] Refined: {new_start:.3f}s - {new_end:.3f}s "
              f"(start: {start_delta:+.3f}s, end: {end_delta:+.3f}s)")

        # Only keep segment if it still has positive duration
        if new_end > new_start:
            refined_segments.append({
                'start': round(new_start, 3),
                'end': round(new_end, 3)
            })
        else:
            print(f"[EDGE-REFINE] Segment {seg_idx + 1} removed (no faces found in refined window)")

        # Keep-alive logging
        if context:
            remaining_ms = context.get_remaining_time_in_millis()
            print(f"[KEEP-ALIVE] Edge refinement {seg_idx + 1}/{len(segments)} | Lambda time remaining: {remaining_ms // 1000}s")

    print(f"[EDGE-REFINE] Refined {len(segments)} → {len(refined_segments)} segments")
    return refined_segments


def validate_segment_starts(
    segments: List[Dict[str, float]],
    video_path: str,
    native_fps: float = 30.0
) -> List[Dict[str, float]]:
    """
    Final validation: ensure each segment's first frame has a face.
    If not, advance by 1 frame at native FPS until it does.
    """
    if not segments:
        return segments

    prototxt_path, caffemodel_path = get_model_paths()
    net = cv2.dnn.readNetFromCaffe(prototxt_path, caffemodel_path)

    frame_duration = 1.0 / native_fps
    validated = []

    for seg_idx, segment in enumerate(segments):
        start = segment['start']
        end = segment['end']
        original_start = start

        # Extract and check frames one at a time until we find a face
        max_frames_to_check = 10  # Safety limit
        for frame_num in range(max_frames_to_check):
            if start >= end:
                print(f"[VALIDATE] Segment {seg_idx + 1}: No face found, removing segment")
                start = None
                break

            # Extract single frame at current start time
            # Use -ss AFTER -i for frame-accurate seeking (slower but precise)
            temp_dir = tempfile.mkdtemp()
            frame_path = os.path.join(temp_dir, "frame.jpg")
            cmd = [
                'ffmpeg', '-y', '-i', video_path, '-ss', str(start),
                '-vframes', '1', '-q:v', '2', frame_path,
                '-loglevel', 'warning'
            ]
            subprocess.run(cmd, capture_output=True)

            has_face = os.path.exists(frame_path) and detect_faces_in_frame(net, frame_path)
            shutil.rmtree(temp_dir, ignore_errors=True)

            if has_face:
                if start > original_start:
                    print(f"[VALIDATE] Segment {seg_idx + 1}: Advanced {frame_num} frame(s) from {original_start:.3f}s to {start:.3f}s")
                else:
                    print(f"[VALIDATE] Segment {seg_idx + 1}: First frame OK at {start:.3f}s")
                break
            else:
                # No face, advance by 1 frame
                start += frame_duration

        if start is not None and start < end:
            validated.append({
                'start': round(start, 3),
                'end': round(end, 3)
            })

    print(f"[VALIDATE] Validated {len(segments)} → {len(validated)} segments")
    return validated


def apply_frame_offset(
    segments: List[Dict[str, float]],
    video_duration: float,
    native_fps: float,
    frame_offset: int = 2
) -> List[Dict[str, float]]:
    """
    Apply a frame offset to segment boundaries.
    Subtracts frames from start (earlier) and adds frames to end (later).
    This provides a small buffer around detected face segments.
    """
    if not segments or frame_offset <= 0:
        return segments

    time_offset = frame_offset / native_fps
    print(f"[FRAME-OFFSET] Applying {frame_offset} frame offset ({time_offset:.4f}s at {native_fps} FPS)")

    offset_segments = []
    for seg in segments:
        new_start = max(0, seg['start'] - time_offset)
        new_end = min(video_duration, seg['end'] + time_offset)
        offset_segments.append({
            'start': round(new_start, 3),
            'end': round(new_end, 3)
        })

    print(f"[FRAME-OFFSET] Applied offset to {len(offset_segments)} segments")
    return offset_segments


def pad_segments(
    segments: List[Dict[str, float]],
    video_duration: float,
    padding: float = 0.3
) -> List[Dict[str, float]]:
    if not segments:
        return []

    padded = [
        {
            'start': seg['start'],
            'end': min(video_duration, seg['end'] + padding)
        }
        for seg in segments
    ]

    padded.sort(key=lambda x: x['start'])

    merged = []
    current = padded[0]

    for seg in padded[1:]:
        if seg['start'] <= current['end'] + 0.1:
            current = {
                'start': current['start'],
                'end': max(current['end'], seg['end'])
            }
        else:
            merged.append(current)
            current = seg
    merged.append(current)

    filtered = [
        seg for seg in merged
        if seg['end'] - seg['start'] >= FACE_CONFIG['min_segment_duration']
    ]

    return [
        {'start': round(seg['start'], 3), 'end': round(seg['end'], 3)}
        for seg in filtered
    ]


def get_video_info(video_path: str) -> Tuple[float, float]:
    """Get video duration and FPS using ffmpeg."""
    cmd = [
        'ffmpeg', '-i', video_path,
        '-f', 'null', '-'
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    stderr = result.stderr

    duration = 0.0
    fps = 30.0

    import re
    duration_match = re.search(r'Duration: (\d+):(\d+):(\d+)\.(\d+)', stderr)
    if duration_match:
        h, m, s, ms = duration_match.groups()
        duration = int(h) * 3600 + int(m) * 60 + int(s) + int(ms) / 100

    fps_match = re.search(r'(\d+(?:\.\d+)?)\s*fps', stderr)
    if fps_match:
        fps = float(fps_match.group(1))

    return duration, fps




def process_frame_batch(args: Tuple[int, str, str, str]) -> Tuple[int, bool]:
    frame_idx, frame_path, prototxt_path, caffemodel_path = args
    net = cv2.dnn.readNetFromCaffe(prototxt_path, caffemodel_path)
    has_face = detect_faces_in_frame(net, frame_path)
    return (frame_idx, has_face)


def detect_face_segments(
    video_path: str,
    net,
    config: Dict[str, Any] = None,
    context: Any = None
) -> List[Dict[str, float]]:
    if config is None:
        config = FACE_CONFIG

    sample_rate = config['sample_fps']
    print(f"[FACE-DETECT] Using {sample_rate} FPS")

    sample_interval = 1 / sample_rate
    max_workers = config['max_workers']

    with tempfile.TemporaryDirectory() as temp_dir:
        frames_dir = os.path.join(temp_dir, 'frames')

        frames = extract_frames(video_path, frames_dir, sample_rate)
        if not frames:
            return []

        total_frames = len(frames)
        print(f"[FACE-DETECT] Processing {total_frames} frames with {max_workers} workers...")

        prototxt_path, caffemodel_path = get_model_paths()

        frame_args = [
            (i, frame_path, prototxt_path, caffemodel_path)
            for i, frame_path in enumerate(frames)
        ]

        face_times = []
        processed_count = 0
        progress_interval = max(1, total_frames // 10)  # Log every 10%

        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = {executor.submit(process_frame_batch, args): args[0] for args in frame_args}

            for future in as_completed(futures):
                frame_idx, has_face = future.result()
                if has_face:
                    face_times.append(frame_idx / sample_rate)

                processed_count += 1

                # Keep-alive: log progress every 10% and show remaining Lambda time
                if processed_count % progress_interval == 0 or processed_count == total_frames:
                    pct = (processed_count / total_frames) * 100
                    remaining_time = "N/A"
                    if context:
                        remaining_ms = context.get_remaining_time_in_millis()
                        remaining_time = f"{remaining_ms // 1000}s"
                    print(f"[KEEP-ALIVE] Progress: {processed_count}/{total_frames} ({pct:.0f}%) | Faces found: {len(face_times)} | Lambda time remaining: {remaining_time}")

        print(f"[FACE-DETECT] Raw detections: {len(face_times)}/{len(frames)} frames")

        filtered_times = filter_isolated_detections(
            face_times,
            sample_interval,
            min_consecutive=config['min_consecutive_frames']
        )
        print(f"[FACE-DETECT] After filtering: {len(filtered_times)} detections")

        segments = merge_times_into_segments(filtered_times, config['merge_gap'])
        print(f"[FACE-DETECT] Merged into {len(segments)} segments")

        return segments


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    print(f"[FACE-DETECT] Received event: {json.dumps(event)}")

    try:
        body = event.get('body')
        if isinstance(body, str):
            body = json.loads(body)
        elif body is None:
            body = event

        video_url = body.get('video_url') or body.get('videoUrl')
        video_duration = body.get('video_duration') or body.get('videoDuration')
        frame_accurate = body.get('frame_accurate') or body.get('frameAccurate') or False

        if not video_url:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'video_url is required'})
            }

        print("[FACE-DETECT] Loading face detector...")
        net = get_face_detector()

        with tempfile.NamedTemporaryFile(suffix='.mp4', delete=False) as tmp:
            video_path = tmp.name

        try:
            # Keep-alive: Log remaining time at each step
            def log_remaining_time(step: str):
                if context:
                    remaining_ms = context.get_remaining_time_in_millis()
                    print(f"[KEEP-ALIVE] {step} | Lambda time remaining: {remaining_ms // 1000}s")
                else:
                    print(f"[KEEP-ALIVE] {step}")

            log_remaining_time("Starting - downloading video")
            print(f"[FACE-DETECT] Downloading video from {video_url}")
            download_from_s3(video_url, video_path)

            # ── Detect face time segments ──
            config = FRAME_ACCURATE_CONFIG if frame_accurate else FACE_CONFIG
            log_remaining_time("Download complete - extracting video info")
            detected_duration, native_fps = get_video_info(video_path)
            if not video_duration:
                video_duration = detected_duration

            print(f"[FACE-DETECT] Video: {video_duration}s @ {native_fps} FPS")
            log_remaining_time("Starting face detection")

            raw_segments = detect_face_segments(video_path, net, config, context)

            log_remaining_time("Face detection complete - refining segment edges")

            refined_segments = refine_segment_edges(
                raw_segments,
                video_path,
                video_duration,
                context,
                native_fps
            )

            log_remaining_time("Edge refinement complete - validating segment starts")

            validated_segments = validate_segment_starts(
                refined_segments,
                video_path,
                native_fps
            )

            log_remaining_time("Validation complete - applying frame offset")

            offset_segments = apply_frame_offset(
                validated_segments,
                video_duration,
                native_fps,
                config.get('frame_offset', 2)
            )

            log_remaining_time("Frame offset applied - padding segments")

            segments = pad_segments(
                offset_segments,
                video_duration,
                config['padding']
            )

            log_remaining_time(f"Complete - found {len(segments)} segments")
            print(f"[FACE-DETECT] Final segments: {segments}")

            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({
                    'success': True,
                    'segments': segments,
                    'videoDuration': video_duration,
                    'segmentCount': len(segments),
                    'frameAccurate': frame_accurate,
                    'nativeFps': native_fps,
                    'sampleFps': config['sample_fps']
                })
            }
        finally:
            if os.path.exists(video_path):
                os.unlink(video_path)

    except Exception as e:
        print(f"[FACE-DETECT] Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }
