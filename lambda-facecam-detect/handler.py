import json
import os
import re
import shutil
import tempfile
import subprocess
import statistics
import boto3
import cv2
import numpy as np
from typing import List, Dict, Any, Tuple, Optional
from urllib.parse import urlparse

s3_client = boto3.client('s3')

# Facecam-specific config: tuned for small webcam overlays in gaming streams
FACECAM_CONFIG = {
    'min_confidence': 0.45,
    'min_face_size_percent': 0.003,   # Facecams are small — min 0.3% of frame
    'max_face_size_percent': 0.25,    # Reject large faces (talking-head, not a facecam)
    'num_sample_frames': 16,
    'skip_percent': 0.05,             # Skip first/last 5% of video
    'min_consistent_detections': 3,   # Need 3+ consistent face positions
    'outlier_threshold_px': 50,       # Faces >50px from median are outliers
    'expand_factor': 2.5,             # Expand face bbox by 2.5x to get webcam region
    'edge_snap_px': 30,               # Snap to edge if within 30px
}

# Multi-face config: tuned for podcast/interview content with 2+ visible speakers
MULTI_FACE_CONFIG = {
    'min_confidence': 0.5,
    'min_face_size_percent': 0.005,   # Keep min small for flexibility
    'max_face_size_percent': 0.9,     # Podcast faces can be large
    'num_sample_frames': 24,          # More frames for better consistency
    'skip_percent': 0.05,
    'min_consistent_detections': 3,
    'outlier_threshold_px': 80,       # Wider threshold for talking head movement
    'expand_factor': 2.5,
    'edge_snap_px': 30,
}

BAKED_MODEL_DIR = "/var/task/models"
CACHE_MODEL_DIR = "/tmp/face_models"

PROTOTXT_URL = "https://raw.githubusercontent.com/opencv/opencv/master/samples/dnn/face_detector/deploy.prototxt"
CAFFEMODEL_URL = "https://raw.githubusercontent.com/opencv/opencv_3rdparty/dnn_samples_face_detector_20170830/res10_300x300_ssd_iter_140000.caffemodel"


def get_model_paths() -> Tuple[str, str]:
    baked_prototxt = os.path.join(BAKED_MODEL_DIR, "deploy.prototxt")
    baked_caffemodel = os.path.join(BAKED_MODEL_DIR, "res10_300x300_ssd_iter_140000.caffemodel")

    if os.path.exists(baked_prototxt) and os.path.exists(baked_caffemodel):
        print("[FACECAM-DETECT] Using baked-in models")
        return baked_prototxt, baked_caffemodel

    os.makedirs(CACHE_MODEL_DIR, exist_ok=True)
    cache_prototxt = os.path.join(CACHE_MODEL_DIR, "deploy.prototxt")
    cache_caffemodel = os.path.join(CACHE_MODEL_DIR, "res10_300x300_ssd_iter_140000.caffemodel")

    if not os.path.exists(cache_prototxt):
        import urllib.request
        print("[FACECAM-DETECT] Downloading prototxt...")
        urllib.request.urlretrieve(PROTOTXT_URL, cache_prototxt)

    if not os.path.exists(cache_caffemodel):
        import urllib.request
        print("[FACECAM-DETECT] Downloading caffemodel...")
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


def get_video_info(video_path: str) -> Tuple[float, int, int]:
    """Get video duration, width, and height using ffprobe."""
    cmd = [
        'ffprobe', '-v', 'error',
        '-select_streams', 'v:0',
        '-show_entries', 'stream=width,height',
        '-show_entries', 'format=duration',
        '-of', 'json',
        video_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"ffprobe failed: {result.stderr}")

    info = json.loads(result.stdout)
    duration = float(info.get('format', {}).get('duration', 0))
    stream = info.get('streams', [{}])[0]
    width = int(stream.get('width', 0))
    height = int(stream.get('height', 0))

    return duration, width, height


def extract_sample_frames(video_path: str, num_frames: int = 12, skip_percent: float = 0.05) -> List[str]:
    """Sample evenly-spaced frames, skipping first/last 5% of the video."""
    duration, _, _ = get_video_info(video_path)
    start = duration * skip_percent
    end = duration * (1 - skip_percent)
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


