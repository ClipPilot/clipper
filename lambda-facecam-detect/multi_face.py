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

        face_w = max(0, endX - startX)
        face_h = max(0, endY - startY)
        face_area = face_w * face_h
        face_size_pct = face_area / frame_area if frame_area > 0 else 0

        if config['min_face_size_percent'] <= face_size_pct <= config['max_face_size_percent']:
            faces.append({
                'x': max(0, startX),
                'y': max(0, startY),
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


def handle_multi_face(net, video_path: str, frame_w: int, frame_h: int, context: Any) -> Dict[str, Any]:
    """Detect ALL face positions for active-speaker mode.

    Returns all live face clusters sorted left-to-right by center X.
    Used for podcast/interview content with 2+ speakers.
    """
    config = MULTI_FACE_CONFIG

    frame_paths = extract_sample_frames(
        video_path,
        num_frames=config['num_sample_frames'],
        skip_percent=config['skip_percent'],
    )
    print(f"[MULTI-FACE] Extracted {len(frame_paths)} sample frames")

    # Detect ALL faces in each frame using multi-face config
    all_frame_faces: List[List[Dict]] = []
    for i, frame_path in enumerate(frame_paths):
        faces = detect_face_bboxes_in_frame(net, frame_path, config)
        all_frame_faces.append(faces)

        if context and (i + 1) % 6 == 0:
            remaining_ms = context.get_remaining_time_in_millis()
            print(f"[KEEP-ALIVE] Processed {i + 1}/{len(frame_paths)} frames | Lambda time remaining: {remaining_ms // 1000}s")

    total_detections = sum(len(ff) for ff in all_frame_faces)
    frames_with_faces = sum(1 for ff in all_frame_faces if ff)
    print(f"[MULTI-FACE] Found {total_detections} faces across {frames_with_faces}/{len(frame_paths)} frames")

    # Group faces by position
    face_groups = group_faces_by_position(all_frame_faces, threshold_px=config['outlier_threshold_px'])
    print(f"[MULTI-FACE] Found {len(face_groups)} face groups")

    MOTION_THRESHOLD = 3.0
    live_faces = []
    for group in face_groups:
        if len(group) < config['min_consistent_detections']:
            continue
        median_bbox = cluster_face_positions(group, config)
        if median_bbox is None:
            continue
        motion = compute_face_motion(frame_paths, median_bbox, threshold=MOTION_THRESHOLD)
        print(f"[MULTI-FACE] Group at ({median_bbox['x']},{median_bbox['y']}): {len(group)} detections, motion={motion:.1f}")
        if motion >= MOTION_THRESHOLD:
            live_faces.append(median_bbox)
        else:
            print(f"[MULTI-FACE] Filtered out static face (motion={motion:.1f})")

    # Sort faces left-to-right by center X
    live_faces.sort(key=lambda f: f['x'] + f['w'] / 2)

    detection_rate = frames_with_faces / max(len(frame_paths), 1)

    # Clean up frame temp directory
    if frame_paths:
        frame_dir = os.path.dirname(frame_paths[0])
        shutil.rmtree(frame_dir, ignore_errors=True)

    face_regions = [
        {'x': f['x'], 'y': f['y'], 'w': f['w'], 'h': f['h']}
        for f in live_faces
    ]

    print(f"[MULTI-FACE] Returning {len(face_regions)} live faces sorted left-to-right")

    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/json'},
        'body': json.dumps({
            'success': True,
            'mode': 'multi-face',
            'faces': face_regions,
            'faceCount': len(face_regions),
            'detectionRate': round(detection_rate, 2),
            'frameWidth': frame_w,
            'frameHeight': frame_h,
        }),
    }
