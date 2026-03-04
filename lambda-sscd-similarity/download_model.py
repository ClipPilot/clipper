"""
Build-time script to download the SSCD (Self-Supervised Copy Detection) model.
Run during Docker build to bake the model into the image for fast Lambda cold starts.
"""
import os
import urllib.request
import torch

MODEL_URL = "https://dl.fbaipublicfiles.com/sscd-copy-detection/sscd_disc_mixup.torchscript.pt"
MODEL_DIR = "/var/task/models"
MODEL_PATH = os.path.join(MODEL_DIR, "sscd_disc_mixup.torchscript.pt")


def download_model():
    os.makedirs(MODEL_DIR, exist_ok=True)

    print(f"[SSCD] Downloading model from {MODEL_URL}")
    urllib.request.urlretrieve(MODEL_URL, MODEL_PATH)

    file_size = os.path.getsize(MODEL_PATH) / (1024 * 1024)
    print(f"[SSCD] Downloaded model: {file_size:.1f} MB")

    # Verify the model loads correctly
    print("[SSCD] Verifying model loads with torch.jit.load()...")
    model = torch.jit.load(MODEL_PATH, map_location="cpu")
    model.eval()
    print("[SSCD] Model verified successfully")


if __name__ == "__main__":
    download_model()
