# Lambda function to sync virality targets via Apify
# Runs every 6 hours via EventBridge

# Import existing resources into state (remove these blocks after first successful apply)
import {
  to = aws_ecr_repository.virality_sync_lambda
  id = "clipster-virality-sync-lambda"
}

import {
  to = aws_iam_role.virality_sync_lambda
  id = "clipster-virality-sync-lambda-role"
}

import {
  to = aws_cloudwatch_log_group.virality_sync_lambda
  id = "/aws/lambda/clipster-virality-sync"
}

# ECR Repository for Virality Sync Lambda
resource "aws_ecr_repository" "virality_sync_lambda" {
  name                 = "${var.project_name}-virality-sync-lambda"
  image_tag_mutability = "MUTABLE"
  force_delete         = true

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Name = "${var.project_name}-virality-sync-lambda"
  }
}

resource "aws_ecr_lifecycle_policy" "virality_sync_lambda" {
  repository = aws_ecr_repository.virality_sync_lambda.name

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

# IAM Role for Virality Sync Lambda
resource "aws_iam_role" "virality_sync_lambda" {
  name = "${var.project_name}-virality-sync-lambda-role"

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
    Name = "${var.project_name}-virality-sync-lambda-role"
  }
}

# Lambda basic execution policy (CloudWatch Logs)
resource "aws_iam_role_policy_attachment" "virality_sync_lambda_basic" {
  role       = aws_iam_role.virality_sync_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Virality Sync Lambda Function
resource "aws_lambda_function" "virality_sync" {
  function_name = "${var.project_name}-virality-sync"
  role          = aws_iam_role.virality_sync_lambda.arn
  package_type  = "Image"
  image_uri     = "${aws_ecr_repository.virality_sync_lambda.repository_url}:latest"
  timeout       = 900
  memory_size   = 512

  environment {
    variables = {
      DATABASE_URL    = var.database_url
      APIFY_API_TOKEN = var.apify_api_token
    }
  }

  depends_on = [
    aws_iam_role_policy_attachment.virality_sync_lambda_basic
  ]

  lifecycle {
    ignore_changes = [image_uri]
  }

  tags = {
    Name = "${var.project_name}-virality-sync"
  }
}

# CloudWatch Log Group for Virality Sync Lambda
resource "aws_cloudwatch_log_group" "virality_sync_lambda" {
  name              = "/aws/lambda/${var.project_name}-virality-sync"
  retention_in_days = 14

  tags = {
    Name = "${var.project_name}-virality-sync-logs"
  }
}

# EventBridge Rule - Run every 6 hours
resource "aws_cloudwatch_event_rule" "virality_sync_schedule" {
  name                = "${var.project_name}-virality-sync-schedule"
  description         = "Trigger virality-sync Lambda every 6 hours"
  schedule_expression = "cron(0 */6 * * ? *)"

  tags = {
    Name = "${var.project_name}-virality-sync-schedule"
  }
}

# EventBridge Target - Connect rule to Lambda
resource "aws_cloudwatch_event_target" "virality_sync_target" {
  rule      = aws_cloudwatch_event_rule.virality_sync_schedule.name
  target_id = "virality-sync-lambda"
  arn       = aws_lambda_function.virality_sync.arn
}

# Permission for EventBridge to invoke Lambda
resource "aws_lambda_permission" "allow_eventbridge_virality_sync" {
  statement_id  = "AllowEventBridgeInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.virality_sync.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.virality_sync_schedule.arn
}
