import json
import os
import shutil
import tempfile
import subprocess
import cv2
import numpy as np
from typing import List, Dict, Any, Optional

from shared import (
    get_yunet_model_path,
    get_video_info,
    expand_face_to_webcam_region,
    detect_corner,
)

# Fix #1: Cached YuNet detector — created once, reused across all calls
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


# ── Layer 1: Temporal Variance Map ──

def compute_temporal_variance_map(frames: List[np.ndarray]) -> np.ndarray:
    """
    Per-pixel temporal variance across sampled frames (uint8, 0-255).
    Gameplay = high variance, facecam = moderate, static HUD = near-zero.
    """
    grays = [cv2.cvtColor(f, cv2.COLOR_BGR2GRAY).astype(np.float32) for f in frames]
    stack = np.stack(grays, axis=0)
    variance = np.var(stack, axis=0)
    return cv2.normalize(variance, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)


def find_overlay_candidates_from_variance(
    variance_map: np.ndarray,
    frame_w: int,
    frame_h: int
) -> List[Dict[str, Any]]:
    """
    Find rectangular overlay candidates from the temporal variance map.
    Uses edge detection + band-pass thresholding to find sharp rectangular
    boundaries between facecam and gameplay regions.
    """
    frame_area = frame_w * frame_h
    smoothed = cv2.GaussianBlur(variance_map, (15, 15), 0)
    candidates = []

    # Strategy A: Edge detection on variance map finds sharp boundaries
    edges = cv2.Canny(smoothed, 30, 100)
    edge_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
    edges = cv2.dilate(edges, edge_kernel, iterations=2)
    edges = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, edge_kernel, iterations=2)

    # Strategy B: Band-pass threshold for moderate-variance regions (facecam)
    # Fix #7: Robust thresholding that handles low-variance streams
    otsu_thresh, _ = cv2.threshold(smoothed, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    if otsu_thresh < 50:
        # Low-variance stream (mostly static) — widen the band
        lower = 5
        upper = max(45, int(otsu_thresh * 1.5))
    else:
        lower = max(10, int(otsu_thresh * 0.15))
        upper = max(lower + 40, int(otsu_thresh * 0.85))
    band = cv2.inRange(smoothed, lower, upper)
    band_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (7, 7))
    band = cv2.morphologyEx(band, cv2.MORPH_CLOSE, band_kernel, iterations=3)
    band = cv2.morphologyEx(band, cv2.MORPH_OPEN, band_kernel, iterations=1)

    for source_name, source in [("var_edges", edges), ("var_band", band)]:
        contours, _ = cv2.findContours(source, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)

        for contour in contours:
            area = cv2.contourArea(contour)
            area_pct = area / frame_area
            if area_pct < 0.02 or area_pct > 0.40:
                continue

            peri = cv2.arcLength(contour, True)
            approx = cv2.approxPolyDP(contour, 0.02 * peri, True)
            if len(approx) < 4 or len(approx) > 6:
                continue

            bx, by, bw, bh = cv2.boundingRect(approx)

            aspect = bw / bh if bh > 0 else 0
            if aspect < 0.4 or aspect > 2.5:
                continue

            rect_area = bw * bh
            rectangularity = area / rect_area if rect_area > 0 else 0
            if rectangularity < 0.60:
                continue

            cx, cy = bx + bw / 2, by + bh / 2
            corner_score = 0.0
            if cx < frame_w * 0.3 or cx > frame_w * 0.7:
                corner_score += 0.5
            if cy < frame_h * 0.3 or cy > frame_h * 0.7:
                corner_score += 0.5

            candidates.append({
                'x': bx, 'y': by, 'w': bw, 'h': bh,
                'area_pct': area_pct,
                'rectangularity': rectangularity,
                'aspect_ratio': aspect,
                'corner_score': corner_score,
                'source': source_name,
            })

    candidates = _deduplicate_candidates(candidates)
    return candidates


def _compute_iou(a: Dict, b: Dict) -> float:
    """Intersection over union of two boxes."""
    x1 = max(a['x'], b['x'])
    y1 = max(a['y'], b['y'])
    x2 = min(a['x'] + a['w'], b['x'] + b['w'])
    y2 = min(a['y'] + a['h'], b['y'] + b['h'])

    if x2 <= x1 or y2 <= y1:
        return 0.0

    intersection = (x2 - x1) * (y2 - y1)
    union = a['w'] * a['h'] + b['w'] * b['h'] - intersection
    return intersection / union if union > 0 else 0.0


