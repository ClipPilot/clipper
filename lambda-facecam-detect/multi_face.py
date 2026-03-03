import json
import os
import shutil
import statistics
import cv2
import numpy as np
from typing import List, Dict, Any, Optional

from shared import (
    FACECAM_CONFIG,
    MULTI_FACE_CONFIG,
    get_video_info,
    extract_sample_frames,
)

# Scene detection config (lightweight, borrowed from lambda-scene-detect)
SCENE_DETECT_CONFIG = {
    'threshold': 30.0,         # Mean pixel diff threshold for scene cut
    'min_scene_length': 0.5,   # Min scene duration in seconds
    'sample_fps': 8,           # Frames per second to analyze
    'frame_width': 320,        # Downscale width
    'frame_height': 180,       # Downscale height
}


def detect_scene_boundaries(video_path: str) -> List[float]:
    """Detect scene cut timestamps using frame differencing.

    Returns boundary timestamps: [0.0, t1, t2, ..., duration].
    Lightweight version of lambda-scene-detect's algorithm — uses grayscale
    downscaled frames at 8 FPS to find visual cuts.
    """
    cfg = SCENE_DETECT_CONFIG
    video = cv2.VideoCapture(video_path)
    if not video.isOpened():
        raise RuntimeError(f"Could not open video: {video_path}")

    native_fps = video.get(cv2.CAP_PROP_FPS)
    total_frames = int(video.get(cv2.CAP_PROP_FRAME_COUNT))
    duration = total_frames / native_fps if native_fps > 0 else 0

    frame_skip = max(1, int(native_fps / cfg['sample_fps']))
    min_frames_between = int(cfg['sample_fps'] * cfg['min_scene_length'])

    boundaries = [0.0]
    prev_frame = None
    frame_count = 0
    samples_processed = 0
    last_scene_sample = 0

    while True:
        ret, frame = video.read()
        if not ret:
            break

        if frame_count % frame_skip == 0:
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            gray = cv2.resize(gray, (cfg['frame_width'], cfg['frame_height']))

            if prev_frame is not None:
                diff = np.mean(cv2.absdiff(prev_frame, gray))
                frames_since_last = samples_processed - last_scene_sample
                if diff > cfg['threshold'] and frames_since_last >= min_frames_between:
                    timestamp = frame_count / native_fps
                    boundaries.append(timestamp)
                    last_scene_sample = samples_processed
                    print(f"[SCENE-DETECT] Scene cut at {timestamp:.2f}s (diff={diff:.1f})")

            prev_frame = gray.copy()
            samples_processed += 1

        frame_count += 1

    boundaries.append(duration)
    video.release()

    print(f"[SCENE-DETECT] Found {len(boundaries) - 2} scene cuts → {len(boundaries) - 1} scenes")
    return boundaries


def extract_sample_frames_for_range(
    video_path: str, start: float, end: float, num_frames: int
) -> List[str]:
    """Extract evenly-spaced sample frames within a specific time range.

    Like shared.py's extract_sample_frames but constrained to [start, end].
    """
    import tempfile
    import subprocess

    if num_frames <= 0:
        return []

    interval = (end - start) / (num_frames + 1)
    temp_dir = tempfile.mkdtemp()
    frame_paths = []

    for i in range(num_frames):
        timestamp = start + interval * (i + 1)
        frame_path = os.path.join(temp_dir, f'frame_{i:04d}.jpg')
        cmd = [
            'ffmpeg', '-y', '-ss', str(timestamp),
            '-i', video_path,
            '-vframes', '1', '-q:v', '2',
            frame_path,
            '-loglevel', 'warning',
        ]
        subprocess.run(cmd, capture_output=True)
        if os.path.exists(frame_path):
            frame_paths.append(frame_path)

    return frame_paths


