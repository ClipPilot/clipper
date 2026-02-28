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


def _find_boundary_by_edges(
    frame: np.ndarray,
    expanded_region: Dict[str, int],
    face_bbox: Dict[str, int],
    padding: int = 20
) -> Optional[Dict[str, int]]:
    """Approach 1: Edge Detection + Contour Finding.

    Searches within the expanded region for the actual overlay boundary
    using Canny edge detection and contour analysis. Works best when the
    facecam has a visible border/frame.
    """
    rx, ry, rw, rh = expanded_region['x'], expanded_region['y'], expanded_region['w'], expanded_region['h']
    h, w = frame.shape[:2]

    # Expand search area slightly beyond the estimated region
    sx1 = max(0, rx - padding)
    sy1 = max(0, ry - padding)
    sx2 = min(w, rx + rw + padding)
    sy2 = min(h, ry + rh + padding)

    roi = frame[sy1:sy2, sx1:sx2]
    if roi.size == 0:
        return None

    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 50, 150)

    # Dilate to close gaps in overlay borders
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
    edges = cv2.dilate(edges, kernel, iterations=2)

    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None

    face_cx = face_bbox['x'] + face_bbox['w'] / 2
    face_cy = face_bbox['y'] + face_bbox['h'] / 2

    best = None
    best_area = 0

    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < 500:
            continue

        peri = cv2.arcLength(cnt, True)
        approx = cv2.approxPolyDP(cnt, 0.02 * peri, True)

        # Roughly rectangular (4+ vertices after polygon approximation)
        if len(approx) >= 4 and area > best_area:
            bx, by, bw, bh = cv2.boundingRect(cnt)
            abs_x = sx1 + bx
            abs_y = sy1 + by

            # Must contain the face center
            if (abs_x <= face_cx <= abs_x + bw and
                    abs_y <= face_cy <= abs_y + bh):
                best = {'x': abs_x, 'y': abs_y, 'w': bw, 'h': bh}
                best_area = area

    return best


def _find_boundary_by_gradient(
    frame: np.ndarray,
    expanded_region: Dict[str, int],
    face_bbox: Dict[str, int],
    padding: int = 30
) -> Optional[Dict[str, int]]:
    """Approach 2: Gradient Discontinuity Detection.

    Facecams have sharp contrast boundaries against game/screen content.
    Uses Sobel gradients + HoughLinesP to detect overlay edges.
    """
    rx, ry, rw, rh = expanded_region['x'], expanded_region['y'], expanded_region['w'], expanded_region['h']
    h, w = frame.shape[:2]

    sx1 = max(0, rx - padding)
    sy1 = max(0, ry - padding)
    sx2 = min(w, rx + rw + padding)
    sy2 = min(h, ry + rh + padding)

    roi = frame[sy1:sy2, sx1:sx2]
    if roi.size == 0:
        return None

    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
    roi_h, roi_w = gray.shape[:2]

    # Sobel gradients — strong edges indicate overlay borders
    grad_x = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
    grad_y = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
    magnitude = np.sqrt(grad_x**2 + grad_y**2)

    thresh = np.percentile(magnitude, 95)
    strong_edges = (magnitude > thresh).astype(np.uint8) * 255

    lines = cv2.HoughLinesP(strong_edges, 1, np.pi / 180, 50,
                             minLineLength=30, maxLineGap=10)
    if lines is None or len(lines) == 0:
        return None

    face_cx_roi = (face_bbox['x'] + face_bbox['w'] / 2) - sx1
    face_cy_roi = (face_bbox['y'] + face_bbox['h'] / 2) - sy1

    # Classify lines as horizontal/vertical and by position relative to face
    h_above: List[float] = []
    h_below: List[float] = []
    v_left: List[float] = []
    v_right: List[float] = []

    for line in lines:
        x1l, y1l, x2l, y2l = line[0]
        angle = abs(np.arctan2(y2l - y1l, x2l - x1l) * 180 / np.pi)
        length = np.sqrt((x2l - x1l)**2 + (y2l - y1l)**2)

        if length < 20:
            continue

        if angle < 15 or angle > 165:  # horizontal
            avg_y = (y1l + y2l) / 2
            if avg_y < face_cy_roi:
                h_above.append(avg_y)
            else:
                h_below.append(avg_y)
        elif 75 < angle < 105:  # vertical
            avg_x = (x1l + x2l) / 2
            if avg_x < face_cx_roi:
                v_left.append(avg_x)
            else:
                v_right.append(avg_x)

    # Need at least 2 boundary edges for a useful refinement
    edges_found = sum(1 for lst in [h_above, h_below, v_left, v_right] if lst)
    if edges_found < 2:
        return None

    # Pick the closest significant line on each side of the face
    top_y = max(h_above) if h_above else 0
    bottom_y = min(h_below) if h_below else roi_h
    left_x = max(v_left) if v_left else 0
    right_x = min(v_right) if v_right else roi_w

    result_w = int(right_x - left_x)
    result_h = int(bottom_y - top_y)

    # Result must be at least as large as the face
    if result_w < face_bbox['w'] or result_h < face_bbox['h']:
        return None

    return {
        'x': int(sx1 + left_x),
        'y': int(sy1 + top_y),
        'w': result_w,
        'h': result_h,
    }