def _deduplicate_candidates(
    candidates: List[Dict[str, Any]],
    iou_threshold: float = 0.5
) -> List[Dict[str, Any]]:
    """Remove overlapping candidates, keeping the more rectangular one."""
    if not candidates:
        return []

    candidates.sort(key=lambda c: c['rectangularity'], reverse=True)
    kept = []

    for candidate in candidates:
        overlaps = False
        for existing in kept:
            if _compute_iou(candidate, existing) > iou_threshold:
                overlaps = True
                break
        if not overlaps:
            kept.append(candidate)

    return kept


# ── Layer 2: Scoring ──

def score_overlay_candidate(candidate: Dict[str, Any]) -> float:
    """Score an overlay candidate — higher = more likely to be a facecam."""
    score = 0.0

    # Corner position is the strongest signal (most cams are in corners)
    score += candidate['corner_score'] * 3.0

    # Rectangularity — clean overlays are very rectangular
    score += candidate['rectangularity'] * 2.0

    # Aspect ratio — reward typical webcam ratios (4:3 and 16:9)
    ar = candidate['aspect_ratio']
    if 1.1 <= ar <= 2.0:       # sweet spot: 4:3 through 16:9
        score += 1.5
    elif 0.75 <= ar <= 2.2:    # acceptable: portrait-ish to wide
        score += 0.7

    # Area — typical facecams are 5-20% of frame
    ap = candidate['area_pct']
    if 0.04 <= ap <= 0.22:
        score += 1.5
    elif 0.02 <= ap <= 0.35:
        score += 0.5

    # Edge-detected boundaries are more reliable than band-pass
    if candidate['source'] == 'var_edges':
        score += 0.5

    return score


# ── Layer 3: Motion Verification ──

def compute_region_motion(
    region: Dict[str, int],
    frames: List[np.ndarray],
    threshold: float = 3.0
) -> bool:
    """Check if a region has motion across frames (rejects static images/overlays)."""
    if len(frames) < 2:
        return True

    x, y, w, h = region['x'], region['y'], region['w'], region['h']
    diffs = []
    for i in range(1, min(len(frames), 6)):
        prev_crop = frames[i - 1][y:y + h, x:x + w]
        curr_crop = frames[i][y:y + h, x:x + w]
        if prev_crop.size == 0 or curr_crop.size == 0:
            continue

        # Fix #5: Resize to 64x64 for consistent comparison (matches multi_face approach)
        prev = cv2.cvtColor(cv2.resize(prev_crop, (64, 64)), cv2.COLOR_BGR2GRAY).astype(float)
        curr = cv2.cvtColor(cv2.resize(curr_crop, (64, 64)), cv2.COLOR_BGR2GRAY).astype(float)
        diff = np.mean(np.abs(curr - prev))
        diffs.append(diff)

    if not diffs:
        return True

    avg_motion = np.mean(diffs)
    print(f"[FACECAM-DETECT] Region motion: {avg_motion:.2f} (threshold: {threshold})")
    return avg_motion >= threshold


# ── Helpers for multi-frame face confirmation ──

