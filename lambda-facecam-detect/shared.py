import json
import os
import tempfile
import subprocess
import boto3
import cv2
import numpy as np
from typing import List, Dict, Any, Tuple
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
YUNET_MODEL_URL = "https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx"


def get_model_paths() -> Tuple[str, str]:
    """Get paths to ResNet-10 SSD face detector model files."""
    baked_prototxt = os.path.join(BAKED_MODEL_DIR, "deploy.prototxt")
    baked_caffemodel = os.path.join(BAKED_MODEL_DIR, "res10_300x300_ssd_iter_140000.caffemodel")

    if os.path.exists(baked_prototxt) and os.path.exists(baked_caffemodel):
        print("[FACECAM-DETECT] Using baked-in SSD models")
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
    """Load ResNet-10 SSD face detector (used by multi-face mode)."""
    prototxt_path, caffemodel_path = get_model_paths()
    net = cv2.dnn.readNetFromCaffe(prototxt_path, caffemodel_path)
    return net


def get_yunet_model_path() -> str:
    """Get path to YuNet ONNX model (baked in or downloaded on first use)."""
    baked = os.path.join(BAKED_MODEL_DIR, "face_detection_yunet_2023mar.onnx")
    if os.path.exists(baked):
        print("[FACECAM-DETECT] Using baked-in YuNet model")
        return baked

    os.makedirs(CACHE_MODEL_DIR, exist_ok=True)
    cached = os.path.join(CACHE_MODEL_DIR, "face_detection_yunet_2023mar.onnx")
    if not os.path.exists(cached):
        import urllib.request
        print("[FACECAM-DETECT] Downloading YuNet model...")
        urllib.request.urlretrieve(YUNET_MODEL_URL, cached)
    return cached


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


def expand_face_to_webcam_region(face_bbox: Dict, frame_w: int, frame_h: int) -> Dict[str, int]:
    """Expand face bounding box ~2.5x to estimate the full webcam overlay region.

    Snaps to nearest edge if within 30px (facecams are flush with corners).
    """
    factor = FACECAM_CONFIG['expand_factor']
    snap = FACECAM_CONFIG['edge_snap_px']

    face_cx = face_bbox['x'] + face_bbox['w'] / 2
    face_cy = face_bbox['y'] + face_bbox['h'] / 2

    face_size = max(face_bbox['w'], face_bbox['h'])
    region_size = int(face_size * factor)

    rx = int(face_cx - region_size / 2)
    ry = int(face_cy - region_size / 2)
    rw = region_size
    rh = region_size

    if rx < snap:
        rx = 0
    if ry < snap:
        ry = 0
    if (rx + rw) > (frame_w - snap):
        rw = frame_w - rx
    if (ry + rh) > (frame_h - snap):
        rh = frame_h - ry

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