def detect_face_bboxes_in_frame(net, frame_path: str, config: Optional[Dict] = None) -> List[Dict[str, Any]]:
    """Detect faces and return bounding boxes with confidence scores.

    Returns list of {x, y, w, h, confidence} in pixel coordinates.
    Filters by size: only keeps faces between min/max size thresholds.
    """
    image = cv2.imread(frame_path)
    if image is None:
        return []

    (h, w) = image.shape[:2]
    frame_area = w * h
    if config is None:
        config = FACECAM_CONFIG

    blob = cv2.dnn.blobFromImage(
        cv2.resize(image, (300, 300)),
        1.0,
        (300, 300),
        (104.0, 177.0, 123.0),
    )

    net.setInput(blob)
    detections = net.forward()

    faces = []
    for i in range(detections.shape[2]):
        confidence = float(detections[0, 0, i, 2])
        if confidence < config['min_confidence']:
            continue

        box = detections[0, 0, i, 3:7] * [w, h, w, h]
        (startX, startY, endX, endY) = box.astype("int")

        # Clamp all coordinates to frame bounds BEFORE computing dimensions
        startX = max(0, min(startX, w))
        startY = max(0, min(startY, h))
        endX = max(0, min(endX, w))
        endY = max(0, min(endY, h))

        face_w = endX - startX
        face_h = endY - startY
        if face_w <= 0 or face_h <= 0:
            continue

        face_area = face_w * face_h
        face_size_pct = face_area / frame_area if frame_area > 0 else 0

        if config['min_face_size_percent'] <= face_size_pct <= config['max_face_size_percent']:
            faces.append({
                'x': startX,
                'y': startY,
                'w': face_w,
                'h': face_h,
                'confidence': confidence,
            })

    return faces


def select_facecam_face(faces: List[Dict], frame_w: int, frame_h: int) -> Optional[Dict]:
    """When multiple faces found, pick the one closest to a corner.

    Facecams live in corners of the screen, so the face nearest a corner
    is most likely the facecam face (vs. a face in gameplay footage).
    """
    if not faces:
        return None
    if len(faces) == 1:
        return faces[0]

    corners = [
        (0, 0),
        (frame_w, 0),
        (0, frame_h),
        (frame_w, frame_h),
    ]

    best_face = None
    best_dist = float('inf')

    for face in faces:
        cx = face['x'] + face['w'] / 2
        cy = face['y'] + face['h'] / 2
        min_corner_dist = min(
            ((cx - corner[0]) ** 2 + (cy - corner[1]) ** 2) ** 0.5
            for corner in corners
        )
        if min_corner_dist < best_dist:
            best_dist = min_corner_dist
            best_face = face

    return best_face


def compute_face_motion(frame_paths: List[str], face_bbox: Dict, threshold: float = 3.0) -> float:
    """Measure how much a face region changes across consecutive frames.

    Static images (memes, PNGs) will have near-zero motion.
    A real person's face will have expression changes and micro-movements.

    Returns the mean absolute pixel difference across frame pairs.
    """
    diffs = []
    prev_crop = None

    for frame_path in frame_paths:
        img = cv2.imread(frame_path)
        if img is None:
            continue

        h, w = img.shape[:2]
        x = max(0, min(face_bbox['x'], w - 1))
        y = max(0, min(face_bbox['y'], h - 1))
        x2 = min(x + face_bbox['w'], w)
        y2 = min(y + face_bbox['h'], h)

        crop = img[y:y2, x:x2]
        if crop.size == 0:
            continue

        # Resize to fixed size for consistent comparison
        crop = cv2.resize(crop, (64, 64))
        crop_gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY).astype(np.float32)

        if prev_crop is not None:
            diff = np.mean(np.abs(crop_gray - prev_crop))
            diffs.append(diff)

        prev_crop = crop_gray

    if not diffs:
        return 0.0

    return float(np.mean(diffs))


def group_faces_by_position(all_frame_faces: List[List[Dict]], threshold_px: float = 50) -> List[List[Dict]]:
    """Group faces across frames by spatial proximity.

    Each group represents the same face source (streamer, meme image, etc.)
    appearing at roughly the same screen position across multiple frames.
    """
    groups: List[List[Dict]] = []

    for frame_faces in all_frame_faces:
        for face in frame_faces:
            cx = face['x'] + face['w'] / 2
            cy = face['y'] + face['h'] / 2

            matched = False
            for group in groups:
                # Compare against the group's median center
                gcxs = [f['x'] + f['w'] / 2 for f in group]
                gcys = [f['y'] + f['h'] / 2 for f in group]
                gcx = statistics.median(gcxs)
                gcy = statistics.median(gcys)

                if abs(cx - gcx) <= threshold_px and abs(cy - gcy) <= threshold_px:
                    group.append(face)
                    matched = True
                    break

            if not matched:
                groups.append([face])

    return groups


