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
    'min_confidence': 0.45,           # SSD confidence threshold (used by multi-face defaults)
    'min_face_size_percent': 0.003,   # Facecams are small — min 0.3% of frame
    'max_face_size_percent': 0.25,    # Reject detections > 25% of frame
    'num_sample_frames': 16,
    'skip_percent': 0.05,             # Skip first/last 5% of video
    'min_consistent_detections': 3,   # Need 3+ consistent detections
    'outlier_threshold_px': 50,       # Detections >50px from median are outliers
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



def detect_corner(region: Dict[str, int], frame_w: int, frame_h: int) -> str:
    """Determine which corner the facecam region is closest to."""
    cx = region['x'] + region['w'] / 2
    cy = region['y'] + region['h'] / 2

    horizontal = 'left' if cx < frame_w / 2 else 'right'
    vertical = 'top' if cy < frame_h / 2 else 'bottom'

    return f'{vertical}-{horizontal}'
