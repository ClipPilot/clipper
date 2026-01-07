import json
import os
import re
import tempfile
import subprocess
import boto3
import cv2
import urllib.request
from typing import List, Dict, Any, Tuple
from urllib.parse import urlparse
from concurrent.futures import ThreadPoolExecutor, as_completed

s3_client = boto3.client('s3')

FACE_CONFIG = {
    'min_confidence': 0.5,
    'min_face_size_percent': 0.03,
    'max_face_size_percent': 0.9,
    'min_consecutive_frames': 2,
    'min_segment_duration': 1.0,
    'sample_fps': 3,
    'merge_gap': 0.7,
    'padding': 0.3,
    'max_workers': 4,
}

FRAME_ACCURATE_CONFIG = {
    'min_confidence': 0.5,
    'min_face_size_percent': 0.03,
    'max_face_size_percent': 0.9,
    'min_consecutive_frames': 2,
    'min_segment_duration': 0.1,
    'sample_fps': 15,
    'merge_gap': 0.15,
    'padding': 0.0,
    'max_workers': 8,
}

PROTOTXT_URL = "https://raw.githubusercontent.com/opencv/opencv/master/samples/dnn/face_detector/deploy.prototxt"
CAFFEMODEL_URL = "https://raw.githubusercontent.com/opencv/opencv_3rdparty/dnn_samples_face_detector_20170830/res10_300x300_ssd_iter_140000.caffemodel"

BAKED_MODEL_DIR = "/var/task/models"
CACHE_MODEL_DIR = "/tmp/face_models"


def get_model_paths() -> Tuple[str, str]:
    baked_prototxt = os.path.join(BAKED_MODEL_DIR, "deploy.prototxt")
    baked_caffemodel = os.path.join(BAKED_MODEL_DIR, "res10_300x300_ssd_iter_140000.caffemodel")

    if os.path.exists(baked_prototxt) and os.path.exists(baked_caffemodel):
        print("[FACE-DETECT] Using baked-in models")
        return baked_prototxt, baked_caffemodel

    os.makedirs(CACHE_MODEL_DIR, exist_ok=True)
    cache_prototxt = os.path.join(CACHE_MODEL_DIR, "deploy.prototxt")
    cache_caffemodel = os.path.join(CACHE_MODEL_DIR, "res10_300x300_ssd_iter_140000.caffemodel")

    if not os.path.exists(cache_prototxt):
        print("[FACE-DETECT] Downloading prototxt...")
        urllib.request.urlretrieve(PROTOTXT_URL, cache_prototxt)

    if not os.path.exists(cache_caffemodel):
        print("[FACE-DETECT] Downloading caffemodel...")
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


def extract_frames(video_path: str, output_dir: str, fps: float = 5.0) -> List[str]:
    os.makedirs(output_dir, exist_ok=True)
    output_pattern = os.path.join(output_dir, 'frame_%04d.jpg')

    fps_val = min(float(fps), 30.0)
    if fps_val != int(fps_val):
        fps_filter = f'fps={fps_val:.2f}'
    else:
        fps_filter = f'fps={int(fps_val)}'

    cmd = [
        'ffmpeg', '-i', video_path,
        '-vf', fps_filter,
        '-q:v', '2',
        output_pattern,
        '-y', '-loglevel', 'warning'
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"[FACE-DETECT] FFmpeg stderr: {result.stderr}")
        raise RuntimeError(f"Frame extraction failed: {result.stderr}")

    frames = sorted([
        os.path.join(output_dir, f)
        for f in os.listdir(output_dir)
        if f.endswith('.jpg')
    ])
    return frames


def detect_faces_in_frame(net, frame_path: str) -> bool:
    image = cv2.imread(frame_path)
    if image is None:
        return False

    (h, w) = image.shape[:2]
    frame_area = w * h

    blob = cv2.dnn.blobFromImage(
        cv2.resize(image, (300, 300)),
        1.0,
        (300, 300),
        (104.0, 177.0, 123.0)
    )

    net.setInput(blob)
    detections = net.forward()

    for i in range(detections.shape[2]):
        confidence = detections[0, 0, i, 2]

        if confidence < FACE_CONFIG['min_confidence']:
            continue

        box = detections[0, 0, i, 3:7] * [w, h, w, h]
        (startX, startY, endX, endY) = box.astype("int")

        face_width = endX - startX
        face_height = endY - startY
        face_area = face_width * face_height
        face_size_percent = face_area / frame_area

        if (FACE_CONFIG['min_face_size_percent'] <= face_size_percent <=
            FACE_CONFIG['max_face_size_percent']):
            return True

    return False


def filter_isolated_detections(
    times: List[float],
    sample_interval: float,
    min_consecutive: int = None
) -> List[float]:
    if min_consecutive is None:
        min_consecutive = FACE_CONFIG['min_consecutive_frames']
    if len(times) < min_consecutive:
        return []

    sorted_times = sorted(times)
    valid_times = []
    max_gap = sample_interval * 1.5

    for i, current in enumerate(sorted_times):
        consecutive_count = 1

        for j in range(i - 1, -1, -1):
            if current - sorted_times[j] <= max_gap * (i - j):
                consecutive_count += 1
            else:
                break

        for j in range(i + 1, len(sorted_times)):
            if sorted_times[j] - current <= max_gap * (j - i):
                consecutive_count += 1
            else:
                break

        if consecutive_count >= min_consecutive:
            valid_times.append(current)

    return valid_times