def cluster_face_positions(all_faces: List[Dict], config: Optional[Dict] = None) -> Optional[Dict]:
    """Take median of all face positions across frames, filter outliers.

    Requires min_consistent_detections consistent detections.
    Returns median bbox or None.
    """
    if config is None:
        config = FACECAM_CONFIG

    if len(all_faces) < config['min_consistent_detections']:
        return None

    xs = [f['x'] for f in all_faces]
    ys = [f['y'] for f in all_faces]
    ws = [f['w'] for f in all_faces]
    hs = [f['h'] for f in all_faces]

    median_x = statistics.median(xs)
    median_y = statistics.median(ys)
    median_w = statistics.median(ws)
    median_h = statistics.median(hs)

    # Filter outliers: faces > threshold px from median center
    threshold = config['outlier_threshold_px']
    filtered = []
    for face in all_faces:
        dx = abs((face['x'] + face['w'] / 2) - (median_x + median_w / 2))
        dy = abs((face['y'] + face['h'] / 2) - (median_y + median_h / 2))
        if dx <= threshold and dy <= threshold:
            filtered.append(face)

    if len(filtered) < config['min_consistent_detections']:
        return None

    # Recompute median from filtered set
    return {
        'x': int(statistics.median([f['x'] for f in filtered])),
        'y': int(statistics.median([f['y'] for f in filtered])),
        'w': int(statistics.median([f['w'] for f in filtered])),
        'h': int(statistics.median([f['h'] for f in filtered])),
        'confidence': statistics.mean([f['confidence'] for f in filtered]),
    }


def _detect_faces_in_scene(
    net, frame_paths: List[str], config: Dict, min_detections: int
) -> List[Dict]:
    """Run face detection pipeline on a set of frames for one scene.

    Groups → clusters → motion-filters → sorts left-to-right.
    Returns list of live face regions (x, y, w, h).
    """
    MOTION_THRESHOLD = 3.0

    all_frame_faces: List[List[Dict]] = []
    for frame_path in frame_paths:
        faces = detect_face_bboxes_in_frame(net, frame_path, config)
        all_frame_faces.append(faces)

    face_groups = group_faces_by_position(
        all_frame_faces, threshold_px=config['outlier_threshold_px']
    )

    # Override min_consistent_detections for this scene's scale
    scene_config = {**config, 'min_consistent_detections': min_detections}

    live_faces = []
    for group in face_groups:
        if len(group) < min_detections:
            continue
        median_bbox = cluster_face_positions(group, scene_config)
        if median_bbox is None:
            continue
        motion = compute_face_motion(frame_paths, median_bbox, threshold=MOTION_THRESHOLD)
        if motion >= MOTION_THRESHOLD:
            live_faces.append(median_bbox)
        else:
            print(f"[MULTI-FACE] Filtered static face at ({median_bbox['x']},{median_bbox['y']}), motion={motion:.1f}")

    live_faces.sort(key=lambda f: f['x'] + f['w'] / 2)
    return [{'x': f['x'], 'y': f['y'], 'w': f['w'], 'h': f['h']} for f in live_faces]