def detect_faces_multiscale(net, frame_path: str, config: Optional[Dict] = None) -> List[Dict[str, Any]]:
    """Multi-scale face detection: full frame + corner crops for small facecams.

    Small facecams in corners get missed at 300x300 on a full 1080p frame because
    the face gets downsampled to ~9px. By cropping each corner (45% of frame) and
    running detection on the crop, we get ~2x effective resolution where facecams live.
    """
    image = cv2.imread(frame_path)
    if image is None:
        return []

    (h, w) = image.shape[:2]
    frame_area = w * h
    if config is None:
        config = FACECAM_CONFIG

    # 1. Standard full-frame detection
    all_faces = detect_face_bboxes_in_frame(net, frame_path, config)

    # 2. Corner-crop detection — each crop is 45% of frame to overlap slightly
    crop_frac = 0.45
    cw = int(w * crop_frac)
    ch = int(h * crop_frac)

    corners = [
        (0, 0),            # top-left
        (w - cw, 0),       # top-right
        (0, h - ch),       # bottom-left
        (w - cw, h - ch),  # bottom-right
    ]

    # Lower confidence for corner crops — higher effective resolution means
    # the model sees more detail, but small faces still score lower
    corner_conf = max(config['min_confidence'] - 0.1, 0.30)

    for (ox, oy) in corners:
        crop = image[oy:oy + ch, ox:ox + cw]
        if crop.size == 0:
            continue

        ch_actual, cw_actual = crop.shape[:2]

        blob = cv2.dnn.blobFromImage(
            cv2.resize(crop, (300, 300)), 1.0, (300, 300), (104.0, 177.0, 123.0)
        )
        net.setInput(blob)
        detections = net.forward()

        for i in range(detections.shape[2]):
            conf = float(detections[0, 0, i, 2])
            if conf < corner_conf:
                continue

            box = detections[0, 0, i, 3:7] * [cw_actual, ch_actual, cw_actual, ch_actual]
            (sx, sy, ex, ey) = box.astype("int")

            # Map back to full-frame coordinates
            sx += ox
            sy += oy
            ex += ox
            ey += oy

            fw = max(0, ex - sx)
            fh = max(0, ey - sy)
            fa = fw * fh
            pct = fa / frame_area if frame_area > 0 else 0

            if not (config['min_face_size_percent'] <= pct <= config['max_face_size_percent']):
                continue

            # Deduplicate: skip if >50% overlap with an existing detection
            is_dup = False
            for ef in all_faces:
                ix1 = max(sx, ef['x'])
                iy1 = max(sy, ef['y'])
                ix2 = min(sx + fw, ef['x'] + ef['w'])
                iy2 = min(sy + fh, ef['y'] + ef['h'])
                if ix1 < ix2 and iy1 < iy2:
                    inter = (ix2 - ix1) * (iy2 - iy1)
                    smaller = min(fa, ef['w'] * ef['h'])
                    if smaller > 0 and inter / smaller > 0.5:
                        # Keep the higher-confidence detection
                        if conf > ef['confidence']:
                            ef['confidence'] = conf
                        is_dup = True
                        break

            if not is_dup:
                all_faces.append({
                    'x': max(0, sx), 'y': max(0, sy),
                    'w': fw, 'h': fh, 'confidence': conf,
                })

    return all_faces


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


def cluster_face_positions(all_faces: List[Dict]) -> Optional[Dict]:
    """Take median of all face positions across frames, filter outliers.

    Requires min_consistent_detections consistent detections.
    Returns median bbox or None.
    """
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


def expand_face_to_webcam_region(face_bbox: Dict, frame_w: int, frame_h: int) -> Dict[str, int]:
    """Expand face bounding box ~2.5x to estimate the full webcam overlay region.

    Snaps to nearest edge if within 30px (facecams are flush with corners).
    """
    config = FACECAM_CONFIG
    factor = config['expand_factor']
    snap = config['edge_snap_px']

    face_cx = face_bbox['x'] + face_bbox['w'] / 2
    face_cy = face_bbox['y'] + face_bbox['h'] / 2

    # Use the larger of w/h to make a square-ish region
    face_size = max(face_bbox['w'], face_bbox['h'])
    region_size = int(face_size * factor)

    # Center the expanded region on the face
    rx = int(face_cx - region_size / 2)
    ry = int(face_cy - region_size / 2)
    rw = region_size
    rh = region_size

    # Snap to edges if close
    if rx < snap:
        rx = 0
    if ry < snap:
        ry = 0
    if (rx + rw) > (frame_w - snap):
        rw = frame_w - rx
    if (ry + rh) > (frame_h - snap):
        rh = frame_h - ry

    # Clamp to frame bounds
    rx = max(0, rx)
    ry = max(0, ry)
    rw = min(rw, frame_w - rx)
    rh = min(rh, frame_h - ry)

    return {'x': rx, 'y': ry, 'w': rw, 'h': rh}


