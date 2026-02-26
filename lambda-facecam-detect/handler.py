import json
import tempfile
import os
from typing import Dict, Any

from shared import download_from_s3, get_video_info, get_face_detector
from facecam import handle_facecam
from multi_face import handle_multi_face


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

        with tempfile.NamedTemporaryFile(suffix='.mp4', delete=False) as tmp:
            video_path = tmp.name

        try:
            print(f"[FACECAM-DETECT] Downloading video from {video_url}")
            download_from_s3(video_url, video_path)

            duration, frame_w, frame_h = get_video_info(video_path)
            print(f"[FACECAM-DETECT] Video: {duration:.1f}s, {frame_w}x{frame_h}, mode={mode}")

            if mode == 'multi-face':
                print("[FACECAM-DETECT] Loading SSD face detector for multi-face...")
                net = get_face_detector()
                return handle_multi_face(net, video_path, frame_w, frame_h, context)

            # Facecam detection (3-layer: variance map → YuNet → motion)
            return handle_facecam(video_path, frame_w, frame_h, context)
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