def _confirm_face_in_region(
    candidate: Dict[str, int],
    frames: List[np.ndarray],
    score_threshold: float = 0.4
) -> Optional[Dict[str, Any]]:
    """
    Fix #4: Check multiple frames for face confirmation.
    If the streamer looks away in one frame, we still detect via others.
    Returns the best face found, or None.
    """
    n = len(frames)
    # Check frames at 1/4, 1/2, 3/4 positions
    check_indices = sorted(set([n // 4, n // 2, 3 * n // 4]))

    cx, cy, cw, ch = candidate['x'], candidate['y'], candidate['w'], candidate['h']
    best_face = None
    best_conf = 0.0

    for idx in check_indices:
        if idx >= n:
            continue
        crop = frames[idx][cy:cy + ch, cx:cx + cw]
        if crop.size == 0 or crop.shape[0] < 10 or crop.shape[1] < 10:
            continue

        faces = detect_faces_yunet(crop, score_threshold=score_threshold)
        if faces and faces[0]['confidence'] > best_conf:
            best_face = faces[0]
            best_conf = faces[0]['confidence']

    return best_face


# ── Pipeline ──

def handle_facecam(video_path: str, frame_w: int, frame_h: int, context: Any) -> Dict[str, Any]:
    """
    3-layer facecam detection pipeline:

    Layer 1: Temporal Variance Map — find overlay rectangle (no ML needed)
    Layer 2: YuNet Face Confirmation — verify a face in candidate regions
    Layer 3: Motion Verification — reject static images / meme overlays

    Fallback: YuNet full-frame → motion check → expand_face_to_webcam_region
    """
    duration, _, _ = get_video_info(video_path)

    if context:
        remaining_ms = context.get_remaining_time_in_millis()
        print(f"[KEEP-ALIVE] Starting facecam detection | Lambda time remaining: {remaining_ms // 1000}s")

    # Sample 10 frames (skip first/last 5%)
    safe_start = duration * 0.05
    safe_end = duration * 0.95
    num_samples = 10
    sample_times = [
        safe_start + (safe_end - safe_start) * i / (num_samples - 1)
        for i in range(num_samples)
    ]

    # Fix #2: Single temp dir for all frame extraction
    temp_dir = tempfile.mkdtemp()
    sampled_frames: List[np.ndarray] = []

    try:
        for i, t in enumerate(sample_times):
            frame_path = os.path.join(temp_dir, f"sample_{i:02d}.jpg")
            # Fix #3: -ss before -i for fast seeking
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

    print(f"[FACECAM-DETECT] Sampled {len(sampled_frames)} frames for variance analysis")

    if len(sampled_frames) < 3:
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

    # ── Layer 1: Temporal Variance Map ──
    print(f"[FACECAM-DETECT] Layer 1: Temporal variance from {len(sampled_frames)} frames")
    variance_map = compute_temporal_variance_map(sampled_frames)
    candidates = find_overlay_candidates_from_variance(variance_map, frame_w, frame_h)

    for c in candidates:
        c['score'] = score_overlay_candidate(c)
    candidates.sort(key=lambda c: c['score'], reverse=True)
    print(f"[FACECAM-DETECT] {len(candidates)} overlay candidates from variance analysis")

    if context:
        remaining_ms = context.get_remaining_time_in_millis()
        print(f"[KEEP-ALIVE] Variance analysis complete | Lambda time remaining: {remaining_ms // 1000}s")

    # ── Layer 2 + 3: YuNet confirmation (multi-frame) + motion check ──
    confirmed_region = None
    confirmed_face = None
    best_confidence = 0.0

    for candidate in candidates[:10]:
        cx, cy, cw, ch = candidate['x'], candidate['y'], candidate['w'], candidate['h']

        # Fix #4: Check 3 frames instead of just the middle one
        face = _confirm_face_in_region(candidate, sampled_frames, score_threshold=0.4)
        if not face:
            continue

        print(f"[FACECAM-DETECT] Layer 2: YuNet confirmed face in {cw}x{ch}+{cx}+{cy} "
              f"(conf={face['confidence']:.2f})")

        region = {'x': cx, 'y': cy, 'w': cw, 'h': ch}
        if not compute_region_motion(region, sampled_frames):
            print("[FACECAM-DETECT] Layer 3: Rejected — no motion (static image)")
            continue

        confirmed_region = region
        confirmed_face = {
            'x': cx + face['x'],
            'y': cy + face['y'],
            'w': face['w'],
            'h': face['h'],
        }
        best_confidence = face['confidence']
        print(f"[FACECAM-DETECT] Confirmed facecam: region={confirmed_region}")
        break

    # ── Fallback: YuNet full-frame scan ──
    if not confirmed_region:
        print("[FACECAM-DETECT] Variance pipeline found nothing — YuNet full-frame fallback")

        fallback_face = None
        for frame in sampled_frames:
            faces = detect_faces_yunet(frame, score_threshold=0.4)
            if faces and faces[0]['confidence'] > best_confidence:
                fallback_face = faces[0]
                best_confidence = faces[0]['confidence']

        if fallback_face:
            fallback_region = expand_face_to_webcam_region(fallback_face, frame_w, frame_h)

            # Fix #6: Fallback also checks motion to reject static face images
            if compute_region_motion(fallback_region, sampled_frames):
                confirmed_face = {
                    'x': fallback_face['x'], 'y': fallback_face['y'],
                    'w': fallback_face['w'], 'h': fallback_face['h'],
                }
                confirmed_region = fallback_region
                print(f"[FACECAM-DETECT] Fallback expansion: {confirmed_region}")
            else:
                print("[FACECAM-DETECT] Fallback rejected — static face image")

    if not confirmed_region or not confirmed_face:
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