def handle_multi_face(net, video_path: str, frame_w: int, frame_h: int, context: Any) -> Dict[str, Any]:
    """Detect ALL face positions for active-speaker mode, scene-aware.

    Detects scene cuts first, then runs face detection independently per scene.
    Returns per-scene face data plus a backward-compatible global faces array.
    """
    config = MULTI_FACE_CONFIG
    total_frames_budget = config['num_sample_frames']  # 24

    # --- Step 1: Detect scene boundaries ---
    print("[MULTI-FACE] Detecting scene boundaries...")
    boundaries = detect_scene_boundaries(video_path)
    scene_ranges = [
        (boundaries[i], boundaries[i + 1])
        for i in range(len(boundaries) - 1)
        if boundaries[i + 1] - boundaries[i] >= 0.5
    ]

    if not scene_ranges:
        # Fallback: treat entire video as one scene
        duration, _, _ = get_video_info(video_path)
        scene_ranges = [(0.0, duration)]

    print(f"[MULTI-FACE] {len(scene_ranges)} scene(s): {[(round(s,1), round(e,1)) for s, e in scene_ranges]}")

    # --- Step 2: Distribute frame budget across scenes proportionally ---
    total_duration = sum(e - s for s, e in scene_ranges)
    frames_per_scene = []
    for start, end in scene_ranges:
        proportion = (end - start) / total_duration if total_duration > 0 else 1.0 / len(scene_ranges)
        n = max(2, round(proportion * total_frames_budget))
        frames_per_scene.append(n)

    # Adjust to hit exact budget
    diff = total_frames_budget - sum(frames_per_scene)
    if diff > 0:
        # Add extra frames to longest scene
        longest_idx = max(range(len(scene_ranges)), key=lambda i: scene_ranges[i][1] - scene_ranges[i][0])
        frames_per_scene[longest_idx] += diff
    elif diff < 0:
        # Remove frames from longest scene (but keep min 2)
        longest_idx = max(range(len(scene_ranges)), key=lambda i: frames_per_scene[i])
        frames_per_scene[longest_idx] = max(2, frames_per_scene[longest_idx] + diff)

    # --- Step 3: Detect faces per scene ---
    scenes_output = []
    all_faces_union = []
    total_frames_processed = 0
    total_frames_with_faces = 0
    temp_dirs = []

    for scene_idx, ((start, end), num_frames) in enumerate(zip(scene_ranges, frames_per_scene)):
        print(f"[MULTI-FACE] Scene {scene_idx}: {start:.1f}s-{end:.1f}s ({num_frames} frames)")

        frame_paths = extract_sample_frames_for_range(video_path, start, end, num_frames)
        if frame_paths:
            temp_dirs.append(os.path.dirname(frame_paths[0]))

        total_frames_processed += len(frame_paths)

        # Scale min_consistent_detections proportionally (floor at 2)
        min_detections = max(2, round(
            config['min_consistent_detections'] * (num_frames / total_frames_budget) * len(scene_ranges)
        ))
        min_detections = min(min_detections, num_frames)

        scene_faces = _detect_faces_in_scene(net, frame_paths, config, min_detections)

        # Estimate frames-with-faces from scene results (at least 1 if faces found)
        total_frames_with_faces += len(frame_paths) if scene_faces else 0

        scenes_output.append({
            'start': round(start, 3),
            'end': round(end, 3),
            'faces': scene_faces,
            'faceCount': len(scene_faces),
        })
        all_faces_union.extend(scene_faces)

        print(f"[MULTI-FACE] Scene {scene_idx}: {len(scene_faces)} live faces")

        if context:
            remaining_ms = context.get_remaining_time_in_millis()
            print(f"[KEEP-ALIVE] Scene {scene_idx + 1}/{len(scene_ranges)} done | Lambda time: {remaining_ms // 1000}s")

    # Clean up all temp directories
    for d in temp_dirs:
        shutil.rmtree(d, ignore_errors=True)

    # Deduplicate global faces union (faces at same position across scenes)
    deduped_faces = []
    for face in all_faces_union:
        cx = face['x'] + face['w'] / 2
        cy = face['y'] + face['h'] / 2
        is_dupe = False
        for existing in deduped_faces:
            ecx = existing['x'] + existing['w'] / 2
            ecy = existing['y'] + existing['h'] / 2
            if abs(cx - ecx) <= config['outlier_threshold_px'] and abs(cy - ecy) <= config['outlier_threshold_px']:
                is_dupe = True
                break
        if not is_dupe:
            deduped_faces.append(face)
    deduped_faces.sort(key=lambda f: f['x'] + f['w'] / 2)

    detection_rate = total_frames_with_faces / max(total_frames_processed, 1)

    print(f"[MULTI-FACE] Returning {len(deduped_faces)} global faces, {len(scenes_output)} scenes")

    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/json'},
        'body': json.dumps({
            'success': True,
            'mode': 'multi-face',
            'faces': deduped_faces,
            'faceCount': len(deduped_faces),
            'scenes': scenes_output,
            'sceneCount': len(scenes_output),
            'detectionRate': round(detection_rate, 2),
            'frameWidth': frame_w,
            'frameHeight': frame_h,
        }),
    }
