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
resource "aws_s3_bucket_lifecycle_configuration" "videos" {
  bucket = aws_s3_bucket.videos.id

  rule {
    id     = "delete-raw-videos-after-2-months"
    status = "Enabled"

    filter {
      prefix = "raw-videos/"
    }

    expiration {
      days = 60
    }
  }

  rule {
    id     = "transition-generated-clips"
    status = "Enabled"

    filter {
      prefix = "generated-clips/"
    }

    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 90
      storage_class = "GLACIER"
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
