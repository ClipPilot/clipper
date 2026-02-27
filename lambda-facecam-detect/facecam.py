import json
import os
import shutil
import tempfile
import subprocess
import cv2
import numpy as np
from typing import List, Dict, Any, Optional, Tuple

from shared import (
    FACECAM_CONFIG,
    get_yunet_model_path,
    get_video_info,
    expand_face_to_webcam_region,
    detect_corner,
)

# Cached YuNet detector — created once, reused across all calls
_yunet_detector = None


def _get_yunet_detector():
    """Get or create the cached YuNet detector instance."""
    global _yunet_detector
    if _yunet_detector is None:
        model_path = get_yunet_model_path()
        _yunet_detector = cv2.FaceDetectorYN.create(
            model_path, "", (320, 320),
            score_threshold=0.5,
            nms_threshold=0.3,
            top_k=5000
        )
    return _yunet_detector


def detect_faces_yunet(image: np.ndarray, score_threshold: float = 0.5) -> List[Dict[str, Any]]:
    """Detect faces using YuNet. Reuses a single cached detector instance."""
    h, w = image.shape[:2]
    if h < 10 or w < 10:
        return []

    detector = _get_yunet_detector()
    detector.setInputSize((w, h))
    detector.setScoreThreshold(score_threshold)
    _, faces = detector.detect(image)
    if faces is None:
        return []

    results = []
    for face in faces:
        fx, fy, fw, fh = int(face[0]), int(face[1]), int(face[2]), int(face[3])
        confidence = float(face[-1])
        results.append({
            'x': max(0, fx),
            'y': max(0, fy),
            'w': min(fw, w - max(0, fx)),
            'h': min(fh, h - max(0, fy)),
            'confidence': confidence,
        })
    results.sort(key=lambda f: f['confidence'], reverse=True)
    return results


def _detect_faces_with_quadrants(
    frame: np.ndarray,
    frame_w: int,
    frame_h: int,
    score_threshold: float = 0.3
) -> List[Dict[str, Any]]:
    """Detect faces on the full frame AND on each corner quadrant crop.

    Quadrant crops run YuNet at 2x effective resolution, catching small
    facecam faces that the full-frame pass misses.
    """
    all_faces = []

    # Pass 1: Full frame
    full_faces = detect_faces_yunet(frame, score_threshold=score_threshold)
    all_faces.extend(full_faces)

    # Pass 2: Corner quadrants (overlapping halves)
    half_w = frame_w // 2
    half_h = frame_h // 2
    quadrants = [
        (0, 0, half_w, half_h),                    # top-left
        (frame_w - half_w, 0, half_w, half_h),     # top-right
        (0, frame_h - half_h, half_w, half_h),     # bottom-left
        (frame_w - half_w, frame_h - half_h, half_w, half_h),  # bottom-right
    ]

    for qx, qy, qw, qh in quadrants:
        crop = frame[qy:qy + qh, qx:qx + qw]
        if crop.size == 0:
            continue
        quad_faces = detect_faces_yunet(crop, score_threshold=score_threshold)
        # Map coordinates back to full frame
        for f in quad_faces:
            f['x'] += qx
            f['y'] += qy
        all_faces.extend(quad_faces)

    return all_faces


def _cluster_faces(
    faces: List[Dict[str, Any]],
    distance_threshold: int = 60
) -> List[List[Dict[str, Any]]]:
    """Group face detections by proximity into unique face regions."""
    clusters: List[List[Dict[str, Any]]] = []

    for face in faces:
        fcx = face['x'] + face['w'] / 2
        fcy = face['y'] + face['h'] / 2

        matched = False
        for cluster in clusters:
            avg_cx = sum(f['x'] + f['w'] / 2 for f in cluster) / len(cluster)
            avg_cy = sum(f['y'] + f['h'] / 2 for f in cluster) / len(cluster)
            dist = ((fcx - avg_cx) ** 2 + (fcy - avg_cy) ** 2) ** 0.5
            if dist < distance_threshold:
                cluster.append(face)
                matched = True
                break

        if not matched:
            clusters.append([face])

    # Sort by detection count (most consistent face first)
    clusters.sort(key=lambda c: len(c), reverse=True)
    return clusters


