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
            if area_pct < 0.01 or area_pct > 0.40:
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

    # Edge proximity — facecams are on edges (corners, mid-left, mid-bottom, etc.)
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
    threshold: float = 5.0
) -> bool:
    """Check if a region has real motion (rejects static images/memes).

    Compares spread-apart frames (not just consecutive) so compression
    noise between similar frames doesn't fool it.  Requires multiple
    pairs to exceed the threshold — a single noisy pair isn't enough.
    """
    if len(frames) < 3:
        return True

    x, y, w, h = region['x'], region['y'], region['w'], region['h']

    # Pick spread-apart pairs across the full sample range
    n = len(frames)
    pair_indices = []
    if n >= 6:
        pair_indices = [(0, n // 3), (n // 3, 2 * n // 3), (2 * n // 3, n - 1),
                        (0, n // 2), (n // 2, n - 1)]
    else:
        pair_indices = [(0, n // 2), (n // 2, n - 1), (0, n - 1)]

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

    avg_motion = np.mean(diffs)
    # Require at least 2 pairs above threshold to confirm real motion
    pairs_above = sum(1 for d in diffs if d >= threshold)
    is_live = avg_motion >= threshold and pairs_above >= 2
    print(f"[FACECAM-DETECT] Region motion: avg={avg_motion:.2f} "
          f"pairs_above={pairs_above}/{len(diffs)} (threshold: {threshold}) → {'LIVE' if is_live else 'STATIC'}")
    return is_live


# ── Helpers for multi-frame face confirmation ──

def _confirm_face_in_region(
    candidate: Dict[str, int],
    frames: List[np.ndarray],
    score_threshold: float = 0.4
) -> Optional[Dict[str, Any]]:
    """
    Confirm a LIVE face exists in the candidate region.

    Two-layer check:
    1. Face must be detected in 2+ of 3 spread frames
    2. Face center must shift by >= 5px (rejects static images; accounts for YuNet bbox jitter)
    """
    n = len(frames)
    check_indices = sorted(set([n // 4, n // 2, 3 * n // 4]))

    cx, cy, cw, ch = candidate['x'], candidate['y'], candidate['w'], candidate['h']
    best_face = None
    best_conf = 0.0
    face_centers: List[Tuple[float, float]] = []

    for idx in check_indices:
        if idx >= n:
            continue
        crop = frames[idx][cy:cy + ch, cx:cx + cw]
        if crop.size == 0 or crop.shape[0] < 10 or crop.shape[1] < 10:
            continue

        faces = detect_faces_yunet(crop, score_threshold=score_threshold)
        if faces:
            f = faces[0]
            face_centers.append((f['x'] + f['w'] / 2, f['y'] + f['h'] / 2))
            if f['confidence'] > best_conf:
                best_face = f
                best_conf = f['confidence']

    if len(face_centers) < 2:
        return None

    # Face center must shift by >= 5px across frames (YuNet jitter is ~1-3px)
    max_shift = 0.0
    for i in range(1, len(face_centers)):
        dx = abs(face_centers[i][0] - face_centers[0][0])
        dy = abs(face_centers[i][1] - face_centers[0][1])
        max_shift = max(max_shift, dx + dy)

    if max_shift < 5.0:
        print(f"[FACECAM-DETECT] Rejected static face — shift={max_shift:.1f}px across {len(face_centers)} frames")
        return None

    return best_face


def _compute_face_motion(
    face_bbox: Dict[str, int],
    frames: List[np.ndarray],
    threshold: float = 5.0
) -> bool:
    """Check motion on the FACE region specifically (not the whole candidate).

    This prevents surrounding gameplay from masking a static face.
    """
    if len(frames) < 3:
        return True

    x, y, w, h = face_bbox['x'], face_bbox['y'], face_bbox['w'], face_bbox['h']
    n = len(frames)
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
    is_live = avg >= threshold and above >= 2
    print(f"[FACECAM-DETECT] Face-region motion: avg={avg:.2f} above={above}/{len(diffs)} → {'LIVE' if is_live else 'STATIC'}")
    return is_live


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

    # Sample frames (skip first/last 5%)
    safe_start = duration * 0.05
    safe_end = duration * 0.95
    num_samples = FACECAM_CONFIG['num_sample_frames']  # 16
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

    # ── Filter: only keep candidates near edges (not center of frame) ──
    # Facecams are always on edges/corners — reject anything in the middle 40%
    edge_margin_x = frame_w * 0.30
    edge_margin_y = frame_h * 0.30
    edge_candidates = []
    for c in candidates:
        ccx = c['x'] + c['w'] / 2
        ccy = c['y'] + c['h'] / 2
        near_edge = (ccx < edge_margin_x or ccx > frame_w - edge_margin_x or
                     ccy < edge_margin_y or ccy > frame_h - edge_margin_y)
        if near_edge:
            edge_candidates.append(c)
        else:
            print(f"[FACECAM-DETECT] Skipping center candidate at ({c['x']},{c['y']}) {c['w']}x{c['h']}")

    print(f"[FACECAM-DETECT] {len(edge_candidates)} edge candidates (from {len(candidates)} total)")

    # ── Layer 2 + 3: Check ALL edge candidates for a moving face ──
    confirmed_region = None
    confirmed_face = None
    best_confidence = 0.0

    for candidate in edge_candidates[:10]:
        cx, cy, cw, ch = candidate['x'], candidate['y'], candidate['w'], candidate['h']

        face = _confirm_face_in_region(candidate, sampled_frames, score_threshold=0.4)
        if not face:
            continue

        print(f"[FACECAM-DETECT] Layer 2: YuNet found face in {cw}x{ch}+{cx}+{cy} "
              f"(conf={face['confidence']:.2f})")

        # Motion check on the FACE region specifically (not the whole candidate)
        abs_face = {
            'x': cx + face['x'], 'y': cy + face['y'],
            'w': face['w'], 'h': face['h'],
        }
        if not _compute_face_motion(abs_face, sampled_frames):
            print(f"[FACECAM-DETECT] Layer 3: Rejected static face at ({abs_face['x']},{abs_face['y']})")
            continue

        confirmed_region = {'x': cx, 'y': cy, 'w': cw, 'h': ch}
        confirmed_face = abs_face
        best_confidence = face['confidence']
        print(f"[FACECAM-DETECT] Confirmed facecam: region={confirmed_region}")
        break

    # ── Fallback: YuNet full-frame → find moving face near edge ──
    if not confirmed_region:
        print("[FACECAM-DETECT] Variance pipeline found nothing — YuNet full-frame fallback")

        # Collect faces from spread frames — lower threshold to catch small facecam faces,
        # check every 2nd frame instead of every 3rd for better coverage
        all_faces: List[Dict[str, Any]] = []
        for frame in sampled_frames[::2]:
            faces = detect_faces_yunet(frame, score_threshold=0.3)
            all_faces.extend(faces)

        # Score by edge proximity — facecams are near any edge, not just corners
        scored = []
        for f in all_faces:
            fcx = f['x'] + f['w'] / 2
            fcy = f['y'] + f['h'] / 2
            # Skip faces in the center of the frame
            if (edge_margin_x < fcx < frame_w - edge_margin_x and
                    edge_margin_y < fcy < frame_h - edge_margin_y):
                continue
            # Distance to nearest edge (left, right, top, bottom)
            dist_to_edge = min(fcx, frame_w - fcx, fcy, frame_h - fcy)
            max_edge_dist = min(frame_w, frame_h) / 2
            edge_score = 1.0 - (dist_to_edge / max_edge_dist)
            combined = edge_score * 0.7 + f['confidence'] * 0.3
            scored.append((combined, f))
        scored.sort(key=lambda x: x[0], reverse=True)

        for _, fallback_face in scored[:5]:
            if _compute_face_motion(fallback_face, sampled_frames):
                fallback_region = expand_face_to_webcam_region(fallback_face, frame_w, frame_h)
                confirmed_face = {
                    'x': fallback_face['x'], 'y': fallback_face['y'],
                    'w': fallback_face['w'], 'h': fallback_face['h'],
                }
                confirmed_region = fallback_region
                print(f"[FACECAM-DETECT] Fallback: moving face at ({fallback_face['x']},{fallback_face['y']}), "
                      f"region={confirmed_region}")
                break
            else:
                print(f"[FACECAM-DETECT] Fallback skip: static face at ({fallback_face['x']},{fallback_face['y']})")

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

    # Pad region outward so the facecam isn't cropped too tight
    pad = FACECAM_CONFIG['region_padding_factor']
    cx = confirmed_region['x'] + confirmed_region['w'] / 2
    cy = confirmed_region['y'] + confirmed_region['h'] / 2
    pw = int(confirmed_region['w'] * pad)
    ph = int(confirmed_region['h'] * pad)
    px = max(0, int(cx - pw / 2))
    py = max(0, int(cy - ph / 2))
    pw = min(pw, frame_w - px)
    ph = min(ph, frame_h - py)

    snap = FACECAM_CONFIG['edge_snap_px']
    if px < snap:
        px = 0
    if py < snap:
        py = 0
    if (px + pw) > (frame_w - snap):
        pw = frame_w - px
    if (py + ph) > (frame_h - snap):
        ph = frame_h - py

    confirmed_region = {'x': px, 'y': py, 'w': pw, 'h': ph}

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
