# YouTube Lambda Downloader

AWS Lambda function for downloading YouTube videos and uploading to S3.

## Current Status

**Not fully working** - YouTube has aggressive bot detection that blocks yt-dlp without additional measures.

## The Problem

YouTube requires either:

1. Cookies from a logged-in browser session (expire every 2-4 weeks)
2. PO (Proof of Origin) tokens (complex to generate)
3. A proxy service that handles bot detection

## Solution: Use a Proxy Service

The most reliable approach is using a residential proxy service like **ZenRows**, **Bright Data**, or **SmartProxy**.

### Example Implementation (from working code):

```python
import yt_dlp

ydl_opts = {
    'proxy': 'https://USER:PASS@superproxy.zenrows.com:1338',
    'format': 'bestaudio/best',
    'outtmpl': '/tmp/video.mp4',
    'retries': 3,
    'socket_timeout': 30,
    'quiet': False,
}

with yt_dlp.YoutubeDL(ydl_opts) as ydl:
    ydl.download(youtube_url)
```

### Proxy Services

| Service     | Starting Price | Notes                                |
| ----------- | -------------- | ------------------------------------ |
| ZenRows     | ~$49/month     | Used in production, handles CAPTCHAs |
| Bright Data | ~$15/month     | Large proxy network                  |
| SmartProxy  | ~$14/month     | Good for scraping                    |
| IPRoyal     | ~$7/month      | Budget option                        |

## Setup Instructions

### 1. Get Proxy Credentials

Sign up for a proxy service (e.g., ZenRows) and get your credentials.

### 2. Update handler.py

Add proxy to the yt-dlp options:

```python
def get_yt_dlp_args():
    return [
        '--proxy', 'https://USER:PASS@proxy.example.com:PORT',
        '--no-check-certificates',
        '--geo-bypass',
    ]
```

### 3. (Optional) Add Cookies

For extra reliability, export cookies from your browser:

1. Install "Get cookies.txt LOCALLY" Chrome extension
2. Go to youtube.com while logged in
3. Export cookies to `cookies.txt`
4. Place in this directory

The Dockerfile will automatically include it if present.

### 4. Deploy

```bash
./bootstrap.sh
```

Or push to main/staging to trigger GitHub Actions.

## Environment Variables

Set in Lambda via Terraform:

- `S3_BUCKET_STAGING` - Staging S3 bucket name
- `S3_BUCKET_PROD` - Production S3 bucket name

## API

### Get Video Info

```json
POST /
{
  "action": "info",
  "url": "https://youtube.com/watch?v=VIDEO_ID"
}
```

### Download Video

```json
POST /
{
  "action": "download",
  "url": "https://youtube.com/watch?v=VIDEO_ID",
  "teamId": 123,
  "environment": "staging"
}
```

## Resources

- [yt-dlp Documentation](https://github.com/yt-dlp/yt-dlp)
- [yt-dlp Bot Detection Issue](https://github.com/yt-dlp/yt-dlp/issues/10128)
- [PO Token Guide](https://github.com/yt-dlp/yt-dlp/wiki/PO-Token-Guide)
- [Cookies FAQ](https://github.com/yt-dlp/yt-dlp/wiki/FAQ#how-do-i-pass-cookies-to-yt-dlp)
  import tempfile
  from uuid import uuid4

import yt_dlp
import os
import time

from posthog import Posthog
from urllib.parse import urlparse
from uuid_extensions import uuid7
from transcribe.common import ssm
from transcribe.common.logger import logger
from transcribe.common.util import create_text_blocks
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api.proxies import GenericProxyConfig
from transcribe.services.video import video_transcribe_deepgram

POSTHOG_API_KEY = ssm.get('/posthog/api-key')
posthog = Posthog(POSTHOG_API_KEY, host='https://app.posthog.com')

ytt_api = YouTubeTranscriptApi(
proxy_config=GenericProxyConfig(
http_url=superproxy.zenrows.com:1338',
https_url=
)
)

def is_short_youtube_url(url):
parsed_url = urlparse(url)

    if parsed_url.netloc == 'youtu.be' and parsed_url.path:
        return True
    else:
        return False

def youtube_video_get_transcript(video_url):
start_time = time.time() # Start the timer
distinct_id = str(uuid7())

    try:
        if is_short_youtube_url(video_url):
            parsed_url = urlparse(video_url)
            video_id = parsed_url.path[1:]
            video_url = f"https://www.youtube.com/watch?v={video_id}"

        video_id = video_url.split('v=')[1]
        transcript = ytt_api.fetch(video_id)

        text = ""

        for snippet in transcript:
            text += snippet.text + " "

        output = create_text_blocks(text)

        duration = time.time() - start_time  # Calculate the duration
        posthog.capture(distinct_id, 'youtube_transcribe_time', {'time': str(duration), 'video_url': video_url, '$process_person_profile': False})

        return output
    except Exception as e:
        logger.exception(e)
        logger.warn(f"Unable to download transcript for Youtube video: {e}", extra={"metadata": {"video_url": video_url}})

        return youtube_download(video_url)

def youtube_download(youtube_url):
start_time = time.time() # Start the timer
distinct_id = str(uuid7())

    logger.info("Beginning download of youtube video")

    temp_file_path = os.path.join(tempfile.gettempdir(), f"{uuid4()}.mp4")

    try:
        ydl_opts = {
            'proxy': 'proxy',
            'format': 'bestaudio/best',
            'outtmpl': temp_file_path,
            'retries': 3,
            'socket_timeout': 30,
            'quiet': False,
        }

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download(youtube_url)

        transcript = video_transcribe_deepgram(temp_file_path, "", is_local=True)

        if not transcript:
            logger.info(f"Transcription is empty for video {youtube_url}")

        duration = time.time() - start_time  # Calculate the duration
        posthog.capture(distinct_id, 'youtube_download_time', {'time': str(duration), 'video_url': youtube_url, '$process_person_profile': False})

        return transcript

    finally:
        if os.path.exists(temp_file_path):
            try:
                os.remove(temp_file_path)
                logger.debug(f"Temporary file {temp_file_path} removed")
            except Exception as e:
                logger.error(f"Failed to remove temporary file {temp_file_path}: {e}")
