# S3 Bucket for Video Processing
# Always create the environment-specific bucket (keeps existing buckets intact)
resource "aws_s3_bucket" "videos" {
  bucket = "${var.project_name}-videos-${var.environment}-${data.aws_caller_identity.current.account_id}"

  tags = {
    Name = "${var.project_name}-videos-${var.environment}"
  }
}

locals {
  # Use shared bucket if specified, otherwise use the environment's own bucket
  s3_bucket_id  = var.shared_s3_bucket != "" ? var.shared_s3_bucket : aws_s3_bucket.videos.id
  s3_bucket_arn = var.shared_s3_bucket != "" ? "arn:aws:s3:::${var.shared_s3_bucket}" : aws_s3_bucket.videos.arn
}

# S3 Bucket Versioning
resource "aws_s3_bucket_versioning" "videos" {
  bucket = aws_s3_bucket.videos.id

  versioning_configuration {
    status = "Enabled"
  }
}

# S3 Bucket Encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "videos" {
  bucket = aws_s3_bucket.videos.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# S3 Bucket Public Access Block
resource "aws_s3_bucket_public_access_block" "videos" {
  bucket = aws_s3_bucket.videos.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# S3 Bucket Lifecycle Policy
# Note: IA storage classes require minimum 30 days for transition
resource "aws_s3_bucket_lifecycle_configuration" "videos" {
  bucket = aws_s3_bucket.videos.id

  # Raw videos → Glacier Deep Archive after 1 day (cheapest long-term storage)
  rule {
    id     = "archive-raw-videos-to-glacier"
    status = "Enabled"

    filter {
      prefix = "raw-videos/"
    }

    transition {
      days          = 1
      storage_class = "DEEP_ARCHIVE"
    }

    # Delete after 1 year in Glacier
    expiration {
      days = 365
    }
  }

  # Blank clips (clean videos for editing) → One Zone-IA after 30 days
  # These are accessed occasionally for re-editing but don't need multi-AZ redundancy
  rule {
    id     = "transition-blank-clips-to-one-zone"
    status = "Enabled"

    filter {
      prefix = "blank-clips/"
    }

    transition {
      days          = 30
      storage_class = "ONEZONE_IA"
    }
  }

  # Generated clips stay in Standard (frequently accessed by users)
  # Transition to One Zone-IA after 30 days, stay there indefinitely
  rule {
    id     = "transition-generated-clips"
    status = "Enabled"

    filter {
      prefix = "generated-clips/"
    }

    transition {
      days          = 30
      storage_class = "ONEZONE_IA"
    }
  }

  # Watermarked clips (preview versions) → One Zone-IA after 30 days
  rule {
    id     = "transition-watermarked-clips"
    status = "Enabled"

    filter {
      prefix = "watermarked-clips/"
    }

    transition {
      days          = 30
      storage_class = "ONEZONE_IA"
    }

    # Delete watermarked clips after 60 days (users should have downloaded by then)
    expiration {
      days = 60
    }
  }

  # SRT files → One Zone-IA after 30 days (small files, rarely accessed)
  rule {
    id     = "transition-srt-files"
    status = "Enabled"

    filter {
      prefix = "srt-files/"
    }

    transition {
      days          = 30
      storage_class = "ONEZONE_IA"
    }
  }

  # Thumbnails → One Zone-IA after 30 days
  rule {
    id     = "transition-thumbnails"
    status = "Enabled"

    filter {
      prefix = "thumbnails/"
    }

    transition {
      days          = 30
      storage_class = "ONEZONE_IA"
    }
  }

  # ============================================
  # TEMPORARY FILES - Delete quickly
  # ============================================

  # Temp face detection files → Delete after 1 day
  rule {
    id     = "expire-temp-face-detect"
    status = "Enabled"

    filter {
      prefix = "temp-face-detect/"
    }

    expiration {
      days = 1
    }
  }

  # Temp scene detection files → Delete after 1 day
  rule {
    id     = "expire-temp-scene-detect"
    status = "Enabled"

    filter {
      prefix = "temp-scene-detect/"
    }

    expiration {
      days = 1
    }
  }

  # Face swap temporary files → Delete after 1 day
  rule {
    id     = "expire-face-swap-temp"
    status = "Enabled"

    filter {
      prefix = "teams/"
    }

    expiration {
      days = 1
    }
  }

  # ============================================
  # UGC CONTENT - Transition to cheaper storage
  # ============================================

  # UGC product images → One Zone-IA after 30 days, delete after 90 days
  rule {
    id     = "lifecycle-ugc-products"
    status = "Enabled"

    filter {
      prefix = "ugc-products/"
    }

    transition {
      days          = 30
      storage_class = "ONEZONE_IA"
    }

    expiration {
      days = 90
    }
  }

  # UGC final videos → One Zone-IA after 30 days, NO EXPIRATION
  rule {
    id     = "archive-ugc-final-videos"
    status = "Enabled"

    filter {
      prefix = "ugc-videos/"
    }

    transition {
      days          = 30
      storage_class = "ONEZONE_IA"
    }
  }

  # UGC intermediate scene videos → Delete after 7 days
  rule {
    id     = "expire-ugc-temp-scenes"
    status = "Enabled"

    filter {
      prefix = "ugc-temp-scenes/"
    }

    expiration {
      days = 7
    }
  }

  # UGC audio (TTS files) → Delete after 30 days
  # Note: No transition to IA - minimum 30 days required, same as expiration
  rule {
    id     = "lifecycle-ugc-audio"
    status = "Enabled"

    filter {
      prefix = "ugc-audio/"
    }

    expiration {
      days = 30
    }
  }

  # ============================================
  # AI GENERATED ASSETS - Keep but archive
  # ============================================

  # Character images → One Zone-IA after 30 days
  rule {
    id     = "transition-characters"
    status = "Enabled"

    filter {
      prefix = "characters/"
    }

    transition {
      days          = 30
      storage_class = "ONEZONE_IA"
    }
  }

  # Scene images → Delete after 30 days
  # Note: No transition to IA - minimum 30 days required, same as expiration
  rule {
    id     = "lifecycle-scene-images"
    status = "Enabled"

    filter {
      prefix = "scene-images/"
    }

    expiration {
      days = 30
    }
  }

  # ============================================
  # FACE-SWAP OUTPUTS - Keep indefinitely
  # ============================================

  # ComfyUI outputs (face-swap final videos) → One Zone-IA after 30 days, NO EXPIRATION
  rule {
    id     = "archive-comfy-outputs"
    status = "Enabled"

    filter {
      prefix = "comfy-outputs/"
    }

    transition {
      days          = 30
      storage_class = "ONEZONE_IA"
    }
  }
}

# CORS Configuration for S3
resource "aws_s3_bucket_cors_configuration" "videos" {
  bucket = aws_s3_bucket.videos.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST", "DELETE", "HEAD"]
    allowed_origins = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

# Data source for AWS account ID
data "aws_caller_identity" "current" {}
