import json
import os
import tempfile
import subprocess
import boto3
import cv2
import mediapipe as mp
from typing import List, Dict, Any
from urllib.parse import urlparse

s3_client = boto3.client('s3')

# MediaPipe face detection
mp_face_detection = mp.solutions.face_detection

# Configuration
FACE_CONFIG = {
    'min_confidence': 0.5,
    'min_face_size_percent': 0.03,
    'max_face_size_percent': 0.9,
    'min_consecutive_frames': 3,
    'min_segment_duration': 1.0,
    'sample_fps': 5,
    'merge_gap': 0.5,
    'padding': 0.3,
}


def download_from_s3(s3_url: str, local_path: str) -> None:
    """Download file from S3 URL to local path."""
    parsed = urlparse(s3_url)
    if parsed.scheme == 's3':
        bucket = parsed.netloc
        key = parsed.path.lstrip('/')
    else:
        # Handle https://bucket.s3.region.amazonaws.com/key format
        parts = parsed.netloc.split('.')
        bucket = parts[0]
        key = parsed.path.lstrip('/')

    s3_client.download_file(bucket, key, local_path)


def extract_frames(video_path: str, output_dir: str, fps: int = 5) -> List[str]:
    """Extract frames from video using ffmpeg."""
    os.makedirs(output_dir, exist_ok=True)
    output_pattern = os.path.join(output_dir, 'frame_%04d.jpg')

    cmd = [
        'ffmpeg', '-i', video_path,
        '-vf', f'fps={fps}',
        '-q:v', '2',
        output_pattern,
        '-y', '-loglevel', 'error'
    ]
    subprocess.run(cmd, check=True)

    frames = sorted([
        os.path.join(output_dir, f)
        for f in os.listdir(output_dir)
        if f.endswith('.jpg')
    ])
    return frames


def detect_faces_in_frame(
    face_detection: mp_face_detection.FaceDetection,
    frame_path: str
) -> bool:
    """Detect if frame contains a valid face."""
    image = cv2.imread(frame_path)
    if image is None:
        return False

    height, width = image.shape[:2]
    frame_area = width * height

    # Convert BGR to RGB for MediaPipe
    rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    results = face_detection.process(rgb_image)

    if not results.detections:
        return False

    for detection in results.detections:
        confidence = detection.score[0]
        if confidence < FACE_CONFIG['min_confidence']:
            continue

        # Get bounding box
        bbox = detection.location_data.relative_bounding_box
        face_width = bbox.width * width
        face_height = bbox.height * height
        face_area = face_width * face_height
        face_size_percent = face_area / frame_area

        if (FACE_CONFIG['min_face_size_percent'] <= face_size_percent <=
            FACE_CONFIG['max_face_size_percent']):
            return True

    return False


def filter_isolated_detections(times: List[float], sample_interval: float) -> List[float]:
    """Filter out isolated detections, keep only consecutive ones."""
    min_consecutive = FACE_CONFIG['min_consecutive_frames']
    if len(times) < min_consecutive:
        return []

    sorted_times = sorted(times)
    valid_times = []
    max_gap = sample_interval * 1.5

    for i, current in enumerate(sorted_times):
        consecutive_count = 1

        # Check backwards
        for j in range(i - 1, -1, -1):
            if current - sorted_times[j] <= max_gap * (i - j):
                consecutive_count += 1
            else:
                break

        # Check forwards
        for j in range(i + 1, len(sorted_times)):
            if sorted_times[j] - current <= max_gap * (j - i):
                consecutive_count += 1
            else:
                break

        if consecutive_count >= min_consecutive:
            valid_times.append(current)

    return valid_times


def merge_times_into_segments(times: List[float], gap: float = 0.5) -> List[Dict[str, float]]:
    """Merge adjacent times into segments."""
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
    """Add padding to segments and merge overlapping ones."""
    if not segments:
        return []

    # Add padding
    padded = [
        {
            'start': max(0, seg['start'] - padding),
            'end': min(video_duration, seg['end'] + padding)
        }
        for seg in segments
    ]

    # Sort by start time
    padded.sort(key=lambda x: x['start'])

    # Merge overlapping
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

    # Filter by minimum duration
    filtered = [
        seg for seg in merged
        if seg['end'] - seg['start'] >= FACE_CONFIG['min_segment_duration']
    ]

    return filtered


def get_video_duration(video_path: str) -> float:
    """Get video duration using ffprobe."""
    cmd = [
        'ffprobe', '-v', 'error',
        '-show_entries', 'format=duration',
        '-of', 'default=noprint_wrappers=1:nokey=1',
        video_path
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, check=True)
    return float(result.stdout.strip())


def detect_face_segments(video_path: str) -> List[Dict[str, float]]:
    """Main face detection pipeline."""
    sample_rate = FACE_CONFIG['sample_fps']
    sample_interval = 1 / sample_rate

    with tempfile.TemporaryDirectory() as temp_dir:
        frames_dir = os.path.join(temp_dir, 'frames')

        # Extract frames
        frames = extract_frames(video_path, frames_dir, sample_rate)
        if not frames:
            return []

        # Detect faces in each frame
        face_times = []
        with mp_face_detection.FaceDetection(
            model_selection=0,  # 0 for short-range, 1 for full-range
            min_detection_confidence=FACE_CONFIG['min_confidence']
        ) as face_detection:
            for i, frame_path in enumerate(frames):
                if detect_faces_in_frame(face_detection, frame_path):
                    face_times.append(i / sample_rate)

        print(f"Raw detections: {len(face_times)}/{len(frames)} frames")

        # Filter isolated detections
        filtered_times = filter_isolated_detections(face_times, sample_interval)
        print(f"After filtering: {len(filtered_times)} detections")

        # Merge into segments
        segments = merge_times_into_segments(filtered_times, FACE_CONFIG['merge_gap'])
        print(f"Merged into {len(segments)} segments")

        return segments


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Lambda handler for face detection."""
    print(f"Received event: {json.dumps(event)}")

    try:
        # Parse input
        body = event.get('body')
        if isinstance(body, str):
            body = json.loads(body)
        elif body is None:
            body = event

        video_url = body.get('video_url') or body.get('videoUrl')
        video_duration = body.get('video_duration') or body.get('videoDuration')

        if not video_url:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'video_url is required'})
            }

        with tempfile.NamedTemporaryFile(suffix='.mp4', delete=False) as tmp:
            video_path = tmp.name

        try:
            # Download video from S3
            print(f"Downloading video from {video_url}")
            download_from_s3(video_url, video_path)

            # Get video duration if not provided
            if not video_duration:
                video_duration = get_video_duration(video_path)

            print(f"Video duration: {video_duration}s")

            # Detect face segments
            raw_segments = detect_face_segments(video_path)

            # Add padding
            segments = pad_segments(
                raw_segments,
                video_duration,
                FACE_CONFIG['padding']
            )

            print(f"Final segments: {segments}")

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
                    'segmentCount': len(segments)
                })
            }
        finally:
            if os.path.exists(video_path):
                os.unlink(video_path)

    except Exception as e:
        print(f"Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }


if __name__ == '__main__':
    # Local testing
    test_event = {
        'video_url': 's3://test-bucket/test-video.mp4',
        'video_duration': 60
    }
    result = handler(test_event, None)
    print(json.dumps(result, indent=2))
