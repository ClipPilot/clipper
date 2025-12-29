# Lambda function to expire unsaved clips older than 7 days
# Runs daily at 3 AM UTC via EventBridge
# Single Lambda for all environments (shares S3 bucket)

# TEMPORARY: Import existing resources into Terraform state
# Remove these import blocks after successful apply
import {
  to = aws_ecr_repository.expire_clips_lambda
  id = "clipster-expire-clips-lambda"
}

import {
  to = aws_iam_role.expire_clips_lambda
  id = "clipster-expire-clips-lambda-role"
}

import {
  to = aws_cloudwatch_log_group.expire_clips_lambda
  id = "/aws/lambda/clipster-expire-clips"
}

import {
  to = aws_lambda_function.expire_clips
  id = "clipster-expire-clips"
}

import {
  to = aws_cloudwatch_event_rule.expire_clips_schedule
  id = "clipster-expire-clips-schedule"
}

import {
  to = aws_cloudwatch_event_target.expire_clips_target
  id = "clipster-expire-clips-schedule/expire-clips-lambda"
}

import {
  to = aws_lambda_permission.allow_eventbridge_expire_clips
  id = "clipster-expire-clips/AllowEventBridgeInvoke"
}

# ECR Repository for Expire Clips Lambda
resource "aws_ecr_repository" "expire_clips_lambda" {
  name                 = "${var.project_name}-expire-clips-lambda"
  image_tag_mutability = "MUTABLE"
  force_delete         = true

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Name = "${var.project_name}-expire-clips-lambda"
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
  name = "${var.project_name}-expire-clips-lambda-role"

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
    Name = "${var.project_name}-expire-clips-lambda-role"
  }
}

# Lambda basic execution policy
resource "aws_iam_role_policy_attachment" "expire_clips_lambda_basic" {
  role       = aws_iam_role.expire_clips_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# S3 access policy for Expire Clips Lambda (both staging and prod buckets)
resource "aws_iam_role_policy" "expire_clips_lambda_s3" {
  name = "${var.project_name}-expire-clips-lambda-s3-policy"
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

# Expire Clips Lambda Function
resource "aws_lambda_function" "expire_clips" {
  function_name = "${var.project_name}-expire-clips"
  role          = aws_iam_role.expire_clips_lambda.arn
  package_type  = "Image"
  image_uri     = "${aws_ecr_repository.expire_clips_lambda.repository_url}:latest"
  timeout       = 300
  memory_size   = 512

  environment {
    variables = {
      S3_BUCKET    = "${var.project_name}-videos-prod-${data.aws_caller_identity.current.account_id}"
      DATABASE_URL = var.database_url
    }
  }

  depends_on = [
    aws_iam_role_policy_attachment.expire_clips_lambda_basic,
    aws_iam_role_policy.expire_clips_lambda_s3
  ]

  lifecycle {
    ignore_changes = [image_uri]
  }

  tags = {
    Name = "${var.project_name}-expire-clips"
  }
}

# CloudWatch Log Group for Expire Clips Lambda
resource "aws_cloudwatch_log_group" "expire_clips_lambda" {
  name              = "/aws/lambda/${var.project_name}-expire-clips"
  retention_in_days = 14

  tags = {
    Name = "${var.project_name}-expire-clips-logs"
  }
}

# EventBridge Rule - Run daily at 3 AM UTC
resource "aws_cloudwatch_event_rule" "expire_clips_schedule" {
  name                = "${var.project_name}-expire-clips-schedule"
  description         = "Trigger expire-clips Lambda daily at 3 AM UTC"
  schedule_expression = "cron(0 3 * * ? *)"

  tags = {
    Name = "${var.project_name}-expire-clips-schedule"
  }
}

# EventBridge Target - Connect rule to Lambda
resource "aws_cloudwatch_event_target" "expire_clips_target" {
  rule      = aws_cloudwatch_event_rule.expire_clips_schedule.name
  target_id = "expire-clips-lambda"
  arn       = aws_lambda_function.expire_clips.arn
}

# Permission for EventBridge to invoke Lambda
resource "aws_lambda_permission" "allow_eventbridge_expire_clips" {
  statement_id  = "AllowEventBridgeInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.expire_clips.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.expire_clips_schedule.arn
}
