# ECR Repository for YouTube Lambda
resource "aws_ecr_repository" "youtube_lambda" {
  name                 = "${var.project_name}-youtube-lambda"
  image_tag_mutability = "MUTABLE"
  force_delete         = true

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_lifecycle_policy" "youtube_lambda" {
  repository = aws_ecr_repository.youtube_lambda.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep last 5 images"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = 5
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}

# IAM Role for YouTube Lambda
resource "aws_iam_role" "youtube_lambda" {
  name = "${var.project_name}-youtube-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

# Lambda basic execution policy
resource "aws_iam_role_policy_attachment" "youtube_lambda_basic" {
  role       = aws_iam_role.youtube_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# S3 access policy for YouTube Lambda (both staging and prod buckets)
resource "aws_iam_role_policy" "youtube_lambda_s3" {
  name = "${var.project_name}-youtube-lambda-s3-policy"
  role = aws_iam_role.youtube_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:DeleteObject"
        ]
        Resource = [
          "arn:aws:s3:::${var.project_name}-videos-staging-${data.aws_caller_identity.current.account_id}/*",
          "arn:aws:s3:::${var.project_name}-videos-prod-${data.aws_caller_identity.current.account_id}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "s3:ListBucket"
        ]
        Resource = [
          "arn:aws:s3:::${var.project_name}-videos-staging-${data.aws_caller_identity.current.account_id}",
          "arn:aws:s3:::${var.project_name}-videos-prod-${data.aws_caller_identity.current.account_id}"
        ]
      }
    ]
  })
}

# YouTube Lambda Function
resource "aws_lambda_function" "youtube_downloader" {
  function_name = "${var.project_name}-youtube-downloader"
  role          = aws_iam_role.youtube_lambda.arn
  package_type  = "Image"
  image_uri     = "${aws_ecr_repository.youtube_lambda.repository_url}:latest"
  timeout       = 900
  memory_size   = 2048

  environment {
    variables = {
      S3_BUCKET_STAGING = "${var.project_name}-videos-staging-${data.aws_caller_identity.current.account_id}"
      S3_BUCKET_PROD    = "${var.project_name}-videos-prod-${data.aws_caller_identity.current.account_id}"
      AWS_REGION_NAME   = var.aws_region
    }
  }

  ephemeral_storage {
    size = 10240
  }

  depends_on = [
    aws_iam_role_policy_attachment.youtube_lambda_basic,
    aws_iam_role_policy.youtube_lambda_s3
  ]

  lifecycle {
    ignore_changes = [image_uri]
  }
}

# Lambda Function URL (public HTTP endpoint)
resource "aws_lambda_function_url" "youtube_downloader" {
  function_name      = aws_lambda_function.youtube_downloader.function_name
  authorization_type = "NONE"

  cors {
    allow_origins  = ["*"]
    allow_methods  = ["*"]
    allow_headers  = ["*"]
    expose_headers = ["*"]
    max_age        = 3600
  }
}

# CloudWatch Log Group for YouTube Lambda
resource "aws_cloudwatch_log_group" "youtube_lambda" {
  name              = "/aws/lambda/${var.project_name}-youtube-downloader"
  retention_in_days = 14
}