def _average_face(cluster: List[Dict[str, Any]]) -> Dict[str, int]:
    """Compute average bounding box for a cluster of face detections."""
    return {
        'x': int(sum(f['x'] for f in cluster) / len(cluster)),
        'y': int(sum(f['y'] for f in cluster) / len(cluster)),
        'w': int(sum(f['w'] for f in cluster) / len(cluster)),
        'h': int(sum(f['h'] for f in cluster) / len(cluster)),
    }


def _compute_face_motion(
    face_bbox: Dict[str, int],
    frames: List[np.ndarray],
    threshold: float = 3.0
) -> bool:
    """Check motion on the FACE region specifically (not the whole candidate).

    Rejects static images/memes while accepting real but relatively still
    streamers. Threshold lowered from 5.0 to 3.0 — compression noise is
    typically 0.5-1.5, while a real person scores 2.0+.
    """
    if len(frames) < 3:
        return True

    x, y, w, h = face_bbox['x'], face_bbox['y'], face_bbox['w'], face_bbox['h']
    n = len(frames)

    # Use more pairs with 16 frames for better accuracy
    if n >= 8:
        pair_indices = [(0, n // 4), (n // 4, n // 2), (n // 2, 3 * n // 4),
                        (3 * n // 4, n - 1), (0, n // 2), (n // 4, 3 * n // 4),
                        (0, n - 1)]
    else:
        pair_indices = [(0, n // 3), (n // 3, 2 * n // 3), (0, n - 1)]

    diffs = []
    for a, b in pair_indices:
        crop_a = frames[a][y:y + h, x:x + w]
        crop_b = frames[b][y:y + h, x:x + w]
        if crop_a.size == 0 or crop_b.size == 0:
            continue

        ga = cv2.cvtColor(cv2.resize(crop_a, (64, 64)), cv2.COLOR_BGR2GRAY).astype(float)
        gb = cv2.cvtColor(cv2.resize(crop_b, (64, 64)), cv2.COLOR_BGR2GRAY).astype(float)
        diffs.append(float(np.mean(np.abs(ga - gb))))

    if not diffs:
        return True

    avg = np.mean(diffs)
    above = sum(1 for d in diffs if d >= threshold)
    is_live = avg >= threshold and above >= 1
    print(f"[FACECAM-DETECT] Face-region motion: avg={avg:.2f} above={above}/{len(diffs)} (thr={threshold}) → {'LIVE' if is_live else 'STATIC'}")
    return is_live


def _no_facecam_response(frame_w: int, frame_h: int) -> Dict[str, Any]:
    """Return a standard "no facecam found" response."""
    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/json'},
        'body': json.dumps({
            'success': True,
            'facecamDetected': False,
            'facecamRegion': None,
            'corner': None,
            'faceRegion': None,
            'detectionRate': 0.0,
            'frameWidth': frame_w,
            'frameHeight': frame_h,
        }),
    }


# ── Pipeline ──

def handle_facecam(video_path: str, frame_w: int, frame_h: int, context: Any) -> Dict[str, Any]:
    """
    YuNet-based facecam detection pipeline:

    1. Sample frames from video
    2. Detect faces with YuNet (full-frame + quadrant crops for small faces)
    3. Cluster detections into unique face regions
    4. Check motion for each cluster — pick the moving face
    5. Expand to webcam region
    """
    duration, _, _ = get_video_info(video_path)

    if context:
        remaining_ms = context.get_remaining_time_in_millis()
        print(f"[KEEP-ALIVE] Starting facecam detection | Lambda time remaining: {remaining_ms // 1000}s")

    # Sample frames (skip first/last 5%)
    safe_start = duration * 0.05
    safe_end = duration * 0.95
    num_samples = FACECAM_CONFIG['num_sample_frames']  # 16
    sample_times = [
        safe_start + (safe_end - safe_start) * i / (num_samples - 1)
        for i in range(num_samples)
    ]

    temp_dir = tempfile.mkdtemp()
    sampled_frames: List[np.ndarray] = []

    try:
        for i, t in enumerate(sample_times):
            frame_path = os.path.join(temp_dir, f"sample_{i:02d}.jpg")
            cmd = [
                'ffmpeg', '-y', '-ss', str(t),
                '-i', video_path,
                '-vframes', '1', '-q:v', '2',
                frame_path,
                '-loglevel', 'warning'
            ]
            subprocess.run(cmd, capture_output=True)

            if os.path.exists(frame_path):
                img = cv2.imread(frame_path)
                if img is not None:
                    sampled_frames.append(img.copy())
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)

    print(f"[FACECAM-DETECT] Sampled {len(sampled_frames)} frames")

    if len(sampled_frames) < 3:
        return _no_facecam_response(frame_w, frame_h)

    if context:
        remaining_ms = context.get_remaining_time_in_millis()
        print(f"[KEEP-ALIVE] Frame sampling done | Lambda time remaining: {remaining_ms // 1000}s")

    # ── Step 1: Detect faces across all frames (full-frame + quadrant crops) ──
    all_faces: List[Dict[str, Any]] = []
    for frame in sampled_frames:
        faces = _detect_faces_with_quadrants(frame, frame_w, frame_h, score_threshold=0.3)
        all_faces.extend(faces)

    print(f"[FACECAM-DETECT] YuNet found {len(all_faces)} total detections across {len(sampled_frames)} frames")

    if not all_faces:
        print("[FACECAM-DETECT] No faces detected in any frame")
        return _no_facecam_response(frame_w, frame_h)

    # ── Step 2: Cluster faces by position ──
    clusters = _cluster_faces(all_faces, distance_threshold=60)
    print(f"[FACECAM-DETECT] Clustered into {len(clusters)} unique face regions")

    for i, cluster in enumerate(clusters[:5]):
        avg = _average_face(cluster)
        max_conf = max(f.get('confidence', 0) for f in cluster)
        print(f"[FACECAM-DETECT]   Cluster {i}: ({avg['x']},{avg['y']}) {avg['w']}x{avg['h']}, "
              f"detections={len(cluster)}, max_conf={max_conf:.2f}")

    if context:
        remaining_ms = context.get_remaining_time_in_millis()
        print(f"[KEEP-ALIVE] Clustering done | Lambda time remaining: {remaining_ms // 1000}s")

    # ── Step 3: Find the first moving face ──
    confirmed_face = None
    confirmed_region = None
    best_confidence = 0.0

    for cluster in clusters:
        avg_face = _average_face(cluster)

        if _compute_face_motion(avg_face, sampled_frames):
            # This is a real, moving face — expand to webcam region
            region = expand_face_to_webcam_region(avg_face, frame_w, frame_h)
            confirmed_face = avg_face
            confirmed_region = region
            best_confidence = max(f.get('confidence', 0) for f in cluster)
            print(f"[FACECAM-DETECT] Moving face found at ({avg_face['x']},{avg_face['y']}) "
                  f"{avg_face['w']}x{avg_face['h']}, conf={best_confidence:.2f}, "
                  f"expanded region={region}")
            break
        else:
            print(f"[FACECAM-DETECT] Static face at ({avg_face['x']},{avg_face['y']}), skipping")

    if not confirmed_region or not confirmed_face:
        print("[FACECAM-DETECT] No moving face found")
        return _no_facecam_response(frame_w, frame_h)

    corner = detect_corner(confirmed_region, frame_w, frame_h)
    print(f"[FACECAM-DETECT] Facecam detected at {corner}: region={confirmed_region}")

    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/json'},
        'body': json.dumps({
            'success': True,
            'facecamDetected': True,
            'facecamRegion': confirmed_region,
            'corner': corner,
            'faceRegion': {
                'x': confirmed_face['x'],
                'y': confirmed_face['y'],
                'w': confirmed_face['w'],
                'h': confirmed_face['h'],
            },
            'detectionRate': round(best_confidence, 2),
            'frameWidth': frame_w,
            'frameHeight': frame_h,
        }),
    }
