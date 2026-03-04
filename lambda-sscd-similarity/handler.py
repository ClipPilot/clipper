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


def perturb_frames(frame_paths, model, epsilon=0.03, steps=10, step_size=0.005):
    """
    Apply PGD adversarial perturbation to frames to maximize SSCD embedding distance.
    Epsilon controls max pixel change (0.03 = ±8/255, invisible to humans).
    Returns list of perturbed PIL images.
    """
    tensors = []
    original_sizes = []
    for path in frame_paths:
        img = Image.open(path).convert("RGB")
        original_sizes.append(img.size)
        tensors.append(SSCD_TRANSFORM(img))

    if not tensors:
        return None

    batch = torch.stack(tensors)  # [N, 3, 288, 288]

    with torch.no_grad():
        original_embedding = model(batch)  # [N, 512]

    perturbation = torch.zeros_like(batch, requires_grad=True)

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

    print(f"[SSCD] PGD complete after {steps} steps, epsilon={epsilon}")

    with torch.no_grad():
        final = batch + perturbation
        final_embedding = model(final)
        sim = torch.nn.functional.cosine_similarity(
            final_embedding, original_embedding, dim=1
        ).mean().item()
        print(f"[SSCD] Post-perturbation self-similarity: {sim:.4f}")

    mean = torch.tensor(IMAGENET_MEAN).view(1, 3, 1, 1)
    std = torch.tensor(IMAGENET_STD).view(1, 3, 1, 1)

    perturbed_images = []
    for i in range(final.shape[0]):
        frame = final[i].detach()
        frame = frame * std.squeeze(0) + mean.squeeze(0)
        frame = torch.clamp(frame, 0, 1)
        frame_np = (frame.permute(1, 2, 0).numpy() * 255).astype(np.uint8)
        img = Image.fromarray(frame_np).resize(original_sizes[i], Image.LANCZOS)
        perturbed_images.append(img)

    return perturbed_images


def reassemble_video(original_video_path, perturbed_images, output_path, fps):
    """Replace frames in the original video with perturbed versions."""
    with tempfile.TemporaryDirectory() as framedir:
        for i, img in enumerate(perturbed_images):
            img.save(os.path.join(framedir, f"frame_{i:04d}.png"))

        frame_pattern = os.path.join(framedir, "frame_%04d.png")

        has_audio = False
        probe = subprocess.run(
            ['ffprobe', '-v', 'quiet', '-select_streams', 'a',
             '-show_entries', 'stream=codec_type', '-of', 'csv=p=0',
             original_video_path],
            capture_output=True, text=True
        )
        if probe.stdout.strip():
            has_audio = True

        cmd = [
            'ffmpeg', '-y',
            '-framerate', str(fps),
            '-i', frame_pattern,
        ]

        if has_audio:
            cmd.extend(['-i', original_video_path, '-map', '0:v', '-map', '1:a', '-shortest'])
        else:
            cmd.extend(['-map', '0:v'])

        cmd.extend([
            '-c:v', 'libx264', '-preset', 'fast', '-crf', '17',
            '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
            output_path
        ])

        if has_audio:
            cmd.extend(['-c:a', 'copy'])

        subprocess.run(cmd, check=True, capture_output=True, text=True)
        print(f"[SSCD] Reassembled perturbed video: {output_path}")


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

    epsilon = float(body.get('epsilon', 0.03))
    steps = int(body.get('steps', 10))
    max_seconds = int(body.get('max_seconds', DEFAULTS['max_seconds']))
    fps = int(body.get('fps', 2))

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

        perturbed_images = perturb_frames(frame_paths, model, epsilon=epsilon, steps=steps)

        if perturbed_images is None:
            return {
                'statusCode': 200,
                'body': json.dumps({
                    'success': False,
                    'error': 'Perturbation failed',
                })
            }

        reassemble_video(video_path, perturbed_images, output_path, fps)
        upload_to_s3(output_path, bucket, output_key)

        return {
            'statusCode': 200,
            'body': json.dumps({
                'success': True,
                'output_key': output_key,
                'frames_perturbed': len(perturbed_images),
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
