"""
SSCD Similarity Lambda — computes cosine similarity between original and modified videos
using Meta's SSCD (Self-Supervised Copy Detection) model to verify uniquification effectiveness.
"""
import json
import os
import subprocess
import tempfile
import glob as glob_module
import traceback

import boto3
import numpy as np
import torch
from PIL import Image
from torchvision import transforms
from urllib.parse import urlparse

# Module-level model cache for warm Lambda reuse
_model = None
s3_client = boto3.client('s3')

# SSCD preprocessing: 288x288 with ImageNet normalization
SSCD_TRANSFORM = transforms.Compose([
    transforms.Resize((288, 288)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
])

DEFAULTS = {
    'max_seconds': 10,
    'fps': 1,
    'threshold': 0.75,
}


def get_model():
    """Load SSCD model (cached at module level for warm Lambda reuse)."""
    global _model
    if _model is None:
        model_path = "/var/task/models/sscd_disc_mixup.torchscript.pt"
        print(f"[SSCD] Loading model from {model_path}")
        _model = torch.jit.load(model_path, map_location="cpu")
        _model.eval()
        print("[SSCD] Model loaded successfully")
    return _model


def download_from_s3_url(s3_url, local_path):
    """Download from S3 URL (s3:// or https://) to local path."""
    parsed = urlparse(s3_url)
    if parsed.scheme == 's3':
        bucket = parsed.netloc
        key = parsed.path.lstrip('/')
    else:
        parts = parsed.netloc.split('.')
        bucket = parts[0]
        key = parsed.path.lstrip('/')

    print(f"[SSCD] Downloading s3://{bucket}/{key}")
    s3_client.download_file(bucket, key, local_path)


def extract_frames(video_path, output_dir, max_seconds, fps):
    """Extract frames from the first N seconds of a video using ffmpeg."""
    pattern = os.path.join(output_dir, "frame_%04d.jpg")
    cmd = [
        'ffmpeg', '-i', video_path,
        '-t', str(max_seconds),
        '-vf', f'fps={fps}',
        '-q:v', '2',
        pattern,
        '-y', '-loglevel', 'warning'
    ]
    subprocess.run(cmd, check=True, capture_output=True, text=True)

    frames = sorted(glob_module.glob(os.path.join(output_dir, "frame_*.jpg")))
    print(f"[SSCD] Extracted {len(frames)} frames from {video_path}")
    return frames


def compute_video_embedding(frame_paths, model):
    """
    Compute a single L2-normalized SSCD embedding for a video from its extracted frames.
    Batches all frames in one forward pass for efficiency (typically <=10 frames).
    """
    tensors = []
    for path in frame_paths:
        try:
            img = Image.open(path).convert("RGB")
            tensors.append(SSCD_TRANSFORM(img))
        except Exception as e:
            print(f"[SSCD] Skipping corrupt frame {path}: {e}")

    if not tensors:
        return None

    batch = torch.stack(tensors)  # [N, 3, 288, 288]
    with torch.no_grad():
        embeddings = model(batch).numpy()  # [N, 512]

    avg = embeddings.mean(axis=0)  # [512]
    norm = np.linalg.norm(avg)
    if norm < 1e-8:
        return None
    return avg / norm


def compute_cosine_similarity(embedding_a, embedding_b):
    """Compute cosine similarity between two L2-normalized embeddings."""
    return float(np.dot(embedding_a, embedding_b))


def handler(event, context):
    """
    Lambda handler for SSCD similarity checking.

    Input event:
    {
        "original_url": "s3://bucket/path/to/original.mp4",
        "modified_url": "s3://bucket/path/to/modified.mp4",
        "max_seconds": 10,   // optional, default 10
        "fps": 1,            // optional, default 1
        "threshold": 0.75    // optional, default 0.75
    }
    """
    print(f"[SSCD] Received event: {json.dumps(event)}")

    try:
        body = event.get('body')
        if isinstance(body, str):
            body = json.loads(body)
        elif body is None:
            body = event

        original_url = body.get('original_url')
        modified_url = body.get('modified_url')

        if not original_url or not modified_url:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'original_url and modified_url are required'})
            }

        max_seconds = int(body.get('max_seconds', DEFAULTS['max_seconds']))
        fps = int(body.get('fps', DEFAULTS['fps']))
        threshold = float(body.get('threshold', DEFAULTS['threshold']))

        # Load model (cached on warm invocations)
        model = get_model()

        with tempfile.TemporaryDirectory() as tmpdir:
            original_path = os.path.join(tmpdir, "original.mp4")
            modified_path = os.path.join(tmpdir, "modified.mp4")
            original_frames_dir = os.path.join(tmpdir, "original_frames")
            modified_frames_dir = os.path.join(tmpdir, "modified_frames")
            os.makedirs(original_frames_dir)
            os.makedirs(modified_frames_dir)

            # Download both videos
            download_from_s3_url(original_url, original_path)
            download_from_s3_url(modified_url, modified_path)

            # Extract frames from first N seconds
            original_frames = extract_frames(original_path, original_frames_dir, max_seconds, fps)
            modified_frames = extract_frames(modified_path, modified_frames_dir, max_seconds, fps)

            if not original_frames or not modified_frames:
                return {
                    'statusCode': 200,
                    'body': json.dumps({
                        'success': False,
                        'error': 'Could not extract frames from one or both videos',
                        'original_frames': len(original_frames),
                        'modified_frames': len(modified_frames),
                    })
                }

            # Compute embeddings
            original_embedding = compute_video_embedding(original_frames, model)
            modified_embedding = compute_video_embedding(modified_frames, model)

            if original_embedding is None or modified_embedding is None:
                return {
                    'statusCode': 200,
                    'body': json.dumps({
                        'success': False,
                        'error': 'Could not compute embeddings for one or both videos',
                    })
                }

            # Compute similarity
            similarity = compute_cosine_similarity(original_embedding, modified_embedding)
            below = similarity < threshold

            print(f"[SSCD] Cosine similarity: {similarity:.4f} (threshold: {threshold}, below: {below})")

            return {
                'statusCode': 200,
                'body': json.dumps({
                    'success': True,
                    'cosine_similarity': round(similarity, 4),
                    'below_threshold': below,
                    'threshold': threshold,
                    'original_frames': len(original_frames),
                    'modified_frames': len(modified_frames),
                })
            }

    except Exception as e:
        print(f"[SSCD] Error: {str(e)}")
        traceback.print_exc()
        return {
            'statusCode': 200,
            'body': json.dumps({
                'success': False,
                'error': str(e),
            })
        }