def detect_corner(region: Dict[str, int], frame_w: int, frame_h: int) -> str:
    """Determine which corner the facecam region is closest to."""
    cx = region['x'] + region['w'] / 2
    cy = region['y'] + region['h'] / 2

    horizontal = 'left' if cx < frame_w / 2 else 'right'
    vertical = 'top' if cy < frame_h / 2 else 'bottom'

    return f'{vertical}-{horizontal}'


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
        median_bbox = cluster_face_positions(group)
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


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    print(f"[FACECAM-DETECT] Received event: {json.dumps(event)}")

    try:
        body = event.get('body')
        if isinstance(body, str):
            body = json.loads(body)
        elif body is None:
            body = event

        video_url = body.get('video_url') or body.get('videoUrl')
        mode = body.get('mode', 'facecam')  # 'facecam' (default) or 'multi-face'

        if not video_url:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'video_url is required'}),
            }

        print("[FACECAM-DETECT] Loading face detector...")
        net = get_face_detector()

        with tempfile.NamedTemporaryFile(suffix='.mp4', delete=False) as tmp:
            video_path = tmp.name

        try:
            print(f"[FACECAM-DETECT] Downloading video from {video_url}")
            download_from_s3(video_url, video_path)

            duration, frame_w, frame_h = get_video_info(video_path)
            print(f"[FACECAM-DETECT] Video: {duration:.1f}s, {frame_w}x{frame_h}, mode={mode}")

            # Route to multi-face handler if requested
            if mode == 'multi-face':
                return handle_multi_face(net, video_path, frame_w, frame_h, context)

            if context:
                remaining_ms = context.get_remaining_time_in_millis()
                print(f"[KEEP-ALIVE] Download complete | Lambda time remaining: {remaining_ms // 1000}s")

            # Sample frames
            config = FACECAM_CONFIG
            frame_paths = extract_sample_frames(
                video_path,
                num_frames=config['num_sample_frames'],
                skip_percent=config['skip_percent'],
            )
            print(f"[FACECAM-DETECT] Extracted {len(frame_paths)} sample frames")

            # Detect ALL faces in each frame using multi-scale (corner crops for small facecams)
            all_frame_faces: List[List[Dict]] = []
            for i, frame_path in enumerate(frame_paths):
                faces = detect_faces_multiscale(net, frame_path, config)
                all_frame_faces.append(faces)

                if context and (i + 1) % 4 == 0:
                    remaining_ms = context.get_remaining_time_in_millis()
                    print(f"[KEEP-ALIVE] Processed {i + 1}/{len(frame_paths)} frames | Lambda time remaining: {remaining_ms // 1000}s")

            total_detections = sum(len(ff) for ff in all_frame_faces)
            frames_with_faces = sum(1 for ff in all_frame_faces if ff)
            print(f"[FACECAM-DETECT] Found {total_detections} faces across {frames_with_faces}/{len(frame_paths)} frames")

            # Group faces by position, then filter out static ones (memes, images)
            face_groups = group_faces_by_position(all_frame_faces, threshold_px=config['outlier_threshold_px'])
            print(f"[FACECAM-DETECT] Found {len(face_groups)} face groups")

            MOTION_THRESHOLD = 3.0  # Below this = static image
            live_groups = []
            for group in face_groups:
                if len(group) < config['min_consistent_detections']:
                    continue
                median_bbox = cluster_face_positions(group)
                if median_bbox is None:
                    continue
                motion = compute_face_motion(frame_paths, median_bbox, threshold=MOTION_THRESHOLD)
                print(f"[FACECAM-DETECT] Group at ({median_bbox['x']},{median_bbox['y']}): {len(group)} detections, motion={motion:.1f}")
                if motion >= MOTION_THRESHOLD:
                    live_groups.append((median_bbox, motion))
                else:
                    print(f"[FACECAM-DETECT] Filtered out static face (motion={motion:.1f})")

            # From live face groups, pick the one closest to a corner (facecams live in corners)
            face_bbox: Optional[Dict] = None
            if live_groups:
                face_bbox = select_facecam_face(
                    [g[0] for g in live_groups], frame_w, frame_h
                )

            detection_rate = frames_with_faces / max(len(frame_paths), 1)

            if face_bbox is None:
                print("[FACECAM-DETECT] No consistent live facecam detected")
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json'},
                    'body': json.dumps({
                        'success': True,
                        'facecamDetected': False,
                        'facecamRegion': None,
                        'corner': None,
                        'faceRegion': None,
                        'detectionRate': round(detection_rate, 2),
                        'frameWidth': frame_w,
                        'frameHeight': frame_h,
                    }),
                }

            # Expand face to webcam region
            facecam_region = expand_face_to_webcam_region(face_bbox, frame_w, frame_h)
            corner = detect_corner(facecam_region, frame_w, frame_h)

            print(f"[FACECAM-DETECT] Facecam detected at {corner}: region={facecam_region}, face={face_bbox}")

            # Clean up frame temp directory
            if frame_paths:
                frame_dir = os.path.dirname(frame_paths[0])
                shutil.rmtree(frame_dir, ignore_errors=True)

            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json'},
                'body': json.dumps({
                    'success': True,
                    'facecamDetected': True,
                    'facecamRegion': facecam_region,
                    'corner': corner,
                    'faceRegion': {
                        'x': face_bbox['x'],
                        'y': face_bbox['y'],
                        'w': face_bbox['w'],
                        'h': face_bbox['h'],
                    },
                    'detectionRate': round(detection_rate, 2),
                    'frameWidth': frame_w,
                    'frameHeight': frame_h,
                }),
            }
        finally:
            if os.path.exists(video_path):
                os.unlink(video_path)

    except Exception as e:
        print(f"[FACECAM-DETECT] Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)}),
        }
