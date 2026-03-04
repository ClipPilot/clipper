"""
SSCD Similarity Lambda — two modes:
1. "compare": Compute cosine similarity between original and modified videos
2. "perturb": Generate adversarial perturbation that makes SSCD see a different video
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

_model = None
s3_client = boto3.client('s3')

IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]

SSCD_TRANSFORM = transforms.Compose([
    transforms.Resize((288, 288)),
    transforms.ToTensor(),
    transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
])

DEFAULTS = {
    'max_seconds': 10,
    'fps': 1,
    'threshold': 0.75,
}


def get_model():
    global _model
    if _model is None:
        model_path = "/var/task/models/sscd_disc_mixup.torchscript.pt"
        print(f"[SSCD] Loading model from {model_path}")
        _model = torch.jit.load(model_path, map_location="cpu")
        _model.eval()
        print("[SSCD] Model loaded successfully")
    return _model


def parse_s3_url(s3_url):
    parsed = urlparse(s3_url)
    if parsed.scheme == 's3':
        return parsed.netloc, parsed.path.lstrip('/')
    parts = parsed.netloc.split('.')
    return parts[0], parsed.path.lstrip('/')


def download_from_s3_url(s3_url, local_path):
    bucket, key = parse_s3_url(s3_url)
    print(f"[SSCD] Downloading s3://{bucket}/{key}")
    s3_client.download_file(bucket, key, local_path)


def upload_to_s3(local_path, bucket, key):
    print(f"[SSCD] Uploading to s3://{bucket}/{key}")
    s3_client.upload_file(local_path, bucket, key, ExtraArgs={'ContentType': 'video/mp4'})


def extract_frames(video_path, output_dir, max_seconds, fps):
    pattern = os.path.join(output_dir, "frame_%04d.png")
    cmd = [
        'ffmpeg', '-i', video_path,
        '-t', str(max_seconds),
        '-vf', f'fps={fps}',
        pattern,
        '-y', '-loglevel', 'warning'
    ]
    subprocess.run(cmd, check=True, capture_output=True, text=True)
    frames = sorted(glob_module.glob(os.path.join(output_dir, "frame_*.png")))
    print(f"[SSCD] Extracted {len(frames)} frames from {video_path}")
    return frames


def compute_video_embedding(frame_paths, model):
    tensors = []
    for path in frame_paths:
        try:
            img = Image.open(path).convert("RGB")
            tensors.append(SSCD_TRANSFORM(img))
        except Exception as e:
            print(f"[SSCD] Skipping corrupt frame {path}: {e}")

    if not tensors:
        return None

    batch = torch.stack(tensors)
    with torch.no_grad():
        embeddings = model(batch).numpy()

    avg = embeddings.mean(axis=0)
    norm = np.linalg.norm(avg)
    if norm < 1e-8:
        return None
    return avg / norm


def compute_cosine_similarity(embedding_a, embedding_b):
    return float(np.dot(embedding_a, embedding_b))


def compute_perturbation(frame_paths, model, epsilon=0.15, steps=10):
    """
    Run PGD on sample frames to compute an adversarial perturbation tensor.
    Returns the averaged perturbation in normalized ImageNet space.
    """
    tensors = []
    for path in frame_paths:
        img = Image.open(path).convert("RGB")
        tensors.append(SSCD_TRANSFORM(img))

    if not tensors:
        return None

    batch = torch.stack(tensors)  # [N, 3, 288, 288]

    with torch.no_grad():
        original_embedding = model(batch)  # [N, 512]

    perturbation = torch.zeros_like(batch, requires_grad=True)
    step_size = 2.5 * epsilon / steps

    for step in range(steps):
        perturbed = batch + perturbation
        embedding = model(perturbed)

        similarity = torch.nn.functional.cosine_similarity(
            embedding, original_embedding, dim=1
        ).mean()

        similarity.backward()

        with torch.no_grad():
            grad = perturbation.grad
            perturbation.data = perturbation.data - step_size * grad.sign()
            perturbation.data = torch.clamp(perturbation.data, -epsilon, epsilon)
            perturbation.grad.zero_()

    with torch.no_grad():
        final = batch + perturbation
        final_embedding = model(final)
        sim = torch.nn.functional.cosine_similarity(
            final_embedding, original_embedding, dim=1
        ).mean().item()
        print(f"[SSCD] PGD complete: {steps} steps, epsilon={epsilon}, self-sim={sim:.4f}")

    return perturbation.detach()


def apply_perturbation_to_video(original_video_path, perturbation, output_path):
    """
    Apply the averaged perturbation as an FFmpeg grainmerge overlay on the full video.
    Preserves original duration, fps, and audio.
    """
    avg_delta = perturbation.mean(dim=0)  # [3, 288, 288]

    std = torch.tensor(IMAGENET_STD).view(3, 1, 1)
    pixel_delta = avg_delta * std * 255  # convert to [0,255] pixel-space delta

    # grainmerge: output = A + B - 128, so B = 128 + delta
    overlay_tensor = (128.0 + pixel_delta).clamp(0, 255)
    overlay_np = overlay_tensor.permute(1, 2, 0).numpy().astype(np.uint8)

    overlay_path = os.path.join(os.path.dirname(output_path), "overlay.png")
    Image.fromarray(overlay_np).save(overlay_path)

    probe = subprocess.run(
        ['ffprobe', '-v', 'quiet', '-select_streams', 'v:0',
         '-show_entries', 'stream=width,height', '-of', 'csv=p=0',
         original_video_path],
        capture_output=True, text=True
    )
    width, height = probe.stdout.strip().split(',')

    has_audio = False
    audio_probe = subprocess.run(
        ['ffprobe', '-v', 'quiet', '-select_streams', 'a',
         '-show_entries', 'stream=codec_type', '-of', 'csv=p=0',
         original_video_path],
        capture_output=True, text=True
    )
    if audio_probe.stdout.strip():
        has_audio = True

    filter_str = (
        f'[1:v]scale={width}:{height}:flags=bilinear[noise];'
        f'[0:v][noise]blend=all_mode=grainmerge:shortest=1[v]'
    )

    cmd = [
        'ffmpeg', '-y',
        '-i', original_video_path,
        '-loop', '1', '-i', overlay_path,
        '-filter_complex', filter_str,
        '-map', '[v]',
    ]

    if has_audio:
        cmd.extend(['-map', '0:a', '-c:a', 'copy'])

    cmd.extend([
        '-c:v', 'libx264', '-preset', 'fast', '-crf', '17',
        '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
        output_path
    ])

    subprocess.run(cmd, check=True, capture_output=True, text=True)
    print(f"[SSCD] Applied perturbation overlay to full video ({width}x{height})")


def handle_compare(body):
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

    model = get_model()

    with tempfile.TemporaryDirectory() as tmpdir:
        original_path = os.path.join(tmpdir, "original.mp4")
        modified_path = os.path.join(tmpdir, "modified.mp4")
        original_frames_dir = os.path.join(tmpdir, "original_frames")
        modified_frames_dir = os.path.join(tmpdir, "modified_frames")
        os.makedirs(original_frames_dir)
        os.makedirs(modified_frames_dir)

        download_from_s3_url(original_url, original_path)
        download_from_s3_url(modified_url, modified_path)

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


def handle_perturb(body):
    video_url = body.get('video_url')
    output_key = body.get('output_key')

    if not video_url or not output_key:
        return {
            'statusCode': 400,
            'body': json.dumps({'error': 'video_url and output_key are required'})
        }

    epsilon = float(body.get('epsilon', 0.15))
    steps = int(body.get('steps', 10))
    max_seconds = int(body.get('max_seconds', 5))
    fps = int(body.get('fps', 1))

    bucket, _ = parse_s3_url(video_url)
    model = get_model()

    with tempfile.TemporaryDirectory() as tmpdir:
        video_path = os.path.join(tmpdir, "input.mp4")
        frames_dir = os.path.join(tmpdir, "frames")
        output_path = os.path.join(tmpdir, "perturbed.mp4")
        os.makedirs(frames_dir)

        download_from_s3_url(video_url, video_path)
        frame_paths = extract_frames(video_path, frames_dir, max_seconds, fps)

        if not frame_paths:
            return {
                'statusCode': 200,
                'body': json.dumps({
                    'success': False,
                    'error': 'Could not extract frames from video',
                })
            }

        perturbation = compute_perturbation(frame_paths, model, epsilon=epsilon, steps=steps)

        if perturbation is None:
            return {
                'statusCode': 200,
                'body': json.dumps({
                    'success': False,
                    'error': 'Perturbation computation failed',
                })
            }

        apply_perturbation_to_video(video_path, perturbation, output_path)
        upload_to_s3(output_path, bucket, output_key)

        return {
            'statusCode': 200,
            'body': json.dumps({
                'success': True,
                'output_key': output_key,
                'frames_sampled': len(frame_paths),
                'epsilon': epsilon,
                'steps': steps,
            })
        }


def handler(event, context):
    print(f"[SSCD] Received event: {json.dumps(event)}")

    try:
        body = event.get('body')
        if isinstance(body, str):
            body = json.loads(body)
        elif body is None:
            body = event

        mode = body.get('mode', 'compare')

        if mode == 'perturb':
            return handle_perturb(body)
        else:
            return handle_compare(body)

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