def merge_times_into_segments(times: List[float], gap: float = 0.5) -> List[Dict[str, float]]:
    if not times:
        return []

    sorted_times = sorted(times)
    segments = []
    start = sorted_times[0]
    prev = sorted_times[0]

    for t in sorted_times[1:]:
        if t - prev <= gap:
            prev = t
        else:
            segments.append({'start': start, 'end': prev})
            start = t
            prev = t

    segments.append({'start': start, 'end': prev})
    return segments


def pad_segments(
    segments: List[Dict[str, float]],
    video_duration: float,
    padding: float = 0.3
) -> List[Dict[str, float]]:
    if not segments:
        return []

    padded = [
        {
            'start': seg['start'],
            'end': min(video_duration, seg['end'] + padding)
        }
        for seg in segments
    ]

    padded.sort(key=lambda x: x['start'])

    merged = []
    current = padded[0]

    for seg in padded[1:]:
        if seg['start'] <= current['end'] + 0.1:
            current = {
                'start': current['start'],
                'end': max(current['end'], seg['end'])
            }
        else:
            merged.append(current)
            current = seg
    merged.append(current)

    filtered = [
        seg for seg in merged
        if seg['end'] - seg['start'] >= FACE_CONFIG['min_segment_duration']
    ]

    return filtered


def get_video_info(video_path: str) -> Tuple[float, float]:
    """Get video duration and FPS using ffmpeg."""
    cmd = [
        'ffmpeg', '-i', video_path,
        '-f', 'null', '-'
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    stderr = result.stderr

    duration = 0.0
    fps = 30.0

    import re
    duration_match = re.search(r'Duration: (\d+):(\d+):(\d+)\.(\d+)', stderr)
    if duration_match:
        h, m, s, ms = duration_match.groups()
        duration = int(h) * 3600 + int(m) * 60 + int(s) + int(ms) / 100

    fps_match = re.search(r'(\d+(?:\.\d+)?)\s*fps', stderr)
    if fps_match:
        fps = float(fps_match.group(1))

    return duration, fps




def process_frame_batch(args: Tuple[int, str, str, str]) -> Tuple[int, bool]:
    frame_idx, frame_path, prototxt_path, caffemodel_path = args
    net = cv2.dnn.readNetFromCaffe(prototxt_path, caffemodel_path)
    has_face = detect_faces_in_frame(net, frame_path)
    return (frame_idx, has_face)


def detect_face_segments(
    video_path: str,
    net,
    config: Dict[str, Any] = None
) -> List[Dict[str, float]]:
    if config is None:
        config = FACE_CONFIG

    sample_rate = config['sample_fps']
    print(f"[FACE-DETECT] Using {sample_rate} FPS")

    sample_interval = 1 / sample_rate
    max_workers = config['max_workers']

    with tempfile.TemporaryDirectory() as temp_dir:
        frames_dir = os.path.join(temp_dir, 'frames')

        frames = extract_frames(video_path, frames_dir, sample_rate)
        if not frames:
            return []

        print(f"[FACE-DETECT] Processing {len(frames)} frames with {max_workers} workers...")

        prototxt_path, caffemodel_path = get_model_paths()

        frame_args = [
            (i, frame_path, prototxt_path, caffemodel_path)
            for i, frame_path in enumerate(frames)
        ]

        face_times = []
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = {executor.submit(process_frame_batch, args): args[0] for args in frame_args}

            for future in as_completed(futures):
                frame_idx, has_face = future.result()
                if has_face:
                    face_times.append(frame_idx / sample_rate)

        print(f"[FACE-DETECT] Raw detections: {len(face_times)}/{len(frames)} frames")

        filtered_times = filter_isolated_detections(
            face_times,
            sample_interval,
            min_consecutive=config['min_consecutive_frames']
        )
        print(f"[FACE-DETECT] After filtering: {len(filtered_times)} detections")

        segments = merge_times_into_segments(filtered_times, config['merge_gap'])
        print(f"[FACE-DETECT] Merged into {len(segments)} segments")

        return segments


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    print(f"[FACE-DETECT] Received event: {json.dumps(event)}")

    try:
        body = event.get('body')
        if isinstance(body, str):
            body = json.loads(body)
        elif body is None:
            body = event

        video_url = body.get('video_url') or body.get('videoUrl')
        video_duration = body.get('video_duration') or body.get('videoDuration')
        frame_accurate = body.get('frame_accurate') or body.get('frameAccurate') or False

        if not video_url:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'video_url is required'})
            }

        config = FRAME_ACCURATE_CONFIG if frame_accurate else FACE_CONFIG
        mode_name = "FRAME-ACCURATE" if frame_accurate else "STANDARD"
        print(f"[FACE-DETECT] Mode: {mode_name}")

        print("[FACE-DETECT] Loading face detector...")
        net = get_face_detector()

        with tempfile.NamedTemporaryFile(suffix='.mp4', delete=False) as tmp:
            video_path = tmp.name

        try:
            print(f"[FACE-DETECT] Downloading video from {video_url}")
            download_from_s3(video_url, video_path)

            detected_duration, native_fps = get_video_info(video_path)
            if not video_duration:
                video_duration = detected_duration

            print(f"[FACE-DETECT] Video: {video_duration}s @ {native_fps} FPS")

            raw_segments = detect_face_segments(video_path, net, config)

            segments = pad_segments(
                raw_segments,
                video_duration,
                config['padding']
            )

            print(f"[FACE-DETECT] Final segments: {segments}")

            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({
                    'success': True,
                    'segments': segments,
                    'videoDuration': video_duration,
                    'segmentCount': len(segments),
                    'frameAccurate': frame_accurate,
                    'nativeFps': native_fps,
                    'sampleFps': config['sample_fps']
                })
            }
        finally:
            if os.path.exists(video_path):
                os.unlink(video_path)

    except Exception as e:
        print(f"[FACE-DETECT] Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }
