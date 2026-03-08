import json
import os
import shutil
import tempfile
import subprocess
import numpy as np
from typing import List, Dict, Any

from ultralytics import YOLO

from shared import (
    FACECAM_CONFIG,
    get_video_info,
    detect_corner,
)

# Cached YOLO detector — loaded once, reused across Lambda invocations
_yolo_model = None


def _get_yolo_model() -> YOLO:
    """Get or create the cached YOLO facecam detector."""
    global _yolo_model
    if _yolo_model is None:
        model_path = os.path.join(os.path.dirname(__file__), 'best.pt')
        _yolo_model = YOLO(model_path)
    return _yolo_model


def _no_facecam_response(frame_w: int, frame_h: int) -> Dict[str, Any]:
    """Return a standard 'no facecam found' response."""
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


def _snap_and_clamp(region: Dict[str, int], frame_w: int, frame_h: int) -> Dict[str, int]:
    """Snap edges close to frame borders and clamp within bounds.

    Facecams sit flush in corners, so if an edge is within snap distance
    of the frame border, extend it to the border.
    """
    snap = FACECAM_CONFIG['edge_snap_px']
    x, y, w, h = region['x'], region['y'], region['w'], region['h']

    if x < snap:
        w += x
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


def handle_facecam(video_path: str, frame_w: int, frame_h: int, context: Any) -> Dict[str, Any]:
    """
    YOLO-based facecam detection pipeline:

    1. Sample frames from video (skip first/last 5%)
    2. Run custom YOLO model to detect facecam overlays directly
    3. Filter by size and outlier position
    4. Compute median bounding box across frames for stability
    5. Snap to frame edges and determine corner position
    """
    duration, _, _ = get_video_info(video_path)

    if context:
        remaining_ms = context.get_remaining_time_in_millis()
        print(f"[KEEP-ALIVE] Starting facecam detection | Lambda time remaining: {remaining_ms // 1000}s")

    # ── Step 1: Sample frames ──
    num_samples = FACECAM_CONFIG['num_sample_frames']
    skip_pct = FACECAM_CONFIG['skip_percent']
    safe_start = duration * skip_pct
    safe_end = duration * (1 - skip_pct)
    sample_times = [
        safe_start + (safe_end - safe_start) * i / (num_samples - 1)
        for i in range(num_samples)
    ]

    temp_dir = tempfile.mkdtemp()
    frame_paths: List[str] = []

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
                frame_paths.append(frame_path)

        print(f"[FACECAM-DETECT] Sampled {len(frame_paths)} frames")

        if len(frame_paths) < 3:
            return _no_facecam_response(frame_w, frame_h)

        if context:
            remaining_ms = context.get_remaining_time_in_millis()
            print(f"[KEEP-ALIVE] Frame sampling done | Lambda time remaining: {remaining_ms // 1000}s")

        # ── Step 2: Run YOLO on all frames ──
        model = _get_yolo_model()
        frame_area = frame_w * frame_h
        max_facecam_pct = FACECAM_CONFIG['max_face_size_percent']
        min_facecam_pct = FACECAM_CONFIG['min_face_size_percent']

        detections: List[Dict[str, Any]] = []

        for frame_path in frame_paths:
            results = model.predict(source=frame_path, conf=0.5, verbose=False)
            for r in results:
                if r.boxes is None or len(r.boxes) == 0:
                    continue
                # Pick highest confidence detection per frame
                best_idx = r.boxes.conf.argmax().item()
                box = r.boxes[best_idx]
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                conf = box.conf[0].item()

                det_w = int(x2 - x1)
                det_h = int(y2 - y1)
                det_area = det_w * det_h
                det_pct = det_area / frame_area if frame_area > 0 else 0

                if min_facecam_pct <= det_pct <= max_facecam_pct:
                    detections.append({
                        'x': int(x1),
                        'y': int(y1),
                        'w': det_w,
                        'h': det_h,
                        'confidence': conf,
                    })

        print(f"[FACECAM-DETECT] YOLO found {len(detections)} valid detections across {len(frame_paths)} frames")

        if context:
            remaining_ms = context.get_remaining_time_in_millis()
            print(f"[KEEP-ALIVE] YOLO inference done | Lambda time remaining: {remaining_ms // 1000}s")

        # ── Step 3: Consistency check ──
        min_consistent = FACECAM_CONFIG['min_consistent_detections']
        if len(detections) < min_consistent:
            print(f"[FACECAM-DETECT] Not enough consistent detections ({len(detections)} < {min_consistent})")
            return _no_facecam_response(frame_w, frame_h)

        # ── Step 4: Filter outliers by distance from median center ──
        median_cx = float(np.median([d['x'] + d['w'] / 2 for d in detections]))
        median_cy = float(np.median([d['y'] + d['h'] / 2 for d in detections]))
        threshold = FACECAM_CONFIG['outlier_threshold_px']

        filtered = [
            d for d in detections
            if abs((d['x'] + d['w'] / 2) - median_cx) <= threshold
            and abs((d['y'] + d['h'] / 2) - median_cy) <= threshold
        ]

        if len(filtered) < min_consistent:
            print(f"[FACECAM-DETECT] Not enough detections after outlier filtering ({len(filtered)})")
            return _no_facecam_response(frame_w, frame_h)

        # ── Step 5: Compute median bounding box for stability ──
        region = {
            'x': int(np.median([d['x'] for d in filtered])),
            'y': int(np.median([d['y'] for d in filtered])),
            'w': int(np.median([d['w'] for d in filtered])),
            'h': int(np.median([d['h'] for d in filtered])),
        }
        avg_confidence = float(np.mean([d['confidence'] for d in filtered]))
        detection_rate = len(filtered) / len(frame_paths)

        # ── Step 6: Snap to frame edges ──
        region = _snap_and_clamp(region, frame_w, frame_h)

        corner = detect_corner(region, frame_w, frame_h)
        print(f"[FACECAM-DETECT] Facecam detected at {corner}: region={region}, "
              f"confidence={avg_confidence:.2f}, rate={detection_rate:.0%}")

        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({
                'success': True,
                'facecamDetected': True,
                'facecamRegion': region,
                'corner': corner,
                'faceRegion': None,
                'detectionRate': round(avg_confidence, 2),
                'frameWidth': frame_w,
                'frameHeight': frame_h,
            }),
        }
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)
