# Lambda function to expire unsaved clips older than 7 days
# Runs daily at 3 AM UTC via EventBridge

# ECR Repository for Expire Clips Lambda
resource "aws_ecr_repository" "expire_clips_lambda" {
  name                 = "${var.project_name}-expire-clips-lambda-${var.environment}"
  image_tag_mutability = "MUTABLE"
  force_delete         = true

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Name = "${var.project_name}-expire-clips-lambda-${var.environment}"
  }
}

resource "aws_ecr_lifecycle_policy" "expire_clips_lambda" {
  repository = aws_ecr_repository.expire_clips_lambda.name

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

# IAM Role for Expire Clips Lambda
resource "aws_iam_role" "expire_clips_lambda" {
  name = "${var.project_name}-expire-clips-lambda-role-${var.environment}"

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

  tags = {
    Name = "${var.project_name}-expire-clips-lambda-role-${var.environment}"
  }
}

# Lambda basic execution policy
resource "aws_iam_role_policy_attachment" "expire_clips_lambda_basic" {
  role       = aws_iam_role.expire_clips_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# S3 access policy for Expire Clips Lambda (environment-specific bucket)
resource "aws_iam_role_policy" "expire_clips_lambda_s3" {
  name = "${var.project_name}-expire-clips-lambda-s3-policy-${var.environment}"
  role = aws_iam_role.expire_clips_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:CopyObject"
        ]
        Resource = [
          "arn:aws:s3:::${var.project_name}-videos-${var.environment}-${data.aws_caller_identity.current.account_id}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "s3:ListBucket"
        ]
        Resource = [
          "arn:aws:s3:::${var.project_name}-videos-${var.environment}-${data.aws_caller_identity.current.account_id}"
        ]
      }
    ]
  })
}

# Secrets Manager access for DATABASE_URL
resource "aws_iam_role_policy" "expire_clips_lambda_secrets" {
  name = "${var.project_name}-expire-clips-lambda-secrets-policy-${var.environment}"
  role = aws_iam_role.expire_clips_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = [
          aws_secretsmanager_secret.database_url.arn
        ]
      }
    ]
  })
}

# Expire Clips Lambda Function
resource "aws_lambda_function" "expire_clips" {
  function_name = "${var.project_name}-expire-clips-${var.environment}"
  role          = aws_iam_role.expire_clips_lambda.arn
  package_type  = "Image"
  image_uri     = "${aws_ecr_repository.expire_clips_lambda.repository_url}:latest"
  timeout       = 300 # 5 minutes
  memory_size   = 512

  environment {
    variables = {
      S3_BUCKET    = "${var.project_name}-videos-${var.environment}-${data.aws_caller_identity.current.account_id}"
      DATABASE_URL = var.database_url
    }
  }

  depends_on = [
    aws_iam_role_policy_attachment.expire_clips_lambda_basic,
    aws_iam_role_policy.expire_clips_lambda_s3,
    aws_iam_role_policy.expire_clips_lambda_secrets
  ]

  lifecycle {
    ignore_changes = [image_uri]
  }

  tags = {
    Name = "${var.project_name}-expire-clips-${var.environment}"
  }
}

# CloudWatch Log Group for Expire Clips Lambda
resource "aws_cloudwatch_log_group" "expire_clips_lambda" {
  name              = "/aws/lambda/${var.project_name}-expire-clips-${var.environment}"
  retention_in_days = 14

  tags = {
    Name = "${var.project_name}-expire-clips-logs-${var.environment}"
  }
}

# EventBridge Rule - Run daily at 3 AM UTC
resource "aws_cloudwatch_event_rule" "expire_clips_schedule" {
  name                = "${var.project_name}-expire-clips-schedule-${var.environment}"
  description         = "Trigger expire-clips Lambda daily at 3 AM UTC (${var.environment})"
  schedule_expression = "cron(0 3 * * ? *)"

  tags = {
    Name = "${var.project_name}-expire-clips-schedule-${var.environment}"
  }
}

# EventBridge Target - Connect rule to Lambda
resource "aws_cloudwatch_event_target" "expire_clips_target" {
  rule      = aws_cloudwatch_event_rule.expire_clips_schedule.name
  target_id = "expire-clips-lambda-${var.environment}"
  arn       = aws_lambda_function.expire_clips.arn
}

# Permission for EventBridge to invoke Lambda
resource "aws_lambda_permission" "allow_eventbridge_expire_clips" {
  statement_id  = "AllowEventBridgeInvoke-${var.environment}"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.expire_clips.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.expire_clips_schedule.arn
}