def _median_boundary(results: List[Dict[str, int]]) -> Dict[str, int]:
    """Compute median boundary from a list of valid detection results."""
    return {
        'x': int(np.median([r['x'] for r in results])),
        'y': int(np.median([r['y'] for r in results])),
        'w': int(np.median([r['w'] for r in results])),
        'h': int(np.median([r['h'] for r in results])),
    }


def _iou(a: Dict[str, int], b: Dict[str, int]) -> float:
    """Compute intersection-over-union between two {x, y, w, h} rects."""
    x1 = max(a['x'], b['x'])
    y1 = max(a['y'], b['y'])
    x2 = min(a['x'] + a['w'], b['x'] + b['w'])
    y2 = min(a['y'] + a['h'], b['y'] + b['h'])

    inter = max(0, x2 - x1) * max(0, y2 - y1)
    if inter == 0:
        return 0.0

    area_a = a['w'] * a['h']
    area_b = b['w'] * b['h']
    return inter / (area_a + area_b - inter)


def _snap_and_clamp(region: Dict[str, int], frame_w: int, frame_h: int) -> Dict[str, int]:
    """Snap edges close to frame borders and clamp within bounds."""
    snap = FACECAM_CONFIG['edge_snap_px']
    x, y, w, h = region['x'], region['y'], region['w'], region['h']

    if x < snap:
        w += x  # absorb the gap into width
        x = 0
    if y < snap:
        h += y
        y = 0
    if (x + w) > (frame_w - snap):
        w = frame_w - x
    if (y + h) > (frame_h - snap):
        h = frame_h - y

    x = max(0, x)
    y = max(0, y)
    w = min(w, frame_w - x)
    h = min(h, frame_h - y)

    return {'x': x, 'y': y, 'w': w, 'h': h}


