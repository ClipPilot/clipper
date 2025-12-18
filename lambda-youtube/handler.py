import json
import os
import subprocess
import uuid
import boto3
import re

s3_client = boto3.client('s3')

S3_BUCKET_STAGING = os.environ.get('S3_BUCKET_STAGING')
S3_BUCKET_PROD = os.environ.get('S3_BUCKET_PROD')

YOUTUBE_PATTERNS = [
    r'^(https?://)?(www\.)?youtube\.com/watch\?v=[\w-]+',
    r'^(https?://)?(www\.)?youtube\.com/shorts/[\w-]+',
    r'^(https?://)?youtu\.be/[\w-]+',
    r'^(https?://)?(www\.)?youtube\.com/embed/[\w-]+'
]

YT_DLP_COMMON_ARGS = [
    '--js-runtimes', 'nodejs',
    '--extractor-args', 'youtube:player_client=ios,web',
    '--no-check-certificates',
    '--geo-bypass',
]

def is_valid_youtube_url(url):
    return any(re.match(pattern, url) for pattern in YOUTUBE_PATTERNS)

def get_video_info(url):
    result = subprocess.run(
        ['yt-dlp', '--dump-json', '--no-download', '-f',
         'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
         *YT_DLP_COMMON_ARGS, url],
        capture_output=True,
        text=True,
        timeout=120
    )

    if result.returncode != 0:
        raise Exception(f"Failed to get video info: {result.stderr}")

    info = json.loads(result.stdout)
    return {
        'title': info.get('title', 'Unknown'),
        'duration': info.get('duration', 0),
        'filesize': info.get('filesize') or info.get('filesize_approx', 0),
        'thumbnail': info.get('thumbnail', ''),
        'uploader': info.get('uploader', 'Unknown')
    }

def download_video(url, output_path):
    result = subprocess.run(
        ['yt-dlp', '-f',
         'bestvideo[ext=mp4][height<=1080]+bestaudio[ext=m4a]/best[ext=mp4][height<=1080]/best[height<=1080]',
         '--merge-output-format', 'mp4',
         '-o', output_path,
         '--no-playlist',
         *YT_DLP_COMMON_ARGS, url],
        capture_output=True,
        text=True,
        timeout=600
    )

    if result.returncode != 0:
        raise Exception(f"Failed to download video: {result.stderr}")

    return output_path

def lambda_handler(event, context):
    try:
        if event.get('requestContext', {}).get('http', {}).get('method') == 'OPTIONS':
            return {
                'statusCode': 200,
                'headers': {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Api-Key'
                },
                'body': ''
            }

        body = event.get('body', '{}')
        if event.get('isBase64Encoded'):
            import base64
            body = base64.b64decode(body).decode('utf-8')

        data = json.loads(body)
        action = data.get('action', 'download')
        url = data.get('url')
        team_id = data.get('teamId')
        environment = data.get('environment', 'prod')

        if not url:
            return {
                'statusCode': 400,
                'headers': {'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'YouTube URL is required'})
            }

        if not is_valid_youtube_url(url):
            return {
                'statusCode': 400,
                'headers': {'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Invalid YouTube URL'})
            }

        if action == 'info':
            info = get_video_info(url)
            return {
                'statusCode': 200,
                'headers': {'Access-Control-Allow-Origin': '*'},
                'body': json.dumps(info)
            }

        if action == 'download':
            if not team_id:
                return {
                    'statusCode': 400,
                    'headers': {'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'teamId is required for download'})
                }

            bucket = S3_BUCKET_STAGING if environment == 'staging' else S3_BUCKET_PROD

            unique_id = str(uuid.uuid4())[:8]
            temp_path = f"/tmp/{unique_id}.mp4"

            download_video(url, temp_path)

            file_size = os.path.getsize(temp_path)
            s3_key = f"raw-videos/{team_id}/{unique_id}.mp4"

            s3_client.upload_file(temp_path, bucket, s3_key)

            os.remove(temp_path)

            return {
                'statusCode': 200,
                'headers': {'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({
                    's3Key': s3_key,
                    'fileName': f'{unique_id}.mp4',
                    'fileSize': file_size,
                    'bucket': bucket
                })
            }

        return {
            'statusCode': 400,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': f'Unknown action: {action}'})
        }

    except subprocess.TimeoutExpired:
        return {
            'statusCode': 504,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Video download timed out'})
        }
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)})
        }