def _select_best_boundary(
    edge_results: List[Optional[Dict[str, int]]],
    gradient_results: List[Optional[Dict[str, int]]],
    expanded_region: Dict[str, int],
    face_bbox: Dict[str, int],
    frame_w: int,
    frame_h: int,
) -> Optional[Dict[str, int]]:
    """Select the best facecam boundary from edge + gradient detection results.

    Strategy:
      1. Filter each approach to valid results (>= 50% hit rate across frames).
      2. Compute median boundary per approach for robustness against outliers.
      3. Validate each candidate: must contain the face, be >= 1.5x face size,
         and be tighter than the 3x-expanded fallback.
      4. When both approaches produce valid candidates with high IoU (>0.6),
         use their average — they agree on the boundary.
      5. Otherwise pick the tighter candidate (smaller area).
      6. Snap to frame edges (facecams sit flush in corners).

    Returns:
        Refined boundary {x, y, w, h}, or None to fall back to expanded_region.
    """
    num_frames = len(edge_results)
    min_hits = max(2, num_frames // 2)  # need ≥50% consistency

    valid_edges = [r for r in edge_results if r is not None]
    valid_grads = [r for r in gradient_results if r is not None]

    face_area = face_bbox['w'] * face_bbox['h']
    expanded_area = expanded_region['w'] * expanded_region['h']
    min_area = face_area * 1.5  # boundary can't be smaller than 1.5x face
    face_cx = face_bbox['x'] + face_bbox['w'] / 2
    face_cy = face_bbox['y'] + face_bbox['h'] / 2

    def _is_valid_candidate(region: Dict[str, int]) -> bool:
        """Check that the candidate contains the face and is reasonably sized."""
        area = region['w'] * region['h']
        if area < min_area or area >= expanded_area:
            return False
        # Must contain the face center
        if not (region['x'] <= face_cx <= region['x'] + region['w'] and
                region['y'] <= face_cy <= region['y'] + region['h']):
            return False
        # Reject extreme aspect ratios (webcams are roughly 4:3 to 16:9)
        ratio = max(region['w'], region['h']) / max(1, min(region['w'], region['h']))
        if ratio > 4.0:
            return False
        return True

    # Build candidates from each approach (if enough consistent detections)
    candidates: List[Tuple[Dict[str, int], str]] = []

    if len(valid_edges) >= min_hits:
        median_edge = _median_boundary(valid_edges)
        if _is_valid_candidate(median_edge):
            candidates.append((median_edge, 'edge'))

    if len(valid_grads) >= min_hits:
        median_grad = _median_boundary(valid_grads)
        if _is_valid_candidate(median_grad):
            candidates.append((median_grad, 'gradient'))

    if not candidates:
        return None

    if len(candidates) == 2:
        edge_cand, grad_cand = candidates[0][0], candidates[1][0]
        overlap = _iou(edge_cand, grad_cand)
        print(f"[FACECAM-DETECT] Edge/gradient IoU: {overlap:.2f}")

        if overlap > 0.6:
            # Both approaches agree — average them for best precision
            merged = {
                'x': (edge_cand['x'] + grad_cand['x']) // 2,
                'y': (edge_cand['y'] + grad_cand['y']) // 2,
                'w': (edge_cand['w'] + grad_cand['w']) // 2,
                'h': (edge_cand['h'] + grad_cand['h']) // 2,
            }
            return _snap_and_clamp(merged, frame_w, frame_h)
        else:
            # Disagree — pick the tighter (smaller area) candidate
            best = min(candidates, key=lambda c: c[0]['w'] * c[0]['h'])
            print(f"[FACECAM-DETECT] Approaches disagree, using {best[1]} (tighter)")
            return _snap_and_clamp(best[0], frame_w, frame_h)

    # Single valid candidate
    result, source = candidates[0]
    print(f"[FACECAM-DETECT] Using {source} boundary (only valid approach)")
    return _snap_and_clamp(result, frame_w, frame_h)


def _refine_facecam_boundary(
    expanded_region: Dict[str, int],
    face_bbox: Dict[str, int],
    frames: List[np.ndarray],
    frame_w: int,
    frame_h: int,
) -> Dict[str, int]:
    """Refine the 3x-expanded region by detecting the actual overlay boundary.

    Runs edge detection and gradient analysis on a subset of sampled frames,
    then selects the best consistent boundary.
    """
    if len(frames) < 2:
        return expanded_region

    # Sample up to 6 evenly-spaced frames (no need to process all 16)
    step = max(1, len(frames) // 6)
    sample_frames = frames[::step][:6]

    edge_results: List[Optional[Dict[str, int]]] = []
    gradient_results: List[Optional[Dict[str, int]]] = []

    for frame in sample_frames:
        edge_results.append(_find_boundary_by_edges(frame, expanded_region, face_bbox))
        gradient_results.append(_find_boundary_by_gradient(frame, expanded_region, face_bbox))

    valid_edges = sum(1 for r in edge_results if r is not None)
    valid_gradients = sum(1 for r in gradient_results if r is not None)
    print(f"[FACECAM-DETECT] Boundary refinement: {valid_edges}/{len(sample_frames)} edge, "
          f"{valid_gradients}/{len(sample_frames)} gradient detections")

    refined = _select_best_boundary(
        edge_results, gradient_results,
        expanded_region, face_bbox,
        frame_w, frame_h,
    )

    if refined and refined != expanded_region:
        print(f"[FACECAM-DETECT] Refined boundary: {refined} (was {expanded_region})")
    else:
        print("[FACECAM-DETECT] No refinement found, using expanded region")

    return refined if refined else expanded_region


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
            # Refine the boundary using edge/gradient analysis
            region = _refine_facecam_boundary(region, avg_face, sampled_frames, frame_w, frame_h)
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
